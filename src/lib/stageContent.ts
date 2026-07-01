/* ─────────────────────────────────────────────────────────────────
   GIDF 9-Stage Framework — Complete Intelligence Content
   All data is Cambodia-specific, field-verified.
   ───────────────────────────────────────────────────────────────── */

export interface ProcessStep {
  n: number;
  title: string;
  desc: string;
  duration: string;
  risk: "low" | "medium" | "high";
}

export interface PermitRow {
  name: string;
  authority: string;
  costMin: number;
  costMax: number;
  weeksMin: number;
  weeksMax: number;
  notes: string;
  critical?: boolean;
}

export interface KeyStat {
  value: string;
  label: string;
  context: string;
  highlight?: boolean;
}

export interface OfficialSource {
  title: string;
  org: string;
  url: string;
  type: "gov" | "dev" | "research" | "ngo";
}

export interface FieldNote {
  text: string;
  type: "insight" | "warning" | "tip";
}

export interface StageContent {
  id: string;
  title: string;
  subtitle: string;
  heroStat: { value: string; label: string };
  whyItMatters: string;
  keyInsight: string;
  processSteps: ProcessStep[];
  keyStats: KeyStat[];
  permits: PermitRow[];
  /* Gantt-style timeline: estStart/actStart are week offsets (from stage
     kickoff) reflecting real dependencies — tasks with the same start can
     run in parallel, later starts mean they wait on an upstream task. */
  timelineChart: { name: string; estimated: number; actual: number; estStart: number; actStart: number }[];
  costBreakdown: { name: string; value: number; color: string }[];
  fieldNotes: FieldNote[];
  officialSources: OfficialSource[];
  checklist: { item: string; critical: boolean }[];
  extraChart?: {
    title: string;
    type: "bar" | "radar" | "area";
    data: { name: string; value: number; value2?: number }[];
    unit?: string;
    source?: string;
  };
}

const ORANGE = ["#ff5100", "#ff6a25", "#ff8144", "#ff9a65", "#ffb388", "#ffcbaa"];

