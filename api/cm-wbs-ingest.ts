/* Internal tool endpoint: proposes a Work Breakdown Structure (phases →
 * packages → activities) from a project's already-parsed BOQ and Schedule
 * rows, plus which existing rows should attach to which proposed node.
 *
 * Unlike api/advisor.ts this is not a public, credit-metered feature — it's
 * an authenticated CM-app internal tool, so there's no credit deduction and
 * no streaming. It never touches the CM Supabase project's tables itself:
 * auth is verified against the CM project's own auth server, structured
 * rows go to Claude, and the proposal comes back as one JSON response. All
 * writes happen client-side, after a human reviews and confirms.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface BOQRow {
  id: string;
  description: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  unit_cost: number;
}

interface ScheduleRow {
  id: string;
  title: string;
  group_label: string;
  boq_category: string | null;
}

const PROPOSE_WBS_TOOL = {
  name: "propose_wbs",
  description: "Propose a Work Breakdown Structure tree and assign existing BOQ/Schedule rows to it.",
  input_schema: {
    type: "object" as const,
    properties: {
      nodes: {
        type: "array" as const,
        description: "The proposed WBS tree, flattened. Root nodes have parentTempId: null.",
        items: {
          type: "object" as const,
          properties: {
            tempId: { type: "string", description: "A short unique id for this node, e.g. 'p1', 'pkg1a'." },
            parentTempId: { type: ["string", "null"], description: "tempId of the parent node, or null for a root phase." },
            name: { type: "string" },
            level: { type: "string", enum: ["phase", "package", "activity"] },
            code: { type: ["string", "null"] },
          },
          required: ["tempId", "parentTempId", "name", "level"],
        },
      },
      assignments: {
        type: "array" as const,
        description: "Which existing BOQ/Schedule row attaches to which proposed node.",
        items: {
          type: "object" as const,
          properties: {
            itemType: { type: "string", enum: ["boq", "schedule"] },
            itemId: { type: "string", description: "The id of the existing BOQ or Schedule row." },
            nodeTempId: { type: "string" },
            confidence: { type: "number", description: "0 to 1." },
          },
          required: ["itemType", "itemId", "nodeTempId", "confidence"],
        },
      },
      anomalies: {
        type: "array" as const,
        description: "Rows that look inconsistent or don't fit cleanly (e.g. cost/progress mismatch, ambiguous category).",
        items: {
          type: "object" as const,
          properties: {
            itemType: { type: "string", enum: ["boq", "schedule"] },
            itemId: { type: "string" },
            message: { type: "string" },
          },
          required: ["itemType", "itemId", "message"],
        },
      },
    },
    required: ["nodes", "assignments", "anomalies"],
  },
};

const SYSTEM_PROMPT = `You are a construction cost/schedule analyst. Given a flat list of BOQ (Bill of Quantities) lines and Schedule activities from one construction project, propose a Work Breakdown Structure (WBS) that organizes the work into a shallow tree — phases at the top, packages under phases, activities under packages (skip levels where the project is small) — and assign every input row to the most appropriate node.

Rules:
- Prefer grouping by existing BOQ "category" / schedule "group_label" / "boq_category" values where they're consistent — don't invent structure that ignores the data's own hints.
- Keep the tree shallow: most projects need 3-8 phases, a handful of packages each.
- Every BOQ row and every Schedule row must appear exactly once in "assignments".
- Set confidence lower (below 0.6) when a row's category is missing, vague, or conflicts with its description.
- Flag an anomaly when a schedule activity's boq_category doesn't match any BOQ category, or a BOQ line's cost looks inconsistent with similar lines (e.g. wildly different unit_cost for the same unit/description pattern).
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

  let boqItems: BOQRow[], scheduleItems: ScheduleRow[];
  try {
    const body = await req.json();
    boqItems = Array.isArray(body.boqItems) ? body.boqItems : [];
    scheduleItems = Array.isArray(body.scheduleItems) ? body.scheduleItems : [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  if (boqItems.length === 0 && scheduleItems.length === 0) {
    return new Response(JSON.stringify({ error: "No BOQ or Schedule rows to analyze" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const userMessage = `BOQ rows (${boqItems.length}):\n${JSON.stringify(boqItems)}\n\nSchedule rows (${scheduleItems.length}):\n${JSON.stringify(scheduleItems)}\n\nPropose the WBS now.`;

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

    return new Response(JSON.stringify(toolUse.input), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

export const config = { runtime: "edge" };
