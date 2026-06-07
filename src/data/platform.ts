// Curated seed data for The Gentry Lab Industrial Intelligence Platform.
// Illustrative — based on public knowledge (CDC, SEZ Board, EDC, MPWT).
// Coordinates are approximate.

export type LayerGroup =
  | "investment"
  | "infrastructure"
  | "utilities"
  | "risk"
  | "labor"
  | "corridors";

export type SiteKind =
  | "sez"
  | "park"
  | "factory"
  | "logistics"
  | "port"
  | "airport"
  | "substation"
  | "university"
  | "tvet"
  | "corridor";

export interface MapSite {
  id: string;
  name: string;
  kind: SiteKind;
  layer: LayerGroup;
  province: string;
  lat: number;
  lng: number;
  size?: string;
  status?: "Operational" | "Under Construction" | "Planned";
  utilities?: string;
  road?: string;
  notes?: string;
  score?: number; // suitability snapshot 0-100
  strengths?: string[];
  constraints?: string[];
  targetIndustries?: string[];
  recommendation?: string;
}

export interface Corridor {
  id: string;
  name: string;
  shortName: string;
  color: string;
  waypoints: [number, number][]; // [lat, lng] pairs
  description: string;
}

export const LAYER_META: Record<
  LayerGroup,
  { label: string; color: string; description: string }
> = {
  investment: {
    label: "Investment",
    color: "#ff5100",
    description: "Factories, parks, SEZs, logistics hubs",
  },
  infrastructure: {
    label: "Infrastructure",
    color: "#facc15",
    description: "Roads, expressways, railways, ports, airports",
  },
  utilities: {
    label: "Utilities",
    color: "#38bdf8",
    description: "EDC substations, transmission, water, wastewater",
  },
  risk: {
    label: "Risk",
    color: "#f43f5e",
    description: "Flood zones, environmental & ownership risk",
  },
  labor: {
    label: "Labor",
    color: "#a78bfa",
    description: "Population density, universities, TVET centers",
  },
  corridors: {
    label: "Corridors",
    color: "#34d399",
    description: "National roads and industrial development corridors",
  },
};

