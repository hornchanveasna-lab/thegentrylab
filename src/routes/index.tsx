import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { useReveal } from "@/components/site/Counter";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";
import { useLang } from "@/lib/i18n";

// Lazy-load map (Leaflet is browser-only)
const IndustrialMap = lazy(() =>
  import("@/components/site/IndustrialMap").then((m) => ({ default: m.IndustrialMap }))
);

export const Route = createFileRoute("/")({
  component: Index,
});

/* ── Speed streaks ───────────────────────────────────────── */
const STREAKS = [
  { left: "10%", top: "80%", width: 320, duration: 2.8, delay: 0.0 },
  { left: "5%",  top: "70%", width: 180, duration: 3.4, delay: 0.6 },
  { left: "20%", top: "90%", width: 260, duration: 2.5, delay: 1.2 },
  { left: "35%", top: "85%", width: 400, duration: 3.1, delay: 0.3 },
  { left: "15%", top: "60%", width: 220, duration: 4.0, delay: 1.8 },
  { left: "50%", top: "95%", width: 300, duration: 2.7, delay: 0.9 },
  { left: "60%", top: "75%", width: 160, duration: 3.6, delay: 2.1 },
  { left: "40%", top: "55%", width: 280, duration: 2.9, delay: 0.4 },
  { left: "70%", top: "88%", width: 200, duration: 3.2, delay: 1.5 },
  { left: "25%", top: "40%", width: 140, duration: 4.2, delay: 2.6 },
  { left: "80%", top: "65%", width: 350, duration: 2.6, delay: 0.7 },
  { left: "55%", top: "50%", width: 190, duration: 3.8, delay: 1.1 },
];