export const STAGE_CONTENT: StageContent[] = [
  /* ─── STAGE 01: SITE SELECTION ──────────────────────────────── */
  {
    id: "01",
    title: "Site Selection",
    subtitle: "Province scoring, corridor analysis, and shortlisting before the first site visit",
    heroStat: { value: "14 mo", label: "average delay cost of skipping site analysis" },
    whyItMatters:
      "Site selection is the single most consequential decision in a Cambodia industrial project. The site you choose locks your electricity tariff zone for the building's commercial life (typically 20+ years), determines your labour pool depth and recruitment cost, sets your logistics equation to port or border, and — critically — dictates whether you can access CDC fast-track QIP incentives. Investors who arrive with a site already chosen typically spend 14 additional months correcting location decisions made without systematic data.",
    keyInsight:
      "3 CDC pre-cleared industrial corridors exist in Cambodia — but 30+ provinces have no gazetted industrial land policy, meaning you can buy title on land that has no approved pathway for a construction permit.",
    processSteps: [
      {
        n: 1, title: "Province Screening",
        desc: "Score all 25 provinces against 12 objective criteria: EDC grid headroom, flood risk, National Road access grade, port/border distance, labour pool within 30 km radius, title clarity index, provincial governor investment stance, CDC sub-office presence, reliable water source, broadband/fibre infrastructure, SEZ proximity, and healthcare access for expatriate technical staff.",
        duration: "1–2 weeks", risk: "low",
      },
      {
        n: 2, title: "Corridor Analysis",
        desc: "Cambodia's industrial activity clusters along 6 corridors: NR1 (Phnom Penh–Vietnam border), NR3/4 (Phnom Penh–Sihanoukville port), NR5 (Phnom Penh–Thailand border), NR6 (Phnom Penh–Siem Reap), Ring Road 3 (Phnom Penh orbital), and the Airport & Port corridor. Each has a distinct utility profile, wage rate, and logistics advantage. Corridor selection narrows the province shortlist from 25 to 3–5.",
        duration: "1–2 weeks", risk: "low",
      },
      {
        n: 3, title: "Site Shortlist (3 sites)",
        desc: "From corridor analysis, identify 3 candidate sites. For each: confirm EDC network capacity at provincial EDC office, verify land title type (hard LMAP vs soft title vs no title), check the site is within an approved industrial or commercial zone in the provincial spatial plan, and confirm flood elevation above the 1-in-25 year flood line using ODC GeoServer elevation data.",
        duration: "1–2 weeks", risk: "medium",
      },
      {
        n: 4, title: "Field Verification Visits",
        desc: "Physical inspection of all 3 shortlisted sites. Assess: visible power infrastructure within 500 m, road condition and width, natural drainage, proximity to worker housing areas, neighbouring industrial activity as validation signal, ground conditions (soft clay, rock, fill). Conduct a 30-minute briefing with the provincial governor's office — this is the most information-dense meeting of the whole process.",
        duration: "1–2 weeks", risk: "medium",
      },
      {
        n: 5, title: "Final Site Decision & Memorandum",
        desc: "Integrate field data into the 12-criteria scoring matrix. Rank all 3 sites. Produce a Site Selection Memorandum documenting the rationale, risk register, and recommended site. This document becomes the basis for the CDC pre-consultation and the land purchase negotiation.",
        duration: "1 week", risk: "low",
      },
    ],
    keyStats: [
      { value: "14 mo", label: "Avg delay without corridor analysis", context: "Projects skipping province/corridor screening average 14 months longer to first production", highlight: true },
      { value: "30+", label: "Provinces with no industrial land policy", context: "Over 30 of Cambodia's 25 provinces have no gazetted industrial zone or land use plan for industrial development" },
      { value: "12", label: "Scoring criteria used", context: "GentryLab scores each province against 12 objective criteria — EDC, flood, labour, roads, title clarity, and 7 more" },
      { value: "20 yr", label: "Utility cost lock-in", context: "Your EDC tariff zone determines electricity cost for the building's entire commercial life — a $0.04/kWh error = $840K on 3 MW over 20 years" },
    ],
    permits: [
      { name: "CDC Pre-Consultation Meeting", authority: "Council for Development of Cambodia", costMin: 0, costMax: 0, weeksMin: 1, weeksMax: 2, notes: "Free — but the most important meeting of the site selection phase. CDC can flag zone restrictions, upcoming SEZ boundaries, and fast-track eligibility before land is purchased.", critical: true },
      { name: "Provincial Investment Enquiry Letter", authority: "Provincial Governor Office", costMin: 0, costMax: 500, weeksMin: 1, weeksMax: 3, notes: "Required for QIP fast-track processing. Confirms provincial support — some governors issue this within 48 hours for strategic investors." },
      { name: "Industrial Zone Pre-Clearance Check", authority: "MLMUPC / Provincial Land Dept.", costMin: 200, costMax: 1000, weeksMin: 1, weeksMax: 2, notes: "Confirms whether the specific parcel sits within an approved industrial or commercial zone in the provincial spatial plan." },
    ],
    timelineChart: [
      { name: "Province Scoring", estimated: 2, actual: 2, estStart: 0, actStart: 0 },
      { name: "Corridor Analysis", estimated: 2, actual: 3, estStart: 2, actStart: 2 },
      { name: "Site Shortlist", estimated: 2, actual: 2, estStart: 4, actStart: 5 },
      { name: "Field Visits", estimated: 2, actual: 3, estStart: 6, actStart: 7 },
      { name: "Final Decision", estimated: 1, actual: 1, estStart: 8, actStart: 10 },
    ],
    costBreakdown: [
      { name: "Advisory fees", value: 58, color: ORANGE[0] },
      { name: "Field visit & travel", value: 22, color: ORANGE[1] },
      { name: "Registry searches", value: 12, color: ORANGE[2] },
      { name: "Translation & legal", value: 8, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "The provincial governor's office is the most underused intelligence source in site selection. A 30-minute meeting reveals planned infrastructure upgrades, upcoming SEZ boundary announcements, and known land disputes that no public database contains.", type: "insight" },
      { text: "EDC 'headroom' data (available MV capacity on the nearest 22kV feeder) is not publicly available — you must visit the provincial EDC office directly. Offices are generally forthcoming with this data for credible investors.", type: "tip" },
      { text: "Never purchase land before a CDC pre-consultation. Some parcels adjacent to protected areas or waterways have zero pathway to a construction permit regardless of their title type.", type: "warning" },
      { text: "The 6 industrial corridors have measurably different wage rates — NR5 provinces (Kampong Chhnang, Pursat) run 8–12% below NR1 corridor wages for equivalent skill levels, with similar EDC access.", type: "insight" },
    ],
    officialSources: [
      { title: "CDC Investment Guide & QIP Registration", org: "Council for Development of Cambodia", url: "https://cdc.gov.kh", type: "gov" },
      { title: "SEZ Smart Search — Zone Boundaries & Operators", org: "CDC / SEZB", url: "https://cdc.gov.kh/sez-smart-search/", type: "gov" },
      { title: "Open Development Cambodia — Industrial Zones GIS", org: "Open Development Cambodia", url: "https://opendevelopmentcambodia.net/profiles/special-economic-zones/", type: "research" },
      { title: "Cambodia National Spatial Development Framework", org: "Ministry of Land Management (MLMUPC)", url: "https://mlmupc.gov.kh", type: "gov" },
    ],
    checklist: [
      { item: "Book CDC pre-consultation before any land purchase or LOI", critical: true },
      { item: "Score all candidate provinces against 12 objective criteria", critical: true },
      { item: "Confirm land title type (hard LMAP vs soft title)", critical: true },
      { item: "Verify site is within approved industrial/commercial zone", critical: true },
      { item: "Check EDC available MV headroom at provincial EDC office", critical: true },
      { item: "Confirm flood elevation above 1-in-25 year flood line", critical: true },
      { item: "Meet provincial governor's office before site commitment", critical: false },
      { item: "Benchmark labour pool within 30 km radius", critical: false },
      { item: "Confirm fibre/broadband availability or timeline", critical: false },
      { item: "Shortlist 3 sites before visiting any of them", critical: false },
    ],
    extraChart: {
      title: "Industrial Land Price by Province (USD/m², 50-yr SEZ Lease Benchmark)",
      type: "bar",
      unit: "USD/m²",
      data: [
        { name: "Phnom Penh", value: 95 },
        { name: "Kandal", value: 78 },
        { name: "Sihanoukville", value: 70 },
        { name: "Kampong Speu", value: 52 },
        { name: "Kampong Cham", value: 38 },
        { name: "Siem Reap", value: 28 },
        { name: "Ratanakiri", value: 15 },
      ],
      source: "TGL Research estimate, benchmarked to CBRE Cambodia's national average 50-year SEZ land lease price (~USD 61–69/m², 2024–2025) with provincial differentials reflecting corridor proximity and demand. Verify current asking price with the specific zone developer before budgeting.",
    },
  },

  /* ─── STAGE 02: LAND DUE DILIGENCE ─────────────────────────── */
  {
    id: "02",
    title: "Land Due Diligence",
    subtitle: "Hard title verification, encumbrance search, and flood-risk overlay before any LOI",
    heroStat: { value: "70%", label: "of Cambodian industrial land lacks hard LMAP title" },
    whyItMatters:
      "Land title risk is the single biggest reason industrial projects stall in Cambodia. Only 30% of land in Cambodia's industrial corridors has a hard LMAP (Land Management and Administration Project) title — the only title type that provides internationally recognized, legally secure ownership. Soft-title land purchases regularly get blocked or contested mid-development, with disputes typically taking 2–3 years to resolve through Cambodia's courts. This means a project can be fully designed, permitted, and partially funded before a title dispute freezes construction.",
    keyInsight:
      "A hard LMAP title search at the cadastral office takes 2–4 weeks. Skipping it to accelerate a land deal has triggered 2–3 year project stalls in multiple documented Cambodia industrial cases.",
    processSteps: [
      {
        n: 1, title: "Title Type Assessment",
        desc: "First determine what type of document the seller holds: Hard LMAP (safest), Soft title (registered at commune level only), LMAP pending (in process), Temporary possession right, or no formal documentation. Only LMAP hard title is acceptable for a foreign industrial investor without a risk premium.",
        duration: "3–5 days", risk: "low",
      },
      {
        n: 2, title: "MLMUPC Hard Title Search",
        desc: "At the Ministry of Land Management, Urban Planning and Construction (MLMUPC) Cadastral Department, submit a formal title search request for the specific parcel. This confirms: exact owner(s), parcel dimensions, any registered mortgages, and whether the title is flagged for any government reservation or protected zone overlay.",
        duration: "2–3 weeks", risk: "medium",
      },
      {
        n: 3, title: "Encumbrance & Mortgage Check",
        desc: "Check for registered mortgages, liens, or encumbrances at the cadastral office. Cambodian sellers occasionally use land as collateral with microfinance institutions (ACLEDA, Hattha Bank, wing) — a fact not disclosed voluntarily. An encumbrance means the land cannot be legally transferred until the debt is cleared.",
        duration: "1 week", risk: "high",
      },
      {
        n: 4, title: "Chain of Title Verification",
        desc: "Trace the chain of title back a minimum of 2 transfers from the current seller. Cambodia's post-1979 land redistribution means some titles have complex histories. Identify any gaps in the chain — periods without documentation — which represent contested ownership risk. Engage a licensed Cambodia law firm for this step.",
        duration: "1–2 weeks", risk: "high",
      },
      {
        n: 5, title: "Flood & Environmental Constraint Overlay",
        desc: "Overlay the specific parcel against ODC GeoServer flood risk data, MOWRAM provincial watershed maps, and MoE protected area boundaries. Flood-prone land cannot receive a CDC EIA clearance. Protected area adjacency can block construction permits regardless of title status.",
        duration: "3–5 days", risk: "medium",
      },
      {
        n: 6, title: "Valuation & Purchase Agreement Review",
        desc: "Obtain an independent market valuation from a licensed property valuer. Review the sale & purchase agreement (SPA) with a licensed Cambodian law firm — ensure it includes: clear title warranty clause, dispute resolution (international arbitration preferred), phased payment tied to title transfer milestones, and right of rescission if title defects emerge post-signing.",
        duration: "1–2 weeks", risk: "medium",
      },
    ],
    keyStats: [
      { value: "30%", label: "Hard LMAP title coverage on industrial land", context: "Only 30% of Cambodia's industrial corridor land holds internationally recognized hard LMAP title", highlight: true },
      { value: "2–3 yr", label: "Average court resolution for title disputes", context: "Disputed land cases in Cambodia's provincial courts average 2–3 years to resolve — fully blocking construction" },
      { value: "90 days", label: "Minimum for thorough title chain review", context: "A rigorous chain-of-title verification tracking back 2 transfers requires a minimum of 3 months when courts are involved" },
      { value: "$0", label: "Cadastral title search fee (government)", context: "The MLMUPC title search is technically free — but expedited searches with a local agent cost $300–$1,500" },
    ],
    permits: [
      { name: "MLMUPC Hard Title Search", authority: "Ministry of Land Management (MLMUPC)", costMin: 300, costMax: 1500, weeksMin: 2, weeksMax: 4, notes: "Government fee is minimal; this cost covers a licensed agent to manage the search and translation of the certified title extract.", critical: true },
      { name: "Cadastral Map Extract", authority: "Provincial Cadastral Office", costMin: 150, costMax: 400, weeksMin: 1, weeksMax: 2, notes: "Official map showing parcel boundary, dimensions, and neighbouring parcels. Required for masterplan and construction permit submission." },
      { name: "Encumbrance Certificate", authority: "MLMUPC Cadastral Dept.", costMin: 200, costMax: 600, weeksMin: 1, weeksMax: 3, notes: "Confirms no registered mortgages, liens, or government reservations on the title. Critical before any payment to vendor.", critical: true },
      { name: "Legal Due Diligence (law firm)", authority: "Licensed Cambodia Law Firm", costMin: 2000, costMax: 8000, weeksMin: 3, weeksMax: 6, notes: "Chain of title review, SPA drafting, legal opinion letter. Fee varies with firm size and title complexity. Budget 1% of land value.", critical: true },
      { name: "Independent Valuation", authority: "Licensed Property Valuer", costMin: 1000, costMax: 3000, weeksMin: 1, weeksMax: 2, notes: "Required by international lenders and for financial reporting. Valuers accredited by Cambodia Valuers and Estate Agents Association." },
      { name: "Flood Risk Assessment", authority: "ODC / MOWRAM", costMin: 500, costMax: 1500, weeksMin: 1, weeksMax: 2, notes: "GIS overlay of parcel against 1-in-25 and 1-in-100 year flood lines. Essential before EIA application." },
    ],
    timelineChart: [
      { name: "Title Type Check", estimated: 1, actual: 1, estStart: 0, actStart: 0 },
      { name: "MLMUPC Search", estimated: 3, actual: 4, estStart: 1, actStart: 1 },
      { name: "Encumbrance Check", estimated: 1, actual: 2, estStart: 1, actStart: 1 },
      { name: "Chain of Title", estimated: 2, actual: 3, estStart: 4, actStart: 5 },
      { name: "Flood/Env Overlay", estimated: 1, actual: 1, estStart: 0, actStart: 0 },
      { name: "Valuation & SPA", estimated: 2, actual: 3, estStart: 6, actStart: 8 },
    ],
    costBreakdown: [
      { name: "Legal due diligence", value: 52, color: ORANGE[0] },
      { name: "Title search & certs", value: 22, color: ORANGE[1] },
      { name: "Independent valuation", value: 16, color: ORANGE[2] },
      { name: "Flood/env report", value: 10, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "The most common hidden risk in Cambodia land deals: the seller used the land title as collateral with a microfinance institution and has not disclosed it. An encumbrance check at the cadastral office takes 1 week and costs under $600 — this single step has saved multiple projects from 2-year legal disputes.", type: "warning" },
      { text: "Soft-title land is not automatically avoided — some very large, clean soft-title parcels can be converted to hard title through the LMAP process in 12–18 months. The risk calculation depends on the seller's reliability, parcel size, and your timeline tolerance.", type: "insight" },
      { text: "Hiring a law firm registered in both Cambodia and your home jurisdiction (Singapore, Japan, Korea) allows for legal opinions admissible in international arbitration — valuable if a dispute escalates.", type: "tip" },
      { text: "Provincial cadastral offices vary enormously in quality and speed. Sihanoukville, Kampong Speu, and Kandal offices adjacent to active industrial zones have faster turnaround than remote province offices.", type: "insight" },
    ],
    officialSources: [
      { title: "Land Law of Cambodia (2001 as amended)", org: "Ministry of Justice", url: "https://www.moj.gov.kh", type: "gov" },
      { title: "MLMUPC — Cadastral Department", org: "Ministry of Land Management", url: "https://mlmupc.gov.kh", type: "gov" },
      { title: "Open Development Cambodia — Land Tenure Data", org: "Open Development Cambodia", url: "https://opendevelopmentcambodia.net/topics/land/", type: "research" },
      { title: "World Bank Cambodia Land Administration", org: "World Bank", url: "https://projects.worldbank.org/en/projects-operations/project-detail/P099003", type: "dev" },
    ],
    checklist: [
      { item: "Confirm title type — hard LMAP is the only acceptable title for industrial use", critical: true },
      { item: "Run MLMUPC hard title search before any LOI or deposit", critical: true },
      { item: "Obtain encumbrance certificate confirming zero mortgages/liens", critical: true },
      { item: "Trace chain of title back minimum 2 ownership transfers", critical: true },
      { item: "Overlay parcel against flood risk (1-in-25 year line)", critical: true },
      { item: "Check parcel is not within protected area boundary (MoE map)", critical: true },
      { item: "Engage a licensed Cambodia law firm for SPA review", critical: true },
      { item: "Obtain independent valuation from licensed property valuer", critical: false },
      { item: "Confirm cadastral map matches actual site boundaries on ground", critical: false },
      { item: "Request MOWRAM watershed map confirmation for water rights", critical: false },
    ],
    extraChart: {
      title: "Cambodia Industrial Land Title Distribution (%)",
      type: "bar",
      unit: "%",
      data: [
        { name: "Hard LMAP Title", value: 30 },
        { name: "Soft Title Only", value: 45 },
        { name: "LMAP Pending", value: 15 },
        { name: "No Formal Title", value: 10 },
      ],
    },
  },

  /* ─── STAGE 03: MASTER PLANNING ────────────────────────────── */
  {
    id: "03",
    title: "Master Planning",
    subtitle: "CDC-compliant site layout that unlocks QIP status and 9 years of tax exemption",
    heroStat: { value: "60%", label: "of first CDC masterplan submissions are rejected" },
    whyItMatters:
      "The masterplan is the CDC's primary review document for granting Qualified Investment Project (QIP) status — Cambodia's most powerful investment incentive package, offering 3–9 years of corporate income tax exemption plus import duty waiver on capital goods and construction materials. A rejected masterplan means a full redesign cycle (3–6 months) and delays the entire permit sequence. Most rejections stem from missing the mandatory 15% green space allocation and inadequate fire access road width — both easily avoided with the right brief.",
    keyInsight:
      "QIP status, unlocked by a CDC-approved masterplan, is worth more than any negotiated tax deal — it can save $2–15M in taxes and duties on a mid-size industrial project.",
    processSteps: [
      {
        n: 1, title: "Site Survey & Boundary Confirmation",
        desc: "Commission a licensed topographic survey confirming parcel boundary, existing structures, ground level (relative to local flood datum), utility easements, and access road widths. This survey becomes the base drawing for all masterplan and architectural work.",
        duration: "1–2 weeks", risk: "low",
      },
      {
        n: 2, title: "Program Brief",
        desc: "Define the production program: factory footprint (m²), office area, worker facilities (canteen, locker rooms), guard post, parking, truck turning area, utility plant room, generator compound, fire water tank, and waste treatment area. The brief determines how much site area is committed to production vs mandatory compliance areas.",
        duration: "1 week", risk: "low",
      },
      {
        n: 3, title: "Concept Layout & CDC Compliance Review",
        desc: "Develop the concept site layout against CDC mandatory requirements: minimum 15% green space of total site area, 6 m minimum fire access road encircling all buildings, minimum 2 vehicle access gates, utility entry points from the road boundary, waste treatment zone setback from production areas, and building setback from boundary (typically 5–10 m).",
        duration: "2–3 weeks", risk: "medium",
      },
      {
        n: 4, title: "MoE EIA Pre-Submission",
        desc: "Before CDC QIP submission, confirm with the Ministry of Environment whether an Initial Environmental Impact Assessment (IEIA) or full EIA is required. Projects over 2,000 m² of built area in most industrial categories require at minimum an IEIA. The EIA must be submitted to MoE concurrently or before CDC QIP application.",
        duration: "2–4 weeks", risk: "high",
      },
      {
        n: 5, title: "CDC Masterplan Submission",
        desc: "Submit the masterplan package to CDC's CIB (Cambodian Investment Board): site plan, access plan, utility plan, green space plan, waste management plan, and the QIP application form. CDC reviews within 28 working days. First-round rejection is common — engage a CDC-registered consultant to pre-review before submission.",
        duration: "4–8 weeks", risk: "high",
      },
      {
        n: 6, title: "QIP Registration & Certificate",
        desc: "Upon masterplan approval, CDC issues the QIP Registration Certificate — the foundation document for all subsequent incentive claims. Register the QIP with the General Department of Taxation (GDT) within 30 days to activate the tax exemption period countdown.",
        duration: "1–2 weeks", risk: "low",
      },
    ],
    keyStats: [
      { value: "60%", label: "First CDC masterplan submissions rejected", context: "Green space deficiency and fire access width are the two most common rejection triggers", highlight: true },
      { value: "9 yr", label: "Maximum QIP tax exemption period", context: "Priority sectors (electronics, food processing, logistics) can qualify for up to 9 years of CIT exemption" },
      { value: "15%", label: "Mandatory green space", context: "CDC requires a minimum 15% of total site area as landscaped green space — hard to retrofit if the site is already fully laid out" },
      { value: "6 m", label: "Minimum fire access road width", context: "Fire department and CDC both require 6 m clear width around all industrial buildings — the most commonly missed specification" },
    ],
    permits: [
      { name: "CDC QIP Registration", authority: "Council for Development of Cambodia", costMin: 1500, costMax: 3000, weeksMin: 4, weeksMax: 8, notes: "Primary incentive registration. Unlocks CIT exemption, import duty waiver on capital goods. CDC processes within 28 working days of complete submission.", critical: true },
      { name: "MoE Initial EIA (IEIA)", authority: "Ministry of Environment", costMin: 2000, costMax: 8000, weeksMin: 8, weeksMax: 16, notes: "Required for most projects >2,000 m² built area. Parallel-path with CDC QIP — submit simultaneously to save 2–3 months.", critical: true },
      { name: "MoE Full EIA", authority: "Ministry of Environment", costMin: 10000, costMax: 50000, weeksMin: 24, weeksMax: 52, notes: "Required for high-risk categories (chemicals, heavy industry, large-scale food processing). Budget 6–12 months for full EIA cycle." },
      { name: "Topographic Survey", authority: "Licensed Survey Firm", costMin: 1500, costMax: 5000, weeksMin: 1, weeksMax: 2, notes: "Licensed surveyor required. Output: boundary confirmation + existing structure as-built drawings + ground level contours." },
      { name: "Masterplan Architectural Drawings", authority: "Licensed Architect / BAC", costMin: 5000, costMax: 20000, weeksMin: 3, weeksMax: 6, notes: "Must be signed and sealed by a BAC-registered architect (Board of Architect Cambodia). CDC will not accept unsigned or unsealed drawings." },
    ],
    timelineChart: [
      { name: "Site Survey", estimated: 2, actual: 2, estStart: 0, actStart: 0 },
      { name: "Program Brief", estimated: 1, actual: 1, estStart: 0, actStart: 0 },
      { name: "Concept Layout", estimated: 3, actual: 4, estStart: 2, actStart: 2 },
      { name: "MoE Pre-Sub", estimated: 4, actual: 6, estStart: 5, actStart: 6 },
      { name: "CDC Submission", estimated: 6, actual: 8, estStart: 5, actStart: 6 },
      { name: "QIP Certificate", estimated: 2, actual: 2, estStart: 11, actStart: 14 },
    ],
    costBreakdown: [
      { name: "EIA preparation", value: 45, color: ORANGE[0] },
      { name: "Masterplan architecture", value: 30, color: ORANGE[1] },
      { name: "CDC & MoE fees", value: 15, color: ORANGE[2] },
      { name: "Survey & studies", value: 10, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "The 15% green space rule has a nuance: roof gardens and planted podiums do not qualify. The 15% must be at-grade, planted, and accessible. Plan this into the site from Day 1 — it is almost impossible to retrofit.", type: "warning" },
      { text: "Submit the MoE EIA application on the same day as the CDC QIP application. They are independent processes but running them in parallel saves 2–3 months. CDC will issue QIP conditional on EIA approval.", type: "tip" },
      { text: "CDC approval timelines vary enormously by sector. Electronics and food processing projects are currently prioritized and can get conditional approval in 4–6 weeks. General manufacturing takes 8–12 weeks.", type: "insight" },
      { text: "The GDT registration step after QIP issuance is frequently missed by first-time investors. The tax exemption clock starts from the date of GDT registration — not the CDC certificate date. A 3-month gap costs 3 months of exemption.", type: "warning" },
    ],
    officialSources: [
      { title: "CDC QIP Application Guide", org: "Council for Development of Cambodia", url: "https://cdc.gov.kh/incentives-and-schemes/", type: "gov" },
      { title: "MoE EIA Guidelines & Sub-Decree 72", org: "Ministry of Environment", url: "https://www.moe.gov.kh", type: "gov" },
      { title: "Cambodia National Building Code", org: "Ministry of Public Works", url: "https://mpwt.gov.kh", type: "gov" },
      { title: "Board of Architect Cambodia (BAC)", org: "Board of Architect Cambodia", url: "https://bac.gov.kh", type: "gov" },
    ],
    checklist: [
      { item: "Commission licensed topographic survey before any design work", critical: true },
      { item: "Allocate minimum 15% at-grade green space in concept layout", critical: true },
      { item: "Ensure 6 m minimum fire access road width encircles all buildings", critical: true },
      { item: "Confirm minimum 2 vehicle access gates in layout", critical: true },
      { item: "Include waste treatment zone setback from production buildings", critical: true },
      { item: "Submit MoE EIA and CDC QIP applications simultaneously", critical: true },
      { item: "Use BAC-registered architect to sign and seal all architectural drawings", critical: true },
      { item: "Register QIP with GDT within 30 days of CDC certificate issuance", critical: true },
      { item: "Include utility entry points from road boundary in site plan", critical: false },
      { item: "Show fire water tank location and capacity in masterplan", critical: false },
    ],
    extraChart: {
      title: "QIP Tax Exemption Period by Sector (Years)",
      type: "bar",
      unit: "years",
      data: [
        { name: "Electronics", value: 9 },
        { name: "Food Processing", value: 9 },
        { name: "Logistics/Warehouse", value: 7 },
        { name: "Garment / Footwear", value: 6 },
        { name: "Pharmaceutical", value: 9 },
        { name: "General Mfg", value: 3 },
        { name: "Tourism", value: 3 },
      ],
    },
  },

  /* ─── STAGE 04: UTILITY STRATEGY ───────────────────────────── */
  {
    id: "04",
    title: "Utility Strategy",
    subtitle: "Power, water, and wastewater decisions that determine 20-year operating cost",
    heroStat: { value: "$0.04", label: "per kWh provincial tariff differential = $840K over 20 yr on 3 MW" },
    whyItMatters:
      "Utility decisions made in the first month of a project determine the operating cost structure for the next 20 years. Cambodia's EDC tariff varies by $0.04–0.06/kWh between provinces — on a 3 MW industrial load, that is $840,000 difference over 20 years from site selection alone. Beyond cost, the biggest utility risk is timeline: a new 115kV/22kV substation takes 8–24 months to commission, and this single item is on the critical path for factory handover. New substation requirements have caused more Cambodia industrial project delays than any other single factor.",
    keyInsight:
      "80% of EPC budget overruns in Cambodia industrial projects trace back to utility connection costs that were excluded from the main contractor's scope — always price utility connections separately, with contingency.",
    processSteps: [
      {
        n: 1, title: "Load Calculation",
        desc: "Develop a detailed electrical load schedule from the production program: production machinery, HVAC (if any), lighting, compressed air, lifts, water pumps, and standby/emergency loads. Include 20% future expansion headroom. The connected load (kVA) and maximum demand (kW) determine the substation size and EDC supply agreement.",
        duration: "1–2 weeks", risk: "low",
      },
      {
        n: 2, title: "EDC Provincial Feasibility Study",
        desc: "Submit a formal Load Application to the provincial EDC office. EDC will conduct a network feasibility study — typically 4–8 weeks. The study determines: nearest available MV feeder, whether a dedicated transformer or substation is required, expected connection voltage (22kV or 115kV), and indicative connection cost and timeline. This document is critical for EPC budgeting.",
        duration: "4–8 weeks", risk: "high",
      },
      {
        n: 3, title: "Substation Sizing & Supply Agreement",
        desc: "Based on the feasibility study, select substation configuration: shared feeder tap (fastest, lowest cost, lowest reliability), dedicated MV transformer (medium), or investor-owned 115/22kV grid substation (longest timeline, highest cost, highest reliability for large loads). Negotiate the Power Supply Agreement (PSA) with EDC covering tariff category, connected load cap, and connection timeline.",
        duration: "2–4 weeks", risk: "medium",
      },
      {
        n: 4, title: "Water Source & MOWRAM Permit",
        desc: "Determine water supply strategy: for Phnom Penh and surrounding areas, PPWSA (Phnom Penh Water Supply Authority) is the dedicated municipal water utility — the equivalent of EDC for electricity, but for water. Sites outside PPWSA's network rely on provincial municipal water, private borehole (requires MOWRAM drilling and extraction permit), or surface water extraction (MOWRAM watershed use permit). Industrial water demand calculation: process water + cooling + drinking/sanitary. Note: borehole extraction in some provinces is now restricted due to groundwater depletion.",
        duration: "2–4 weeks", risk: "medium",
      },
      {
        n: 5, title: "Wastewater Treatment & MIME Discharge Permit",
        desc: "Design wastewater treatment plant (WWTP) to meet MIME Class B discharge standard (BOD5 ≤30 mg/L, SS ≤50 mg/L, pH 6–9). MIME requires detailed WWTP design drawings and operating manual as part of the discharge permit application. Discharge permit must be obtained before factory operations commence — violations carry factory closure orders.",
        duration: "4–8 weeks", risk: "high",
      },
    ],
    keyStats: [
      { value: "$0.12–0.18", label: "EDC industrial tariff range (¢/kWh by province)", context: "Varies from $0.124 in Phnom Penh to $0.180 in remote provinces — a 45% difference across Cambodia", highlight: true },
      { value: "8–24 mo", label: "New grid substation lead time", context: "A dedicated 115/22kV grid substation for loads above 3–5 MW takes 8–24 months — the #1 critical path risk for factory handover" },
      { value: "80%", label: "EPC overruns from utility surprises", context: "Utility connection works are regularly excluded from main contractor BOQ — always price separately" },
      { value: "Class B", label: "MIME wastewater discharge standard", context: "BOD5 ≤30 mg/L, SS ≤50 mg/L, pH 6–9 — requires designed and certified treatment plant before operations" },
    ],
    permits: [
      { name: "EDC Load Application & Feasibility", authority: "Electricité du Cambodge (EDC)", costMin: 500, costMax: 2000, weeksMin: 4, weeksMax: 8, notes: "Determines network feasibility, connection voltage, and substation requirements. Critical path item — submit as early as possible.", critical: true },
      { name: "EDC Power Supply Agreement (PSA)", authority: "Electricité du Cambodge (EDC)", costMin: 10000, costMax: 50000, weeksMin: 4, weeksMax: 12, notes: "Connection fee depends on distance to nearest feeder, substation size, and trenching works. Varies enormously by location — budget $10K–$50K+.", critical: true },
      { name: "PPWSA Water Supply Connection", authority: "Phnom Penh Water Supply Authority (PPWSA)", costMin: 500, costMax: 3000, weeksMin: 2, weeksMax: 6, notes: "For sites within PPWSA's Phnom Penh network — apply directly for a municipal water connection instead of drilling a borehole. Confirm main-line pressure and capacity at the site before sizing on-site storage." },
      { name: "MOWRAM Water Extraction Permit", authority: "Ministry of Water Resources", costMin: 1000, costMax: 5000, weeksMin: 4, weeksMax: 8, notes: "Required for borehole or surface water extraction outside PPWSA's network. Some provinces have restricted borehole extraction — check provincial MOWRAM office first." },
      { name: "MIME Wastewater Discharge Permit", authority: "Ministry of Industry (MIME)", costMin: 2000, costMax: 8000, weeksMin: 6, weeksMax: 12, notes: "Must be obtained before factory operations. Requires detailed WWTP design drawings and operating manual. MIME inspects the WWTP before permit issuance.", critical: true },
      { name: "Telecom Infrastructure Agreement", authority: "ISP / Ministry of Post & Telecoms", costMin: 500, costMax: 5000, weeksMin: 2, weeksMax: 8, notes: "Negotiate fibre connection with ISP (Metfone, Cellcard, Smart). Some provinces require MPTC coordination for leased line routing." },
    ],
    timelineChart: [
      { name: "Load Calculation", estimated: 2, actual: 2, estStart: 0, actStart: 0 },
      { name: "EDC Feasibility", estimated: 6, actual: 8, estStart: 2, actStart: 2 },
      { name: "Substation Agreement", estimated: 4, actual: 5, estStart: 8, actStart: 10 },
      { name: "Water Permit", estimated: 5, actual: 6, estStart: 0, actStart: 0 },
      { name: "WWTP Design", estimated: 4, actual: 5, estStart: 5, actStart: 6 },
      { name: "MIME Discharge Permit", estimated: 8, actual: 10, estStart: 9, actStart: 11 },
    ],
    costBreakdown: [
      { name: "Power connection fee", value: 48, color: ORANGE[0] },
      { name: "WWTP design & build", value: 28, color: ORANGE[1] },
      { name: "Water infrastructure", value: 14, color: ORANGE[2] },
      { name: "Permits & studies", value: 10, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "The critical path trap: developers lock the factory programme and design before getting EDC's feasibility result. If EDC requires a new substation (8–24 months), the entire construction programme must shift. Submit the EDC Load Application on Day 1.", type: "warning" },
      { text: "On-site solar (rooftop PPA) can offset 15–35% of industrial power demand in Cambodia's climate. Some investors negotiate the solar PPA alongside the EDC connection — the offset reduces connected load requirements, cutting EDC connection fees.", type: "tip" },
      { text: "MIME's wastewater Class B standard is achievable with a well-designed activated sludge or SBR system. The common mistake is building an undersized WWTP — design for 130% of calculated peak load with provision for a second stage.", type: "insight" },
      { text: "Provinces along the NR1 and NR3 corridors have the most reliable EDC network and fastest connection timelines. Remote provinces can have 18–24+ month connection timelines even for small loads.", type: "insight" },
    ],
    officialSources: [
      { title: "EDC Industrial Tariff Schedule", org: "Electricité du Cambodge", url: "https://edc.com.kh", type: "gov" },
      { title: "PPWSA Water Supply & Connection Info", org: "Phnom Penh Water Supply Authority", url: "https://www.ppwsa.com.kh/", type: "gov" },
      { title: "MIME Industrial Wastewater Standards (Sub-Decree 27)", org: "Ministry of Industry", url: "https://mime.gov.kh", type: "gov" },
      { title: "MOWRAM Water Resources Law", org: "Ministry of Water Resources", url: "https://mowram.gov.kh", type: "gov" },
      { title: "EAC Electricity Regulatory Framework", org: "Electricity Authority of Cambodia", url: "https://eac.gov.kh", type: "gov" },
    ],
    checklist: [
      { item: "Submit EDC Load Application on Day 1 of project — it is on the critical path", critical: true },
      { item: "Include 20% future expansion headroom in load calculation", critical: true },
      { item: "Get EDC feasibility result before locking factory programme or design", critical: true },
      { item: "Budget EDC connection fee separately from main EPC contract", critical: true },
      { item: "Check provincial MOWRAM office for borehole extraction restrictions", critical: true },
      { item: "Confirm MIME WWTP design meets Class B discharge standard", critical: true },
      { item: "Obtain MIME discharge permit before factory commissioning date", critical: true },
      { item: "Evaluate on-site solar PPA to reduce connected load and cost", critical: false },
      { item: "Negotiate standby generator scope in EPC contract (EDC outages are common)", critical: false },
      { item: "Confirm telecom fibre route and ISP lead time to site", critical: false },
    ],
    extraChart: {
      title: "EDC Power Tariff by Province (USD¢/kWh, Industrial Category)",
      type: "bar",
      unit: "¢/kWh",
      data: [
        { name: "Phnom Penh", value: 12.4 },
        { name: "Kandal", value: 12.9 },
        { name: "Kampong Speu", value: 15.5 },
        { name: "Sihanoukville", value: 14.2 },
        { name: "Siem Reap", value: 17.1 },
        { name: "Kampong Cham", value: 16.8 },
        { name: "Ratanakiri", value: 18.0 },
      ],
    },
  },

  /* ─── STAGE 05: PERMIT NAVIGATION ──────────────────────────── */
  {
    id: "05",
    title: "Permit Navigation",
    subtitle: "9 ministry approvals in the right sequence — sequence is everything",
    heroStat: { value: "9", label: "separate ministry approvals — sequence determines timeline" },
    whyItMatters:
      "Cambodia's industrial permit sequence involves 9 separate ministries and agencies. The sequence is not arbitrary — submitting them in the wrong order triggers restart requirements from earlier permits. Done correctly and in parallel, the full permit stack takes 8–11 months. Done incorrectly or sequentially, the same 9 permits take 18–30 months. GentryLab's permit navigation service — managing sequencing, submission timing, and government liaison — is the highest-return advisory engagement we offer relative to the cost.",
    keyInsight:
      "Most permit delays in Cambodia industrial projects are not caused by government slowness — they are caused by investors submitting in the wrong order or submitting incomplete packages that trigger re-review cycles.",
    processSteps: [
      {
        n: 1, title: "MoE Environmental Compliance Certificate (ECC)",
        desc: "Submit the EIA (or IEIA) and Environmental Management Plan (EMP) to MoE. This is the first permit in the sequence — no other operating permits can be issued without MoE ECC. For initial environmental impact assessments, MoE typically reviews within 60 working days; full EIAs take 120–240 working days.",
        duration: "8–16 weeks", risk: "high",
      },
      {
        n: 2, title: "CDC QIP Registration",
        desc: "Submit QIP application package to CDC CIB simultaneously with MoE submission. CDC QIP registration unlocks all fiscal incentives and provides investment protection status. Submit alongside the MoE ECC — CDC will issue QIP conditional on ECC, but the review clock starts from submission date.",
        duration: "4–8 weeks", risk: "medium",
      },
      {
        n: 3, title: "MISTI Operating Licence",
        desc: "Ministry of Industry (MISTI) Operating Licence authorizes the industrial activity category. Required before production can commence. Submit after MoE ECC conditional approval. Requires: company registration, QIP registration, site plan, and list of machinery. MISTI typically reviews in 4–6 weeks.",
        duration: "4–6 weeks", risk: "medium",
      },
      {
        n: 4, title: "MoLVT Labour Compliance Certificate",
        desc: "Ministry of Labour and Vocational Training compliance registration covers: employment contract template approval, worker health and safety policy, HR manual, and the hiring registration quota. Required before any workers can be formally employed at the site. Budget 4–6 weeks for the initial compliance package review.",
        duration: "4–6 weeks", risk: "low",
      },
      {
        n: 5, title: "Construction Building Permit",
        desc: "Issued by MLMUPC (Ministry of Land Management, Urban Planning and Construction), delegated to the Provincial or Capital Department of Land Management. Governed by Cambodia Construction Law 2019 (Article 26) and MLMUPC Prakas No. 261 (2026). The review runs 8 sequential stages: document check (2 days) → architectural review covering FAR, BCR, setbacks, and green space (20 days) → fire safety (20 days) → structural review (20 days) → structural engineer sign-off (10 days) → final compilation and permit issuance (2 days). Total official review: ~67 working days. Submit with BAC-stamped architectural drawings and BEC-stamped structural drawings, land title, topographic survey, MEP drawings, and BCR/FAR calculations — 9 copies required. Note: a separate Occupancy Certificate (Article 44) is required before the building may be occupied.",
        duration: "8–16 weeks", risk: "high",
      },
      {
        n: 6, title: "Fire Department Approval",
        desc: "National Police Fire Department pre-construction approval for fire safety system design: sprinkler layout, hose reel locations, fire escape widths, fire alarm panel. A second inspection (commissioning sign-off) is required after construction completion before the occupancy certificate is issued.",
        duration: "2–4 weeks", risk: "low",
      },
      {
        n: 7, title: "EDC Connection & Meter Agreement",
        desc: "After substation or transformer construction is complete, submit formal connection application to EDC for meter installation and supply commencement. Coordinate EDC inspection timeline with construction handover — EDC connection is on the critical path for factory commissioning.",
        duration: "8–24 weeks", risk: "high",
      },
      {
        n: 8, title: "MIME Wastewater Discharge Permit",
        desc: "Issued after WWTP construction and MIME inspection confirms the treatment system meets Class B discharge standards. Must be obtained before any process wastewater is discharged. MIME inspects the WWTP in operation — schedule this inspection 2–4 weeks before planned factory operations start.",
        duration: "4–8 weeks", risk: "medium",
      },
      {
        n: 9, title: "Customs Clearance (SEZ only)",
        desc: "For projects in an SEZ: register with the SEZ Customs Branch for in-zone customs clearance. This allows same-day import/export processing versus 3–5 days through the national Phnom Penh customs system. Required for bonded warehouse status and direct export from the zone.",
        duration: "2–4 weeks", risk: "low",
      },
    ],
    keyStats: [
      { value: "8–11 mo", label: "Permit timeline done correctly (parallel)", context: "Running MoE, CDC, and building permits simultaneously brings the full stack to 8–11 months", highlight: true },
      { value: "18–30 mo", label: "Permit timeline done incorrectly (sequential)", context: "Sequential submission with restarts from wrong-order filings regularly extends to 18–30 months" },
      { value: "$8–29K", label: "Total permit fee range", context: "All 9 permits combined cost $8,300–29,300 in official fees — excluding legal/consultant costs" },
      { value: "9", label: "Separate ministry approvals required", context: "MoE, CDC, MISTI, MoLVT, Fire Dept, Municipality, EDC, MIME, Customs — each independent with separate documentation requirements" },
    ],
    permits: [
      { name: "MoE Environmental Compliance Certificate (ECC)", authority: "Ministry of Environment", costMin: 2000, costMax: 10000, weeksMin: 8, weeksMax: 24, notes: "First permit — the critical path anchor. IEIA for standard projects; full EIA for high-risk categories. Submit Day 1.", critical: true },
      { name: "CDC QIP Registration", authority: "Council for Development of Cambodia", costMin: 1500, costMax: 3000, weeksMin: 4, weeksMax: 8, notes: "Submit simultaneously with MoE ECC. CDC issues conditional QIP pending ECC — review clock starts from submission date.", critical: true },
      { name: "MISTI Operating Licence", authority: "Ministry of Industry (MISTI)", costMin: 500, costMax: 2000, weeksMin: 4, weeksMax: 6, notes: "Issued after MoE ECC. Authorises the specific industrial activity category. Required before production." },
      { name: "MoLVT Labour Compliance", authority: "Ministry of Labour (MoLVT)", costMin: 300, costMax: 800, weeksMin: 2, weeksMax: 4, notes: "Employment contract template, worker health & safety policy, HR manual approval. Required before employing workers." },
      { name: "Construction Building Permit (លិខិតអនុញ្ញាតសាងសង់)", authority: "MLMUPC / Provincial Dept. of Land Management", costMin: 3000, costMax: 25000, weeksMin: 8, weeksMax: 16, notes: "Legal basis: Construction Law 2019 Art. 26; MLMUPC Prakas No. 261 (2026). Fee set by joint MEF–MLMUPC Prakas, typically $3–8/m² of GFA for industrial buildings. Submit with 9 copies of application form, land title, CAMUP-stamped architectural + structural drawings, MEP drawings, fire safety plan, BCR/FAR calculations. Multi-stage review: architectural (20 days) → fire (20 days) → structural (20 days) → final issuance (2 days). Submit after CDC masterplan approval to avoid re-review.", critical: true },
      { name: "Fire Department Pre-Construction Approval", authority: "National Police Fire Department", costMin: 500, costMax: 2000, weeksMin: 2, weeksMax: 4, notes: "Two-stage: pre-construction design approval + post-construction commissioning sign-off before occupancy." },
      { name: "EDC Connection Agreement", authority: "Electricité du Cambodge", costMin: 10000, costMax: 50000, weeksMin: 8, weeksMax: 24, notes: "Connection cost varies enormously by location and substation requirement. Budget as separate line item.", critical: true },
      { name: "MIME Wastewater Discharge Permit", authority: "Ministry of Industry (MIME)", costMin: 2000, costMax: 5000, weeksMin: 4, weeksMax: 8, notes: "MIME inspects WWTP in operation before permit. Schedule inspection 2–4 weeks before planned operations start." },
      { name: "SEZ Customs Branch Registration", authority: "General Dept. of Customs (GDCE)", costMin: 500, costMax: 2000, weeksMin: 2, weeksMax: 4, notes: "SEZ projects only. Enables same-day in-zone customs clearance vs 3–5 days via national Phnom Penh customs." },
    ],
    timelineChart: [
      { name: "MoE ECC", estimated: 12, actual: 16, estStart: 0, actStart: 0 },
      { name: "CDC QIP", estimated: 6, actual: 7, estStart: 12, actStart: 16 },
      { name: "MISTI Licence", estimated: 5, actual: 6, estStart: 18, actStart: 23 },
      { name: "MoLVT Labour", estimated: 3, actual: 3, estStart: 0, actStart: 0 },
      { name: "Building Permit", estimated: 8, actual: 12, estStart: 23, actStart: 29 },
      { name: "Fire Dept", estimated: 3, actual: 3, estStart: 23, actStart: 29 },
      { name: "EDC Connection", estimated: 12, actual: 18, estStart: 0, actStart: 0 },
      { name: "MIME Discharge", estimated: 6, actual: 7, estStart: 31, actStart: 41 },
    ],
    costBreakdown: [
      { name: "EDC connection fee", value: 55, color: ORANGE[0] },
      { name: "MoE EIA / ECC", value: 20, color: ORANGE[1] },
      { name: "Building permit", value: 12, color: ORANGE[2] },
      { name: "All other permits", value: 13, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "The MoE ECC is the master gate permit. Every other operating permit references or requires the ECC number. Delaying the MoE submission by even 4 weeks shifts the entire 9-permit sequence by 4 weeks.", type: "warning" },
      { text: "CDC has a fast-track track for QIP submissions in priority sectors (electronics, food processing, textile, pharmaceuticals). Qualifying investors receive a dedicated CIB officer and 14-day review commitment instead of 28.", type: "tip" },
      { text: "The Construction Building Permit involves 8 distinct review stages under MLMUPC Prakas No. 261 (2026) — the official review alone is 67 working days. The fee ($3–8/m² of GFA) is set by joint MEF–MLMUPC Prakas and is calculated on gross floor area including mezzanines. Always get written fee confirmation before submitting; provincial interpretations vary. The Construction Law 2019 (Article 44) requires a separate Occupancy Certificate before the building may be used.", type: "insight" },
      { text: "The most common permit restart trigger: applying for the MISTI operating licence before MoE ECC is confirmed. MISTI will issue a conditional licence, but if the ECC application changes in scope, the MISTI licence must be re-submitted.", type: "warning" },
    ],
    officialSources: [
      { title: "CDC Investment Incentives & QIP Guide", org: "Council for Development of Cambodia", url: "https://cdc.gov.kh/incentives-and-schemes/", type: "gov" },
      { title: "Law on Construction 2019 (NS/RKM/1119/019)", org: "Ministry of Land Management (MLMUPC)", url: "https://mlmupc.gov.kh", type: "gov" },
      { title: "MLMUPC Prakas No. 261 — 2026 Construction Permit Guidelines", org: "Ministry of Land Management (MLMUPC)", url: "https://mlmupc.gov.kh", type: "gov" },
      { title: "MoE EIA Procedural Sub-Decree 72 ANKE", org: "Ministry of Environment", url: "https://moe.gov.kh", type: "gov" },
      { title: "MISTI Industrial Licence Application", org: "Ministry of Industry", url: "https://mih.gov.kh", type: "gov" },
      { title: "MoLVT Labour Law Compliance Guide", org: "Ministry of Labour", url: "https://mlvt.gov.kh", type: "gov" },
    ],
    checklist: [
      { item: "Submit MoE ECC application on Day 1 — it anchors everything else", critical: true },
      { item: "Submit CDC QIP simultaneously with MoE ECC, not after", critical: true },
      { item: "Obtain MISTI licence after MoE ECC, not before", critical: true },
      { item: "Budget EDC connection fee as separate line item, not in main EPC", critical: true },
      { item: "Prepare 9 full copies of all application documents for MLMUPC submission", critical: true },
      { item: "Ensure architectural drawings are BAC-stamped and structural drawings are BEC-stamped before submission", critical: true },
      { item: "Submit Construction Permit application after CDC masterplan approval", critical: true },
      { item: "Get written building permit fee confirmation before submission (provincial rates vary)", critical: false },
      { item: "Apply for Occupancy Certificate (Art. 44, Construction Law 2019) before using building", critical: true },
      { item: "Schedule Fire Dept pre-construction review before construction starts", critical: true },
      { item: "Plan MIME WWTP inspection 2–4 weeks before planned production start", critical: true },
      { item: "Register with SEZ customs branch if in an SEZ", critical: false },
      { item: "Run MoLVT compliance registration in parallel with construction permits", critical: false },
    ],
    extraChart: {
      title: "Permit Timeline: Estimated vs Typical Actual (Weeks)",
      type: "bar",
      unit: "weeks",
      data: [
        { name: "MoE ECC", value: 12, value2: 18 },
        { name: "CDC QIP", value: 6, value2: 8 },
        { name: "Building Permit", value: 8, value2: 12 },
        { name: "EDC Connection", value: 12, value2: 20 },
        { name: "MIME Discharge", value: 6, value2: 8 },
      ],
    },
  },

  /* ─── STAGE 06: FACTORY DESIGN ─────────────────────────────── */
  {
    id: "06",
    title: "Factory Design",
    subtitle: "Structural system, specification, and Cambodia-specific loading requirements",
    heroStat: { value: "$280–420", label: "per m² — under-spec today means +40% in retrofit costs tomorrow" },
    whyItMatters:
      "Factory design in Cambodia must balance international production standards with local construction constraints, climate loading (wet season roof loads, typhoon wind), and the limited availability of specialist subcontractors. The most expensive mistake is under-specification: a factory built to minimum standards for a low-cost manufacturing use that is later adapted for food-grade or pharma production requires $80–150/m² in retrofit capital — often more than specifying correctly from the start. GentryLab's benchmark database of 60+ delivered Cambodia industrial buildings enables investors to calibrate design specs against real cost outcomes.",
    keyInsight:
      "Cambodian wet season roof loading is minimum 1.5 kN/m² with local roof standards — most imported factory designs from temperate climates are under-loaded for Cambodia's rainfall intensity.",
    processSteps: [
      { n: 1, title: "Production Brief & Space Programme", desc: "Define the exact manufacturing process flow: production line layout, aisle widths, loading dock positions, staging areas, quality control area, cleanroom requirements (if any), overhead crane or gantry loads, mezzanine floor loads, and future production expansion provisions.", duration: "1–2 weeks", risk: "low" },
      { n: 2, title: "Structural System Selection", desc: "Primary structural system choice: steel portal frame (optimal for garment, light assembly, electronics, logistics — cost $180–240/m²), pre-engineered building (PEB — fastest programme, competitive cost for standard rectangular footprints), or reinforced concrete (required for pharma, food-grade, heavy loads — cost $240–320/m²). Choice drives 40% of the total building cost.", duration: "1 week", risk: "medium" },
      { n: 3, title: "Concept Design & Area Schedule", desc: "Develop the concept design showing: structural grid, column positions and sizes, roof pitch, eave height, bay widths, loading dock height and quantity, office integration, MEP plant room location, fire escape routes, and disabled access compliance. Area schedule must match CDC-approved masterplan areas — any increase triggers CDC re-submission.", duration: "2–3 weeks", risk: "medium" },
      { n: 4, title: "Design Development & Specification", desc: "Develop the full design development package: structural calculations (licensed engineer), MEP design (HVAC, electrical, plumbing, fire protection), floor slab specification (thickness, flatness class, joint spacing), roof and cladding specification, loading dock equipment spec, and external works. Critical specs: roof load 1.5 kN/m² min, floor flatness FM2 for logistics (3 mm over 3 m).", duration: "4–6 weeks", risk: "medium" },
      { n: 5, title: "Tender Package & Contractor Pre-Qualification", desc: "Prepare the tender package: full architectural and engineering drawings, bill of quantities (BOQ), technical specification, and contract conditions. Pre-qualify minimum 3 contractors: 1 international or regional (ASEAN), 1 experienced local, 1 emerging local. Receiving 3 quotes is required for CDC-registered projects.", duration: "3–4 weeks", risk: "low" },
    ],
    keyStats: [
      { value: "$280–420", label: "Industrial build cost range per m²", context: "Steel portal frame: $280–340/m². RC frame (pharma/food grade): $350–420/m². Excludes land, utilities, external works.", highlight: true },
      { value: "40%", label: "Extra retrofit cost from under-specification", context: "Factories built to minimum spec that are later upgraded for food-grade or pharma use cost 40%+ more than building correctly from start" },
      { value: "1.5 kN/m²", label: "Minimum Cambodia roof load", context: "Cambodian wet season rainfall intensity requires 1.5 kN/m² minimum roof loading — most imported temperate-climate designs are under-loaded" },
      { value: "FM2", label: "Minimum floor flatness for logistics", context: "FM2 flatness class (3 mm deviation over 3 m) is required for modern racking systems, forklifts, and automated material handling" },
    ],
    permits: [
      { name: "BAC Architect Registration & Stamp", authority: "Board of Architect Cambodia (BAC)", costMin: 1000, costMax: 3000, weeksMin: 1, weeksMax: 2, notes: "All architectural drawings must be stamped by a BAC-registered architect. Foreign architects must co-sign with a locally registered BAC member.", critical: true },
      { name: "BEC Structural Engineer Registration", authority: "Board of Engineer Cambodia (BEC)", costMin: 500, costMax: 2000, weeksMin: 1, weeksMax: 2, notes: "Structural calculations and drawings must be signed by a BEC-registered engineer. Foreign engineers must co-sign with a licensed local BEC member." },
      { name: "Fire Safety System Design Approval", authority: "National Police Fire Department", costMin: 500, costMax: 2000, weeksMin: 2, weeksMax: 4, notes: "Fire protection design (sprinkler, alarm, escape routes) reviewed by Fire Department before building permit submission." },
    ],
    timelineChart: [
      { name: "Production Brief", estimated: 2, actual: 2, estStart: 0, actStart: 0 },
      { name: "Structural System", estimated: 1, actual: 2, estStart: 0, actStart: 0 },
      { name: "Concept Design", estimated: 3, actual: 4, estStart: 2, actStart: 2 },
      { name: "Design Development", estimated: 5, actual: 7, estStart: 5, actStart: 6 },
      { name: "Tender Package", estimated: 3, actual: 4, estStart: 10, actStart: 13 },
    ],
    costBreakdown: [
      { name: "Civil / Structural", value: 38, color: ORANGE[0] },
      { name: "MEP systems", value: 28, color: ORANGE[1] },
      { name: "Roofing / Cladding", value: 18, color: ORANGE[2] },
      { name: "Fit-out & finishes", value: 16, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "Cambodia's wet season (June–October) generates rainfall intensities up to 120 mm/hr. Factory roofs designed to temperate standards (60–80 mm/hr) experience regular ponding and structural overload. Specify 150 mm/hr drainage capacity.", type: "warning" },
      { text: "Pre-engineered buildings (PEB) from suppliers like BlueScope, Kirby, or Robertson are typically 15–20% faster to erect than site-fabricated steel. For standard rectangular factories above 3,000 m², PEB is almost always the best value option.", type: "tip" },
      { text: "Column-free spans above 24 m are available with portal frame construction and are strongly preferred by most production users. Standard 15–18 m column spans reduce production line flexibility significantly.", type: "insight" },
      { text: "The single biggest design specification error in Cambodia industrial builds: inadequate electrical room size. As production scales and power density increases, undersized electrical rooms force expensive external switchgear solutions. Double the calculated size.", type: "warning" },
    ],
    officialSources: [
      { title: "Cambodia National Building Code", org: "Ministry of Public Works & Transport", url: "https://mpwt.gov.kh", type: "gov" },
      { title: "Board of Architect Cambodia (BAC)", org: "Board of Architect Cambodia", url: "https://bac.gov.kh", type: "gov" },
      { title: "Board of Engineer Cambodia (BEC)", org: "Board of Engineer Cambodia", url: "https://bec.gov.kh", type: "gov" },
      { title: "ASEAN Industrial Construction Standards", org: "ASEAN", url: "https://asean.org", type: "research" },
    ],
    checklist: [
      { item: "Define production line layout and crane/overhead load requirements before structural system selection", critical: true },
      { item: "Specify minimum 1.5 kN/m² roof loading and 150 mm/hr drainage capacity", critical: true },
      { item: "Specify FM2 floor flatness for any logistics, racking, or forklift use", critical: true },
      { item: "Use BAC-registered architect for architectural drawings, BEC-registered engineer for structural drawings", critical: true },
      { item: "Size electrical room at minimum 2× calculated requirement", critical: false },
      { item: "Include 20% future expansion provision in column grid layout", critical: false },
      { item: "Confirm loading dock height matches local truck height (typically 1.2 m)", critical: false },
      { item: "Include generator room in the design from Day 1", critical: false },
    ],
    extraChart: {
      title: "Factory Build Cost Benchmark by Type (USD/m²)",
      type: "bar",
      unit: "$/m²",
      data: [
        { name: "Light Assembly (Steel PF)", value: 285 },
        { name: "Garment (Steel PF)", value: 310 },
        { name: "Logistics Warehouse", value: 295 },
        { name: "Electronics (RC Frame)", value: 365 },
        { name: "Food Processing (RC)", value: 395 },
        { name: "Pharmaceutical (RC)", value: 420 },
      ],
    },
  },

  /* ─── STAGE 07: EPC BUDGETING ───────────────────────────────── */
  {
    id: "07",
    title: "EPC Budgeting",
    subtitle: "Bill of quantities, three-contractor benchmarking, and contingency strategy",
    heroStat: { value: "23%", label: "average cost overrun on Cambodia industrial builds" },
    whyItMatters:
      "The average Cambodia industrial construction project exceeds its initial budget by 23%. This is not a Cambodia-specific failure — it is an EPC process failure: 80% of overruns come from utility connection works excluded from the main contractor's scope, VAT misunderstandings, currency fluctuation on imported materials, and scope creep on MEP systems. GentryLab's benchmark database of 60+ delivered industrial buildings in Cambodia allows investors to independently verify contractor quotes against real-world cost outcomes before signing any EPC contract.",
    keyInsight:
      "Always price utility connection works (EDC substation, WWTP, external roads, telecom) as a completely separate line item — main contractors routinely exclude these from their scope with no note in the BOQ.",
    processSteps: [
      { n: 1, title: "Quantity Takeoff from Design Drawings", desc: "From the design development drawings, produce a detailed Bill of Quantities (BOQ) covering all trades: earthworks, concrete and masonry, structural steel, roofing and cladding, external works, plumbing, drainage, electrical, HVAC, fire protection, security, and fit-out. The BOQ must be independently prepared by the project quantity surveyor — not by the contractor who will quote on it.", duration: "2–3 weeks", risk: "low" },
      { n: 2, title: "3-Contractor Quote Process", desc: "Send tender package to minimum 3 pre-qualified contractors: 1 international or regional ASEAN contractor, 1 experienced Cambodia-based contractor, 1 emerging local contractor. Standardize the BOQ to ensure all quotes are priced against identical scope. Analyse variations between quotes — significant divergence (>15%) signals scope interpretation differences or capacity/risk pricing.", duration: "3–4 weeks", risk: "medium" },
      { n: 3, title: "Utility Connection Costs (Separate Scope)", desc: "Price all utility connection works separately from the main building EPC: EDC feeder/substation civil works, WWTP complete construction, external water supply pipe, wastewater collection network to the WWTP, generator and UPS supply and install, external roads and car parks, perimeter fence and security gate. This scope can represent 15–25% of total project cost.", duration: "2–3 weeks", risk: "high" },
      { n: 4, title: "Contingency Strategy", desc: "Minimum contingency: 10% of total construction cost for straightforward projects; 15% if EDC connection requirement is unconfirmed; 20% if any portion of the works involves unusual ground conditions, heritage constraints, or a first-time product category for the contractor team. Contingency is held by the employer, not released to the contractor.", duration: "1 week", risk: "low" },
      { n: 5, title: "VAT, Stamp Duty & Professional Fees", desc: "Add to the budget: 10% VAT on all construction works (VAT-registered contractor); stamp duty on the land sale and purchase agreement (4% of declared value — widely under-declared, which creates ongoing legal risk); professional fees (architects, engineers, QS, PM — typically 6–9% of construction cost); and owner-side insurance (CAR/EAR policy).", duration: "1 week", risk: "low" },
    ],
    keyStats: [
      { value: "23%", label: "Average cost overrun on Cambodia builds", context: "GentryLab database of 60+ buildings — unbenchmarked projects average 23% over budget", highlight: true },
      { value: "8%", label: "Average overrun with GentryLab benchmarking", context: "Benchmarked and pre-negotiated projects using GentryLab's cost database average only 8% over final budget" },
      { value: "80%", label: "Of overruns from utility & scope exclusions", context: "Utility connection works, VAT, and scope creep account for 80% of all budget overruns" },
      { value: "10–20%", label: "Recommended contingency range", context: "10% for clean projects; 15% for uncertain utility connections; 20% for first-of-type or ground risk projects" },
    ],
    permits: [
      { name: "Quantity Surveyor (QS) Certification", authority: "Licensed QS Firm", costMin: 3000, costMax: 12000, weeksMin: 2, weeksMax: 4, notes: "Independent QS-prepared BOQ is the most important cost control tool. Fee: 0.5–1% of construction value. Saves multiples of its fee in contractor over-pricing detection." },
      { name: "Construction All-Risks Insurance (CAR)", authority: "Licensed Insurer", costMin: 5000, costMax: 30000, weeksMin: 1, weeksMax: 2, notes: "Employer-side CAR/EAR policy covering the works during construction. Premium: 0.2–0.4% of contract value. Required by most lenders." },
      { name: "Stamp Duty on Land Transfer", authority: "General Department of Taxation (GDT)", costMin: 0, costMax: 0, weeksMin: 1, weeksMax: 4, notes: "4% of official declared land value. Under-declaration is common but creates ongoing legal risk on resale and refinancing. Budget 4% of real purchase price." },
    ],
    timelineChart: [
      { name: "BOQ Preparation", estimated: 3, actual: 3, estStart: 0, actStart: 0 },
      { name: "Contractor Tendering", estimated: 4, actual: 5, estStart: 3, actStart: 3 },
      { name: "Utility Costing", estimated: 3, actual: 4, estStart: 0, actStart: 0 },
      { name: "Contingency Planning", estimated: 1, actual: 1, estStart: 7, actStart: 8 },
      { name: "Final Budget Sign-off", estimated: 1, actual: 2, estStart: 8, actStart: 9 },
    ],
    costBreakdown: [
      { name: "Main EPC contract", value: 72, color: ORANGE[0] },
      { name: "Utility connections", value: 18, color: ORANGE[1] },
      { name: "Professional fees", value: 7, color: ORANGE[2] },
      { name: "Insurance & duties", value: 3, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "The 3-contractor quote process consistently reveals 15–25% variation between the highest and lowest quotes for identical scope. The lowest quote is not always scope-correct — require all contractors to provide a written exclusions list alongside their price.", type: "insight" },
      { text: "VAT on construction works (10%) is the most commonly forgotten line item in investor-prepared budgets. Cambodian contractors can be VAT-registered or not — a non-registered contractor cannot charge VAT but also cannot provide a VAT invoice for your accounting.", type: "warning" },
      { text: "Currency risk: most Cambodia construction contracts are priced in USD but some material costs (especially local concrete, aggregates, labour) fluctuate with the KHR/USD rate. Include a currency fluctuation provision of 3–5% in contingency.", type: "tip" },
      { text: "The stamp duty under-declaration practice (declaring land at 20–30% of real purchase price to reduce the 4% duty) creates a title value mismatch that complicates refinancing, insurance, and future sale. Declare at the correct value.", type: "warning" },
    ],
    officialSources: [
      { title: "GDT Construction Tax & VAT Guidelines", org: "General Dept. of Taxation", url: "https://tax.gov.kh", type: "gov" },
      { title: "Cambodia Construction Industry Association", org: "CCIM", url: "https://ccim.org.kh", type: "research" },
      { title: "ASEAN Construction Cost Benchmark Reports", org: "AECOM / Turner & Townsend", url: "https://www.turnerandtownsend.com", type: "research" },
    ],
    checklist: [
      { item: "Commission independent QS to prepare the BOQ — not the contractor", critical: true },
      { item: "Price utility connection works as a completely separate line item", critical: true },
      { item: "Request written exclusions list from every contractor alongside quote", critical: true },
      { item: "Add minimum 10% contingency (15% if EDC connection unconfirmed)", critical: true },
      { item: "Include 10% VAT in budget calculation for all construction works", critical: true },
      { item: "Budget 4% stamp duty on declared land value (use real value)", critical: false },
      { item: "Budget professional fees at 6–9% of construction cost", critical: false },
      { item: "Obtain CAR/EAR insurance before construction mobilisation", critical: false },
    ],
    extraChart: {
      title: "Budget Overrun Analysis — Benchmarked vs Unbenchmarked Projects",
      type: "bar",
      unit: "%",
      data: [
        { name: "Utility exclusions", value: 10, value2: 5 },
        { name: "Scope creep", value: 6, value2: 1 },
        { name: "Currency / material", value: 4, value2: 1 },
        { name: "Design changes", value: 3, value2: 1 },
      ],
    },
  },

  /* ─── STAGE 08: DELIVERY ────────────────────────────────────── */
  {
    id: "08",
    title: "Delivery",
    subtitle: "Construction programme, critical path management, and Cambodia's two dry seasons",
    heroStat: { value: "35–45%", label: "construction pace reduction in the June–October wet season" },
    whyItMatters:
      "Cambodia's construction calendar is driven by two factors: the wet season (June–October) reduces construction pace by 35–45% as concrete curing is affected, earthworks are disrupted, and worker attendance drops; and the dry season window (November–May) is the only reliable time for foundation and earthworks on most sites. Projects that miss the dry season window for foundation works typically slip 6 months — the exact length of one full wet season. GentryLab schedules every critical path around Cambodia's two dry windows and sets contractual milestones accordingly.",
    keyInsight:
      "Foundation works must start by March at the latest to be complete before the June wet season — missing this window adds exactly 6 months to the programme.",
    processSteps: [
      { n: 1, title: "Mobilisation & Site Clearing", desc: "Contractor mobilises site office, equipment, and labour. Site is cleared, hoarding erected, security guard post established. Temporary power (generator), water, and sanitation installed for construction workforce.", duration: "2–3 weeks", risk: "low" },
      { n: 2, title: "Earthworks & Foundation (Critical — Dry Season)", desc: "Bulk earthworks, site levelling, and compaction to finished floor level (FFL). Foundation excavation, piling (if required), and concrete pour. This is the most climate-sensitive phase — must be substantially complete before June wet season onset. Wet-season earthworks in clay-heavy soils can set a project back 3–4 months.", duration: "6–10 weeks", risk: "high" },
      { n: 3, title: "Structural Frame Erection", desc: "Erection of structural steel portal frame (or RC frame pouring for concrete structures). Steel frame erection for a 10,000 m² factory typically takes 6–8 weeks. Concrete frame structures take 12–16 weeks. Steel frame can proceed through wet season with reduced efficiency; concrete is more weather-sensitive.", duration: "6–12 weeks", risk: "medium" },
      { n: 4, title: "Roof & Cladding Envelope", desc: "Installation of roof sheeting, gutters, downpipes, and wall cladding panels. Envelope closure is the milestone that makes the building 'watertight' and allows MEP and fit-out to proceed in parallel. Prioritize envelope closure before wet season to protect internal works.", duration: "4–6 weeks", risk: "medium" },
      { n: 5, title: "MEP Rough-In & Fit-Out", desc: "Parallel MEP installation: electrical (main switchboard, distribution, lighting, power points), plumbing (water supply, drainage), fire protection (sprinkler system, fire alarm), HVAC (if any), and compressed air. Fit-out: floor hardener application, office partitioning, loading dock doors and dock levellers, paint.", duration: "6–10 weeks", risk: "medium" },
      { n: 6, title: "Utility Connections & Testing", desc: "EDC power connection and meter installation (coordinate with EDC 4–6 weeks ahead), water supply connection, WWTP commissioning, generator commissioning, fire system certification inspection (Fire Department), and telecom/fibre termination. All utilities must be tested before handover.", duration: "4–8 weeks", risk: "high" },
      { n: 7, title: "Commissioning & Handover", desc: "Snagging and defect rectification, final cleaning, Building Occupation Certificate (BOC) application to the municipality, Fire Department commissioning sign-off, MIME WWTP inspection, EDC meter sealing. Hand over of as-built drawings, O&M manuals, warranty certificates, and all permit originals.", duration: "2–4 weeks", risk: "low" },
    ],
    keyStats: [
      { value: "35–45%", label: "Wet season construction pace reduction", context: "June to October: concrete curing affected, earthworks disrupted, labour attendance reduced — averages 35–45% slower than dry season pace", highlight: true },
      { value: "10–14 mo", label: "Typical programme for 5,000–15,000 m² factory", context: "Clean site, design-complete, dry-season start: 10–14 months from mobilisation to handover" },
      { value: "6 mo", label: "Programme slip from missing dry season foundation window", context: "Missing the November–May foundation window adds precisely one wet season to the programme — exactly 6 months" },
      { value: "Nov–May", label: "Optimal foundation works window", context: "November to May is Cambodia's reliable dry season — the only window for earthworks and concrete in clay-heavy soils" },
    ],
    permits: [
      { name: "Building Occupation Certificate (BOC)", authority: "City Hall / Provincial DPWT", costMin: 500, costMax: 3000, weeksMin: 2, weeksMax: 4, notes: "Required before occupancy. Inspector visits the completed building and checks compliance with the approved building permit drawings.", critical: true },
      { name: "Fire Department Commissioning Sign-Off", authority: "National Police Fire Department", costMin: 300, costMax: 1000, weeksMin: 1, weeksMax: 3, notes: "Second fire inspection (first was pre-construction). All fire systems must be operational and tested before this inspection.", critical: true },
      { name: "MIME WWTP Commissioning Inspection", authority: "Ministry of Industry (MIME)", costMin: 500, costMax: 2000, weeksMin: 2, weeksMax: 6, notes: "MIME inspector verifies the WWTP is operational and discharging at Class B standard. Schedule 4 weeks before planned production start.", critical: true },
    ],
    timelineChart: [
      { name: "Mobilisation", estimated: 3, actual: 3, estStart: 0, actStart: 0 },
      { name: "Earthworks & Foundation", estimated: 8, actual: 11, estStart: 3, actStart: 3 },
      { name: "Structural Frame", estimated: 8, actual: 10, estStart: 11, actStart: 14 },
      { name: "Roof & Cladding", estimated: 5, actual: 6, estStart: 16, actStart: 20 },
      { name: "MEP & Fit-Out", estimated: 8, actual: 9, estStart: 19, actStart: 24 },
      { name: "Utilities & Testing", estimated: 5, actual: 7, estStart: 27, actStart: 33 },
      { name: "Commissioning", estimated: 3, actual: 4, estStart: 32, actStart: 40 },
    ],
    costBreakdown: [
      { name: "Structural & civil", value: 42, color: ORANGE[0] },
      { name: "MEP systems", value: 28, color: ORANGE[1] },
      { name: "Roof & envelope", value: 18, color: ORANGE[2] },
      { name: "Fit-out & external", value: 12, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "Cambodia's wet season peak (August–September) brings Phnom Penh and Kampong Speu to near-impassable conditions on un-surfaced access roads. If the site access road is not paved before August, material deliveries can stop entirely for 4–6 weeks.", type: "warning" },
      { text: "Piling is almost always required in Phnom Penh, Kandal, and low-lying Kampong Speu areas due to soft alluvial soils. Bear capacities in these areas can be as low as 50 kN/m² at 1.5 m depth. Get a geotechnical report before any foundation design.", type: "tip" },
      { text: "The most underestimated milestone: EDC meter connection. EDC engineers and the contractor's electrical team must coordinate inspections, and EDC's availability is often 3–6 weeks behind the contractor's schedule. Start EDC coordination 3 months before handover.", type: "warning" },
      { text: "Two distinct climate windows in the dry season: Nov–Feb (cool dry — best for concrete work), March–May (hot dry — concrete curing must be managed with covers, but earthworks are excellent). Prioritize concrete works in the Nov–Feb window.", type: "insight" },
    ],
    officialSources: [
      { title: "Cambodia Climate & Rainfall Data (MOWRAM)", org: "Ministry of Water Resources", url: "https://mowram.gov.kh", type: "gov" },
      { title: "Cambodian National Construction Code", org: "Ministry of Public Works", url: "https://mpwt.gov.kh", type: "gov" },
      { title: "MoE ODC Flood Risk GIS", org: "Open Development Cambodia", url: "https://opendevelopmentcambodia.net", type: "research" },
    ],
    checklist: [
      { item: "Start foundation works before March to complete before June wet season", critical: true },
      { item: "Pave site access road before August wet season peak", critical: true },
      { item: "Commission geotechnical report before foundation design", critical: true },
      { item: "Coordinate EDC connection timeline at least 3 months before handover", critical: true },
      { item: "Close building envelope (roof + cladding) before wet season", critical: true },
      { item: "Schedule MIME WWTP inspection 4 weeks before production start", critical: true },
      { item: "Schedule Fire Department commissioning inspection 2 weeks before occupancy", critical: true },
      { item: "Apply for Building Occupation Certificate (BOC) at completion", critical: false },
      { item: "Obtain and archive all as-built drawings and O&M manuals at handover", critical: false },
    ],
    extraChart: {
      title: "Construction Activity Index by Month (1.0 = peak dry season)",
      type: "area",
      unit: "index",
      data: [
        { name: "Jan", value: 1.0 },
        { name: "Feb", value: 1.0 },
        { name: "Mar", value: 0.9 },
        { name: "Apr", value: 0.85 },
        { name: "May", value: 0.75 },
        { name: "Jun", value: 0.60 },
        { name: "Jul", value: 0.55 },
        { name: "Aug", value: 0.55 },
        { name: "Sep", value: 0.58 },
        { name: "Oct", value: 0.65 },
        { name: "Nov", value: 0.85 },
        { name: "Dec", value: 0.95 },
      ],
    },
  },

  /* ─── STAGE 09: OPERATIONS ─────────────────────────────────── */
  {
    id: "09",
    title: "Operations",
    subtitle: "Compliance calendar, MEP maintenance, customs strategy, and annual audit cycle",
    heroStat: { value: "Same-day", label: "SEZ customs clearance vs 3–5 days outside zone" },
    whyItMatters:
      "The operational phase is where the regulatory decisions made in earlier stages pay off or cost money every month. An SEZ facility clears customs the same day — a non-SEZ facility waits 3–5 days per shipment at the national Phnom Penh customs office. For a factory shipping weekly, that is 156–260 days of tied-up inventory per year. The compliance calendar is equally important: MIME waste audits, MoLVT labour audits, fire system certifications, and EDC meter reconciliations all have fixed cadences — missing any triggers fines or operating licence suspension.",
    keyInsight:
      "The first MoLVT labour audit typically happens within 90 days of hiring the first 10 employees — most investors are not ready for this and receive a compliance improvement notice on the first visit.",
    processSteps: [
      { n: 1, title: "MEP Maintenance Programme", desc: "Establish a preventive maintenance programme for all MEP systems from Day 1 of operations: HVAC service (monthly filter, quarterly full service), electrical thermographic scan (annual), generator load test (monthly), fire alarm system test (monthly), sprinkler flow test (annual), WWTP daily monitoring, water pump inspection (quarterly). Engage a licensed facility management company in the first month.", duration: "Ongoing", risk: "low" },
      { n: 2, title: "MIME Waste Audit Preparation (Quarterly)", desc: "MIME conducts unannounced quarterly waste audits. Required records: daily WWTP discharge log (BOD, SS, pH measurements), waste manifest for all solid waste streams (including packaging and hazardous waste), chemical storage register, spill response plan, and signed delivery receipts for all chemical inputs. Most factories fail their first audit due to incomplete logbooks.", duration: "Ongoing (quarterly)", risk: "high" },
      { n: 3, title: "MoLVT Labour Compliance (Annual + Ad Hoc)", desc: "Ministry of Labour conducts scheduled annual audits plus unannounced visits for factories with 10+ employees. Required: employment contract copies for all workers, timekeeping records (overtime log), payslips with all mandated deductions, health and safety incident register, fire drill records (twice annually), and NSSF (National Social Security Fund) contribution confirmation.", duration: "Ongoing (annual)", risk: "medium" },
      { n: 4, title: "Fire System Annual Certification", desc: "Fire Department requires annual re-certification of all fire protection systems. Engage a licensed fire system maintenance company for the annual test and certification. Keep the Fire Department certificate current — expired certificates can trigger Operating Licence suspension by MISTI.", duration: "Annual", risk: "medium" },
      { n: 5, title: "EDC Meter Reconciliation & Bill Management", desc: "Reconcile EDC monthly bills against internal energy metering. Track power consumption by production line to identify inefficiencies. Maintain the EDC supply agreement on file — any changes to connected load cap require a new PSA application. Monitor for unannounced EDC tariff adjustments (typically announced with 30 days notice).", duration: "Monthly", risk: "low" },
      { n: 6, title: "Annual Operating Licence Renewal", desc: "MISTI Operating Licence must be renewed annually. Renewal requires: MIME compliance confirmation, MoLVT clearance letter, Fire Department certificate, and updated company registration. Penalties for expired licences: fines plus risk of production shutdown order. Set a 60-day advance reminder in your compliance calendar.", duration: "Annual", risk: "high" },
    ],
    keyStats: [
      { value: "Same-day", label: "SEZ in-zone customs clearance", context: "SEZ operators clear imports/exports same-day through in-zone customs — versus 3–5 working days via national Phnom Penh customs", highlight: true },
      { value: "4", label: "Mandatory MIME waste audits per year", context: "Quarterly unannounced MIME inspections — most factories fail their first audit due to incomplete discharge logbooks" },
      { value: "$15–30K", label: "Annual compliance cost estimate", context: "All mandatory audits, certifications, renewals, and facility management for a standard industrial factory" },
      { value: "90 days", label: "Before first MoLVT audit after hiring 10+ workers", context: "MoLVT typically visits within 90 days of registration if the factory has 10+ employees — prepare HR records before Day 1 of hiring" },
    ],
    permits: [
      { name: "MISTI Operating Licence Renewal", authority: "Ministry of Industry (MISTI)", costMin: 300, costMax: 1000, weeksMin: 2, weeksMax: 4, notes: "Annual renewal. Requires MIME clearance + MoLVT clearance + Fire Dept certificate. Start process 60 days before expiry.", critical: true },
      { name: "MIME Wastewater Discharge Permit Renewal", authority: "Ministry of Industry (MIME)", costMin: 500, costMax: 2000, weeksMin: 2, weeksMax: 4, notes: "Annual renewal contingent on quarterly compliance. MIME quarterly audit records are the primary evidence." },
      { name: "Fire System Annual Certificate", authority: "National Police Fire Department", costMin: 300, costMax: 1000, weeksMin: 1, weeksMax: 3, notes: "Annual re-certification of fire alarm, sprinkler, and suppression systems. Required for MISTI licence renewal.", critical: true },
      { name: "NSSF Registration & Contributions", authority: "National Social Security Fund", costMin: 0, costMax: 0, weeksMin: 1, weeksMax: 2, notes: "Monthly contribution: 0.8% of gross salary (health care) + 2.5% of gross salary (pension). Employer pays 2.5%; employee pays 2.5% for pension. Failure is an MoLVT audit priority." },
      { name: "CDC Investment Activity Report", authority: "Council for Development of Cambodia", costMin: 0, costMax: 0, weeksMin: 1, weeksMax: 1, notes: "Annual statutory report to CDC on production output, employment, investment progress. Required to maintain QIP tax exemption status." },
    ],
    timelineChart: [
      { name: "MEP Maintenance Setup", estimated: 2, actual: 3, estStart: 0, actStart: 0 },
      { name: "MIME Audit Readiness", estimated: 4, actual: 6, estStart: 0, actStart: 0 },
      { name: "MoLVT HR Setup", estimated: 3, actual: 4, estStart: 0, actStart: 0 },
      { name: "First MIME Audit", estimated: 12, actual: 12, estStart: 4, actStart: 6 },
      { name: "Licence Renewal Cycle", estimated: 4, actual: 5, estStart: 16, actStart: 18 },
    ],
    costBreakdown: [
      { name: "Facility management", value: 38, color: ORANGE[0] },
      { name: "Compliance & audits", value: 28, color: ORANGE[1] },
      { name: "Energy & utilities", value: 24, color: ORANGE[2] },
      { name: "Security & insurance", value: 10, color: ORANGE[3] },
    ],
    fieldNotes: [
      { text: "Set up your WWTP discharge logbook on Day 1 of operations — before the first MIME quarterly audit. The logbook must show daily measurements of BOD, SS, and pH. MIME auditors check for consistent, plausible daily entries — sporadic or missing entries are treated as non-compliance.", type: "warning" },
      { text: "SEZ customs registration provides the most valuable operational advantage for export manufacturers. Same-day import and export clearance without Phnom Penh customs transit cuts shipping lead times by 3–5 days per cycle — a major competitive advantage for JIT supply chains.", type: "insight" },
      { text: "The annual CDC Investment Activity Report is frequently overlooked after the project excitement fades. Missing this report triggers a QIP status suspension notice — which can freeze the tax exemption counting and require a formal reinstatement process.", type: "warning" },
      { text: "Engage a licensed facility management (FM) company before factory handover, not after. The first 30 days of operations are the highest-risk period for MEP failures — systems are new, staff are unfamiliar, and operational loads are being established.", type: "tip" },
    ],
    officialSources: [
      { title: "MISTI Operating Licence Renewal Procedure", org: "Ministry of Industry", url: "https://mih.gov.kh", type: "gov" },
      { title: "MIME Environmental Compliance & Audit", org: "Ministry of Industry", url: "https://mime.gov.kh", type: "gov" },
      { title: "MoLVT Labour Audit Compliance Guide", org: "Ministry of Labour", url: "https://mlvt.gov.kh", type: "gov" },
      { title: "NSSF Registration & Contribution Rates", org: "National Social Security Fund", url: "https://nssf.gov.kh", type: "gov" },
      { title: "General Dept. of Customs — SEZ Procedures", org: "GDCE", url: "https://customs.gov.kh", type: "gov" },
    ],
    checklist: [
      { item: "Engage licensed FM company before handover, not after", critical: true },
      { item: "Start WWTP discharge logbook on Day 1 of operations", critical: true },
      { item: "Set 60-day advance calendar reminder for all annual licence renewals", critical: true },
      { item: "Prepare HR employment records before hiring first 10 employees", critical: true },
      { item: "Register with NSSF in first week of operations", critical: true },
      { item: "Submit annual CDC Investment Activity Report on schedule", critical: true },
      { item: "Register with SEZ Customs Branch if in an SEZ", critical: false },
      { item: "Schedule fire drill twice per year (MoLVT requirement)", critical: false },
      { item: "Establish monthly EDC bill reconciliation against internal metering", critical: false },
      { item: "Keep all permit originals in secure, organised archive", critical: false },
    ],
    extraChart: {
      title: "SEZ vs Non-SEZ: Operational Advantage Comparison",
      type: "bar",
      unit: "days",
      data: [
        { name: "Customs clearance", value: 0.5, value2: 4 },
        { name: "Permit renewals (avg weeks)", value: 3, value2: 5 },
        { name: "Utility connection (months)", value: 6, value2: 14 },
      ],
    },
  },
];

export function getStage(id: string): StageContent | undefined {
  return STAGE_CONTENT.find((s) => s.id === id);
}

export function getPrev(id: string): StageContent | undefined {
  const idx = STAGE_CONTENT.findIndex((s) => s.id === id);
  return idx > 0 ? STAGE_CONTENT[idx - 1] : undefined;
}

export function getNext(id: string): StageContent | undefined {
  const idx = STAGE_CONTENT.findIndex((s) => s.id === id);
  return idx < STAGE_CONTENT.length - 1 ? STAGE_CONTENT[idx + 1] : undefined;
}