export const CORRIDORS: Corridor[] = [
  {
    id: "nr1",
    name: "National Road 1 — Phnom Penh to Bavet",
    shortName: "NR1",
    color: "#34d399",
    waypoints: [
      [11.57, 104.93],
      [11.45, 105.10],
      [11.30, 105.32],
      [11.17, 105.55],
      [11.07, 105.80],
      [11.07, 105.97],
    ],
    description: "Key corridor to Vietnam border at Bavet; anchors Svay Rieng SEZ cluster.",
  },
  {
    id: "nr2",
    name: "National Road 2 — Phnom Penh to Kep",
    shortName: "NR2",
    color: "#60a5fa",
    waypoints: [
      [11.53, 104.88],
      [11.25, 104.78],
      [10.95, 104.60],
      [10.72, 104.45],
      [10.48, 104.32],
    ],
    description: "Southern corridor through Takeo, linking PP to Kampot and Kep.",
  },
  {
    id: "nr3",
    name: "National Road 3 — Phnom Penh to Kampot",
    shortName: "NR3",
    color: "#f59e0b",
    waypoints: [
      [11.55, 104.83],
      [11.30, 104.65],
      [11.05, 104.40],
      [10.80, 104.25],
      [10.62, 104.18],
    ],
    description: "Connects capital to Kampot province; passes through Kampong Speu industrial belt.",
  },
  {
    id: "nr4",
    name: "National Road 4 — Phnom Penh to Sihanoukville",
    shortName: "NR4",
    color: "#e879f9",
    waypoints: [
      [11.57, 104.85],
      [11.50, 104.72],
      [11.45, 104.55],
      [11.30, 104.35],
      [11.10, 104.10],
      [10.85, 103.90],
      [10.66, 103.65],
    ],
    description: "Cambodia's premier industrial corridor; links capital to deep-water port at Sihanoukville.",
  },
  {
    id: "nr5",
    name: "National Road 5 — Phnom Penh to Poipet",
    shortName: "NR5",
    color: "#fb923c",
    waypoints: [
      [11.58, 104.85],
      [11.80, 104.68],
      [12.10, 104.55],
      [12.55, 104.40],
      [13.00, 103.95],
      [13.40, 103.50],
      [13.65, 102.58],
    ],
    description: "Northwest corridor to Thailand border at Poipet; serves Kampong Chhnang & Pursat.",
  },
  {
    id: "nr6",
    name: "National Road 6 — Phnom Penh to Siem Reap",
    shortName: "NR6",
    color: "#a3e635",
    waypoints: [
      [11.58, 104.90],
      [11.80, 105.05],
      [12.20, 105.00],
      [12.70, 104.90],
      [13.10, 103.95],
      [13.36, 103.86],
    ],
    description: "Northern corridor connecting capital to Siem Reap tourism and logistics hub.",
  },
  {
    id: "ring3",
    name: "Ring Road 3 — Phnom Penh Outer Belt",
    shortName: "RR3",
    color: "#22d3ee",
    waypoints: [
      [11.70, 104.78],
      [11.68, 104.95],
      [11.58, 105.08],
      [11.45, 105.05],
      [11.35, 104.95],
      [11.30, 104.80],
      [11.35, 104.65],
      [11.45, 104.58],
      [11.58, 104.62],
      [11.68, 104.72],
      [11.70, 104.78],
    ],
    description: "Outer ring road enabling industrial decentralisation from Phnom Penh core.",
  },
  {
    id: "airport-corridor",
    name: "Airport Corridor — Techo International",
    shortName: "Airport",
    color: "#f43f5e",
    waypoints: [
      [11.57, 104.87],
      [11.50, 104.87],
      [11.43, 104.86],
      [11.336, 104.85],
    ],
    description: "Dedicated access corridor to Techo International Airport; key for air freight logistics.",
  },
  {
    id: "port-corridor",
    name: "Port Corridor — Sihanoukville",
    shortName: "Port",
    color: "#818cf8",
    waypoints: [
      [10.66, 103.65],
      [10.645, 103.57],
      [10.625, 103.515],
    ],
    description: "Access corridor to Sihanoukville Autonomous Port (SAP); Cambodia's deep-water gateway.",
  },
];

