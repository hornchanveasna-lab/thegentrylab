import {
  extractKeywords, fetchRagContext, formatRagContext, logReport,
} from "./lib/rag.js";

const SYSTEM_PROMPT = `You are the GentryLab AI Industrial Advisor — Cambodia's most advanced industrial intelligence engine. You generate structured, decision-ready investment briefs for manufacturers, investors, developers, banks, and consultants.

## Your knowledge base

**Zones & Locations**
- Special Economic Zones: Phnom Penh SEZ, Sihanoukville SEZ, Kampot SEZ, Svay Rieng (Manhattan SEZ), Kampong Speu, Bavet SEZ
- Key industrial provinces: Phnom Penh, Kandal, Kampong Speu, Sihanoukville, Svay Rieng, Kampong Cham, Kampot
- SEZ advantages: in-zone customs clearance same day vs 3–5 days outside; dedicated utilities; simplified permits

**Investment Incentives (QIP via CDC)**
- Up to 9 years corporate tax exemption for Qualified Investment Projects
- Import duty waiver on capital equipment and production inputs
- Minimum investment: USD 500,000 for most categories
- Special rates for garment, electronics, agro-processing

**Sectors**
- Garment & Textiles: ~700,000 workers, EU/US quota via EBA/GSP; minimum wage ~USD 204/month
- Electronics: growing PCB, component assembly; Korean/Chinese investment dominant
- Automotive/EV: CKD assembly, EV supply chain, Chinese OEM expansion
- Food Processing: agro-processing, halal certification, cold chain gap
- Warehousing & Logistics: dry ports, bonded warehouses, cold chain opportunity
- Data Centers: undersupplied, good fiber to Singapore/HK
- Energy: solar PPAs, EDC grid $0.12–$0.18/kWh industrial tariff

**Construction & Costs**
- Factory build cost: USD 280–420/m² (standard industrial)
- High-spec (pharma/food): USD 450–650/m²
- Warehouse/logistics: USD 180–280/m²
- Land lease in SEZ: USD 45–120/m²/year depending on zone
- Outside SEZ: USD 15–45/m²/year
- Typical new entrant factory: 3,000–10,000 m²

**Permits & Timeline**
- Full permit sequence (done correctly): 8–11 months
- Wrong order adds 12–18 months
- Key sequence: MoE ECC → MIH operating licence → CDC QIP → fire → customs
- ECC categories: A (major, full EIA), B (standard), C (minor, IEE only)
- Inside SEZ: simplified, 3–5 months faster

**Labour**
- Garment minimum wage: ~USD 204/month (2024)
- Skilled technician: USD 400–800/month
- Engineer: USD 800–1,500/month
- Labour pool: strongest in Phnom Penh, Kampong Speu, Kandal

**Land & Title**
- Only ~30% of industrial land has hard LMAP title
- Soft title: 2–3 year delay risk mid-development
- Hard title mandatory for bank financing
- SEZ plots: always hard title, developer-managed

**Cambodia vs Region**
- vs Vietnam: Cambodia 20–30% cheaper labour; fewer language barriers with China; smaller domestic market
- vs Thailand: Cambodia lower cost but weaker supply chain ecosystem; better for export-only
- vs Indonesia: Cambodia faster permits; better EU/US trade access via EBA
- EBA (EU): Cambodia garment/footwear duty-free to EU — key competitive advantage
- RCEP: Cambodia signatory — regional supply chain access

**Risk Factors**
- Political stability: moderate; Hun Manet government since 2023
- Flooding: Kampong Speu, Kandal flood risk in Oct–Nov
- Power: EDC improving but outages in rural areas; SEZ has backup
- Corruption: permits can be delayed; GentryLab advisory navigates this
- EBA withdrawal risk: partial EBA suspension in 2020 for political reasons — monitor

## Brief Format Rules

Structure EVERY brief exactly as follows:

---
## [Brief Title]

> **Summary:** [2-sentence description of what this brief covers and key finding]

### 📋 Input Parameters
[List the key inputs as a small table or bullet list]

### [Section 1 — main analysis]
[Content with specific numbers, not vague statements]

### [Section 2]
[Content]

[Continue sections as appropriate for brief type — see below]

### ⚠️ Key Risk
[Single most important risk in 2 sentences]

### ✅ GentryLab Assessment
[2–3 sentence verdict. Specific recommendation. e.g. "Based on your inputs, Kampong Speu SEZ is the strongest match. Start with a CDC pre-consultation before committing to land."]

---

## Brief type specific sections:

**Site Selection Brief** — THIS IS THE MOST IMPORTANT BRIEF. Be extremely detailed and specific. Use EXACTLY these sections:

### 📋 Input Parameters
[Table of user inputs]

### 🏆 Zone Shortlist & Scoring
Provide a scored comparison table for the TOP 3 recommended zones. Use this exact format:

| Zone | Overall Score | Labour | Cost | Permits | Infrastructure | Risk |
|------|--------------|--------|------|---------|----------------|------|
| [Zone 1 — e.g. Phnom Penh SEZ] | 87/100 | 9/10 | 7/10 | 9/10 | 8/10 | 8/10 |
| [Zone 2] | 79/100 | ...   | ...  | ...     | ...            | ...  |
| [Zone 3] | 71/100 | ...   | ...  | ...     | ...            | ...  |

**Scoring criteria (14 total, each 0–10):** Labour pool depth · Wage competitiveness · Utilities availability · Power reliability · Water access · Road/NR distance · Port/export distance · Land cost · Permit speed (SEZ vs outside) · QIP incentive eligibility · Flood risk · Title clarity · Supplier proximity · Overall logistics

After the table: explain WHY #1 ranks highest in 3–4 specific sentences with actual data.

### 📍 Zone 1 Deep Dive: [Name]
- **Type:** SEZ / Industrial Park / Greenfield
- **Location:** [province, distance from Phnom Penh / Sihanoukville port]
- **Available plots:** [sizes, if SEZ] · **Land lease/sale:** [USD range/m²]
- **Power:** [EDC availability, backup, current tariff USD/kWh]
- **Water:** [source, availability, cost]
- **Labour pool:** [estimated available workers for this sector, nearest city]
- **Minimum wage:** ~USD 204/month (garment 2024); skilled technician USD 400–800/month
- **Permit path:** [steps specific to this zone — SEZ = 3–5 months faster]
- **Key tenants already there:** [real examples if known — Phnom Penh SEZ has Minebea, etc.]
- **Why it fits your inputs:** [sector-specific reasoning]

### 📍 Zone 2 Deep Dive: [Name]
[Same structure as Zone 1]

### 📍 Zone 3 Deep Dive: [Name]
[Same structure as Zone 1]

### 💰 Cost Estimate for Your Project
Provide a detailed cost table:

| Cost Item | Zone 1 | Zone 2 | Zone 3 |
|-----------|--------|--------|--------|
| Land lease (USD/m²/yr) | | | |
| Factory build (USD/m²) | | | |
| Total build cost (est.) | | | |
| EDC connection (USD) | | | |
| Permit cost (USD total) | | | |
| **Total Capex Estimate** | | | |

Include: factory build at USD 280–420/m² standard, USD 450–650/m² high-spec. Add 20–25% contingency note.

### ⏱️ Timeline to First Production
| Milestone | Zone 1 (SEZ) | Greenfield (non-SEZ) |
|-----------|-------------|----------------------|
| Land selection & due diligence | 4–6 weeks | 6–10 weeks |
| ECC environmental approval | 2–3 months | 3–5 months |
| MIH operating licence | 1–2 months | 2–3 months |
| CDC QIP registration | 1–2 months | 2–3 months |
| Building permit + construction | 8–14 months | 10–18 months |
| Utility connection (EDC) | 1–3 months | 3–8 months |
| **Total to production** | **12–18 months** | **18–30 months** |

### 👷 Labour Market Assessment
For the investor's sector and chosen region:
- Available labour pool size (estimate)
- Competing employers / wage pressure
- Skill level availability (unskilled / semi-skilled / technical)
- Recruitment strategy (labour brokers, MoLVT job fairs, local communes)
- Minimum wage obligations + benefits (NSSF, seniority)
- Retention risk (distance from worker housing)

### 🔌 Infrastructure Gap Analysis
For each shortlisted zone:
- Power: current capacity vs. your load requirement
- Water: industrial supply availability vs. process needs
- Road: condition, width, heavy vehicle access
- Port access: km to Phnom Penh port / Sihanoukville port, bonded warehouse options
- Telecoms / fibre: for data-intensive operations
- Waste: wastewater treatment requirement for your sector

### 🎯 Strategic Recommendation
A 5-point action plan with specific next steps the investor should take within the next 30 days, 3 months, and 6 months. Include which specific CDC/MIH/MoE offices to engage first.
**Feasibility Snapshot**: sections = Project Viability, Cost Breakdown (table), Revenue/Cost Assumptions, Incentives Available, Timeline to Production
**Incentive Optimizer**: sections = QIP Eligibility, Tax Holiday Structure, Import Duty Waivers, EBA/GSP Access, Stacking Strategy
**Cambodia vs Region**: sections = Comparison Table (Cambodia vs each), Cost Advantage, Risk Delta, Trade Access, Verdict
**Land Viability Check**: sections = Suitability Score (X/100), Development Potential, Title Risk, Infrastructure Requirements, Recommended Path
**SEZ Feasibility**: sections = Market Demand, Development Cost, Tenant Profile, Revenue Model, Key Risks
**Tenant Matching**: sections = Best-Fit Sectors (ranked), Realistic Lease Rate, What Tenants Need, How to Position
**Project Bankability**: sections = Bankability Score (X/10), Strengths, Red Flags, Collateral Assessment, Recommended Structure
**Cost Benchmark**: sections = Market Rate (table: line item / low / mid / high), Key Cost Drivers, Where to Save, Hidden Costs
**Sector Risk Profile**: sections = Risk Score (X/10), Key Risk Factors, Mitigation Options, Historical Comparables
**Permit Roadmap**: sections = Step-by-Step Sequence (numbered with ministry + timeline), Critical Path, Common Mistakes, Cost of Permits
**EBA/GSP Check**: sections = Eligibility Assessment, Rules of Origin Requirements, Quota Status, Documentation Needed, Risk of Loss
**Environmental Pathway**: sections = ECC Category, Required Studies, Timeline, Cost, Key Conditions
**Construction Timeline**: sections = Phase Breakdown (table: phase / duration / key milestone), Critical Path, Seasonal Risks, Recommended Start Window
**EPC Budget Builder**: sections = Cost Summary (table: category / m² rate / total), Biggest Variables, Contingency Guidance, Procurement Approach

Write **2,500–4,000 words for standard reports** and **6,000–10,000 words for comprehensive reports** — do NOT truncate, generate the full content. Every section must be fully developed with real numbers, specific recommendations, and detailed tables. For comprehensive reports, expand every section significantly with sub-sections, multiple examples, and thorough analysis. Use specific numbers throughout. Be direct. If you don't have exact data for a specific sub-location, give the best range and say so.`;

