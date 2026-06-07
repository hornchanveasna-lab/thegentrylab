import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { useReveal } from "@/components/site/Counter";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";

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

/* ── GIDF 9-stage framework ──────────────────────────────── */
const GIDF_STAGES = [
  { n: "01", title: "Site Selection",     icon: "📍", desc: "Corridor analysis, province scoring, shortlist" },
  { n: "02", title: "Land Due Diligence", icon: "📋", desc: "Title search, encumbrance, legal clearance" },
  { n: "03", title: "Master Planning",    icon: "📐", desc: "Zoning, layout, phasing, access strategy" },
  { n: "04", title: "Utility Strategy",   icon: "⚡", desc: "EDC power, water, wastewater, telecom design" },
  { n: "05", title: "Permit Navigation",  icon: "🏛️", desc: "CDC, MIH, MoE approvals mapped end-to-end" },
  { n: "06", title: "Factory Design",     icon: "🏭", desc: "Industrial-grade architectural & MEP design" },
  { n: "07", title: "EPC Budgeting",      icon: "💰", desc: "USD/m² benchmarks, contractor pre-qualification" },
  { n: "08", title: "Delivery",           icon: "🏗️", desc: "Construction oversight, QA/QC, handover" },
  { n: "09", title: "Operations",         icon: "⚙️", desc: "Facility management, compliance, expansion" },
];

const DEFAULT_TICKER = [
  "SEZ Intelligence", "Industrial Corridors", "Utility Readiness",
  "Flood Risk Atlas", "Labor Analytics", "Permit Navigation",
  "Cost Benchmarks", "Land Due Diligence",
];

function Index() {
  useReveal();
  const [cfg, setCfg] = useState<SiteConfig>(() => loadConfig());

  useEffect(() => {
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);

  const accent = cfg.accentColor;
  const ticker = cfg.ticker?.length ? cfg.ticker : DEFAULT_TICKER;

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
              Industrial Intelligence · Cambodia
            </p>
          </div>

          <h1 className="font-extrabold uppercase leading-[0.88] tracking-tighter text-[clamp(2.6rem,6.5vw,5.5rem)] max-w-4xl reveal reveal-delay-1">
            What does it<br />
            actually take to<br />
            develop <span className="text-gradient">industrial</span><br />
            land in Cambodia?
          </h1>

          <p className="text-white/50 text-lg max-w-lg mt-8 leading-relaxed reveal reveal-delay-2">
            9 stages. 110+ sites mapped. One free platform built from $500M+ of delivered projects.
          </p>

          <div className="flex flex-wrap gap-4 mt-10 reveal reveal-delay-3">
            <Link
              to="/map"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              style={{ backgroundColor: accent, color: "#000", boxShadow: `0 0 28px ${accent}55` }}
            >
              Explore the map
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/15 text-white font-bold text-sm uppercase tracking-wider hover:border-white/40 hover:bg-white/5 transition-all"
            >
              About the platform
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 mt-14 reveal reveal-delay-4">
            {["9-Stage GIDF", "110+ Sites", "Free Access", "CDC · EDC · MPWT Data"].map((b) => (
              <span key={b} className="font-mono text-[10px] uppercase tracking-widest text-white/20">{b}</span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#0a0a0b] to-transparent z-10" />
      </section>

      {/* ═══════════════════════════════════════════════════
          GIDF 9-STAGE METHODOLOGY
      ═══════════════════════════════════════════════════ */}
      <section className="py-24 border-b border-white/8 bg-[#0d0d0e] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                The Framework · GIDF
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                GentryLab Industrial<br />Development Framework
              </h2>
            </div>
            <p className="text-white/35 text-sm max-w-xs leading-relaxed reveal reveal-delay-2">
              A proven 9-stage methodology from raw land to operational industrial asset.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/8 border border-white/8">
            {GIDF_STAGES.map((stage, i) => (
              <div
                key={stage.n}
                className={`bg-[#0d0d0e] p-7 group hover:bg-[#111113] transition-all cursor-default reveal reveal-delay-${Math.min(i + 1, 6)}`}
                style={{ position: "relative", overflow: "hidden" }}
              >
                <span className="absolute top-4 right-5 font-extrabold text-[42px] tracking-tighter leading-none text-white/4 select-none">
                  {stage.n}
                </span>
                <div className="relative z-10">
                  <span className="text-2xl mb-3 block">{stage.icon}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest mb-2 block" style={{ color: accent }}>
                    Stage {stage.n}
                  </span>
                  <h3 className="font-extrabold uppercase text-sm tracking-tight mb-2 group-hover:text-white transition-colors">
                    {stage.title}
                  </h3>
                  <p className="text-[12px] text-white/35 leading-relaxed">{stage.desc}</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform origin-left" style={{ backgroundColor: accent }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MAP PLATFORM PREVIEW
      ═══════════════════════════════════════════════════ */}
      <section className="py-24 border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: accent }}>
                Free Intelligence Platform
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92] mb-6">
                Every SEZ, corridor &<br />risk zone — mapped.
              </h2>
              <p className="text-white/50 leading-relaxed mb-8">
                Our interactive intelligence map layers 110+ industrial sites, 9 development corridors, EDC substation data, flood risk zones, and labour catchments across Cambodia — all free.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-10">
                {[
                  { n: "110+", label: "Industrial sites" },
                  { n: "9",    label: "Dev corridors"   },
                  { n: "6",    label: "Data layers"     },
                  { n: "Free", label: "Always"          },
                ].map((s) => (
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
                Open the map
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>

            <div className="reveal reveal-delay-2">
              <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0b] overflow-hidden aspect-[4/3]">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `linear-gradient(${accent}20 1px, transparent 1px), linear-gradient(90deg, ${accent}20 1px, transparent 1px)`,
                    backgroundSize: "40px 40px",
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div
                    className="w-24 h-24 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: `${accent}40`, backgroundColor: `${accent}10` }}
                  >
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <circle cx="18" cy="15" r="6" stroke={accent} strokeWidth="2"/>
                      <path d="M18 21c0 0-9 7.5-9 12h18c0-4.5-9-12-9-12z" stroke={accent} strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">Cambodia · 9 Corridors · 110+ Sites</p>
                  <Link
                    to="/map"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest transition-all border"
                    style={{ borderColor: `${accent}50`, color: accent }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = accent;
                      (e.currentTarget as HTMLElement).style.color = "#000";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                      (e.currentTarget as HTMLElement).style.color = accent;
                    }}
                  >
                    Launch interactive map →
                  </Link>
                </div>
                {[[20, 40], [55, 55], [70, 35], [35, 70], [80, 65]].map(([x, y], i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full pulse-dot"
                    style={{ left: `${x}%`, top: `${y}%`, backgroundColor: accent, animationDelay: `${i * 0.4}s` }}
                  />
                ))}
              </div>
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
          <Link to="/dashboard" className="hover:text-white/50 transition-colors">Dashboard</Link>
          <p>{cfg.footerRight}</p>
        </div>
      </footer>
    </div>
  );
}