export const SITES: MapSite[] = [
  // Investment — SEZs & parks
  {
    id: "ppsez",
    name: "Phnom Penh SEZ",
    kind: "sez",
    layer: "investment",
    province: "Phnom Penh / Kandal",
    lat: 11.516,
    lng: 104.747,
    size: "360 ha",
    status: "Operational",
    utilities: "115kV substation, 4,800 m³/d water",
    road: "NR4 frontage",
    score: 95,
    notes: "Cambodia's anchor SEZ; garment, electronics and precision components mix.",
    strengths: ["Proven infrastructure", "115kV direct feed", "Bonded warehouse on-site", "NR4 & expressway access"],
    constraints: ["Land premium vs. provincial SEZs", "Wastewater at 80% capacity"],
    targetIndustries: ["Electronics Assembly", "Garment & Textile", "Precision Components", "Logistics"],
    recommendation: "First-choice location for export-oriented light manufacturing requiring reliable utilities and immediate logistics access. Best suited for MNC anchor tenants or JV structures requiring proximity to capital.",
  },
  {
    id: "manhattan",
    name: "Manhattan SVS SEZ",
    kind: "sez",
    layer: "investment",
    province: "Svay Rieng",
    lat: 11.07,
    lng: 105.96,
    size: "180 ha",
    status: "Operational",
    utilities: "Grid + on-site 22kV",
    road: "NR1, Bavet border",
    score: 92,
    notes: "Closest SEZ to Vietnam; ideal for export to HCMC port.",
    strengths: ["Vietnam border adjacency", "Low land cost", "NR1 direct access", "Active tenant community"],
    constraints: ["Single power source (22kV)", "Limited wastewater treatment", "Remote from capital labour pool"],
    targetIndustries: ["Garment & Textile", "Electronics", "Furniture", "Plastics"],
    recommendation: "Strong choice for manufacturers already operating in Vietnam seeking cost arbitrage and ASEAN tariff benefits. Particularly effective for garment and light electronics with HCMC as primary export port.",
  },
  {
    id: "tai-seng",
    name: "Tai Seng Bavet SEZ",
    kind: "sez",
    layer: "investment",
    province: "Svay Rieng",
    lat: 11.05,
    lng: 105.99,
    size: "125 ha",
    status: "Operational",
    score: 88,
    strengths: ["Border zone benefits", "Chinese developer network", "Bonded status"],
    constraints: ["Smaller utility headroom", "Shared grid with Manhattan SEZ"],
    targetIndustries: ["Garment", "Light Manufacturing", "Trade Facilitation"],
    recommendation: "Suitable secondary option in the Bavet cluster for smaller operations seeking border-zone bonded status.",
  },
  {
    id: "sihanoukville-sez",
    name: "Sihanoukville SEZ (SSEZ)",
    kind: "sez",
    layer: "investment",
    province: "Preah Sihanouk",
    lat: 10.66,
    lng: 103.65,
    size: "1,113 ha",
    status: "Operational",
    utilities: "230kV substation, direct port pipeline",
    road: "NR4, PP–SHV Expressway",
    score: 88,
    notes: "Largest SEZ by area; China-led with direct deep-water port adjacency.",
    strengths: ["Direct SAP port access", "230kV substation on-site", "Expressway link to Phnom Penh", "Largest land bank in Cambodia"],
    constraints: ["Regulatory uncertainty post-2023 casino crackdown", "Utility reliability variance", "Perception risk from prior illicit activity"],
    targetIndustries: ["Heavy Industry", "Port Logistics", "Chemicals", "Energy", "Automotive"],
    recommendation: "Best suited for heavy industry and port-dependent manufacturing. Conduct enhanced due diligence on utility reliability and regulatory environment. Strong long-term fundamentals given port adjacency and land scale.",
  },
  {
    id: "techo",
    name: "Techo Industrial Park",
    kind: "park",
    layer: "investment",
    province: "Kandal",
    lat: 11.40,
    lng: 104.85,
    size: "200 ha",
    status: "Under Construction",
    score: 84,
    strengths: ["Adjacent to Techo International Airport", "New infrastructure", "Kandal labor pool"],
    constraints: ["Construction not complete", "Utility connections pending", "Limited track record"],
    targetIndustries: ["Air Freight Logistics", "Pharmaceutical", "Electronics", "Cold Chain"],
    recommendation: "High-potential for air cargo-dependent industries. Monitor construction progress; suitable for early-mover positioning with phased commitment strategy.",
  },
  {
    id: "polo-bavet",
    name: "Polo Bavet Industrial Park",
    kind: "park",
    layer: "investment",
    province: "Svay Rieng",
    lat: 11.06,
    lng: 105.94,
    size: "94 ha",
    status: "Operational",
    score: 81,
    strengths: ["Operational status", "Border proximity", "Thai developer credibility"],
    constraints: ["Smaller scale", "Limited utility capacity"],
    targetIndustries: ["Garment", "Light Assembly", "Packaging"],
    recommendation: "Complementary option within the Bavet corridor cluster for tenants requiring smaller footprints.",
  },
  {
    id: "kampot-park",
    name: "Kampot Industrial Zone",
    kind: "park",
    layer: "investment",
    province: "Kampot",
    lat: 10.62,
    lng: 104.18,
    size: "75 ha",
    status: "Planned",
    score: 70,
    strengths: ["Low land cost", "Port access (Kampot River)", "Agri-processing proximity"],
    constraints: ["Planned status only", "Limited power infrastructure", "Remote labour"],
    targetIndustries: ["Food Processing", "Agro-industry", "Salt & Minerals"],
    recommendation: "Monitor development. Suitable for agro-processing seeking low-cost land near southern coast. Require infrastructure commitments before commitment.",
  },
  {
    id: "isi-sez",
    name: "ISI SEZ (Phnom Penh)",
    kind: "sez",
    layer: "investment",
    province: "Phnom Penh / Kandal",
    lat: 11.490,
    lng: 104.780,
    size: "70 ha",
    status: "Operational",
    utilities: "22kV grid connection, municipal water",
    road: "NR1 adjacent, ~12 km from city centre",
    score: 80,
    notes: "ISI SEZ is an operational urban-fringe SEZ south of Phnom Penh, primarily targeting light manufacturing, garment finishing, and e-commerce logistics. Bonded warehouse facilities available. Managed by ISI Group with Cambodian ownership.",
    strengths: [
      "Operational with active tenants",
      "Proximity to Phnom Penh labour pool",
      "Bonded warehouse available",
      "NR1 corridor access",
      "Lower cost than PPSEZ for smaller footprints",
    ],
    constraints: [
      "22kV supply limits heavy power users",
      "Smaller land bank limits large-format factories",
      "Wastewater treatment capacity limited vs PPSEZ",
      "No dedicated 115kV substation on-site",
    ],
    targetIndustries: ["Garment & Apparel", "Light Assembly", "E-commerce Logistics", "Consumer Goods", "Packaging"],
    recommendation: "Strong option for SME manufacturers and logistics operators seeking Phnom Penh proximity at lower cost than PPSEZ. Best suited for labour-intensive operations under 5,000 m² requiring bonded status. Conduct utility headroom verification before commitment for any operation >1MW.",
  },
  {
    id: "ksez",
    name: "Kampong Speu SEZ",
    kind: "sez",
    layer: "investment",
    province: "Kampong Speu",
    lat: 11.45,
    lng: 104.52,
    size: "240 ha",
    status: "Under Construction",
    utilities: "115kV planned, 3,000 m³/d water",
    road: "NR4, PP–SHV Expressway IC",
    score: 82,
    strengths: ["NR4 corridor access", "Expressway interchange", "Competitive land rates", "Labour pool from province"],
    constraints: ["Infrastructure partially complete", "115kV connection pending"],
    targetIndustries: ["Automotive Components", "Garment", "Food Processing", "General Manufacturing"],
    recommendation: "Emerging mid-corridor play on NR4. Best suited for manufacturers seeking NR4 logistics access at lower cost than PPSEZ. Hyundai plant nearby signals automotive cluster forming.",
  },
  // Factories
  {
    id: "f-electro-1",
    name: "Minebea Mitsumi Plant",
    kind: "factory",
    layer: "investment",
    province: "Phnom Penh",
    lat: 11.526,
    lng: 104.755,
    size: "32,000 m²",
    status: "Operational",
    notes: "Precision components — PPSEZ tenant.",
  },
  {
    id: "f-garment-1",
    name: "Crystal Martin Facility",
    kind: "factory",
    layer: "investment",
    province: "Kandal",
    lat: 11.43,
    lng: 104.82,
    size: "18,000 m²",
    status: "Operational",
  },
  {
    id: "f-food-1",
    name: "Cambodia Beverage Co.",
    kind: "factory",
    layer: "investment",
    province: "Phnom Penh",
    lat: 11.55,
    lng: 104.92,
    size: "25,000 m²",
    status: "Operational",
  },
  {
    id: "f-auto-1",
    name: "Hyundai-Kefico Assembly Plant",
    kind: "factory",
    layer: "investment",
    province: "Kampong Speu",
    lat: 11.47,
    lng: 104.48,
    size: "8 ha",
    status: "Under Construction",
    notes: "EV component assembly; first Korean Tier-1 in Cambodia.",
  },
  // Logistics
  {
    id: "log-wha",
    name: "WHA Logistics Hub",
    kind: "logistics",
    layer: "investment",
    province: "Kandal",
    lat: 11.46,
    lng: 104.78,
    size: "60 ha",
    status: "Under Construction",
    score: 86,
  },
  {
    id: "log-dryport",
    name: "Phnom Penh Dry Port",
    kind: "logistics",
    layer: "investment",
    province: "Phnom Penh",
    lat: 11.61,
    lng: 104.85,
    size: "30 ha",
    status: "Operational",
  },
  {
    id: "log-maersk",
    name: "Maersk Bonded Warehouse",
    kind: "logistics",
    layer: "investment",
    province: "Preah Sihanouk",
    lat: 10.63,
    lng: 103.53,
    size: "22,000 m²",
    status: "Operational",
  },

  // Infrastructure
  {
    id: "port-sihanouk",
    name: "Sihanoukville Autonomous Port",
    kind: "port",
    layer: "infrastructure",
    province: "Preah Sihanouk",
    lat: 10.625,
    lng: 103.515,
    status: "Operational",
    notes: "Cambodia's only deep-water port; new container terminal under expansion.",
  },
  {
    id: "port-ppap",
    name: "Phnom Penh Autonomous Port (LM17)",
    kind: "port",
    layer: "infrastructure",
    province: "Kandal",
    lat: 11.39,
    lng: 105.05,
    status: "Operational",
  },
  {
    id: "airport-techo",
    name: "Techo International Airport",
    kind: "airport",
    layer: "infrastructure",
    province: "Kandal",
    lat: 11.336,
    lng: 104.85,
    status: "Operational",
    notes: "Opened 2025, replaces PNH. Cargo terminal Phase II commissioning Q3 2026.",
  },
  {
    id: "airport-ree",
    name: "Siem Reap-Angkor Intl. Airport",
    kind: "airport",
    layer: "infrastructure",
    province: "Siem Reap",
    lat: 13.40,
    lng: 103.81,
    status: "Operational",
  },
  {
    id: "expy-pps",
    name: "PP–Sihanoukville Expressway IC",
    kind: "logistics",
    layer: "infrastructure",
    province: "Kampong Speu",
    lat: 11.45,
    lng: 104.50,
    status: "Operational",
    notes: "Cambodia's first expressway, 187 km. Travel time PP–SHV reduced to ~2.5 hrs.",
  },
  {
    id: "expy-bavet",
    name: "PP–Bavet Expressway (planned)",
    kind: "logistics",
    layer: "infrastructure",
    province: "Svay Rieng",
    lat: 11.30,
    lng: 105.50,
    status: "Planned",
    notes: "USD 1.6B BOT concession; 138 km link, financial close May 2026.",
  },

  // Utilities
  {
    id: "sub-gs1",
    name: "GS1 230kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Phnom Penh",
    lat: 11.58,
    lng: 104.88,
    status: "Operational",
    utilities: "230/115/22 kV, ~400 MVA",
  },
  {
    id: "sub-takmao",
    name: "Takmao 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Kandal",
    lat: 11.475,
    lng: 104.95,
    status: "Operational",
    utilities: "200 MVA capacity upgrade, Q1 2026",
  },
  {
    id: "sub-bavet",
    name: "Bavet 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Svay Rieng",
    lat: 11.07,
    lng: 105.97,
    status: "Operational",
  },
  {
    id: "sub-sville",
    name: "Sihanoukville 230kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Preah Sihanouk",
    lat: 10.70,
    lng: 103.62,
    status: "Operational",
  },
  {
    id: "sub-kampot",
    name: "Kampot 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Kampot",
    lat: 10.61,
    lng: 104.17,
    status: "Operational",
    utilities: "115/22 kV, 80 MVA",
  },
  {
    id: "sub-siemreap",
    name: "Siem Reap 115kV Substation",
    kind: "substation",
    layer: "utilities",
    province: "Siem Reap",
    lat: 13.37,
    lng: 103.83,
    status: "Operational",
  },

  // Risk markers
  {
    id: "risk-mekong",
    name: "Mekong Floodplain Belt",
    kind: "logistics",
    layer: "risk",
    province: "Kandal",
    lat: 11.55,
    lng: 105.10,
    notes: "Recurrent monsoon flooding; verify ground elevation > +9.0 mASL before site selection.",
  },
  {
    id: "risk-tonle",
    name: "Tonle Sap Lowlands",
    kind: "logistics",
    layer: "risk",
    province: "Kampong Chhnang",
    lat: 12.25,
    lng: 104.65,
    notes: "Seasonal lake expansion up to 16,000 km². Unsuitable for heavy industry without major ground-raising.",
  },
  {
    id: "risk-coastal",
    name: "Coastal Erosion Zone",
    kind: "logistics",
    layer: "risk",
    province: "Preah Sihanouk",
    lat: 10.58,
    lng: 103.47,
    notes: "Active coastal erosion; 3–5m annual retreat in some areas. Sea level rise risk horizon 2040–2060.",
  },

  // Labor
  {
    id: "u-rupp",
    name: "Royal University of Phnom Penh",
    kind: "university",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.569,
    lng: 104.89,
  },
  {
    id: "u-itc",
    name: "Institute of Technology of Cambodia",
    kind: "university",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.57,
    lng: 104.89,
    notes: "Primary engineering talent pipeline for industrial sector.",
  },
  {
    id: "u-norton",
    name: "Norton University",
    kind: "university",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.545,
    lng: 104.92,
  },
  {
    id: "tvet-npic",
    name: "NPIC (National Polytechnic Inst.)",
    kind: "tvet",
    layer: "labor",
    province: "Phnom Penh",
    lat: 11.49,
    lng: 104.85,
    notes: "Key technical skills pipeline for light manufacturing.",
  },
  {
    id: "tvet-svay",
    name: "Svay Rieng RTC",
    kind: "tvet",
    layer: "labor",
    province: "Svay Rieng",
    lat: 11.09,
    lng: 105.80,
  },
  {
    id: "tvet-sville",
    name: "Sihanoukville Vocational Training Centre",
    kind: "tvet",
    layer: "labor",
    province: "Preah Sihanouk",
    lat: 10.64,
    lng: 103.53,
  },
];