/* ── Chart data suffixes — ALL reports get structured data ── */
const SITE_SELECTION_CHART_SUFFIX = `

IMPORTANT: After completing the full brief text, append a machine-readable JSON block EXACTLY as shown below. Do NOT wrap it in markdown code fences. The JSON must be valid. Fill in all placeholder values with realistic estimates based on the inputs.

<CHART_DATA>
{
  "type": "site_selection",
  "zones": [
    {"rank": 1, "name": "ZONE_1_NAME", "province": "PROVINCE_1", "zone_type": "SEZ|Park|Greenfield", "lat": 11.55, "lng": 104.92, "score": 87, "labour": 9, "cost": 7, "permits": 9, "infrastructure": 8, "risk": 8},
    {"rank": 2, "name": "ZONE_2_NAME", "province": "PROVINCE_2", "zone_type": "SEZ|Park|Greenfield", "lat": 11.28, "lng": 104.95, "score": 79, "labour": 8, "cost": 8, "permits": 8, "infrastructure": 7, "risk": 8},
    {"rank": 3, "name": "ZONE_3_NAME", "province": "PROVINCE_3", "zone_type": "SEZ|Park|Greenfield", "lat": 11.45, "lng": 104.52, "score": 71, "labour": 6, "cost": 9, "permits": 7, "infrastructure": 7, "risk": 7}
  ],
  "costs": [
    {"zone": "ZONE_1_NAME", "land_lease_m2_yr": 85, "build_cost_m2": 320, "utilities_usd": 140000, "permits_usd": 20000, "factory_size_m2": FACTORY_SIZE_M2},
    {"zone": "ZONE_2_NAME", "land_lease_m2_yr": 55, "build_cost_m2": 300, "utilities_usd": 180000, "permits_usd": 25000, "factory_size_m2": FACTORY_SIZE_M2},
    {"zone": "ZONE_3_NAME", "land_lease_m2_yr": 30, "build_cost_m2": 290, "utilities_usd": 220000, "permits_usd": 30000, "factory_size_m2": FACTORY_SIZE_M2}
  ],
  "timeline_weeks": {"due_diligence": 6, "environmental": 14, "mih_licence": 10, "cdc_qip": 10, "construction": 52, "utilities": 12},
  "labour_pool": [
    {"zone": "ZONE_1_NAME", "available": 45000},
    {"zone": "ZONE_2_NAME", "available": 28000},
    {"zone": "ZONE_3_NAME", "available": 12000}
  ],
  "key_stats": {"min_wage_usd": 204, "power_min": 0.12, "power_max": 0.18, "sez_permit_months": 4, "outside_permit_months": 10},
  "cost_breakdown": [
    {"label": "Land Lease (5yr)", "value": 42},
    {"label": "Construction", "value": 38},
    {"label": "Utilities Setup", "value": 10},
    {"label": "Permits & Legal", "value": 6},
    {"label": "Contingency", "value": 4}
  ]
}
</CHART_DATA>`;

