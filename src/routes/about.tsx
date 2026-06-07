import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Counter, useReveal } from "@/components/site/Counter";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

/* ── Case studies ────────────────────────────────────────── */
const CASE_STUDIES = [
  {
    tag: "Airport Corridor",
    title: "Techo Airport Industrial Zone",
    sector: "Multi-sector SEZ",
    scope: "Site selection, master planning & utility strategy for 120-ha industrial zone adjacent to new international gateway",
    outcome: "Secured CDC QIP status · 3 anchor tenants · Phase 1 operational",
    color: "#ff5100",
  },
  {
    tag: "Manufacturing",
    title: "Zinus Cambodia Factory",
    sector: "Furniture & Bedding",
    scope: "End-to-end industrial development advisory: land due diligence through EPC budgeting for 65,000 m² manufacturing facility",
    outcome: "On-budget delivery · EDC 3MW substation secured · Export-ready",
    color: "#facc15",
  },
  {
    tag: "Industrial Park",
    title: "ISI Industrial Facilities",
    sector: "Pharmaceutical & Logistics",
    scope: "Permit navigation, utility strategy, and factory design for GMP-grade pharmaceutical warehouse + logistics hub",
    outcome: "MoH GMP certified · Phnom Penh Special Economic Zone · Operational",
    color: "#34d399",
  },
];

const DEFAULT_TICKER = [
  "SEZ Intelligence", "Industrial Corridors", "Utility Readiness",
  "Flood Risk Atlas", "Labor Analytics", "Permit Navigation",
  "Cost Benchmarks", "Land Due Diligence",
];

function AboutPage() {
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
          PAGE HERO
      ═══════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 border-b border-white/8 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 60% at 30% 100%, ${accent}20 0%, transparent 70%)` }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-6 reveal">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: accent }} />
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
              About The Gentry Lab
            </p>
          </div>
          <h1 className="font-extrabold uppercase leading-[0.88] tracking-tighter text-[clamp(2.8rem,7vw,6rem)] max-w-4xl reveal reveal-delay-1">
            Built on $500M+<br />
            of delivered<br />
            <span className="text-gradient">industrial projects</span><br />
            in Cambodia.
          </h1>
          <p className="text-white/50 text-lg max-w-xl mt-8 leading-relaxed reveal reveal-delay-2">
            GentryLab is Cambodia's #1 Industrial Development Advisory Platform — grounded in the GIDF methodology, proven across Techo Airport, Zinus, ISI, and dozens of projects across the country.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════════ */}
      <section className="border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/8">
          {cfg.stats.map((s, i) => (
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
      <section className="px-6 md:px-12 py-24 border-b border-white/8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Problem side */}
          <div className="reveal">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: accent }}>The Problem</p>
            <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92] mb-6">
              Beautiful reports.<br />Zero execution.
            </h2>
            <p className="text-white/50 leading-relaxed mb-8">
              CBRE, JLL, Savills — they produce polished market reports. But none of them explain how to actually turn land into a working industrial development in Cambodia.
            </p>
            <div className="flex flex-col gap-3">
              {[
                "Permitting timelines? Not in their reports.",
                "EDC substation headroom by province? Missing.",
                "Landowner behaviour and title risk? Zero coverage.",
                "How to negotiate with CDC? Good luck.",
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
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: accent }}>The GentryLab Answer</p>
                <h3 className="text-3xl font-extrabold uppercase tracking-tighter leading-[0.92] mb-6">
                  We don't tell you<br /><span style={{ color: accent }}>where.</span> We show you<br /><span style={{ color: accent }}>how.</span>
                </h3>
                <p className="text-white/55 leading-relaxed mb-8">
                  Built on $500M+ of delivered industrial projects across Cambodia — Techo Airport, Zinus, ISI — GentryLab combines ground-level execution knowledge with decision-grade intelligence tools.
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
      <section className="py-24 border-b border-white/8 px-6 md:px-12 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                Track Record
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                $500M+ delivered<br />across Cambodia
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CASE_STUDIES.map((cs, i) => (
              <div
                key={cs.title}
                className={`relative rounded-xl border border-white/10 bg-[#0e0e10] p-7 flex flex-col hover:border-white/20 transition-all group reveal reveal-delay-${i + 1}`}
                style={{ overflow: "hidden" }}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: cs.color }} />
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(ellipse 70% 50% at 50% 100%, ${cs.color}14 0%, transparent 70%)` }} />
                <div className="relative z-10 flex flex-col flex-1">
                  <span
                    className="inline-flex self-start items-center px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest mb-4"
                    style={{ backgroundColor: `${cs.color}20`, color: cs.color }}
                  >
                    {cs.tag}
                  </span>
                  <h3 className="font-extrabold uppercase text-base tracking-tight mb-1 leading-tight">{cs.title}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">{cs.sector}</p>
                  <p className="text-[12px] text-white/50 leading-relaxed mb-6 flex-1">{cs.scope}</p>
                  <div className="border-t border-white/8 pt-4">
                    <p className="text-[11px] font-mono text-white/35">
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
      <section className="py-24 border-b border-white/8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                Roadmap · Phase 02—03
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                Coming next to<br />the platform
              </h2>
            </div>
            <Link to="/research" className="font-mono text-[11px] uppercase tracking-widest text-white/35 hover:text-white transition-colors reveal reveal-delay-2">
              View intelligence research →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/8 border border-white/8">
            {cfg.roadmap.map((r, i) => (
              <div
                key={r.n}
                className={`bg-[#0a0a0b] p-8 group hover:bg-[#111113] hover-glow border border-transparent transition-all cursor-default reveal reveal-delay-${Math.min(i + 1, 6)}`}
              >
                <span className="font-mono text-xs" style={{ color: accent }}>{r.n}</span>
                <h3 className="font-extrabold uppercase text-sm tracking-tight mt-3 mb-2">{r.title}</h3>
                <p className="text-[12px] text-white/35 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FINAL CTA BANNER
      ═══════════════════════════════════════════════════ */}
      <section className="py-28 px-6 md:px-12 border-b border-white/8 relative overflow-hidden">
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
              Explore the intelligence map
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