// Project Tracker
export type Sector =
  | "Garment"
  | "Electronics"
  | "Food Processing"
  | "Warehousing"
  | "Data Center"
  | "Automotive"
  | "Energy";

export interface TrackedProject {
  id: string;
  name: string;
  sector: Sector;
  province: string;
  size: string;
  investor: string;
  origin: string;
  status: "Planned" | "Under Construction" | "Operational";
  updated: string;
  summary: string;
}

export const PROJECTS: TrackedProject[] = [
  { id: "p1", name: "Hyundai-Kefico Assembly Plant", sector: "Automotive", province: "Kampong Speu", size: "8 ha", investor: "Hyundai Mobis", origin: "Korea", status: "Under Construction", updated: "2026-03-12", summary: "Component assembly for SE Asian EV supply chain." },
  { id: "p2", name: "Shenzhou Garment Expansion", sector: "Garment", province: "Phnom Penh", size: "42,000 m²", investor: "Shenzhou Intl.", origin: "China", status: "Operational", updated: "2026-02-04", summary: "Phase III knitwear line, 4,200 workers." },
  { id: "p3", name: "Datacenter PNH-1", sector: "Data Center", province: "Phnom Penh", size: "12 MW", investor: "Telcotech / EDGE", origin: "Cambodia/Singapore", status: "Planned", updated: "2026-04-18", summary: "Tier III carrier-neutral facility, target online 2027." },
  { id: "p4", name: "Wuxi Electronics PCB Plant", sector: "Electronics", province: "Svay Rieng", size: "22,000 m²", investor: "Wuxi Tech", origin: "China", status: "Under Construction", updated: "2026-03-29", summary: "Multi-layer PCB for telecom hardware." },
  { id: "p5", name: "Lotte Foods Cambodia", sector: "Food Processing", province: "Kandal", size: "9 ha", investor: "Lotte Confectionery", origin: "Korea", status: "Planned", updated: "2026-01-21", summary: "Snacks production for ASEAN distribution." },
  { id: "p6", name: "WHA Cold Chain Hub", sector: "Warehousing", province: "Kandal", size: "30,000 m²", investor: "WHA Group", origin: "Thailand", status: "Under Construction", updated: "2026-04-02", summary: "Multi-temperature warehousing, dry port adjacent." },
  { id: "p7", name: "Toray Synthetic Fabrics", sector: "Garment", province: "Preah Sihanouk", size: "15,000 m²", investor: "Toray Industries", origin: "Japan", status: "Operational", updated: "2025-11-30", summary: "Technical textiles for sportswear OEMs." },
  { id: "p8", name: "BYD Auto Assembly", sector: "Automotive", province: "Sihanoukville", size: "20 ha", investor: "BYD", origin: "China", status: "Planned", updated: "2026-05-09", summary: "CKD EV assembly serving ASEAN tariff zones." },
  { id: "p9", name: "Schaeffler Bearings Plant", sector: "Electronics", province: "Phnom Penh", size: "11,000 m²", investor: "Schaeffler AG", origin: "Germany", status: "Under Construction", updated: "2026-02-25", summary: "Precision bearings for industrial machinery." },
  { id: "p10", name: "Smart Axiata Edge POP", sector: "Data Center", province: "Siem Reap", size: "2 MW", investor: "Smart Axiata", origin: "Malaysia", status: "Operational", updated: "2026-01-08", summary: "Northern edge POP serving tourism corridor." },
  { id: "p11", name: "Mondelez Biscuit Plant", sector: "Food Processing", province: "Kampong Speu", size: "6 ha", investor: "Mondelez Intl.", origin: "USA", status: "Planned", updated: "2026-04-30", summary: "Regional biscuit manufacturing." },
  { id: "p12", name: "Maersk Bonded Warehouse", sector: "Warehousing", province: "Preah Sihanouk", size: "22,000 m²", investor: "A.P. Moller-Maersk", origin: "Denmark", status: "Operational", updated: "2025-12-14", summary: "Bonded warehousing at SAP port." },
];

