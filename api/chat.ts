import Anthropic from "@anthropic-ai/sdk";

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
- Key permits: MoE ECC → MIH operating licence → CDC QIP → fire → customs

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
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
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const config = { runtime: "edge" };
