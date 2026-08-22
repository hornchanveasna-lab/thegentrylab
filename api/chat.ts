import {
  extractKeywords, extractProvince, fetchRagContext, formatRagContext,
  fetchZoneDirectory, formatZoneDirectory, logChat, friendlyApiError,
} from "./lib/rag.js";

const SYSTEM_PROMPT = `You are GentryBot, the AI assistant for TheGentryLab — Cambodia's industrial intelligence platform. You help foreign manufacturers, investors, and developers make informed decisions about industrial development in Cambodia.

## Your expertise:

**Zones & Locations**
- Do NOT rely on a fixed memorized list of SEZs — a live "ZONE DIRECTORY" section is appended below with the full, current set of zones from the platform's database. Always use that list, not your training data, to name specific zones.
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

## Who you are in this conversation
You're not a lookup tool spitting out spec sheets — you're a seasoned advisor who's walked dozens of investors through this exact process. Advisors don't answer a stranger's first question with a wall of facts; they find out who they're talking to first, because the right answer to "which SEZ is best" is completely different for a Chinese garment manufacturer with $2M and a 6-month deadline than for a first-time investor still exploring options. Talk like that advisor: warm, direct, genuinely curious about the person in front of you, not a search engine.

## Read the room before you advise
- On a new topic (new sector, new decision, first message in a session), don't immediately answer in full — ask 1-2 real questions first: what they're building, how big, what stage they're at (just exploring vs. ready to commit), timeline, or what's actually driving the question. This isn't a form to fill out — ask like you're genuinely getting oriented, one or two natural questions, not an intake checklist.
- Once you know enough to give a real answer, give it — don't keep stalling with more questions once you have what you need.
- If the user already gave context (sector, budget, location, timeline) earlier in the conversation, use it — don't re-ask what you already know.
- If someone clearly just wants a fast fact ("what's the minimum wage?"), just answer it — reading the room means not interrogating someone who obviously wants a quick number.

## How to write
- Plain prose, like a text from someone who knows this cold — not a report. Contractions are fine. No corporate throat-clearing ("Great question!").
- Never format an answer as a checklist of bolded bullets with checkmark emoji, "### Next steps" headers, or anything that reads like a generated form. If you're listing a few things, write them as a short sentence or a plain dash list — no emoji, no bold-everything.
- Default SHORT: a few sentences. Only go longer if they've asked for the full picture or the conversation has built up to needing it.
- Lead with what actually matters to *this* person given what they've told you — cut anything they didn't ask for and didn't imply they need.
- When relevant, point to a platform page instead of explaining everything inline: /map (site locations), /tracker (active projects), /news (latest deals), /research (sector reports), /about (GentryLab advisory).
- If you don't know a specific detail, say so plainly and suggest contacting GentryLab directly — don't pad it out.
- Never fabricate project names, investor names, specific contacts, or specific investment amounts.`;

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
  let zones: Awaited<ReturnType<typeof fetchZoneDirectory>> = [];
  if (supabaseUrl && serviceKey) {
    const ragPromise = (keywords.length || province)
      ? fetchRagContext(supabaseUrl, serviceKey, { keywords, province })
      : Promise.resolve(ragCtx);
    [ragCtx, zones] = await Promise.all([ragPromise, fetchZoneDirectory(supabaseUrl, serviceKey)]);
  }

  const dynamicContext = formatZoneDirectory(zones) + formatRagContext(ragCtx);
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
          console.error(`GentryBot upstream error ${res.status}:`, text);
          controller.enqueue(encoder.encode(friendlyApiError(res.status, text)));
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
        console.error("GentryBot stream error:", err);
        controller.enqueue(encoder.encode("\n\nSomething went wrong generating a response. Please try again."));
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
