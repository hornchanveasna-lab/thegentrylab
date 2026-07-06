/**
 * rag.ts — Retrieval-Augmented Generation helper
 *
 * Queries Supabase (news, projects, sites) for content relevant to the
 * current user query / report inputs, then formats it as injected context
 * for the Claude system prompt. This makes every AI response aware of
 * the platform's live data — new deals, new sites, recent news.
 *
 * Design rules:
 *  - Hard 3 s timeout: RAG must never block the AI stream
 *  - Graceful fallback: if Supabase is unreachable, returns empty context
 *  - Service role key used (bypasses RLS) — never exposed to client
 */

// ── User-facing message for an Anthropic API failure. Never surface the raw
//    status/body to end users — it can leak billing details, internal error
//    shapes, or other things a visitor shouldn't see. ─────────────────────────
export function friendlyApiError(status: number, rawBody: string): string {
  const lower = rawBody.toLowerCase();
  if (lower.includes("credit balance is too low")) {
    return "GentryBot is temporarily unavailable while we top up service capacity. Please try again shortly, or contact us directly via the Contact page.";
  }
  if (status === 429 || lower.includes("rate_limit")) {
    return "GentryBot is handling a lot of requests right now. Please wait a moment and try again.";
  }
  if (status === 529 || lower.includes("overloaded")) {
    return "GentryBot is temporarily overloaded. Please try again in a moment.";
  }
  return "Something went wrong generating a response. Please try again, or contact us directly if this keeps happening.";
}

// ── Stop-words filtered out of keyword extraction ───────────────────────────
const STOP = new Set([
  "what","where","when","which","does","have","this","that","with","from","they",
  "will","been","more","also","than","into","about","some","would","there","their",
  "should","could","cambodia","cambodian","invest","investment","industrial","industry",
  "factory","plant","zone","area","province","region","please","tell","give","show",
]);

// ── Cambodia province name map (common spellings → canonical) ────────────────
const PROVINCES = [
  "Phnom Penh","Kandal","Kampong Speu","Sihanoukville","Preah Sihanouk",
  "Svay Rieng","Kampong Cham","Kampot","Siem Reap","Battambang",
  "Koh Kong","Banteay Meanchey","Stung Treng","Prey Veng","Pursat",
];

export interface RagNews {
  headline: string; date: string; sector: string; province: string; summary: string; url: string;
}
export interface RagProject {
  name: string; sector: string; province: string; status: string;
  investor: string; origin: string; summary: string;
}
export interface RagSite {
  name: string; kind: string; province: string; status?: string; notes?: string;
}
export interface RagResult {
  news:     RagNews[];
  projects: RagProject[];
  sites:    RagSite[];
}
export interface ZoneEntry {
  name: string; kind: string; province: string;
  status?: string; size?: string; utilities?: string; road?: string;
  notes?: string; targetIndustries?: string[]; eip_tier?: string;
}

// ── Extract meaningful keywords from user message ────────────────────────────
export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (w.length > 4 && !STOP.has(w) && !seen.has(w)) {
      seen.add(w);
      out.push(w);
      if (out.length >= 6) break;
    }
  }
  return out;
}

// ── Detect province mentions in text ────────────────────────────────────────
export function extractProvince(text: string): string | null {
  const lower = text.toLowerCase();
  return PROVINCES.find(p => lower.includes(p.toLowerCase())) ?? null;
}

// ── Low-level fetch against Supabase REST ────────────────────────────────────
async function sbGet<T>(
  url: string, serviceKey: string, signal: AbortSignal
): Promise<T[]> {
  try {
    const r = await fetch(url, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept:        "application/json",
      },
      signal,
    });
    if (!r.ok) return [];
    return (await r.json()) as T[];
  } catch {
    return [];
  }
}

// ── Build PostgREST OR filter for multiple keywords across multiple columns ──
function orFilter(cols: string[], keywords: string[]): string {
  const parts = cols.flatMap(c => keywords.map(k => `${c}.ilike.*${encodeURIComponent(k)}*`));
  return `or=(${parts.join(",")})`;
}