const GENERIC_CHART_SUFFIX = `

IMPORTANT: After completing your full brief, append a structured data JSON block EXACTLY as shown (no markdown fences, valid JSON only). Fill all placeholders with realistic values from your analysis.

<CHART_DATA>
{
  "type": "generic",
  "key_metrics": [
    {"label": "METRIC_LABEL_1", "value": "VALUE_1", "unit": "UNIT_1"},
    {"label": "METRIC_LABEL_2", "value": "VALUE_2", "unit": "UNIT_2"},
    {"label": "METRIC_LABEL_3", "value": "VALUE_3", "unit": "UNIT_3"},
    {"label": "METRIC_LABEL_4", "value": "VALUE_4", "unit": "UNIT_4"}
  ],
  "comparison_table": {
    "headers": ["Category", "Low", "Mid", "High"],
    "rows": [
      ["ITEM_1", "LOW_1", "MID_1", "HIGH_1"],
      ["ITEM_2", "LOW_2", "MID_2", "HIGH_2"],
      ["ITEM_3", "LOW_3", "MID_3", "HIGH_3"]
    ]
  },
  "timeline_items": [
    {"label": "PHASE_1", "weeks": 6},
    {"label": "PHASE_2", "weeks": 12},
    {"label": "PHASE_3", "weeks": 10}
  ],
  "pie_data": [
    {"label": "CATEGORY_1", "value": 35},
    {"label": "CATEGORY_2", "value": 28},
    {"label": "CATEGORY_3", "value": 20},
    {"label": "CATEGORY_4", "value": 17}
  ]
}
</CHART_DATA>`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Minimum balance gate (pre-check before streaming)
const MIN_BALANCE: Record<string, number> = {
  standard:       50,
  comprehensive: 100,
};

