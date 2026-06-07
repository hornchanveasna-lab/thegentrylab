import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { NEWS } from "@/data/platform";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Industrial News — The Gentry Lab" },
      { name: "description", content: "Curated industrial news from Cambodia: SEZs, factory openings, infrastructure projects and regulation updates." },
      { property: "og:title", content: "Cambodia Industrial News" },
      { property: "og:description", content: "What matters this week in Cambodia industrial development." },
    ],
  }),
  component: NewsPage,
});

/* ── Photo map by sector ─────────────────────────────────── */
const SECTOR_PHOTO: Record<string, string> = {
  Infrastructure: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&q=80&fit=crop",
  Energy:         "https://images.unsplash.com/photo-1466611653911-0265b219a3df?w=1200&q=80&fit=crop",
  Automotive:     "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&q=80&fit=crop",
  Garment:        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&fit=crop",
  Warehousing:    "https://images.unsplash.com/photo-1485083269755-a7b559a4fe5e?w=1200&q=80&fit=crop",
  "Data Center":  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80&fit=crop",
  Policy:         "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80&fit=crop",
  Electronics:    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&fit=crop",
};

const SECTOR_GRADIENT: Record<string, string> = {
  Infrastructure: "linear-gradient(135deg,#0f172a 0%,#0d4a6b 100%)",
  Energy:         "linear-gradient(135deg,#1a0a2e 0%,#b45309 100%)",
  Automotive:     "linear-gradient(135deg,#0a0a0b 0%,#7f1d1d 100%)",
  Garment:        "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%)",
  Warehousing:    "linear-gradient(135deg,#052e16 0%,#166534 100%)",
  "Data Center":  "linear-gradient(135deg,#0c0a1a 0%,#1e3a8a 100%)",
  Policy:         "linear-gradient(135deg,#1c1917 0%,#44403c 100%)",
  Electronics:    "linear-gradient(135deg,#0c1a2e 0%,#164e63 100%)",
};

const getPhoto = (sector: string) => SECTOR_PHOTO[sector] ?? "https://images.unsplash.com/photo-1581922815928-45c4b2e35e34?w=1200&q=80&fit=crop";
const getGradient = (sector: string) => SECTOR_GRADIENT[sector] ?? "linear-gradient(135deg,#0a0a0b 0%,#7c2d12 100%)";