// ── Main fetch ───────────────────────────────────────────────────────────────
export async function fetchRagContext(
  supabaseUrl: string,
  serviceKey:  string,
  opts: {
    keywords?: string[];   // from chat message
    province?: string;     // structured (advisor)
    sector?:   string;     // structured (advisor)
  },
): Promise<RagResult> {
  const { keywords = [], province, sector } = opts;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3000);

  try {
    const base = `${supabaseUrl}/rest/v1`;

    // ── NEWS: keyword OR province OR sector match, newest first ──────────────
    const newsFilters: string[] = [];
    if (keywords.length)  newsFilters.push(orFilter(["headline","summary"], keywords));
    if (province)         newsFilters.push(`province.ilike.*${encodeURIComponent(province)}*`);
    if (sector)           newsFilters.push(`sector.ilike.*${encodeURIComponent(sector)}*`);

    const newsOr = newsFilters.length
      ? `or=(${newsFilters.map(f => f.replace(/^or=\(|\)$/g, "")).join(",")})&`
      : "";

    // ── PROJECTS: same approach ───────────────────────────────────────────────
    const projFilters: string[] = [];
    if (keywords.length) projFilters.push(orFilter(["name","summary"], keywords));
    if (province)        projFilters.push(`province.ilike.*${encodeURIComponent(province)}*`);
    if (sector)          projFilters.push(`sector.ilike.*${encodeURIComponent(sector)}*`);

    const projOr = projFilters.length
      ? `or=(${projFilters.map(f => f.replace(/^or=\(|\)$/g, "")).join(",")})&`
      : "";

    // ── SITES: keyword OR province match ─────────────────────────────────────
    const siteFilters: string[] = [];
    if (keywords.length) siteFilters.push(orFilter(["name","province"], keywords));
    if (province)        siteFilters.push(`province.ilike.*${encodeURIComponent(province)}*`);

    const siteOr = siteFilters.length
      ? `or=(${siteFilters.map(f => f.replace(/^or=\(|\)$/g, "")).join(",")})&`
      : "";

    // Run all three fetches in parallel
    const [news, projects, sites] = await Promise.all([
      newsFilters.length || sector || province
        ? sbGet<RagNews>(
            `${base}/news?${newsOr}order=date.desc&limit=6&select=headline,date,sector,province,summary,url`,
            serviceKey, ac.signal,
          )
        : Promise.resolve<RagNews[]>([]),

      projFilters.length
        ? sbGet<RagProject>(
            `${base}/projects?${projOr}order=updated.desc&limit=6&select=name,sector,province,status,investor,origin,summary`,
            serviceKey, ac.signal,
          )
        : Promise.resolve<RagProject[]>([]),

      siteFilters.length
        ? sbGet<RagSite>(
            `${base}/sites?${siteOr}limit=5&select=name,kind,province,status,notes`,
            serviceKey, ac.signal,
          )
        : Promise.resolve<RagSite[]>([]),
    ]);

    return { news, projects, sites };
  } finally {
    clearTimeout(timer);
  }
}