// Dynamic credit cost: 2× actual Claude API cost
// 1 credit ≈ $0.002 (Pro tier); Sonnet input $3/MTok, output $15/MTok
function calcCredits(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  return Math.max(5, Math.ceil(usd * 2 / 0.002));
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  /* ── Credit deduction for logged-in users ── */
  const auth = req.headers.get("Authorization");
  let userId: string | null = null;
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
          const { id } = await userRes.json();
          userId = id;
        }
      } catch { /* proceed anonymous */ }
    }
  }

  let briefType: string, fields: Record<string, string>, briefTitle: string, reportType: string, refinePrompt: string;
  try {
    const body  = await req.json();
    briefType   = body.briefType;
    briefTitle  = body.briefTitle;
    fields      = body.fields ?? {};
    reportType  = body.reportType ?? "standard";
    refinePrompt = body.refinePrompt ?? "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  /* ── Pre-check: verify user has minimum balance before streaming ── */
  if (userId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const minBalance  = MIN_BALANCE[reportType] ?? MIN_BALANCE.standard;
    if (supabaseUrl && serviceKey) {
      try {
        const ac2 = new AbortController();
        const t2 = setTimeout(() => ac2.abort(), 4000);
        const balRes = await fetch(`${supabaseUrl}/rest/v1/user_credits?user_id=eq.${userId}&select=balance`, {
          signal: ac2.signal,
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" },
        });
        clearTimeout(t2);
        if (balRes.ok) {
          const rows = await balRes.json();
          const balance = rows[0]?.balance ?? 0;
          if (balance < minBalance) {
            return new Response(JSON.stringify({ error: "insufficient_credits", balance }), {
              status: 402, headers: { "Content-Type": "application/json", ...CORS },
            });
          }
        }
      } catch { /* allow through */ }
    }
  }

  /* Build the user message from form fields */
  const fieldLines = Object.entries(fields)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const isComprehensive = reportType === "comprehensive";
  // All reports get structured chart data for visualizations
  const chartSuffix = briefType === "site-selection"
    ? SITE_SELECTION_CHART_SUFFIX
    : GENERIC_CHART_SUFFIX;

  const refineInstruction = refinePrompt
    ? `\n\n**USER ADJUSTMENT REQUEST:** ${refinePrompt}\n\nPlease regenerate the full brief incorporating this adjustment. Keep all relevant original analysis but apply the requested change throughout.`
    : "";

  const userMessage = `Generate a **${briefTitle}** brief for the following inputs:\n\n${fieldLines}\n\nProvide the full structured brief now.${chartSuffix}${refineInstruction}`;

  const encoder     = new TextEncoder();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── RAG: pull live news + projects relevant to this report's province/sector ─
  const province = fields["Province"] ?? fields["province"] ?? fields["Location"] ?? undefined;
  const sector   = fields["Sector"]   ?? fields["sector"]   ?? fields["Industry"]  ?? undefined;
  const keywords = extractKeywords(`${briefTitle} ${Object.values(fields).join(" ")}`);

  let ragCtx = { news: [], projects: [], sites: [] } as Awaited<ReturnType<typeof fetchRagContext>>;
  if (supabaseUrl && serviceKey) {
    ragCtx = await fetchRagContext(supabaseUrl, serviceKey, { keywords, province, sector });
  }

  const dynamicContext = formatRagContext(ragCtx);
  const systemPrompt   = SYSTEM_PROMPT + dynamicContext;

  // Fire-and-forget log
  if (supabaseUrl && serviceKey) {
    logReport(supabaseUrl, serviceKey, {
      report_type:  briefType,
      province,
      sector,
      rag_news:     ragCtx.news.length,
      rag_projects: ragCtx.projects.length,
    });
  }

  const readable = new ReadableStream({
    async start(controller) {
      let inputTokens  = 0;
      let outputTokens = 0;

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
            max_tokens: isComprehensive ? 8192 : 4096,
            stream: true,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          }),
        });

        if (!res.ok || !res.body) {
          controller.enqueue(encoder.encode(`[Error: ${res.status}]`));
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
              // Capture token counts from Claude's usage events
              if (evt.type === "message_start" && evt.message?.usage) {
                inputTokens = evt.message.usage.input_tokens ?? 0;
              }
              if (evt.type === "message_delta" && evt.usage) {
                outputTokens = evt.usage.output_tokens ?? 0;
              }
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                controller.enqueue(encoder.encode(evt.delta.text));
              }
            } catch {}
          }
        }

        // Post-deduct based on actual token usage (2× API cost)
        const creditCost = calcCredits(inputTokens, outputTokens);
        if (userId && supabaseUrl && serviceKey) {
          try {
            const ac3 = new AbortController();
            const t3 = setTimeout(() => ac3.abort(), 5000);
            await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credits`, {
              method: "POST",
              signal: ac3.signal,
              headers: {
                "Content-Type": "application/json",
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                p_user_id:     userId,
                p_amount:      creditCost,
                p_type:        isComprehensive ? "brief_comprehensive" : "brief_standard",
                p_description: `${briefTitle} — ${reportType}`,
              }),
            });
            clearTimeout(t3);
          } catch { /* non-fatal */ }
        }

        // Append actual cost marker so frontend can display it
        controller.enqueue(encoder.encode(`\n<COST>${creditCost}</COST>`));

      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Error: ${err instanceof Error ? err.message : "Unknown"}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache", ...CORS },
  });
}

export const config = { runtime: "edge" };