/* ── Slider (auto-advances, keyboard + swipe) ─────────────── */
function FeaturedSlider({ items }: { items: typeof NEWS }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prev = () => setIdx((i) => (i - 1 + items.length) % items.length);
  const next = () => setIdx((i) => (i + 1) % items.length);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [idx, paused]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const item = items[idx];

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: "min(520px, 55vw)", minHeight: 320 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background slides */}
      {items.map((n, i) => (
        <div
          key={n.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0, zIndex: i === idx ? 1 : 0 }}
        >
          <div className="absolute inset-0" style={{ background: getGradient(n.sector) }} />
          <img
            src={getPhoto(n.sector)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.35, mixBlendMode: "luminosity" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          {/* vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        </div>
      ))}

      {/* Grid overlay */}
      <div className="absolute inset-0 z-[2] pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,81,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,81,0,0.04) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* Content */}
      <div className="absolute inset-0 z-[3] flex flex-col justify-end px-8 md:px-16 pb-14 pt-8">
        <div className="flex items-center gap-3 mb-5">
          <span className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>
            {item.sector}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/50">{item.province}</span>
          <span className="ml-auto font-mono text-[10px] text-white/30">{item.date}</span>
        </div>

        <h2 className="font-extrabold uppercase tracking-tighter leading-[0.95] text-white"
          style={{ fontSize: "clamp(1.4rem, 3.5vw, 2.4rem)", maxWidth: "68%" }}>
          {item.headline}
        </h2>
        <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xl line-clamp-2">{item.summary}</p>

        <div className="flex items-center gap-3 mt-5">
          <a href={item.url} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ff5100] text-black font-mono text-[10px] uppercase tracking-widest hover:brightness-110 transition shrink-0">
            Read more
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5h9M6.5 2l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">Source · {item.source}</span>
        </div>
      </div>

      {/* Prev/Next arrows */}
      <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 z-[4] w-10 h-10 flex items-center justify-center bg-black/50 border border-white/15 text-white hover:bg-black/80 hover:border-white/40 transition">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
      <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 z-[4] w-10 h-10 flex items-center justify-center bg-black/50 border border-white/15 text-white hover:bg-black/80 hover:border-white/40 transition">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[4] flex items-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="transition-all"
            style={{
              width: i === idx ? 20 : 6, height: 6,
              borderRadius: 3,
              backgroundColor: i === idx ? "#ff5100" : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>

      {/* Slide count */}
      <div className="absolute top-5 right-5 z-[4] font-mono text-[10px] uppercase tracking-widest text-white/30">
        {idx + 1} / {items.length}
      </div>
    </div>
  );
}

/* ── News card (grid layout) ─────────────────────────────── */
function NewsCard({ item }: { item: typeof NEWS[number] }) {
  return (
    <article className="group border border-white/8 bg-[#0d0d0e] hover:border-white/20 transition-all overflow-hidden flex flex-col">
      {/* Photo strip */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0" style={{ background: getGradient(item.sector) }} />
        <img
          src={getPhoto(item.sector)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ opacity: 0.4, mixBlendMode: "luminosity" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-transparent to-transparent" />
        <div className="absolute top-3 left-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>
          {item.sector}
        </div>
        <div className="absolute bottom-3 right-3 font-mono text-[9px] text-white/40">{item.date}</div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">{item.province}</p>
        <a href={item.url} className="text-[13px] font-extrabold uppercase tracking-tight leading-snug hover:text-[#ff5100] transition line-clamp-2 mb-3">
          {item.headline}
        </a>
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-3 flex-1">{item.summary}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">Source · {item.source}</span>
          <a href={item.url} className="font-mono text-[9px] uppercase tracking-widest hover:text-[#ff5100] transition" style={{ color: "#ff5100" }}>
            Read →
          </a>
        </div>
      </div>
    </article>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
function NewsPage() {
  const sectors = useMemo(() => Array.from(new Set(NEWS.map((n) => n.sector))).sort(), []);
  const provinces = useMemo(() => Array.from(new Set(NEWS.map((n) => n.province))).sort(), []);
  const [sector, setSector]     = useState("All");
  const [province, setProvince] = useState("All");
  const [view, setView]         = useState<"grid" | "list">("grid");

  const sorted  = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));
  const featured = sorted.slice(0, 5);

  const filtered = sorted.filter(
    (n) => (sector === "All" || n.sector === sector) && (province === "All" || n.province === province),
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans flex flex-col">
      <TopNav />

      {/* ── Featured slider ── */}
      <FeaturedSlider items={featured} />

      {/* ── Header + filters ── */}
      <div className="border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "#ff5100" }}>Industrial News</p>
              <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tighter">
                What moved this week
              </h1>
              <p className="text-white/50 max-w-xl mt-2 text-sm leading-relaxed">
                Filtered news that matters for industrial investment decisions in Cambodia — deals, infrastructure, regulation.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest shrink-0">
              <FilterSelect label="Sector"   value={sector}   onChange={setSector}   options={["All", ...sectors]} />
              <FilterSelect label="Province" value={province} onChange={setProvince} options={["All", ...provinces]} />
              {/* View toggle */}
              <div className="flex items-center border border-white/10">
                {(["grid", "list"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className="px-3 py-2 transition-all"
                    style={{ backgroundColor: view === v ? "#ff510020" : "transparent", color: view === v ? "#ff5100" : "rgba(255,255,255,0.3)" }}>
                    {v === "grid"
                      ? <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="0" y="0" width="5.5" height="5.5" rx="0.5"/><rect x="7.5" y="0" width="5.5" height="5.5" rx="0.5"/><rect x="0" y="7.5" width="5.5" height="5.5" rx="0.5"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="0.5"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><line x1="1" y1="2.5" x2="12" y2="2.5"/><line x1="1" y1="6.5" x2="12" y2="6.5"/><line x1="1" y1="10.5" x2="12" y2="10.5"/></svg>
                    }
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="font-mono text-[9px] uppercase tracking-widest text-white/20 mt-4">
            {filtered.length} article{filtered.length !== 1 ? "s" : ""} · Cambodia industrial only
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="flex-1 max-w-7xl mx-auto px-6 md:px-12 py-10 w-full">
        {view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((n) => <NewsCard key={n.id} item={n} />)}
          </div>
        ) : (
          <ul className="border border-white/8 divide-y divide-white/8">
            {filtered.map((n) => (
              <li key={n.id} className="flex gap-0 hover:bg-white/4 transition group">
                {/* Color strip */}
                <div className="w-1 shrink-0" style={{ background: getGradient(n.sector) }} />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">
                    <span className="px-2 py-0.5 text-black font-bold text-[9px]" style={{ backgroundColor: "#ff5100" }}>{n.sector}</span>
                    <span>{n.province}</span>
                    <span className="ml-auto">{n.date}</span>
                  </div>
                  <a href={n.url} className="text-[13px] font-bold leading-snug hover:text-[#ff5100] transition">{n.headline}</a>
                  <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed line-clamp-2">{n.summary}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mt-2">Source · {n.source}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/25">No articles match current filters</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="flex items-center gap-2 border border-white/10 px-3 py-2 cursor-pointer">
      <span className="text-white/30">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none text-white font-mono text-[10px] uppercase tracking-widest">
        {options.map((o) => <option key={o} value={o} className="bg-[#0a0a0b] text-white">{o}</option>)}
      </select>
    </label>
  );
}