// ── Zone directory: the FULL current SEZ/industrial-park list, always
//    injected (not keyword-filtered) so the model reasons over every zone
//    that exists right now — including ones added after this code was
//    written — instead of a hardcoded name list baked into the prompt. ──
export async function fetchZoneDirectory(
  supabaseUrl: string, serviceKey: string,
): Promise<ZoneEntry[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3000);
  try {
    const rows = await sbGet<Record<string, unknown>>(
      `${supabaseUrl}/rest/v1/sites?layer=eq.investment&kind=in.(sez,park)` +
      `&select=name,kind,province,status,size,utilities,road,notes,target_industries,eip_tier&order=name`,
      serviceKey, ac.signal,
    );
    return rows.map((r) => ({
      name:             r.name as string,
      kind:             r.kind as string,
      province:         r.province as string,
      status:           r.status as string | undefined,
      size:             r.size as string | undefined,
      utilities:        r.utilities as string | undefined,
      road:             r.road as string | undefined,
      notes:            r.notes as string | undefined,
      targetIndustries: r.target_industries as string[] | undefined,
      eip_tier:         r.eip_tier as string | undefined,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function formatZoneDirectory(zones: ZoneEntry[]): string {
  if (!zones.length) return "";
  const lines: string[] = [
    "",
    "## 🏭 ZONE DIRECTORY — live, from the platform database (authoritative — supersedes any zone list you were trained on)",
    "",
    "This is the FULL current list of Special Economic Zones and industrial parks in Cambodia. Only recommend zones from this list. New zones are added here as they come online — do not assume this list is fixed.",
    "",
  ];
  for (const z of zones) {
    const bits = [
      z.status,
      z.size ? `${z.size}` : null,
      z.utilities,
      z.road,
    ].filter(Boolean).join(" · ");
    const industries = z.targetIndustries?.length ? ` Targets: ${z.targetIndustries.join(", ")}.` : "";
    const tier = z.eip_tier ? ` [EIP Tier: ${z.eip_tier}]` : "";
    lines.push(`- **${z.name}** (${z.kind === "sez" ? "SEZ" : "Industrial Park"}, ${z.province}${bits ? ` · ${bits}` : ""})${tier}: ${z.notes ?? "No notes on file."}${industries}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ── Format context block for injection into system prompt ────────────────────
export function formatRagContext(ctx: RagResult): string {
  if (!ctx.news.length && !ctx.projects.length && !ctx.sites.length) return "";

  const lines: string[] = [
    "",
    "## 🔴 LIVE PLATFORM DATA — use this to answer accurately (fetched from Supabase right now)",
    "",
  ];

  if (ctx.news.length) {
    lines.push("### Recent News");
    for (const n of ctx.news) {
      lines.push(`- [${n.date}] **${n.headline}** (${n.sector} · ${n.province}): ${n.summary}`);
    }
    lines.push("");
  }

  if (ctx.projects.length) {
    lines.push("### Active Investment Projects");
    for (const p of ctx.projects) {
      lines.push(`- **${p.name}** — ${p.sector}, ${p.province} · ${p.investor} (${p.origin}) · ${p.status}: ${p.summary}`);
    }
    lines.push("");
  }

  if (ctx.sites.length) {
    lines.push("### Relevant Map Sites");
    for (const s of ctx.sites) {
      lines.push(`- **${s.name}** (${s.kind}, ${s.province}${s.status ? ` · ${s.status}` : ""}): ${s.notes?.slice(0, 120) ?? ""}`);
    }
    lines.push("");
  }

  lines.push("Use the above live data in your answer. Prefer it over your training knowledge for Cambodia-specific facts.");
  return lines.join("\n");
}

// ── Async fire-and-forget logger (never blocks the stream) ───────────────────
export function logChat(
  supabaseUrl: string,
  serviceKey:  string,
  payload: {
    session_id?:  string;
    user_message: string;
    keywords:     string[];
    rag_news:     number;
    rag_projects: number;
    rag_sites:    number;
  },
): void {
  fetch(`${supabaseUrl}/rest/v1/chat_logs`, {
    method:  "POST",
    headers: {
      apikey:          serviceKey,
      Authorization:   `Bearer ${serviceKey}`,
      "Content-Type":  "application/json",
      Prefer:          "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => {}); // silent — never throw
}

export function logReport(
  supabaseUrl: string,
  serviceKey:  string,
  payload: {
    ref_id?:      string;
    report_type?: string;
    province?:    string;
    sector?:      string;
    rag_news:     number;
    rag_projects: number;
  },
): void {
  fetch(`${supabaseUrl}/rest/v1/report_logs`, {
    method:  "POST",
    headers: {
      apikey:          serviceKey,
      Authorization:   `Bearer ${serviceKey}`,
      "Content-Type":  "application/json",
      Prefer:          "return=minimal",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
