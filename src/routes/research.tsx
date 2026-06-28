import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { RESEARCH } from "@/data/platform";
import { useResearch } from "@/lib/data";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research Library — The Gentry Lab" },
      { name: "description", content: "Proprietary research briefs on Cambodia industrial development: SEZ landscape, power capacity, permit pathways and cost benchmarks." },
      { property: "og:title", content: "Cambodia Industrial Research Library" },
      { property: "og:description", content: "Decision-grade research for foreign investors." },
    ],
  }),
  component: ResearchPage,
});

const EMAIL = "advisory@thegentrylab.io";

/* ── Teaser stat chips per brief ─────────────────────────── */
const BRIEF_STATS: Record<string, string[]> = {
  r1:  ["71 active SEZs", "$9.2B approved (2025)", "#1 Greenfield FDI Index"],
  r2:  ["24 provinces mapped", "Grid uptime by zone", "Capacity shortage flags"],
  r3:  ["Up to 9-yr tax holiday", "0% export duty (QIP)", "19 eligible sectors"],
  r4:  ["Factory cost per m²", "3 construction types", "Q1 2026 benchmarks"],
  r5:  ["$210/mo min wage (2026)", "60% workforce under 35", "6 labor provinces ranked"],
  r6:  ["4 land title types", "Due diligence checklist", "Red flag risk matrix"],
  r7:  ["6 trade corridors", "Port distance by province", "Cost per tonne/km"],
  r8:  ["141 sites flood-rated", "Province risk tiers", "Seasonal elevation data"],
  r9:  ["800 ha master plan", "1,200 workers on-site", "35% renewable energy"],
  r10: ["5% GDP growth (2026e)", "$8.1B FDI inflows", "RCEP: 2.3B consumers"],
  r11: ["#1 global FDI ranking", "575 projects in 2025", "66% YoY investment growth"],
};

/* ── Per-brief photos — topic-matched ───────────────────── */
const BRIEF_PHOTOS: Record<string, string> = {
  // SEZ Landscape — aerial industrial park
  r1:  "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=900&q=80&fit=crop",
  // Power Capacity — solar + power lines
  r2:  "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=900&q=80&fit=crop",
  // Permit / Incentives — formal meeting / government
  r3:  "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=900&q=80&fit=crop",
  // Construction Cost — cranes, structure
  r4:  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80&fit=crop",
  // Labor — workers / garment production
  r5:  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80&fit=crop",
  // Land Due Diligence — land / field aerial
  r6:  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80&fit=crop",
  // Logistics Cost Map — trucks / port / containers
  r7:  "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=900&q=80&fit=crop",
  // Flood Risk Atlas — water / river / aerial flood
  r8:  "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=900&q=80&fit=crop",
  // ISI SEZ brief — modern industrial zone
  r9:  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=900&q=80&fit=crop",
  // Investment Climate — Phnom Penh / city skyline
  r10: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=900&q=80&fit=crop",
  // Greenfield FDI trends — construction growth
  r11: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80&fit=crop",
};

/* ── Cover art by category ───────────────────────────────── */
const CATEGORY_STYLE: Record<string, {
  gradient: string;
  accent: string;
  icon: React.ReactNode;
}> = {
  Sector: {
    gradient: "linear-gradient(145deg,#0a0a0b 0%,#7c2d12 60%,#ff5100 100%)",
    accent: "#ff5100",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <rect x="2" y="8" width="28" height="20" rx="1"/>
        <path d="M2 8l14-6 14 6"/>
        <line x1="2" y1="15" x2="30" y2="15"/>
        <line x1="11" y1="15" x2="11" y2="28"/>
        <line x1="21" y1="15" x2="21" y2="28"/>
      </svg>
    ),
  },
  Province: {
    gradient: "linear-gradient(145deg,#0c1a2e 0%,#0d4a6b 60%,#38bdf8 100%)",
    accent: "#38bdf8",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <circle cx="16" cy="13" r="5"/>
        <path d="M16 2C9.37 2 4 7.37 4 14c0 8.25 12 18 12 18s12-9.75 12-18c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
  },
  Regulation: {
    gradient: "linear-gradient(145deg,#1c1917 0%,#292524 60%,#78716c 100%)",
    accent: "#a8a29e",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <path d="M20 4H8a2 2 0 00-2 2v20a2 2 0 002 2h16a2 2 0 002-2V10z"/>
        <polyline points="20,4 20,10 26,10"/>
        <line x1="10" y1="16" x2="22" y2="16"/>
        <line x1="10" y1="20" x2="18" y2="20"/>
        <line x1="10" y1="24" x2="14" y2="24"/>
      </svg>
    ),
  },
  Cost: {
    gradient: "linear-gradient(145deg,#1a1200 0%,#713f12 60%,#d97706 100%)",
    accent: "#fbbf24",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <line x1="4" y1="28" x2="28" y2="28"/>
        <rect x="5"  y="18" width="5" height="10"/>
        <rect x="13" y="13" width="5" height="15"/>
        <rect x="21" y="6"  width="5" height="22"/>
        <path d="M7.5 14l5.5-5 5 4 5-7" strokeWidth="1.6"/>
      </svg>
    ),
  },
  Policy: {
    gradient: "linear-gradient(145deg,#0a1628 0%,#1e3a5f 60%,#3b82f6 100%)",
    accent: "#60a5fa",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <circle cx="16" cy="16" r="12"/>
        <line x1="2" y1="16" x2="30" y2="16"/>
        <path d="M16 4c-4 4-6 8-6 12s2 8 6 12"/>
        <path d="M16 4c4 4 6 8 6 12s-2 8-6 12"/>
      </svg>
    ),
  },
};

