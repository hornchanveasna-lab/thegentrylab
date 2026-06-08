import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

/* ── Cover art by category ───────────────────────────────── */
const CATEGORY_STYLE: Record<string, {
  gradient: string;
  photo: string;
  accent: string;
  icon: React.ReactNode;
}> = {
  Sector: {
    gradient: "linear-gradient(145deg,#0a0a0b 0%,#7c2d12 50%,#ff5100 100%)",
    photo: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80&fit=crop",
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
    gradient: "linear-gradient(145deg,#0c1a2e 0%,#0d4a6b 50%,#38bdf8 100%)",
    photo: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80&fit=crop",
    accent: "#38bdf8",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <circle cx="16" cy="13" r="5"/>
        <path d="M16 2C9.37 2 4 7.37 4 14c0 8.25 12 18 12 18s12-9.75 12-18c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
  },
  Regulation: {
    gradient: "linear-gradient(145deg,#1c1917 0%,#292524 50%,#57534e 100%)",
    photo: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80&fit=crop",
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
    gradient: "linear-gradient(145deg,#1a1200 0%,#713f12 50%,#d97706 100%)",
    photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80&fit=crop",
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
};

const DEFAULT_STYLE = CATEGORY_STYLE.Sector;

function getCategoryStyle(category: string) {
  return CATEGORY_STYLE[category] ?? DEFAULT_STYLE;
}

/* ── Research Cover Card ─────────────────────────────────── */
function ResearchCard({
  brief,
  featured = false,
}: {
  brief: typeof RESEARCH[0];
  featured?: boolean;
}) {
  const style = getCategoryStyle(brief.category);

  return (
    <article
      className="group relative overflow-hidden border border-white/10 hover:border-white/25 transition-all flex flex-col bg-[#0d0d0e]"
    >
      {/* ── Cover ── */}
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{ height: featured ? 300 : 200 }}
      >
        {/* Gradient base */}
        <div className="absolute inset-0" style={{ background: style.gradient }} />

        {/* Photo overlay */}
        <img
          src={style.photo}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ opacity: 0.25, mixBlendMode: "luminosity" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(${style.accent}08 1px,transparent 1px),linear-gradient(90deg,${style.accent}08 1px,transparent 1px)`,
          backgroundSize: "32px 32px",
        }} />

        {/* Corner glow */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 60% at 80% 20%,${style.accent}25 0%,transparent 70%)` }} />

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#0d0d0e] to-transparent" />

        {/* Icon + page count */}
        <div className="absolute top-5 left-5 text-white" style={{ color: style.accent }}>
          {style.icon}
        </div>
        <div className="absolute top-5 right-5 font-mono text-[9px] uppercase tracking-widest bg-black/50 px-2 py-1 border border-white/10" style={{ color: style.accent }}>
          {brief.pages} pg
        </div>

        {/* Category badge */}
        <div className="absolute bottom-4 left-5">
          <span className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border" style={{
            borderColor: `${style.accent}50`,
            color: style.accent,
            backgroundColor: `${style.accent}15`,
          }}>
            {brief.category}
          </span>
        </div>

        {/* Featured label */}
        {featured && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-widest text-black font-bold px-3 py-1" style={{ backgroundColor: "#ff5100" }}>
            Featured Brief
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className={`font-extrabold uppercase tracking-tight leading-tight mb-3 ${featured ? "text-xl" : "text-sm"}`}>
          {brief.title}
        </h3>
        <p className="text-[12px] text-white/55 leading-relaxed flex-1">{brief.abstract}</p>

        <div className={`flex items-center gap-4 mt-5 pt-4 border-t border-white/8 ${featured ? "flex-row" : "flex-col sm:flex-row"}`}>
          <a
            href={`mailto:${EMAIL}?subject=Research%20access%20-%20${encodeURIComponent(brief.title)}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-widest transition-all border"
            style={{ borderColor: style.accent, color: style.accent }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = style.accent; (e.currentTarget as HTMLAnchorElement).style.color = "#000"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = style.accent; }}
          >
            Request access
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8M5.5 1.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          {featured && (
            <p className="text-[11px] text-white/30 font-mono">Proprietary · Not available in public domain</p>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
function ResearchPage() {
  const { data: briefs = RESEARCH } = useResearch();
  const [activeCategory, setActiveCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(briefs.map((r) => r.category)))];

  const filtered = briefs.filter((r) => activeCategory === "All" || r.category === activeCategory);
  const [featured, ...rest] = filtered;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans flex flex-col">
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
              <p className="font-mono text-[10px] uppercase tracking-widest mb-4" style={{ color: "#ff5100" }}>Research Library</p>
              <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter leading-[0.9]">
                Decision-grade<br /><span style={{ color: "#ff5100" }}>briefs.</span>
              </h1>
              <p className="text-white/50 max-w-lg mt-5 text-sm leading-relaxed">
                Proprietary research from the field, not desk-research summaries. Written for investment committees, not analysts.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-8 shrink-0">
              {[
                { n: briefs.length, label: "Briefs available" },
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
            <ResearchCard brief={featured} featured />
          </div>
        )}

        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((r) => <ResearchCard key={r.id} brief={r} />)}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/25">No briefs in this category</p>
          </div>
        )}

        {/* Access note */}
        <div className="mt-12 border border-white/8 bg-[#0d0d0e] px-8 py-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#ff5100" }}>Advisory Access</p>
            <p className="text-sm text-white/60 leading-relaxed">All research briefs are available to GentryLab advisory clients. Request access via email and receive the relevant brief within 24 hours.</p>
          </div>
          <a
            href={`mailto:${EMAIL}?subject=Research%20Library%20Access%20Request`}
            className="shrink-0 px-6 py-3 font-mono text-[10px] uppercase tracking-widest bg-[#ff5100] text-black hover:brightness-110 transition font-bold"
          >
            Request all access →
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
