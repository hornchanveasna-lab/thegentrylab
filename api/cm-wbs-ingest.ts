/* Internal tool endpoint: turns one uploaded BOQ/schedule-style file
 * (spreadsheet or PDF, already parsed into row arrays client-side) into a
 * proposed, unlimited-depth WBS folder tree (Zone → Building → Floor → work
 * category → ... — only as many levels as the sheet actually has), the BOQ
 * line items attached to the right leaf folder, and a time-phased schedule
 * of activities attached to those same folders — using the file's own dates
 * when it has them, or general construction-sequencing knowledge bounded by
 * the project's start/end dates when it doesn't. WBS + BOQ + Schedule in a
 * single pass, one round trip.
 *
 * A per-project, credit-metered CM-app tool (not the public advisor) — costs
 * are calculated from actual token usage, same 2x-of-API-cost formula and
 * pre-check/post-charge shape as the public advisor endpoint, just billed
 * against the project's own `cm_ai_credits` balance instead of a site-wide
 * user account. It never touches the CM Supabase project's feature tables
 * itself beyond that credit ledger: auth is verified against the CM
 * project's own auth server, already-parsed rows go to the AI model, and the
 * proposal comes back as one JSON response. All WBS/BOQ/Schedule writes
 * happen client-side, after a human reviews and confirms.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_ROWS = 400;
const MIN_BALANCE = 50;
const STARTING_BALANCE = 2000;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

// Dynamic credit cost: 2x actual AI API cost. 1 credit ~= $0.002 (matches the
// public advisor's pricing so a credit means the same thing everywhere).
function calcCredits(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  return Math.max(5, Math.ceil((usd * 2) / 0.002));
}

async function cmRpc(cmSupabaseUrl: string, cmAnonKey: string, auth: string, fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${cmSupabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cmAnonKey, Authorization: auth },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const PROPOSE_WBS_TOOL = {
  name: "propose_wbs",
  description: "Propose an unlimited-depth WBS folder tree, the BOQ line items under each leaf folder, and a time-phased schedule of activities across the tree.",
  input_schema: {
    type: "object" as const,
    properties: {
      nodes: {
        type: "array" as const,
        description: "The proposed WBS tree, flattened, root-first. Only as many levels deep as the data actually supports — don't invent levels that aren't there.",
        items: {
          type: "object" as const,
          properties: {
            tempId: { type: "string", description: "A short unique id for this node, e.g. 'n1', 'n2a'." },
            parentTempId: { type: ["string", "null"], description: "tempId of the parent folder, or null for a root node." },
            name: { type: "string", description: "e.g. 'Zone A', 'Car Parking', 'Earth Work'." },
            level: { type: "string", description: "A short free-text label for what kind of grouping this is, e.g. 'Zone', 'Building', 'Floor', 'Discipline', 'Work Category'. Leave it generic ('Group') if unclear." },
          },
          required: ["tempId", "parentTempId", "name", "level"],
        },
      },
      items: {
        type: "array" as const,
        description: "BOQ line items, each attached to the leaf (deepest) folder it belongs under. Every priced/quantified row in the sheet should appear here exactly once.",
        items: {
          type: "object" as const,
          properties: {
            nodeTempId: { type: "string", description: "tempId of the leaf folder this item belongs to." },
            description: { type: "string" },
            unit: { type: ["string", "null"] },
            quantity: { type: "number" },
            unit_cost: { type: "number" },
            confidence: { type: "number", description: "0 to 1 — how confident the folder placement is." },
          },
          required: ["nodeTempId", "description", "quantity", "unit_cost", "confidence"],
        },
      },
      activities: {
        type: "array" as const,
        description: "Time-phased schedule activities, each attached to a WBS node (folder or leaf — a folder-level activity can represent a whole phase of that branch). Every WBS branch should end up covered by at least one dated activity.",
        items: {
          type: "object" as const,
          properties: {
            nodeTempId: { type: "string", description: "tempId of the WBS node (folder or leaf) this activity belongs to." },
            title: { type: "string" },
            plan_start: { type: "string", description: "ISO date YYYY-MM-DD." },
            plan_finish: { type: "string", description: "ISO date YYYY-MM-DD." },
            weight: { type: "number", description: "Relative weight for progress math — roughly proportional to this activity's share of total BOQ value." },
          },
          required: ["nodeTempId", "title", "plan_start", "plan_finish", "weight"],
        },
      },
      scheduleSource: {
        type: "string",
        enum: ["file", "inferred", "mixed"],
        description: "'file' if the sheet itself had usable start/finish dates for the activities, 'inferred' if none did and every date was derived from standard construction sequencing plus the given project window, 'mixed' if some activities came from the sheet and others were inferred.",
      },
      anomalies: {
        type: "array" as const,
        description: "Rows or scheduling decisions that were ambiguous, skipped, or look inconsistent (e.g. missing rate, unclear grouping, duplicate-looking line, dates outside the project window that had to be clamped).",
        items: {
          type: "object" as const,
          properties: { message: { type: "string" } },
          required: ["message"],
        },
      },
    },
    required: ["nodes", "items", "activities", "scheduleSource", "anomalies"],
  },
};

const SYSTEM_PROMPT = `You are a construction cost and planning engineer. You're given the raw rows of one uploaded file (a Bill of Quantities and/or a schedule, possibly with the project's physical/scope breakdown embedded in it — via indentation, outline numbering like "1.1.2", or dedicated columns such as Zone/Building/Floor/Area), plus the project's start and end dates.

Your job has three parts, in one pass:
1. Propose a Work Breakdown Structure — unlimited-depth folders that mirror whatever real structure the sheet shows (for example Project > Zone > Building > Floor > Work Category, but use exactly the levels the data supports, no more, no fewer).
2. Attach every priced/quantified BOQ line to the correct leaf folder.
3. Propose a time-phased schedule — one or more dated activities per WBS branch, so the whole tree ends up planned in time, not just costed.

WBS + BOQ rules:
- Read the sheet's own hierarchy signals first: outline/numbering columns, indentation implied by leading blank cells, section header rows (bold-looking rows with no quantity that just label a group), or explicit Zone/Building/Floor/Area columns. Don't impose a fixed template — some sheets are flat (one folder, e.g. just a discipline, then straight to items), others are deep.
- A "section header" row (a description with no quantity/rate) becomes a folder, not an item.
- Every row that has both a quantity and a rate (or clearly represents priced work) becomes an item under the nearest enclosing folder — never under a non-leaf folder that itself has sub-folders.
- If the sheet has no discernible hierarchy at all, propose a single root folder (level "Group") and put every item under it — don't fabricate structure that isn't there.
- Keep folder names short and matching the sheet's own wording.

Schedule rules:
- First check whether the sheet itself carries usable dates for the work (start/finish columns, a duration column, a "planned" date column). If it does, use those dates directly and set scheduleSource to "file" (or "mixed" if only part of the sheet has dates).
- If the sheet has no date information at all (a bare BOQ), propose the full schedule yourself using standard construction sequencing: site mobilization/preliminaries → earthworks/sitework → foundations → structural frame → envelope (roofing/cladding) → MEP rough-in → internal finishes → MEP fit-out and equipment → testing, commissioning and handover. Set scheduleSource to "inferred".
- Respect real dependency order — later phases start once the phases they depend on are meaningfully underway, not all starting on day one alongside earthworks.
- Every activity's plan_start and plan_finish must fall within the given project window. Compress or stretch generic phase durations to fit that window while keeping the relative sequence intact; note any date you had to clamp as an anomaly.
- If no project window is given, start from today's date and use realistic phase durations based on the total scope size instead of guessing an end date.
- Weight each branch's schedule duration roughly by its share of total BOQ value — bigger-value work gets proportionally more time or more parallel activities, not an equal slice.
- Every WBS branch should end up covered by at least one activity — don't leave scope untimed.

Call propose_wbs exactly once with your full proposal. Do not write any prose outside the tool call.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  const auth = req.headers.get("Authorization");
  const cmSupabaseUrl = process.env.VITE_CM_SUPABASE_URL;
  const cmAnonKey = process.env.VITE_CM_SUPABASE_ANON_KEY;
  if (!auth?.startsWith("Bearer ") || !cmSupabaseUrl || !cmAnonKey) return json({ error: "Not authenticated" }, 401);

  try {
    const userRes = await fetch(`${cmSupabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: cmAnonKey } });
    if (!userRes.ok) return json({ error: "Not authenticated" }, 401);
  } catch {
    return json({ error: "Auth check failed" }, 401);
  }

  let rows: (string | number)[][], sheetName: string, projectId: string, ownerId: string, projectStartDate: string | null, projectEndDate: string | null;
  try {
    const body = await req.json();
    rows = Array.isArray(body.rows) ? body.rows : [];
    sheetName = typeof body.sheetName === "string" ? body.sheetName : "Sheet1";
    projectId = typeof body.projectId === "string" ? body.projectId : "";
    ownerId = typeof body.ownerId === "string" ? body.ownerId : "";
    projectStartDate = typeof body.projectStartDate === "string" ? body.projectStartDate : null;
    projectEndDate = typeof body.projectEndDate === "string" ? body.projectEndDate : null;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (rows.length === 0) return json({ error: "No rows to analyze" }, 400);
  if (!projectId || !ownerId) return json({ error: "Missing projectId/ownerId" }, 400);

  /* ── Credit pre-check: ensure a ledger row exists and has enough balance
   *    to attempt a run, before spending anything on the AI call. ── */
  let balanceBefore: number;
  try {
    const credits = await cmRpc(cmSupabaseUrl, cmAnonKey, auth, "cm_ai_ensure_credits", {
      p_project_id: projectId, p_owner_id: ownerId, p_starting_balance: STARTING_BALANCE,
    });
    balanceBefore = credits.balance;
  } catch (err) {
    return json({ error: "Not authorized for this project's AI credits", detail: err instanceof Error ? err.message : String(err) }, 403);
  }
  if (balanceBefore < MIN_BALANCE) return json({ error: "insufficient_credits", balance: balanceBefore }, 402);

  const truncated = rows.length > MAX_ROWS;
  const capped = rows.slice(0, MAX_ROWS);

  const dateContext = projectStartDate || projectEndDate
    ? `Project window: ${projectStartDate ?? "unknown start"} to ${projectEndDate ?? "unknown end"}.`
    : "No project start/end date was provided — use today's date as the schedule start and propose realistic phase durations.";

  const userMessage = `Sheet "${sheetName}" — ${capped.length} rows${truncated ? ` (truncated from ${rows.length}; analyze what's here)` : ""}, as a JSON array of row arrays (each row's cells in column order):\n\n${JSON.stringify(capped)}\n\n${dateContext}\n\nPropose the WBS + BOQ items + schedule now.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        tools: [PROPOSE_WBS_TOOL],
        tool_choice: { type: "tool", name: "propose_wbs" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: "AI request failed", detail: text }, 502);
    }

    const data = await res.json();
    const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");
    if (!toolUse) return json({ error: "AI did not return a structured proposal" }, 502);

    const result = toolUse.input;
    if (truncated) {
      result.anomalies = [...(result.anomalies ?? []), { message: `Only the first ${MAX_ROWS} of ${rows.length} rows were analyzed — review the rest manually.` }];
    }

    /* ── Post-charge based on actual token usage — only once we know the
     *    call succeeded, so a failed/empty run never gets billed. ── */
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const creditCost = calcCredits(inputTokens, outputTokens);
    let creditsRemaining = balanceBefore - creditCost;
    try {
      const credits = await cmRpc(cmSupabaseUrl, cmAnonKey, auth, "cm_ai_charge_credits", {
        p_project_id: projectId, p_amount: creditCost, p_input_tokens: inputTokens, p_output_tokens: outputTokens,
        p_tool: "wbs_schedule_ingest", p_description: `${sheetName} (${capped.length} rows)`,
      });
      creditsRemaining = credits.balance;
    } catch { /* non-fatal — proposal still returned, ledger just won't reflect this run */ }

    return json({ ...result, creditsCharged: creditCost, creditsRemaining }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}

export const config = { runtime: "edge" };