const DEFAULT_STYLE = CATEGORY_STYLE.Sector;

function getCategoryStyle(category: string) {
  return CATEGORY_STYLE[category] ?? DEFAULT_STYLE;
}

/* ── Research Cover Card ─────────────────────────────────── */
function ResearchCard({
  brief,
  featured = false,
  isDark = true,
}: {
  brief: typeof RESEARCH[0];
  featured?: boolean;
  isDark?: boolean;
}) {
  const style = getCategoryStyle(brief.category);
  const stats = BRIEF_STATS[brief.id] ?? [];
  const photo = BRIEF_PHOTOS[brief.id];

  const cardBg = isDark ? "#0d0d0e" : "#e8e8e8";

  return (
    <article className="group relative overflow-hidden transition-all duration-300 flex flex-col" style={{ backgroundColor: cardBg, border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)" }}>

      {/* ── Cover image ── */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ height: featured ? 280 : 200 }}>
        <div className="absolute inset-0" style={{ background: style.gradient }} />
        {photo && (
          <img
            src={photo}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ opacity: 0.35, mixBlendMode: "luminosity" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(${style.accent}07 1px,transparent 1px),linear-gradient(90deg,${style.accent}07 1px,transparent 1px)`,
          backgroundSize: "32px 32px",
        }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 60% at 80% 20%,${style.accent}20 0%,transparent 70%)` }} />
        <div className="absolute bottom-0 left-0 right-0 h-2/3" style={{ background: `linear-gradient(to top, ${cardBg}, transparent)` }} />

        <div className="absolute top-4 left-4 text-white" style={{ color: style.accent }}>{style.icon}</div>

        {/* Lock badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 border border-white/10 px-2.5 py-1">
          <svg width="8" height="9" viewBox="0 0 8 9" fill="none"><rect x="1" y="4" width="6" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.1"/><path d="M2.5 4V2.5a1.5 1.5 0 013 0V4" stroke="currentColor" strokeWidth="1.1"/></svg>
          <span className="font-mono text-[8px] uppercase tracking-widest text-white/50">{brief.pages}p · Advisory</span>
        </div>

        {featured && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[8px] uppercase tracking-widest text-black font-bold px-3 py-1" style={{ backgroundColor: "#ff5100" }}>
            Latest Brief
          </div>
        )}

        <div className="absolute bottom-3 left-4">
          <span className="px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest border" style={{ borderColor: `${style.accent}40`, color: style.accent, backgroundColor: `${style.accent}12` }}>
            {brief.category}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5 flex flex-col flex-1">

        <h3 className={`font-extrabold uppercase tracking-tight leading-tight mb-4 ${featured ? "text-lg" : "text-sm"}`} style={{ color: isDark ? "#fff" : "#111" }}>
          {brief.title}
        </h3>

        {/* Stat chips — the hook */}
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {stats.map((s) => (
              <span key={s} className="px-2 py-0.5 font-mono text-[9px] tracking-wide" style={{ border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)", color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Abstract — faded/blurred teaser */}
        <div className="relative flex-1 overflow-hidden" style={{ maxHeight: featured ? 72 : 52 }}>
          <p className="text-[11px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.45)" }}>{brief.abstract}</p>
          <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, ${cardBg})` }} />
        </div>

        {/* CTA */}
        <div className="mt-4 pt-4 flex items-center justify-between gap-3" style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[10px] font-mono leading-snug" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.35)" }}>
            Full analysis available<br/>to advisory clients
          </p>
          <a
            href={`mailto:${EMAIL}?subject=Brief%20request%3A%20${encodeURIComponent(brief.title)}&body=I'd%20like%20access%20to%20this%20research%20brief.`}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 font-mono text-[9px] uppercase tracking-widest transition-all border"
            style={{ borderColor: style.accent, color: style.accent }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.backgroundColor = style.accent; el.style.color = "#000"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.backgroundColor = "transparent"; el.style.color = style.accent; }}
          >
            Get brief
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M5.5 1.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </div>
    </article>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
function ResearchPage() {
  const { data: briefs = RESEARCH } = useResearch();
  const [activeCategory, setActiveCategory] = useState("All");
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("tgl_theme") !== "light"; } catch { return true; }
  });

  useEffect(() => {
    const onStorage = () => {
      try { setIsDark(localStorage.getItem("tgl_theme") !== "light"); } catch { /* */ }
    };
    window.addEventListener("storage", onStorage);
    // Poll for same-tab changes (theme toggle doesn't fire storage event in same tab)
    const id = setInterval(onStorage, 300);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(id); };
  }, []);
  const categories = ["All", ...Array.from(new Set(briefs.map((r) => r.category)))];

  const filtered = briefs.filter((r) => activeCategory === "All" || r.category === activeCategory);
  const [featured, ...rest] = filtered;

  return (
    <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: isDark ? "#0a0a0b" : "#e2e2e2", color: isDark ? "#fff" : "#111" }}>
      <TopNav />

      {/* ── Hero strip ── */}
      <section className="relative border-b border-white/8 overflow-hidden" style={{ background: "var(--research-hero-bg)" }}>
        {/* Background decorative */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(255,81,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,81,0,0.04) 1px,transparent 1px)",
          backgroundSize: "52px 52px",
        }} />
        <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 80% at 100% 50%,#ff510015 0%,transparent 70%)" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest mb-4" style={{ color: "#ff5100" }}>Intelligence Library · Restricted Access</p>
              <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.9]">
                What Google<br />doesn't <span style={{ color: "#ff5100" }}>index.</span>
              </h1>
              <p className="text-white/40 max-w-md mt-5 text-sm leading-relaxed">
                Field-verified numbers, risk flags, and site-level intelligence on Cambodia's industrial landscape. Not available in the public domain.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-8 shrink-0">
              {[
                { n: briefs.length, label: "Restricted briefs" },
                { n: briefs.reduce((a, r) => a + r.pages, 0), label: "Pages of intel" },
              ].map((s) => (
                <div key={s.label} className="text-right">
                  <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#ff5100" }}>{s.n}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2 mt-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-all"
                style={{
                  backgroundColor: activeCategory === cat ? "#ff5100" : "transparent",
                  borderColor: activeCategory === cat ? "#ff5100" : "var(--news-card-border)",
                  color: activeCategory === cat ? "#000" : "var(--research-filter-inactive)",
                  fontWeight: activeCategory === cat ? 700 : 400,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content grid ── */}
      <main className="flex-1 max-w-7xl mx-auto px-6 md:px-12 py-10 w-full">
        {featured && (
          <div className="mb-5">
            <ResearchCard brief={featured} featured isDark={isDark} />
          </div>
        )}

        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((r) => <ResearchCard key={r.id} brief={r} isDark={isDark} />)}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/25">No briefs in this category</p>
          </div>
        )}

        {/* Access note */}
        <div className="mt-12 border border-white/8 bg-[#0d0d0e] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 120% at 100% 50%, #ff510010 0%, transparent 60%)" }} />
          <div className="relative px-8 py-7 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <svg width="10" height="11" viewBox="0 0 8 9" fill="none"><rect x="1" y="4" width="6" height="5" rx="0.5" stroke="#ff5100" strokeWidth="1.1"/><path d="M2.5 4V2.5a1.5 1.5 0 013 0V4" stroke="#ff5100" strokeWidth="1.1"/></svg>
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>Advisory Access Only</p>
              </div>
              <p className="text-[13px] text-white/50 leading-relaxed max-w-lg">
                These briefs contain data points, risk flags, and site-level findings we don't publish openly. If you're evaluating an investment in Cambodia, this is the difference between a site visit and a real decision.
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
              <a
                href={`mailto:${EMAIL}?subject=Research%20Library%20Access%20Request&body=I'd%20like%20access%20to%20the%20full%20research%20library.`}
                className="px-6 py-3 font-mono text-[10px] uppercase tracking-widest bg-[#ff5100] text-black hover:brightness-110 transition font-bold"
              >
                Request full access →
              </a>
              <p className="font-mono text-[9px] text-white/20 uppercase tracking-widest">Response within 24 hours</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
