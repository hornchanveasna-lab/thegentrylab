/* ─────────────────────────────────────────────────────────────────
   Site Config — centralised editable content for TheGentryLab.
   Persisted in localStorage so the dashboard can live-update the site.
───────────────────────────────────────────────────────────────── */

export interface StatItem   { value: string; suffix: string; label: string }
export interface RoadmapItem { n: string; title: string; desc: string }

export interface SiteConfig {
  /* ── Branding */
  accentColor:   string;
  logoColor:     string;   // SVG G mark fill color (can differ from accentColor)
  logoImage:     string;   // base64 data URL — if set, replaces the SVG G mark
  logoLine1:     string;   // "The"
  logoLine2:     string;   // "Gentry"
  logoLine3:     string;   // "Lab"
  tagline:       string;   // "Industrial Intelligence · KH"

  /* ── Hero */
  heroEyebrow:   string;
  heroLine1:     string;
  heroLine2:     string;
  heroLine3:     string;
  heroSubtext:   string;
  heroCta1:      string;
  heroCta2:      string;

  /* ── Stats bar */
  stats: StatItem[];

  /* ── Roadmap */
  roadmap: RoadmapItem[];

  /* ── Ticker */
  ticker: string[];

  /* ── Footer */
  footerLeft:    string;
  footerRight:   string;

  /* ── Map */
  mapCenter:     [number, number];
  mapZoom:       number;
}

export const DEFAULT_CONFIG: SiteConfig = {
  accentColor:  "#ff5100",
  logoColor:    "#ff5100",
  logoImage:    "",
  logoLine1:    "The",
  logoLine2:    "Gentry",
  logoLine3:    "Lab",
  tagline:      "Industrial Intelligence · KH",

  heroEyebrow:  "Industrial Intelligence · Cambodia",
  heroLine1:    "Know Cambodia's",
  heroLine2:    "industrial",
  heroLine3:    "landscape before\nyou commit.",
  heroSubtext:  "Map every SEZ, corridor, substation, and risk zone. Decision-grade intelligence for foreign manufacturers and investors.",
  heroCta1:     "Explore the map",
  heroCta2:     "About the platform",

  stats: [
    { value: "54",  suffix: "",  label: "Active & planned SEZs" },
    { value: "9",   suffix: "",  label: "Industrial corridors" },
    { value: "110", suffix: "+", label: "Sites on intelligence map" },
    { value: "12",  suffix: "",  label: "Investment projects tracked" },
  ],

  roadmap: [
    { n: "01", title: "Site Score Engine",    desc: "AI-weighted suitability scoring across 14 criteria." },
    { n: "02", title: "Permit Navigator",     desc: "End-to-end CDC, MIH & MoE approval timeline mapper." },
    { n: "03", title: "Utility Capacity Map", desc: "EDC substation headroom & water capacity by province." },
    { n: "04", title: "Cost Heat Map",        desc: "USD/m² construction benchmarks across 6 provinces." },
    { n: "05", title: "Land Marketplace",     desc: "Curated industrial land & SEZ plot listings." },
    { n: "06", title: "AI Industrial Advisor",desc: "LLM-powered site selection & feasibility briefs." },
  ],

  ticker: [
    "SEZ Intelligence", "Industrial Corridors", "Utility Readiness",
    "Flood Risk Atlas", "Labor Analytics", "Permit Navigation",
    "Cost Benchmarks", "Land Due Diligence",
  ],

  footerLeft:  "© 2026 The Gentry Lab · Phnom Penh",
  footerRight: "Industrial Intelligence Platform · v0.1 MVP",

  mapCenter: [11.55, 104.9],
  mapZoom:   7,
};

const STORAGE_KEY = "tgl_site_config";

export function loadConfig(): SiteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    // Deep merge: default values fill any keys missing from stored config
    return deepMerge(DEFAULT_CONFIG, JSON.parse(raw)) as SiteConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(cfg: SiteConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    // Notify other tabs / components
    window.dispatchEvent(new CustomEvent("tgl-config-updated", { detail: cfg }));
  } catch {/* ignore */}
}

export function resetConfig(): SiteConfig {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("tgl-config-updated", { detail: DEFAULT_CONFIG }));
  return DEFAULT_CONFIG;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, override: any): any {
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (key in override) {
      if (Array.isArray(base[key])) {
        out[key] = override[key]; // arrays: take stored value wholesale
      } else if (typeof base[key] === "object" && base[key] !== null) {
        out[key] = deepMerge(base[key], override[key] ?? {});
      } else {
        out[key] = override[key];
      }
    }
  }
  return out;
}
