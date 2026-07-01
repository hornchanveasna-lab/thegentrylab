import {
  extractKeywords, extractProvince, fetchRagContext, formatRagContext,
  logChat,
} from "./lib/rag.js";

const SYSTEM_PROMPT = `You are GentryBot, the AI assistant for TheGentryLab — Cambodia's industrial intelligence platform. You help foreign manufacturers, investors, and developers make informed decisions about industrial development in Cambodia.

## Your expertise:

**Zones & Locations**
- Special Economic Zones: Phnom Penh SEZ, Sihanoukville SEZ, Kampot SEZ, Svay Rieng (Manhattan SEZ), Kampong Speu
- Key industrial provinces: Phnom Penh, Kandal, Kampong Speu, Sihanoukville, Svay Rieng, Kampong Cham
- SEZ advantages: in-zone customs clearance (same day vs 3–5 days outside), dedicated utilities, simplified permits

**Investment Incentives (QIP via CDC)**
- Up to 9 years corporate tax exemption for Qualified Investment Projects
- Import duty waiver on capital equipment and production inputs
- Minimum investment threshold: USD 500,000 for most categories

**Sectors**
- Garment & Textiles: largest sector, ~700,000 workers, EU/US quota access via EBA/GSP
- Electronics: growing PCB, component assembly; major Korean/Chinese investment
- Automotive/EV: CKD assembly, EV supply chain, Chinese OEM expansion
- Food Processing: agro-processing, halal certification opportunities
- Warehousing & Logistics: dry ports, bonded warehouses, cold chain gap
- Data Centers: undersupplied market, good fiber connectivity to Singapore/Hong Kong
- Energy: solar PPAs, EDC grid at $0.12–0.18/kWh industrial tariff

**Construction & Costs**
- Factory build cost: USD 280–420/m² (standard industrial)
- Land lease in SEZ: USD 45–120/m²/year depending on zone and location
- Typical factory size for new entrant: 3,000–10,000 m²

**Permits & Timeline**
- Full permit sequence (done correctly): 8–11 months
- Common mistakes add 12–18 months: wrong permit order, soft-title land, rejected masterplan
- Key permits: MoE ECC → MISTI operating licence → CDC QIP → fire → customs

**Labour**
- Garment minimum wage: ~USD 204/month
- Skilled technician: USD 400–800/month
- Labour disputes: consult VGCL/CCAWDU channels; EBA compliance critical for EU export

## How to respond:
- Be concise and decision-focused — users are evaluating whether to invest
- Lead with the most actionable fact
- When relevant, direct users to platform pages: /map (site locations), /tracker (active projects), /news (latest deals), /research (sector reports), /about (GentryLab advisory)
- If you don't know a specific detail, say so and recommend they contact GentryLab directly
- Never fabricate project names, investor names, or specific investment amounts`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CHAT_CREDIT_COST = 20; // credits per chat message (300% markup on ~$0.006 API cost)

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  /* ── Logged-in user: verify JWT + deduct credits ── */
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 4000);
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: auth, apikey: serviceKey },
          signal: ac.signal,
        });
        clearTimeout(t);
        if (userRes.ok) {
          const { id: userId } = await userRes.json();
          const ac2 = new AbortController();
          const t2 = setTimeout(() => ac2.abort(), 4000);
          const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
            method: "POST",
            signal: ac2.signal,
            headers: {
              "Content-Type": "application/json",
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              p_user_id:    userId,
              p_amount:     CHAT_CREDIT_COST,
              p_type:       "chat",
              p_description: "Chat message",
            }),
          });
          clearTimeout(t2);
          if (rpcRes.ok) {
            const result = await rpcRes.json();
            if (result.success === false) {
              return new Response(JSON.stringify({ error: "insufficient_credits", balance: result.balance }), {
                status: 402, headers: { "Content-Type": "application/json", ...CORS },
              });
            }
          }
        }
      } catch {
        /* Auth check failed — allow through */
      }
    }
  }

  let messages: { role: "user" | "assistant"; content: string }[];
  let sessionId: string | undefined;
  try {
    const body = await req.json();
    messages   = body.messages;
    sessionId  = body.session_id;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  // ── RAG: inject live Supabase context before sending to Claude ─────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
  const keywords    = extractKeywords(lastUserMsg);
  const province    = extractProvince(lastUserMsg) ?? undefined;

  let ragCtx = { news: [], projects: [], sites: [] } as Awaited<ReturnType<typeof fetchRagContext>>;
  if (supabaseUrl && serviceKey && (keywords.length || province)) {
    ragCtx = await fetchRagContext(supabaseUrl, serviceKey, { keywords, province });
  }

  const dynamicContext = formatRagContext(ragCtx);
  const systemPrompt   = SYSTEM_PROMPT + dynamicContext;

  // Fire-and-forget log (never awaited, never blocks)
  if (supabaseUrl && serviceKey && lastUserMsg) {
    logChat(supabaseUrl, serviceKey, {
      session_id:   sessionId,
      user_message: lastUserMsg.slice(0, 500),
      keywords,
      rag_news:     ragCtx.news.length,
      rag_projects: ragCtx.projects.length,
      rag_sites:    ragCtx.sites.length,
    });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            stream: true,
            system: systemPrompt,
            messages,
          }),
        });

        if (!res.ok || !res.body) {
          const text = await res.text();
          controller.enqueue(encoder.encode(`[Error: ${res.status} ${text}]`));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const evt = JSON.parse(data);
              if (
                evt.type === "content_block_delta" &&
                evt.delta?.type === "text_delta"
              ) {
                controller.enqueue(encoder.encode(evt.delta.text));
              }
            } catch {}
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      ...CORS,
    },
  });
}

export const config = { runtime: "edge" };
