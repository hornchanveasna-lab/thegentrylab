import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Counter, useReveal, useSmoothScroll } from "@/components/site/Counter";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";
import { useMapSites, useProjects } from "@/lib/data";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

/* ── Roadmap card metadata ───────────────────────────────── */
const ROADMAP_META: Record<string, {
  icon: React.ReactNode;
  preview: React.ReactNode;
}> = {
  "01": {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7"/>
        <circle cx="9" cy="9" r="3"/>
        <line x1="9" y1="2" x2="9" y2="4"/><line x1="9" y1="14" x2="9" y2="16"/>
        <line x1="2" y1="9" x2="4" y2="9"/><line x1="14" y1="9" x2="16" y2="9"/>
      </svg>
    ),
    preview: (
      <div className="w-full flex flex-col gap-1.5 mb-1">
        {[85,62,91,44,77].map((v,i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-14 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full" style={{
                "--bar-w": `${v}%`,
                backgroundColor: "currentColor",
                animation: `bar-grow 1s cubic-bezier(0.4,0,0.2,1) ${i * 0.15}s both, bar-pulse ${2 + i * 0.2}s ease-in-out ${1 + i * 0.15}s infinite`,
              } as React.CSSProperties} />
            </div>
            <span className="font-mono text-[8px] opacity-50">{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  "02": {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2L2 6v10h14V6L9 2z"/>
        <path d="M6 16v-5h6v5"/>
        <circle cx="9" cy="8" r="1.5"/>
      </svg>
    ),
    preview: (
      <div className="w-full flex items-center gap-1.5 mb-1">
        {["MoE","MISTI","CDC","EDC","Fire"].map((s,i,a) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="px-1.5 py-0.5 border text-[7px] font-mono font-bold" style={{
              borderColor: "currentColor",
              animation: `step-light 2s ease-in-out ${i * 0.4}s infinite`,
            }}>
              {s}
            </div>
            {i < a.length-1 && <div className="w-2 h-px origin-left" style={{
              backgroundColor: "currentColor",
              animation: `connector-flow 2s ease-in-out ${i * 0.4 + 0.2}s infinite`,
            }} />}
          </div>
        ))}
      </div>
    ),
  },
  "03": {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l6-6 6 6v6H3V9z"/>
        <path d="M1 9l8-8 8 8"/><line x1="7" y1="15" x2="7" y2="11"/><line x1="11" y1="15" x2="11" y2="11"/>
      </svg>
    ),
    preview: (
      <div className="w-full grid grid-cols-6 gap-0.5 mb-1">
        {[...Array(18)].map((_, i) => {
          const v = [0.8,0.4,0.9,0.3,0.6,0.2,0.7,0.5,0.95,0.1,0.85,0.45,0.65,0.35,0.75,0.55,0.3,0.7][i];
          const base = +(v * 0.55).toFixed(2);
          return <div key={i} className="h-3 rounded-sm" style={{
            "--cell-base": base,
            backgroundColor: "currentColor",
            animation: `cell-flicker ${1.4 + (i % 4) * 0.35}s ease-in-out ${(i % 6) * 0.15}s infinite`,
          } as React.CSSProperties} />;
        })}
      </div>
    ),
  },
  "04": {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="14" height="14" rx="1"/>
        <rect x="5" y="9" width="2" height="6"/>
        <rect x="8" y="6" width="2" height="9"/>
        <rect x="11" y="3" width="2" height="12"/>
      </svg>
    ),
    preview: (
      <div className="w-full flex items-end gap-1 h-10 mb-1">
        {[30,55,40,80,60,90,45,70].map((h,i) => {
          const op = +(0.15 + (h/100)*0.55).toFixed(2);
          return (
            <div key={i} className="flex-1 rounded-sm" style={{
              "--col-h": `${h}%`,
              "--col-op": op,
              backgroundColor: "currentColor",
              animation: `col-rise 0.8s cubic-bezier(0.4,0,0.2,1) ${i * 0.1}s both, col-sway ${1.6 + i * 0.15}s ease-in-out ${0.8 + i * 0.1}s infinite`,
            } as React.CSSProperties} />
          );
        })}
      </div>
    ),
  },
  "05": {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7"/>
        <polyline points="6,9 8,11 12,7"/>
      </svg>
    ),
    preview: (
      <div className="w-full flex flex-col gap-1 mb-1">
        {["Available","Pending","Restricted"].map((s,i) => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{
              backgroundColor: ["#4ade80","#fbbf24","#f87171"][i],
              animation: `dot-breathe ${1.3 + i * 0.3}s ease-in-out ${i * 0.5}s infinite`,
            }} />
            <span className="text-[8px] font-mono opacity-50">{s}</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "currentColor", opacity: 0.1 }} />
            <span className="text-[8px] font-mono opacity-40">{[24,8,3][i]}</span>
          </div>
        ))}
      </div>
    ),
  },
  "06": {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="3"/>
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M3.5 14.5l1.4-1.4M13.1 4.9l1.4-1.4"/>
      </svg>
    ),
    preview: (
      <div className="w-full mb-1">
        <div className="flex gap-1 flex-wrap">
          {["Site score","EDC","Title","Labour","Permits"].map((tag, i) => (
            <span key={tag} className="px-1.5 py-0.5 text-[7px] font-mono border rounded-full" style={{
              borderColor: "currentColor",
              animation: `tag-pop 1.6s ease-in-out ${i * 0.3}s infinite`,
            }}>
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/8 overflow-hidden relative">
          <div className="h-full rounded-full" style={{
            backgroundColor: "currentColor",
            opacity: 0.6,
            animation: "progress-sweep 2.6s ease-in-out 0.3s infinite",
          }} />
          <div className="absolute inset-y-0 w-6 opacity-40" style={{
            background: "linear-gradient(90deg, transparent, currentColor, transparent)",
            animation: "shimmer-sweep 2.6s ease-in-out 0.3s infinite",
          }} />
        </div>
      </div>
    ),
  },
};

/* ── Case studies ────────────────────────────────────────── */
const CASE_STUDIES = [
  {
    tag: "Airport Corridor",
    title: "Techo Airport Industrial Zone",
    sector: "Multi-sector SEZ",
    scope: "Roof construction project management for a $16M+ scope package within the 120-ha industrial zone adjacent to the new international gateway — world-class build and QA/QC standards on a live SEZ program",
    outcome: "$16M+ roof package delivered · World-class build standard · Phase 1 operational",
    color: "#ff5100",
    photo: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=900&q=80&fit=crop",
    stat1: { n: "$16M+", label: "Roof scope" },
    stat2: { n: "120 ha", label: "Zone area" },
    gradient: "linear-gradient(135deg,#1a0700 0%,#7c2d12 100%)",
  },
  {
    tag: "Manufacturing",
    title: "Zinus Cambodia Factory",
    sector: "Furniture & Bedding",
    scope: "End-to-end industrial development advisory: land due diligence through EPC budgeting for 65,000 m² manufacturing facility",
    outcome: "On-budget delivery · EDC 3MW substation secured · Export-ready",
    color: "#facc15",
    photo: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=900&q=80&fit=crop",
    stat1: { n: "65,000 m²", label: "Factory floor" },
    stat2: { n: "3 MW",      label: "EDC power" },
    gradient: "linear-gradient(135deg,#1a1400 0%,#713f12 100%)",
  },
  {
    tag: "Industrial Park",
    title: "ISI Industrial Facilities",
    sector: "Pharmaceutical & Logistics",
    scope: "Permit navigation, utility strategy, and factory design for GMP-grade pharmaceutical warehouse + logistics hub",
    outcome: "MoH GMP certified · Phnom Penh Special Economic Zone · Operational",
    color: "#34d399",
    photo: "https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=900&q=80&fit=crop",
    stat1: { n: "GMP",    label: "MoH certified" },
    stat2: { n: "PPSEZ",  label: "Location" },
    gradient: "linear-gradient(135deg,#012117 0%,#064e3b 100%)",
  },
];

const DEFAULT_TICKER = [
  "SEZ Intelligence", "Industrial Corridors", "Utility Readiness",
  "Flood Risk Atlas", "Labor Analytics", "Permit Navigation",
  "Cost Benchmarks", "Land Due Diligence",
];

function AboutPage() {
  useReveal();
  useSmoothScroll();
  const [cfg, setCfg] = useState<SiteConfig>(() => loadConfig());

  useEffect(() => {
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);

  const accent = cfg.accentColor;
  const ticker = cfg.ticker?.length ? cfg.ticker : DEFAULT_TICKER;

  // Live platform stats — computed from Supabase (sites/projects), not a
  // manually-edited number that can drift out of date.
  const { data: sites = [] }    = useMapSites();
  const { data: projects = [] } = useProjects();
  const sezParkCount = sites.filter(s => s.layer === "investment" && (s.kind === "sez" || s.kind === "park")).length;
  const liveStats = [
    { value: String(sezParkCount), suffix: "",  label: "SEZs & industrial parks" },
    { value: "9",                  suffix: "",  label: "Industrial corridors" },
    { value: String(sites.length), suffix: "+", label: "Sites on intelligence map" },
    { value: String(projects.length), suffix: "", label: "Investment projects tracked" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans overflow-x-hidden">
      <TopNav cfg={cfg} />

      {/* ═══════════════════════════════════════════════════
          PAGE HERO
      ═══════════════════════════════════════════════════ */}
      <section className="snap-section relative py-24 md:py-32 border-b border-white/8 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 60% at 30% 100%, ${accent}20 0%, transparent 70%)` }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-6 reveal">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: accent }} />
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
              About The Gentry Lab
            </p>
          </div>
          <h1 className="font-extrabold uppercase leading-[0.88] tracking-tighter text-[clamp(2.8rem,7vw,6rem)] max-w-4xl reveal reveal-delay-1">
            Built on $100M+<br />
            of delivered<br />
            <span className="text-gradient">industrial projects</span><br />
            in Cambodia.
          </h1>
          <p className="text-white/50 text-lg max-w-xl mt-8 leading-relaxed reveal reveal-delay-2">
            GentryLab is Cambodia's Industrial Development Advisory Platform — built from over a decade inside the sector, not from a desk. Since 2014 we have advised, designed, permitted, and delivered industrial projects across the country.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════════ */}
      <section className="snap-section border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/8">
          {liveStats.map((s, i) => (
            <div key={s.label} className={`px-8 py-9 reveal reveal-delay-${i + 1}`}>
              <p className="text-4xl font-extrabold tracking-tighter tabular-nums" style={{ color: accent }}>
                <Counter value={s.value} />{s.suffix}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          PROBLEM → SOLUTION
      ═══════════════════════════════════════════════════ */}
      <section className="snap-section px-6 md:px-12 py-24 border-b border-white/8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Problem side */}
          <div className="reveal">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: accent }}>The Gap</p>
            <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92] mb-6">
              Market reports.<br />No execution map.
            </h2>
            <p className="text-white/50 leading-relaxed mb-8">
              Most industrial market intelligence is produced by people who have never permitted a factory, negotiated an EDC connection, or sat across a table with a CDC officer. Since 2014, we have — running site selection across every province, sequencing 9-ministry permit stacks, securing EDC industrial connections, and delivering over $100M in built value across Cambodia.
            </p>
            <div className="flex flex-col gap-3">
              {[
                "Which permits to file first — and which ministry kills your QIP if you get the order wrong",
                "Which provinces have EDC substation headroom, and which will cost you 18 additional months",
                "Whether a Cambodian land title is clean enough to build on — and how to verify it yourself",
                "What it actually takes to move a CDC application from submitted to approved",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-[13px] text-white/40">
                  <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Solution side */}
          <div className="reveal reveal-delay-2">
            <div className="rounded-2xl border border-white/10 bg-[#0e0e10] p-8 relative overflow-hidden">
              <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${accent}12 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: accent }}>Built from the inside · Since 2014</p>
                <h3 className="text-3xl font-extrabold uppercase tracking-tighter leading-[0.92] mb-6">
                  We don't tell you<br /><span style={{ color: accent }}>where.</span> We show you<br /><span style={{ color: accent }}>how.</span>
                </h3>
                <p className="text-white/55 leading-relaxed mb-8">
                  Over a decade embedded in Cambodia's industrial sector — advising on factories, SEZs, and infrastructure — GentryLab was built from lived execution, not secondary research. $100M+ delivered. Every lesson is in the platform.
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    "9-stage GIDF methodology covering every step",
                    "Live intelligence map: SEZs, corridors, utilities, risk",
                    "Permit navigator mapped end-to-end",
                    "136,000-strong industry network via The Gentry Hub",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 text-[13px] text-white/70">
                      <span className="mt-0.5 shrink-0" style={{ color: accent }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          CASE STUDIES
      ═══════════════════════════════════════════════════ */}
      <section className="snap-section py-24 border-b border-white/8 px-6 md:px-12 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                Track Record
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                $100M+ delivered<br />across Cambodia
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CASE_STUDIES.map((cs, i) => (
              <div
                key={cs.title}
                className={`group relative overflow-hidden border border-white/10 hover:border-white/25 transition-all flex flex-col reveal reveal-delay-${i + 1} bg-[#0d0d0e]`}
              >
                {/* Photo cover */}
                <div className="relative overflow-hidden flex-shrink-0" style={{ height: 220 }}>
                  <div className="absolute inset-0" style={{ background: cs.gradient }} />
                  <img
                    src={cs.photo}
                    alt={cs.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    style={{ opacity: 0.35, mixBlendMode: "luminosity" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Grid overlay */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `linear-gradient(${cs.color}08 1px,transparent 1px),linear-gradient(90deg,${cs.color}08 1px,transparent 1px)`,
                    backgroundSize: "28px 28px",
                  }} />
                  {/* Glow */}
                  <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 70% at 80% 20%,${cs.color}30 0%,transparent 65%)` }} />
                  {/* Bottom fade */}
                  <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#0d0d0e] to-transparent" />

                  {/* Tag badge */}
                  <div className="absolute top-4 left-4">
                    <span className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-black font-bold"
                      style={{ backgroundColor: cs.color }}>
                      {cs.tag}
                    </span>
                  </div>

                  {/* Stats pills top-right */}
                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                    <div className="bg-black/60 border border-white/10 px-2.5 py-1 text-right">
                      <p className="font-extrabold text-xs" style={{ color: cs.color }}>{cs.stat1.n}</p>
                      <p className="font-mono text-[8px] uppercase tracking-widest text-white/35">{cs.stat1.label}</p>
                    </div>
                    <div className="bg-black/60 border border-white/10 px-2.5 py-1 text-right">
                      <p className="font-extrabold text-xs" style={{ color: cs.color }}>{cs.stat2.n}</p>
                      <p className="font-mono text-[8px] uppercase tracking-widest text-white/35">{cs.stat2.label}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-extrabold uppercase text-base tracking-tight mb-1 leading-tight">{cs.title}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: cs.color }}>{cs.sector}</p>
                  <p className="text-[12px] text-white/50 leading-relaxed flex-1">{cs.scope}</p>
                  <div className="mt-5 pt-4 border-t border-white/8">
                    <p className="text-[11px] font-mono text-white/40">
                      <span style={{ color: cs.color }}>✓ </span>{cs.outcome}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          ROADMAP
      ═══════════════════════════════════════════════════ */}
      <section className="snap-section py-24 border-b border-white/8 px-6 md:px-12 bg-[#0d0d0e] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                Roadmap · Phase 02—03
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                Coming next to<br />the platform
              </h2>
              <p className="text-white/35 text-sm max-w-sm mt-4 leading-relaxed">
                Phase 01 is live. These six tools are in active development — built on the same ground-level data.
              </p>
            </div>
            <Link to="/research" className="font-mono text-[11px] uppercase tracking-widest text-white/35 hover:text-white transition-colors reveal reveal-delay-2">
              View intelligence research →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cfg.roadmap.map((r, i) => {
              const meta = ROADMAP_META[r.n] ?? ROADMAP_META["01"];
              const phase = parseInt(r.n) <= 3 ? "02" : "03";
              const isPhase2 = phase === "02";
              const isAdvisor = r.n === "06";
              const cardClass = `group relative overflow-hidden border transition-all flex flex-col reveal reveal-delay-${Math.min(i + 1, 6)} bg-[#0a0a0b] ${isAdvisor ? "border-[#ff5100]/40 hover:border-[#ff5100] cursor-pointer" : "border-white/8 hover:border-white/20 cursor-default"}`;
              const inner = (<>
                  {/* Top accent bar */}
                  <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${accent}60 0%, transparent 100%)` }} />

                  {/* Visual preview area */}
                  <div className="relative px-6 pt-6 pb-2 overflow-hidden" style={{ minHeight: 130 }}>
                    {/* Background glow */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: `radial-gradient(ellipse 80% 80% at 20% 50%, ${accent}10 0%, transparent 65%)`,
                    }} />
                    {/* Grid */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundImage: `linear-gradient(${accent}06 1px,transparent 1px),linear-gradient(90deg,${accent}06 1px,transparent 1px)`,
                      backgroundSize: "24px 24px",
                    }} />

                    {/* Phase + number row */}
                    <div className="relative z-10 flex items-center justify-between mb-4">
                      <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border"
                        style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}10` }}>
                        Phase {phase}
                      </span>
                      <span className="font-extrabold text-[42px] leading-none tracking-tighter select-none"
                        style={{ color: `${accent}08` }}>
                        {r.n}
                      </span>
                    </div>

                    {/* Abstract preview illustration */}
                    <div className="relative z-10 flex items-end gap-1" style={{ color: accent }}>
                      {meta.preview}
                    </div>
                  </div>

                  {/* Icon + content */}
                  <div className="px-6 pb-6 flex flex-col flex-1">
                    <div className="mb-3 mt-1 p-2.5 self-start border border-white/8 group-hover:border-white/20 transition-all"
                      style={{ color: accent }}>
                      {meta.icon}
                    </div>
                    <h3 className="font-extrabold uppercase text-sm tracking-tight mb-2 leading-tight group-hover:text-white transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-[12px] text-white/40 leading-relaxed flex-1 group-hover:text-white/60 transition-colors">
                      {r.desc}
                    </p>

                    {/* Status tag */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/6">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: isAdvisor ? "#34d399" : isPhase2 ? "#fbbf24" : "#94a3b8" }} />
                      <span className="font-mono text-[9px] uppercase tracking-widest"
                        style={{ color: isAdvisor ? "#34d399" : isPhase2 ? "#fbbf24" : "#94a3b8" }}>
                        {isAdvisor ? "Beta" : isPhase2 ? "In development" : "Planned"}
                      </span>
                    </div>
                  </div>
                </>);
              return isAdvisor
                ? <Link key={r.n} to="/tools/advisor" className={cardClass}>{inner}</Link>
                : <div  key={r.n} className={cardClass}>{inner}</div>;
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FINAL CTA BANNER
      ═══════════════════════════════════════════════════ */}
      <section className="snap-section py-28 px-6 md:px-12 border-b border-white/8 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 80% at 50% 50%, ${accent}14 0%, transparent 70%)` }} />
        <div className="max-w-4xl mx-auto text-center relative z-10 reveal">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-6" style={{ color: accent }}>
            Cambodia · Industrial Intelligence · Free Access
          </p>
          <h2 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.88] mb-6">
            Cambodia is at an<br />
            <span className="text-gradient">inflection point.</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Manufacturing is diversifying away from China. The Techo Airport corridor is opening. The NR4 port connection is drawing export manufacturers. The next five years will determine everything.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              style={{ backgroundColor: accent, color: "#000", boxShadow: `0 0 32px ${accent}55` }}
            >
              Explore SeerMap
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full border border-white/15 text-white font-bold text-sm uppercase tracking-wider hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Get advisory
            </Link>
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
          <Link to="/dashboard" className="hover:text-white/50 transition-colors">Dashboard</Link>
          <p>{cfg.footerRight}</p>
        </div>
      </footer>
    </div>
  );
}
