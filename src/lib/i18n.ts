/* ─────────────────────────────────────────────────────────────────
   TheGentryLab copy strings — English only.
───────────────────────────────────────────────────────────────── */

const EN = {
  nav: {
    home: "Home", map: "Map", tracker: "Tracker", news: "News",
    research: "Research", about: "About", contact: "Contact",
    getAdvisory: "Get advisory",
  },
  hero: {
    eyebrow: "Industrial Intelligence · Cambodia",
    h1a: "What does it",
    h1b: "actually take to",
    h1c: "develop",
    h1d: "Industrial land in Cambodia?",
    sub: "9 stages. 260+ sites mapped. One free platform built from $500M+ of delivered projects.",
    cta1: "Explore the map",
    cta2: "About the platform",
    tags: ["9-Stage GIDF", "260+ Sites", "Free Access", "CDC · EDC · MPWT Data"],
  },
  gidf: {
    eyebrow: "The Framework · GIDF",
    title1: "GentryLab Industrial",
    title2: "Development Framework",
    sub: "Touch any stage to reveal what really happens on the ground in Cambodia.",
    hintOpen: "▼ cambodia intel",
    hintClose: "▲ hide",
    labelStat: "Key insight",
    labelProcess: "What actually happens",
    labelImplication: "Investor implication",
  },
  mapSection: {
    eyebrow: "Free Intelligence Platform",
    title1: "Every SEZ, corridor &",
    title2: "risk zone — mapped.",
    desc: "Our interactive intelligence map layers 260+ industrial sites, 9 development corridors, EDC substation data, flood risk zones, and labour catchments across Cambodia — all free.",
    cta: "Open the map",
    liveBadge: "● Live Intelligence · Cambodia",
    layersBadge: "8 layers active",
    corridorLabel: "9 corridors · 260+ sites",
    launchCta: "Launch interactive map →",
    stats: [
      { n: "260+", label: "Industrial sites" },
      { n: "9",    label: "Dev corridors"    },
      { n: "8",    label: "Data layers"      },
      { n: "Free", label: "Always"           },
    ],
  },
  map: {
    layersBtn: "Layers",
    searchPlaceholder: "Paste Google Maps link or place name…",
    go: "Go",
    yourLocation: "★ YOUR LOCATION",
    noResults: "No results found in Cambodia.",
    badUrl: "Could not extract coordinates from URL.",
    layerControl: "Layer Control",
    searchSite: "Search site or province…",
    disclaimer: "Data illustrative · Verify before investment decision",
    advisory: "GentryLab Advisory",
  },
  contact: {
    eyebrow: "Engage",
    headline1: "Secure your",
    headline2: "industrial",
    headlineAccent: "footprint.",
    body: "Direct advisory for manufacturers and funds entering Cambodia. Typical engagements: feasibility study, technical due diligence, owner's representative for EPC delivery.",
    officeLabel: "Phnom Penh Office",
    contactLabel: "Contact",
    emailBtn: "Email principal advisor",
  },
  footer: { dashboard: "Dashboard" },
  stageTitles: [
    "Site Selection", "Land Due Diligence", "Master Planning",
    "Utility Strategy", "Permit Navigation", "Factory Design",
    "EPC Budgeting", "Delivery", "Operations",
  ],
  stageStats: [
    "3 CDC pre-cleared zones — 30+ provinces with NO industrial land policy",
    "Only 30% of Cambodian industrial land has hard LMAP title",
    "15% green space mandatory — missed by 60% of first CDC submissions",
    "EDC industrial tariff: $0.12–$0.18/kWh — new substation: 8–24 months",
    "9 separate ministry approvals — order matters, most investors get it wrong",
    "Industrial build cost: $280–$420/m² — wrong spec adds 40%+ in retrofit costs",
    "Average cost overrun on Cambodian industrial builds: 23% — 80% from utility surprises",
    "June–October rainy season: construction pace drops 35–45%",
    "SEZ customs clearance: same-day vs 3–5 days outside zone",
  ],
  stageProcess: [
    "Province scoring across 12 criteria: EDC headroom, flood risk, NR access, labour pool, title clarity, CDC reach. GentryLab shortlists to 3 sites before client visits.",
    "Ministry of Land hard title search, encumbrance check at local cadastral office, ownership chain verified back 2 transfers minimum, flood history from ODC GeoServer.",
    "CDC requires masterplan before QIP registration. Layout must show green buffer, fire access road (6m min), internal road grid, utility entry points, waste treatment zone.",
    "Load calculation → EDC feasibility → substation sizing → dedicated line vs shared feeder → water permit from MOWRAM → wastewater discharge to MIME Class B.",
    "Sequence: MoE ECC → MISTI licence → CDC QIP → MoLVT → fire dept → building permit → EDC → water authority → customs (SEZ). Wrong order = restart.",
    "ASEAN industrial code applies. Steel portal frame for garment/light mfg. Reinforced concrete for pharma/food. Wet season roof loading: min 1.5kN/m². FM2 floor flatness for logistics.",
    "Bill of quantities → 3 contractor quotes (1 international, 1 regional, 1 local) → contingency for utility works → VAT, stamp duty, professional fees.",
    "Mobilisation → site clearing → foundation → structural frame → envelope → MEP rough-in → fit-out → utility connections → testing & commissioning → handover.",
    "Facility management: MEP maintenance, security, MIME waste audit (quarterly), EDC reconciliation, fire cert (annual), MoLVT labour audit preparation.",
  ],
  stageImplication: [
    "Investors who skip corridor analysis average 14 months longer to first production. Site choice locks your utility cost for 20 years.",
    "Soft-title land can be blocked 2–3 years mid-development. Title risk is the #1 reason foreign industrial projects stall in Cambodia.",
    "QIP status unlocks up to 9 years corporate tax exemption + import duty waiver. A rejected masterplan costs 3–6 months and a full redesign fee.",
    "Power cost differential across provinces: $0.04/kWh. On 3MW demand that's $105K/year. Utility strategy done wrong is a 20-year cost penalty.",
    "Done correctly: 8–11 months. Done incorrectly: 18–30 months. Permit sequencing is GentryLab's highest-value advisory service.",
    "Under-specced factories cost more to upgrade than to build right. GentryLab benchmarks against 60+ buildings — investors save 12–18% vs local estimates.",
    "Benchmarked projects average 8% under final cost vs 23% over for unbenchmarked builds.",
    "Projects that miss the dry season (Nov–May) for foundation works typically slip 6 months.",
    "SEZ operators handle customs in-zone. For export manufacturers, SEZ location saves 3–5 days per shipment cycle.",
  ],
};

/* ── Deep-get helper ─────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

/** Translate a dot-path key. */
export function translate(key: string): string {
  const val = deepGet(EN, key) ?? key;
  return typeof val === "string" ? val : key;
}

/** Translate a dot-path that resolves to a string array. */
export function translateArr(key: string): string[] {
  const val = deepGet(EN, key) ?? [];
  return Array.isArray(val) ? val : [];
}

/** Translate a dot-path that resolves to an array of objects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function translateObjArr(key: string): any[] {
  const val = deepGet(EN, key) ?? [];
  return Array.isArray(val) ? val : [];
}

/* ── React hook — kept for API compatibility with existing call sites ── */
import { useCallback } from "react";

export function useLang() {
  const t  = useCallback((key: string) => translate(key), []);
  const ta = useCallback((key: string) => translateArr(key), []);
  const to = useCallback((key: string) => translateObjArr(key), []);

  return { t, ta, to };
}
