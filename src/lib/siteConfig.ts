/* ─────────────────────────────────────────────────────────────────
   Site Config — centralised editable content for TheGentryLab.
   Persisted in localStorage so the dashboard can live-update the site.
───────────────────────────────────────────────────────────────── */

export interface StatItem    { value: string; suffix: string; label: string }
export interface RoadmapItem { n: string; title: string; desc: string }
export interface NavLinkItem { id: string; label: string; visible: boolean }

export interface SiteConfig {
  /* ── Branding */
  accentColor:   string;
  logoColor:     string;
  logoImage:     string;
  logoLine1:     string;
  logoLine2:     string;
  logoLine3:     string;
  tagline:       string;

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
  mapDefaultLayers: string[];   // which layer groups are ON by default

  /* ── Data Intelligence */
  refreshSchedule: "daily" | "weekly" | "monthly";

  /* ── Advisory & Contact */
  advisoryEmail:   string;
  contactOffice:   string;
  contactCity:     string;
  contactPhone:    string;
  contactHours:    string;

  /* ── SEO & Meta */
  seoSiteName:     string;
  seoDescription:  string;
  seoOgImage:      string;   // URL for social sharing image

  /* ── Platform Settings */
  platformVersion: string;
  maintenanceMode: boolean;
  showAdvisoryBanner: boolean;
  analyticsId:     string;   // e.g. GA-XXXXXXXXXX (stored, not injected in MVP)

  /* ── Navigation */
  navLinks: NavLinkItem[];
}

const DEFAULT_NAV_LINKS: NavLinkItem[] = [
  { id: "map",      label: "Map",      visible: true  },
  { id: "tracker",  label: "Tracker",  visible: true  },
  { id: "news",     label: "News",     visible: true  },
  { id: "research", label: "Research", visible: true  },
  { id: "about",    label: "About",    visible: true  },
  { id: "contact",  label: "Contact",  visible: true  },
];

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
    { value: "59",  suffix: "",  label: "SEZs & industrial parks" },
    { value: "9",   suffix: "",  label: "Industrial corridors"  },
    { value: "260", suffix: "+", label: "Sites on intelligence map" },
    { value: "26",  suffix: "",  label: "Investment projects tracked" },
  ],

  roadmap: [
    { n: "06", title: "AI Industrial Advisor",desc: "LLM-powered site selection & feasibility briefs." },
    { n: "01", title: "Site Score Engine",    desc: "AI-weighted suitability scoring across 14 criteria." },
    { n: "02", title: "Permit Navigator",     desc: "End-to-end CDC, MISTI & MoE approval timeline mapper." },
    { n: "03", title: "Utility Capacity Map", desc: "EDC substation headroom & water capacity by province." },
    { n: "04", title: "Cost Heat Map",        desc: "USD/m² construction benchmarks across 6 provinces." },
    { n: "05", title: "Land Marketplace",     desc: "Curated industrial land & SEZ plot listings." },
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
  mapDefaultLayers: ["investment", "infrastructure", "corridors"],

  refreshSchedule: "weekly",

  advisoryEmail:   "advisory@thegentrylab.io",
  contactOffice:   "Phnom Penh, Cambodia",
  contactCity:     "Phnom Penh",
  contactPhone:    "",
  contactHours:    "Mon–Fri, 09:00–18:00 ICT",

  seoSiteName:     "The Gentry Lab",
  seoDescription:  "Interactive map of Cambodia's SEZs, factories, infrastructure, utilities and industrial risk. Decision-grade intelligence for foreign manufacturers and investors.",
  seoOgImage:      "",

  platformVersion:    "0.1 MVP",
  maintenanceMode:    false,
  showAdvisoryBanner: true,
  analyticsId:        "",

  navLinks: DEFAULT_NAV_LINKS,
};

const STORAGE_KEY = "tgl_site_config";

export function loadConfig(): SiteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return deepMerge(DEFAULT_CONFIG, JSON.parse(raw)) as SiteConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(cfg: SiteConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent("tgl-config-updated", { detail: cfg }));
  } catch {/* ignore */}
}

export function resetConfig(): SiteConfig {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("tgl-config-updated", { detail: DEFAULT_CONFIG }));
  return DEFAULT_CONFIG;
}

export function exportConfig(cfg: SiteConfig): void {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `tgl-config-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfig(json: string): SiteConfig | null {
  try {
    const parsed = JSON.parse(json);
    return deepMerge(DEFAULT_CONFIG, parsed) as SiteConfig;
  } catch {
    return null;
  }
}

/* ── React hook — reactive config consumer ───────────────── */
import { useCallback, useEffect, useState } from "react";

export function useConfig(): SiteConfig {
  const [cfg, setCfg] = useState<SiteConfig>(loadConfig);
  useEffect(() => {
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);
  return cfg;
}

/** Setter returned by useManagedConfig — for the dashboard */
export function useManagedConfig() {
  const [cfg, setCfg] = useState<SiteConfig>(loadConfig);
  useEffect(() => {
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);
  const set = useCallback(<K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }, []);
  return { cfg, setCfg, set };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, override: any): any {
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (key in override) {
      if (Array.isArray(base[key])) {
        out[key] = override[key];
      } else if (typeof base[key] === "object" && base[key] !== null) {
        out[key] = deepMerge(base[key], override[key] ?? {});
      } else {
        out[key] = override[key];
      }
    }
  }
  return out;
}
