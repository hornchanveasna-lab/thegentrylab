/* Internal tool endpoint: turns one uploaded BOQ/schedule-style spreadsheet
 * into a proposed, unlimited-depth WBS folder tree (Zone → Building →
 * Floor → work category → ... — only as many levels as the sheet actually
 * has) with BOQ line items (description/unit/quantity/unit_cost) attached
 * to the correct leaf folder. This is the "one upload, AI analysis, create
 * everything together" endpoint — WBS + BOQ in a single pass.
 *
 * Not a public, credit-metered feature — an authenticated CM-app internal
 * tool, so no credit deduction and no streaming. It never touches the CM
 * Supabase project's tables itself: auth is verified against the CM
 * project's own auth server, already-parsed spreadsheet rows go to the AI
 * model, and the proposal comes back as one JSON response. All writes happen
 * client-side, after a human reviews and confirms.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_ROWS = 400;

const PROPOSE_WBS_TOOL = {
  name: "propose_wbs",
  description: "Propose an unlimited-depth WBS folder tree and the BOQ line items that belong under each leaf folder.",
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
      anomalies: {
        type: "array" as const,
        description: "Rows that were ambiguous, skipped, or look inconsistent (e.g. missing rate, unclear grouping, duplicate-looking line).",
        items: {
          type: "object" as const,
          properties: { message: { type: "string" } },
          required: ["message"],
        },
      },
    },
    required: ["nodes", "items", "anomalies"],
  },
};

const SYSTEM_PROMPT = `You are a construction cost engineer. You're given the raw rows of one uploaded spreadsheet (a Bill of Quantities, possibly with the project's physical/scope breakdown embedded in it — via indentation, outline numbering like "1.1.2", or dedicated columns such as Zone/Building/Floor/Area).

Your job: propose a Work Breakdown Structure — unlimited-depth folders that mirror whatever real structure the sheet shows (for example Project > Zone > Building > Floor > Work Category, but use exactly the levels the data supports, no more, no fewer), and attach every priced/quantified BOQ line to the correct leaf folder.

Rules:
- Read the sheet's own hierarchy signals first: outline/numbering columns, indentation implied by leading blank cells, section header rows (bold-looking rows with no quantity that just label a group), or explicit Zone/Building/Floor/Area columns. Don't impose a fixed template — some sheets are flat (one folder, e.g. just a discipline, then straight to items), others are deep.
- A "section header" row (a description with no quantity/rate) becomes a folder, not an item.
- Every row that has both a quantity and a rate (or clearly represents priced work) becomes an item under the nearest enclosing folder — never under a non-leaf folder that itself has sub-folders.
- If the sheet has no discernible hierarchy at all, propose a single root folder (level "Group") and put every item under it — don't fabricate structure that isn't there.
- Keep folder names short and matching the sheet's own wording.
- Call propose_wbs exactly once with your full proposal. Do not write any prose outside the tool call.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const auth = req.headers.get("Authorization");
  const cmSupabaseUrl = process.env.VITE_CM_SUPABASE_URL;
  const cmAnonKey = process.env.VITE_CM_SUPABASE_ANON_KEY;
  if (!auth?.startsWith("Bearer ") || !cmSupabaseUrl || !cmAnonKey) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  try {
    const userRes = await fetch(`${cmSupabaseUrl}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: cmAnonKey },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Auth check failed" }), {
      status: 401, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  let rows: (string | number)[][], sheetName: string;
  try {
    const body = await req.json();
    rows = Array.isArray(body.rows) ? body.rows : [];
    sheetName = typeof body.sheetName === "string" ? body.sheetName : "Sheet1";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "No rows to analyze" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  const truncated = rows.length > MAX_ROWS;
  const capped = rows.slice(0, MAX_ROWS);

  const userMessage = `Sheet "${sheetName}" — ${capped.length} rows${truncated ? ` (truncated from ${rows.length}; analyze what's here)` : ""}, as a JSON array of row arrays (each row's cells in column order):\n\n${JSON.stringify(capped)}\n\nPropose the WBS + BOQ items now.`;

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
      return new Response(JSON.stringify({ error: "AI request failed", detail: text }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const data = await res.json();
    const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");
    if (!toolUse) {
      return new Response(JSON.stringify({ error: "AI did not return a structured proposal" }), {
        status: 502, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const result = toolUse.input;
    if (truncated) {
      result.anomalies = [...(result.anomalies ?? []), { message: `Only the first ${MAX_ROWS} of ${rows.length} rows were analyzed — review the rest manually.` }];
    }
    return new Response(JSON.stringify(result), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

export const config = { runtime: "edge" };