export const SECTORS: Sector[] = [
  "Garment", "Electronics", "Food Processing", "Warehousing", "Data Center", "Automotive", "Energy",
];

// News
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  date: string;
  sector: Sector | "Infrastructure" | "Policy";
  province: string;
  summary: string;
  url: string;
  image_url?: string;  // OG image URL from article (populated by scheduled agents)
}

export const NEWS: NewsItem[] = [
  { id: "n1", headline: "PP–Bavet Expressway reaches financial close", source: "Khmer Times", date: "2026-05-22", sector: "Infrastructure", province: "Svay Rieng", summary: "USD 1.6B BOT concession signed; 138 km link to Vietnam border breaks ground Q4.", url: "#" },
  { id: "n2", headline: "EDC tenders 500 MW solar park in Kampong Chhnang", source: "Phnom Penh Post", date: "2026-05-14", sector: "Energy", province: "Kampong Chhnang", summary: "Pre-qualification opens for IPPs; PPA tenor 25 years.", url: "#" },
  { id: "n3", headline: "Hyundai breaks ground on assembly plant at KSEZ", source: "Nikkei Asia", date: "2026-04-30", sector: "Automotive", province: "Kampong Speu", summary: "Phase I capacity 25,000 vehicles/year, exporting to ASEAN under ATIGA.", url: "#" },
  { id: "n4", headline: "Techo International Airport hits 4M passengers", source: "CAA Cambodia", date: "2026-04-18", sector: "Infrastructure", province: "Kandal", summary: "Cargo terminal Phase II commissioning Q3, +60k tonnes annual capacity.", url: "#" },
  { id: "n5", headline: "CDC approves USD 320M data-center cluster", source: "Khmer Times", date: "2026-04-02", sector: "Data Center", province: "Phnom Penh", summary: "Three Tier III facilities to be developed by 2028; combined 38 MW IT load.", url: "#" },
  { id: "n6", headline: "MoE tightens EIA requirements for >5 ha industrial sites", source: "MoE Cambodia", date: "2026-03-21", sector: "Policy", province: "Nationwide", summary: "New decree mandates 60-day public consultation; affects all SEZ tenants from Jul 1.", url: "#" },
  { id: "n7", headline: "Toray expands technical textile output by 40%", source: "Nikkei Asia", date: "2026-03-09", sector: "Garment", province: "Preah Sihanouk", summary: "Investment of USD 48M; targets Japanese sportswear OEMs.", url: "#" },
  { id: "n8", headline: "EDC commissions Takmao 115 kV substation upgrade", source: "EAC", date: "2026-02-28", sector: "Infrastructure", province: "Kandal", summary: "Adds 200 MVA capacity to southern Phnom Penh industrial belt.", url: "#" },
  { id: "n9", headline: "WHA breaks ground on cold-chain hub near LM17", source: "Bangkok Post", date: "2026-02-15", sector: "Warehousing", province: "Kandal", summary: "30,000 m² multi-temperature warehouse; F&B and pharma tenants.", url: "#" },
  { id: "n10", headline: "BYD signs MoU for Sihanoukville CKD plant", source: "Reuters", date: "2026-01-30", sector: "Automotive", province: "Preah Sihanouk", summary: "Up to 20 ha allocation; production planned for late 2027.", url: "#" },
];