/* ── Professional SVG icons ──────────────────────────────── */
const STAGE_ICONS: Record<string, React.ReactNode> = {
  "01": ( // Site Selection — map pin + crosshair
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3"/>
      <path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z"/>
      <circle cx="12" cy="10" r="6" strokeDasharray="2 2" opacity="0.4"/>
    </svg>
  ),
  "02": ( // Land Due Diligence — document + shield
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <path d="M12 12l-1.5 1.5L12 15l3-3" strokeWidth="1.3"/>
      <path d="M12 18c-3 0-5-1.5-5-3.5V12l5-2 5 2v2.5c0 2-2 3.5-5 3.5z" opacity="0.5"/>
    </svg>
  ),
  "03": ( // Master Planning — grid + compass
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18"/>
      <line x1="3" y1="9" x2="21" y2="9" opacity="0.5"/>
      <line x1="3" y1="15" x2="21" y2="15" opacity="0.5"/>
      <line x1="9" y1="3" x2="9" y2="21" opacity="0.5"/>
      <line x1="15" y1="3" x2="15" y2="21" opacity="0.5"/>
      <circle cx="12" cy="12" r="2.5"/>
      <line x1="12" y1="9" x2="12" y2="9.5" strokeWidth="1"/>
    </svg>
  ),
  "04": ( // Utility Strategy — lightning in hexagon
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8.66 5v10L12 22 3.34 17V7z"/>
      <polyline points="13,8 10,13 14,13 11,18" strokeWidth="1.6"/>
    </svg>
  ),
  "05": ( // Permit Navigation — official stamp
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="5"/>
      <circle cx="12" cy="10" r="2.5"/>
      <path d="M7.76 14.24L4 22h16l-3.76-7.76"/>
      <line x1="12" y1="5" x2="12" y2="3" strokeWidth="1"/>
      <line x1="12" y1="17" x2="12" y2="15" strokeWidth="1" opacity="0.4"/>
      <line x1="5" y1="10" x2="7" y2="10" strokeWidth="1"/>
      <line x1="17" y1="10" x2="19" y2="10" strokeWidth="1"/>
    </svg>
  ),
  "06": ( // Factory Design — building with floors
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="16"/>
      <path d="M2 6l10-4 10 4"/>
      <line x1="2"  y1="12" x2="22" y2="12" opacity="0.5"/>
      <line x1="2"  y1="17" x2="22" y2="17" opacity="0.5"/>
      <rect x="8" y="17" width="8" height="5"/>
      <line x1="8" y1="9" x2="16" y2="9" strokeWidth="1.2" opacity="0.6"/>
    </svg>
  ),
  "07": ( // EPC Budgeting — bar chart ascending
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="20" x2="21" y2="20"/>
      <rect x="4"  y="14" width="4" height="6"/>
      <rect x="10" y="10" width="4" height="10"/>
      <rect x="16" y="5"  width="4" height="15"/>
      <path d="M6 10l4-4 4 3 4-5" strokeWidth="1.2" opacity="0.5"/>
    </svg>
  ),
  "08": ( // Delivery — crane
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="2" x2="6" y2="22"/>
      <line x1="6" y1="4" x2="20" y2="4"/>
      <line x1="20" y1="4" x2="20" y2="10"/>
      <line x1="14" y1="4" x2="14" y2="8"/>
      <rect x="11" y="8" width="6" height="5" rx="0.5"/>
      <path d="M6 4l-3 3" opacity="0.5"/>
    </svg>
  ),
  "09": ( // Operations — gear with arrows
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};

/* ── GIDF 9-stage data with full Cambodia intelligence ───── */
const GIDF_STAGES = [
  {
    n: "01", title: "Site Selection",
    stat: "3 CDC pre-cleared zones — 30+ provinces with NO industrial land policy",
    process: "Province scoring across 12 criteria: EDC headroom, flood risk, NR access, labour pool, title clarity, CDC reach. GentryLab shortlists to 3 sites before client visits.",
    implication: "Investors who skip corridor analysis average 14 months longer to first production. Site choice locks your utility cost for 20 years.",
  },
  {
    n: "02", title: "Land Due Diligence",
    stat: "Only 30% of Cambodian industrial land has hard LMAP title",
    process: "Ministry of Land hard title search, encumbrance check at local cadastral office, ownership chain verified back 2 transfers minimum, flood history from ODC GeoServer.",
    implication: "Soft-title land can be blocked or delayed 2–3 years mid-development. Title risk is the #1 reason foreign industrial projects stall in Cambodia.",
  },
  {
    n: "03", title: "Master Planning",
    stat: "15% green space mandatory — missed by 60% of first CDC submissions",
    process: "CDC requires masterplan submission before QIP registration. Layout must show green buffer, fire access road (6m min), internal road grid, utility entry points, waste treatment zone.",
    implication: "QIP status unlocks up to 9 years corporate tax exemption + import duty waiver. A rejected masterplan costs 3–6 months and a full redesign fee.",
  },
  {
    n: "04", title: "Utility Strategy",
    stat: "EDC industrial tariff: $0.12–$0.18/kWh — new substation: 8–24 months",
    process: "Load calculation → EDC provincial office feasibility → substation sizing → dedicated line vs shared feeder decision → water permit from MOWRAM → wastewater discharge to MIME Class B standard.",
    implication: "Power cost differential across provinces can be $0.04/kWh. On 3MW demand that's $105K/year difference. Utility strategy done wrong is a 20-year cost penalty.",
  },
  {
    n: "05", title: "Permit Navigation",
    stat: "9 separate ministry approvals — order matters, most investors get it wrong",
    process: "Sequence: MoE ECC → MIH operating licence → CDC QIP → MoLVT labour compliance → fire department → municipal building permit → EDC connection → water authority → customs (SEZ only). Wrong order = restart.",
    implication: "Done correctly: 8–11 months. Done incorrectly: 18–30 months. Permit sequencing is GentryLab's highest-value advisory service.",
  },
  {
    n: "06", title: "Factory Design",
    stat: "Industrial build cost: $280–$420/m² — wrong spec adds 40%+ in retrofit costs",
    process: "ASEAN industrial code applies. Steel portal frame for garment/light manufacturing. Reinforced concrete for pharma/food. Cambodian wet season roof loading: min 1.5kN/m². Floor flatness: FM2 minimum for logistics.",
    implication: "Under-specced factories cost more to upgrade than to build right. GentryLab benchmarks against 60+ delivered buildings — investors save 12–18% vs local contractor estimates.",
  },
  {
    n: "07", title: "EPC Budgeting",
    stat: "Average cost overrun on Cambodian industrial builds: 23% — 80% from utility surprises",
    process: "Bill of quantities from design drawings → 3 contractor quotes (1 international, 1 regional, 1 local) → contingency for utility connection works (often excluded by contractors) → VAT, stamp duty, professional fees.",
    implication: "GentryLab's EPC benchmark database covers 60+ industrial buildings. Benchmarked projects average 8% under final cost vs 23% over for unbenchmarked builds.",
  },
  {
    n: "08", title: "Delivery",
    stat: "June–October rainy season: construction pace drops 35–45%",
    process: "Mobilisation → site clearing → foundation (critical path in wet season) → structural frame → envelope → MEP rough-in → fit-out → utility connections → testing & commissioning → handover.",
    implication: "Projects that miss the dry season window (Nov–May) for foundation works typically slip 6 months. GentryLab schedules critical path around Cambodia's two dry seasons.",
  },
  {
    n: "09", title: "Operations",
    stat: "SEZ customs clearance: same-day vs 3–5 days outside zone",
    process: "Facility management: MEP maintenance contract, security protocol, MIME waste audit (quarterly), EDC meter reconciliation, fire system certification (annual), MoLVT labour audit preparation.",
    implication: "SEZ operators handle customs in-zone — direct import/export without Phnom Penh clearance. For export manufacturers, SEZ location saves 3–5 days per shipment cycle.",
  },
];

const DEFAULT_TICKER = [
  "SEZ Intelligence", "Industrial Corridors", "Utility Readiness",
  "Flood Risk Atlas", "Labor Analytics", "Permit Navigation",
  "Cost Benchmarks", "Land Due Diligence",
];

function Index() {
  useReveal();
  const [cfg, setCfg] = useState<SiteConfig>(() => loadConfig());
  const [openStage, setOpenStage] = useState<string | null>(null);
  const { t, ta, to } = useLang();

  useEffect(() => {
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);

  const accent = cfg.accentColor;
  const ticker = cfg.ticker?.length ? cfg.ticker : DEFAULT_TICKER;
  const stageTitles    = ta("stageTitles");
  const stageStats     = ta("stageStats");
  const stageProcess   = ta("stageProcess");
  const stageImplication = ta("stageImplication");

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans overflow-x-hidden">
      <TopNav cfg={cfg} />

      {/* ═══════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════ */}
      <section className="relative min-h-[95vh] flex flex-col justify-end overflow-hidden scanlines">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 90% 55% at 40% 100%, ${accent}28 0%, transparent 70%)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 50% 40% at 20% 85%, ${accent}18 0%, transparent 65%)` }} />

        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          {STREAKS.map((s, i) => (
            <div key={i} className="streak" style={{
              left: s.left, top: s.top, width: s.width,
              animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`,
              transform: "rotate(-32deg)", transformOrigin: "left center",
            }} />
          ))}
        </div>

        <div className="relative z-10 px-6 md:px-12 pb-24 pt-32 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-8 reveal">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: accent }} />
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
              {t("hero.eyebrow")}
            </p>
          </div>

          <h1 className="font-extrabold uppercase leading-[0.88] tracking-tighter text-[clamp(2.6rem,6.5vw,5.5rem)] max-w-4xl reveal reveal-delay-1">
            {t("hero.h1a")}<br />
            {t("hero.h1b")}<br />
            {t("hero.h1c")} <span className="text-gradient">{t("hero.h1d").split(" ")[0]}</span>{" "}
            {t("hero.h1d").split(" ").slice(1).join(" ")}
          </h1>

          <p className="text-white/50 text-lg max-w-lg mt-8 leading-relaxed reveal reveal-delay-2">
            {t("hero.sub")}
          </p>

          <div className="flex flex-wrap gap-4 mt-10 reveal reveal-delay-3">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              style={{ backgroundColor: accent, color: "#000", boxShadow: `0 0 28px ${accent}55` }}
            >
              {t("hero.cta1")}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/15 text-white font-bold text-sm uppercase tracking-wider hover:border-white/40 hover:bg-white/5 transition-all"
            >
              {t("hero.cta2")}
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 mt-14 reveal reveal-delay-4">
            {ta("hero.tags").map((b) => (
              <span key={b} className="font-mono text-[10px] uppercase tracking-widest text-white/20">{b}</span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#0a0a0b] to-transparent z-10" />
      </section>

      {/* ═══════════════════════════════════════════════════
          GIDF 9-STAGE METHODOLOGY — with intelligence tooltips
      ═══════════════════════════════════════════════════ */}
      <section className="py-24 border-b border-white/8 bg-[#0d0d0e] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                {t("gidf.eyebrow")}
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                {t("gidf.title1")}<br />{t("gidf.title2")}
              </h2>
            </div>
            <p className="text-white/35 text-sm max-w-xs leading-relaxed reveal reveal-delay-2">
              {t("gidf.sub")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/8 border border-white/8">
            {GIDF_STAGES.map((stage, i) => {
              const isOpen  = openStage === stage.n;
              const title   = stageTitles[i]   ?? stage.title;
              const stat    = stageStats[i]    ?? stage.stat;
              const process = stageProcess[i]  ?? stage.process;
              const impl    = stageImplication[i] ?? stage.implication;
              return (
                <div
                  key={stage.n}
                  className={`bg-[#0d0d0e] group transition-all cursor-pointer reveal reveal-delay-${Math.min(i + 1, 6)}`}
                  style={{ position: "relative", overflow: "hidden" }}
                  onClick={() => setOpenStage(isOpen ? null : stage.n)}
                  onMouseEnter={() => setOpenStage(stage.n)}
                  onMouseLeave={() => setOpenStage(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setOpenStage(isOpen ? null : stage.n)}
                  aria-expanded={isOpen}
                >
                  {/* Stage header */}
                  <div className={`p-7 transition-colors ${isOpen ? "gidf-card-open bg-[#111113]" : ""}`}>
                    <span className="absolute top-4 right-5 font-extrabold text-[42px] tracking-tighter leading-none select-none" style={{ color: "rgba(255,255,255,0.04)" }}>
                      {stage.n}
                    </span>
                    <div className="relative z-10">
                      <span className="mb-4 block transition-colors gidf-icon" style={isOpen ? { color: accent } : {}}>
                        {STAGE_ICONS[stage.n]}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest mb-2 block" style={{ color: accent }}>
                        Stage {stage.n}
                      </span>
                      <h3 className="font-extrabold uppercase text-sm tracking-tight mb-1 gidf-title group-hover:text-white transition-colors">
                        {title}
                      </h3>
                      <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest mt-2 gidf-hint">
                        {isOpen ? t("gidf.hintClose") : t("gidf.hintOpen")}
                      </span>
                    </div>
                  </div>

                  {/* Intelligence tooltip panel */}
                  <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: isOpen ? "400px" : "0px" }}>
                    <div className="gidf-tooltip-panel px-7 pb-7 border-t" style={{ borderColor: `${accent}25`, backgroundColor: "#111113" }}>
                      {/* Stat hook */}
                      <div className="pt-5 pb-3 border-b border-white/8">
                        <p className="font-mono text-[9px] uppercase tracking-widest mb-1.5 gidf-label">{t("gidf.labelStat")}</p>
                        <p className="font-bold text-sm leading-tight" style={{ color: accent }}>{stat}</p>
                      </div>
                      {/* Process */}
                      <div className="pt-3 pb-3 border-b border-white/8">
                        <p className="font-mono text-[9px] uppercase tracking-widest mb-1.5 gidf-label">{t("gidf.labelProcess")}</p>
                        <p className="text-[12px] leading-relaxed gidf-body">{process}</p>
                      </div>
                      {/* Implication */}
                      <div className="pt-3">
                        <p className="font-mono text-[9px] uppercase tracking-widest mb-1.5 gidf-label">{t("gidf.labelImplication")}</p>
                        <p className="text-[12px] leading-relaxed gidf-body-strong">{impl}</p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform origin-left" style={{ backgroundColor: accent }} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MAP PLATFORM PREVIEW — animated overlay + dim real map
      ═══════════════════════════════════════════════════ */}
      <section className="py-24 border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: accent }}>
                {t("mapSection.eyebrow")}
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92] mb-6">
                {t("mapSection.title1")}<br />{t("mapSection.title2")}
              </h2>
              <p className="text-white/50 leading-relaxed mb-8">
                {t("mapSection.desc")}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-10">
                {to("mapSection.stats").map((s: { n: string; label: string }) => (
                  <div key={s.label} className="rounded-lg border border-white/8 px-4 py-3 bg-[#0a0a0b]">
                    <p className="text-xl font-extrabold tracking-tighter" style={{ color: accent }}>{s.n}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/map"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
                style={{ backgroundColor: accent, color: "#000", boxShadow: `0 0 20px ${accent}44` }}
              >
                {t("mapSection.cta")}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>

            {/* Animated map preview with dim real Leaflet map behind */}
            <div className="reveal reveal-delay-2">
              <Link to="/map" className="block relative overflow-hidden border border-white/10 aspect-[4/3] group" style={{ borderRadius: "1rem" }}>

                {/* ── Layer 1: dim real Cambodia basemap ── */}
                <div className="absolute inset-0" style={{ opacity: 0.28, pointerEvents: "none" }}>
                  <Suspense fallback={<div className="w-full h-full bg-[#0a0a0b]" />}>
                    <IndustrialMap previewMode />
                  </Suspense>
                </div>

                {/* ── Layer 2: dark tint so dots pop ── */}
                <div className="absolute inset-0 bg-[#0a0a0b]/55 pointer-events-none" />

                {/* ── Layer 3: animated grid lines ── */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: `
                    linear-gradient(rgba(255,81,0,0.06) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,81,0,0.06) 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                }}/>

                {/* ── Layer 4: pulse dots (Cambodia major zones) ── */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Phnom Penh SEZ cluster */}
                  {[
                    { left: "48%",  top: "60%",  size: 8,  delay: "0s",    color: "#ff5100" },
                    { left: "43%",  top: "64%",  size: 5,  delay: "0.4s",  color: "#ff5100" },
                    { left: "53%",  top: "57%",  size: 6,  delay: "0.8s",  color: "#ff5100" },
                    /* Sihanoukville port */
                    { left: "33%",  top: "78%",  size: 7,  delay: "0.2s",  color: "#34d399" },
                    { left: "29%",  top: "82%",  size: 4,  delay: "1.0s",  color: "#34d399" },
                    /* Kampong Cham / Bavet corridor */
                    { left: "65%",  top: "55%",  size: 6,  delay: "0.6s",  color: "#fbbf24" },
                    { left: "72%",  top: "60%",  size: 5,  delay: "1.4s",  color: "#fbbf24" },
                    /* Siem Reap north */
                    { left: "40%",  top: "30%",  size: 5,  delay: "1.1s",  color: "#a78bfa" },
                    { left: "36%",  top: "25%",  size: 4,  delay: "1.8s",  color: "#a78bfa" },
                    /* Koh Kong west */
                    { left: "22%",  top: "72%",  size: 4,  delay: "0.9s",  color: "#38bdf8" },
                    /* Kandal south */
                    { left: "51%",  top: "68%",  size: 4,  delay: "1.6s",  color: "#ff5100" },
                    /* Battambang north-west */
                    { left: "27%",  top: "38%",  size: 4,  delay: "2.1s",  color: "#34d399" },
                  ].map((d, i) => (
                    <span
                      key={i}
                      className="pulse-dot absolute rounded-full"
                      style={{
                        left: d.left, top: d.top,
                        width: d.size, height: d.size,
                        backgroundColor: d.color,
                        animationDelay: d.delay,
                        boxShadow: `0 0 ${d.size * 2}px ${d.color}99`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  ))}
                </div>

                {/* ── Layer 5: scan line sweep ── */}
                <div className="scan-line" />

                {/* ── Layer 6: top eyebrow label ── */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 bg-black/60 border border-white/10" style={{ color: accent }}>
                    {t("mapSection.liveBadge")}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 bg-black/60 border border-white/10 text-white/30">
                    {t("mapSection.layersBadge")}
                  </span>
                </div>

                {/* ── Layer 7: corridor line art overlay ── */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="none" fill="none">
                  {/* NR1 east corridor */}
                  <path d="M195 182 L290 170 L340 178" stroke="#fbbf24" strokeWidth="1.2" opacity="0.55" strokeDasharray="4 3"/>
                  {/* Sihanoukville highway */}
                  <path d="M132 232 L180 200 L195 182" stroke="#34d399" strokeWidth="1.2" opacity="0.55" strokeDasharray="4 3"/>
                  {/* Northern corridor */}
                  <path d="M160 90 L195 182 L215 212" stroke="#38bdf8" strokeWidth="1" opacity="0.40" strokeDasharray="3 4"/>
                  {/* Mekong axis */}
                  <path d="M195 182 L198 250" stroke="#ff5100" strokeWidth="1" opacity="0.35" strokeDasharray="2 3"/>
                </svg>

                {/* ── Layer 8: bottom gradient + CTA ── */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between pointer-events-none">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/50 mb-1">{t("mapSection.corridorLabel")}</p>
                    <p className="font-extrabold text-sm uppercase tracking-tight text-white group-hover:text-[#ff5100] transition-colors">
                      {t("mapSection.launchCta")}
                    </p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-all"
                    style={{ backgroundColor: accent }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7h10M8 3l4 4-4 4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Hover glow border */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ borderRadius: "1rem", boxShadow: `inset 0 0 0 1px ${accent}50` }} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MARQUEE TICKER
      ═══════════════════════════════════════════════════ */}
      <div className="border-b border-white/8 py-4 overflow-hidden bg-[#0d0d0e]">
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center gap-10 pr-10">
              {ticker.map((item) => (
                <span key={item} className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-white/20 whitespace-nowrap">
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: `${accent}80` }} />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════ */}
      <footer className="px-6 md:px-12 py-8 font-mono text-[10px] uppercase tracking-widest text-white/20 flex flex-col sm:flex-row justify-between gap-2 max-w-7xl mx-auto">
        <p>{cfg.footerLeft}</p>
        <div className="flex gap-6 items-center">
          <Link to="/dashboard" className="hover:text-white/50 transition-colors">{t("footer.dashboard")}</Link>
          <p>{cfg.footerRight}</p>
        </div>
      </footer>
    </div>
  );
}