// Research
export interface ResearchBrief {
  id: string;
  title: string;
  category: "Sector" | "Province" | "Regulation" | "Cost";
  pages: number;
  abstract: string;
}

export const RESEARCH: ResearchBrief[] = [
  { id: "r1", title: "Cambodia SEZ Landscape 2026", category: "Sector", pages: 42, abstract: "Census of 54 active and planned SEZs with tenant mix, utility capacity, and absorption rates." },
  { id: "r2", title: "Power Capacity by Province", category: "Province", pages: 28, abstract: "EDC substation inventory, transformer headroom, and 2027 grid reinforcement schedule." },
  { id: "r3", title: "Permit Pathway for Foreign Manufacturers", category: "Regulation", pages: 36, abstract: "End-to-end mapping of CDC, MIH, MoE, MLMUPC and municipal approvals with realistic timelines." },
  { id: "r4", title: "Construction Cost Benchmark — Industrial Buildings", category: "Cost", pages: 22, abstract: "USD/m² ranges for PEB, RC-frame and hybrid factories across six provinces." },
  { id: "r5", title: "Labor Availability & Wage Curves", category: "Sector", pages: 30, abstract: "Provincial labor pool sizing, TVET output, and 5-year wage projections by skill tier." },
  { id: "r6", title: "Land Due Diligence Playbook", category: "Regulation", pages: 48, abstract: "Title verification, hard/soft title risks, encumbrance and easement red flags." },
  { id: "r7", title: "Logistics Cost Map — Factory to Port", category: "Cost", pages: 18, abstract: "Truck, rail and barge cost per TEU from major industrial zones to SAP and HCMC." },
  { id: "r8", title: "Flood Risk Atlas — Industrial Suitability", category: "Province", pages: 26, abstract: "Province-by-province hydrology overlay with recommended minimum platform elevations." },
  { id: "r9", title: "ISI SEZ — Site Intelligence Brief", category: "Sector", pages: 14, abstract: "Operational profile, tenant mix, utility headroom, cost benchmarks, and competitive positioning of ISI SEZ versus PPSEZ and Techo Industrial Park." },
];
