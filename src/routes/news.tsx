import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { NEWS, type NewsItem } from "@/data/platform";
import { useNews } from "@/lib/data";

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

/* ── Sector visual identity ──────────────────────────────── */
// Each sector: accent color, gradient, fallback Unsplash photo
const SECTOR_META: Record<string, { accent: string; gradient: string; photo: string }> = {
  Infrastructure: {
    accent:   "#38bdf8",
    gradient: "linear-gradient(135deg,#0a1628 0%,#0c3a5c 60%,#0e5280 100%)",
    photo:    "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=1200&q=80&fit=crop",
  },
  Energy: {
    accent:   "#fbbf24",
    gradient: "linear-gradient(135deg,#0f0a00 0%,#7c4800 60%,#a85e00 100%)",
    photo:    "https://images.unsplash.com/photo-1466611653911-0265b219a3df?w=1200&q=80&fit=crop",
  },
  Automotive: {
    accent:   "#f43f5e",
    gradient: "linear-gradient(135deg,#0d0005 0%,#5a0018 60%,#8b0025 100%)",
    photo:    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80&fit=crop",
  },
  Garment: {
    accent:   "#a78bfa",
    gradient: "linear-gradient(135deg,#0c0820 0%,#2d1060 60%,#4a1d96 100%)",
    photo:    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&fit=crop",
  },
  Warehousing: {
    accent:   "#34d399",
    gradient: "linear-gradient(135deg,#001a0e 0%,#054a27 60%,#076b38 100%)",
    photo:    "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80&fit=crop",
  },
  "Data Center": {
    accent:   "#818cf8",
    gradient: "linear-gradient(135deg,#06050f 0%,#111860 60%,#1a2580 100%)",
    photo:    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80&fit=crop",
  },
  "Food Processing": {
    accent:   "#fb923c",
    gradient: "linear-gradient(135deg,#0f0500 0%,#7c2e00 60%,#a84000 100%)",
    photo:    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&fit=crop",
  },
  Electronics: {
    accent:   "#22d3ee",
    gradient: "linear-gradient(135deg,#020c12 0%,#053d52 60%,#075e7a 100%)",
    photo:    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&fit=crop",
  },
  Policy: {
    accent:   "#94a3b8",
    gradient: "linear-gradient(135deg,#080808 0%,#1e2025 60%,#2c2f38 100%)",
    photo:    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80&fit=crop",
  },
};

const DEFAULT_META = {
  accent:   "#ff5100",
  gradient: "linear-gradient(135deg,#0a0a0b 0%,#5c1e00 100%)",
  photo:    "https://images.unsplash.com/photo-1581922815928-45c4b2e35e34?w=1200&q=80&fit=crop",
};

const getSectorMeta  = (sector: string) => SECTOR_META[sector] ?? DEFAULT_META;
const getPhoto       = (sector: string) => getSectorMeta(sector).photo;
const getGradient    = (sector: string) => getSectorMeta(sector).gradient;
const getAccent      = (sector: string) => getSectorMeta(sector).accent;
const getItemPhoto   = (item: NewsItem) => item.image_url || getPhoto(item.sector);
const isRealUrl      = (url: string) => url && url !== "#";
const linkProps      = (url: string) => isRealUrl(url)
  ? { href: url, target: "_blank", rel: "noopener noreferrer" }
  : { href: "#" };

/* ── Slide background with fade-in (no flash on src change) ── */
function SliderSlide({ item: n, active }: { item: NewsItem; active: boolean }) {
  const src = getItemPhoto(n);
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    if (src !== currentSrc) {
      setLoaded(false);
      setCurrentSrc(src);
    }
  }, [src]);

  return (
    <div
      className="absolute inset-0 transition-opacity duration-700"
      style={{ opacity: active ? 1 : 0, zIndex: active ? 1 : 0 }}
    >
      <div className="absolute inset-0 bg-[#111]" />
      <img
        src={currentSrc}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: loaded ? 0.65 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => { setCurrentSrc(getPhoto(n.sector)); }}
      />
      {/* Sector colour wash */}
      <div className="absolute inset-0" style={{ backgroundColor: getAccent(n.sector), opacity: 0.28 }} />
      {/* vignette */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
    </div>
  );
}

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
      className="relative overflow-hidden text-white"
      style={{ height: "min(520px, 55vw)", minHeight: 320 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background slides */}
      {items.map((n, i) => (
        <SliderSlide key={n.id} item={n} active={i === idx} />
      ))}

      {/* Grid overlay — tinted to sector accent */}
      <div className="absolute inset-0 z-[2] pointer-events-none" style={{
        backgroundImage: `linear-gradient(${getAccent(item.sector)}08 1px,transparent 1px),linear-gradient(90deg,${getAccent(item.sector)}08 1px,transparent 1px)`,
        backgroundSize: "48px 48px",
      }} />

      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 z-[3]" style={{ backgroundColor: getAccent(item.sector) }} />

      {/* Content */}
      <div className="absolute inset-0 z-[3] flex flex-col justify-end px-8 md:px-16 pb-14 pt-8">
        <div className="flex items-center gap-3 mb-5">
          <span className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest font-bold"
            style={{ backgroundColor: getAccent(item.sector), color: "#000" }}>
            {item.sector}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/50">{item.province}</span>
          <span className="ml-auto font-mono text-[10px] text-white/30">{item.date}</span>
        </div>

        <h2 className="news-hero-title font-extrabold uppercase tracking-tighter leading-[0.95] text-white"
          style={{ fontSize: "clamp(1.4rem, 3.5vw, 2.4rem)", maxWidth: "68%" }}>
          {item.headline}
        </h2>
        <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xl line-clamp-2">{item.summary}</p>

        <div className="flex items-center gap-3 mt-5">
          <a {...linkProps(item.url)} className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest hover:brightness-110 transition shrink-0 font-bold"
            style={{ backgroundColor: getAccent(item.sector), color: "#000" }}>
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

      {/* Dot indicators — sector-colored active dot */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[4] flex items-center gap-2">
        {items.map((n, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="transition-all"
            style={{
              width: i === idx ? 20 : 6, height: 6,
              borderRadius: 3,
              backgroundColor: i === idx ? getAccent(n.sector) : "var(--news-dot-inactive)",
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
function NewsCard({ item }: { item: NewsItem }) {
  const accent = getAccent(item.sector);
  const src = getItemPhoto(item);
  const [imgSrc, setImgSrc] = useState(src);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (src !== imgSrc) {
      setImgLoaded(false);
      setImgSrc(src);
    }
  }, [src]);

  return (
    <article className="group border bg-[#0d0d0e] news-card transition-all overflow-hidden flex flex-col"
      style={{ borderColor: "var(--news-card-border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accent}50`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--news-card-border)")}
    >
      {/* Photo strip */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0 bg-[#111]" />
        <img
          src={imgSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ opacity: imgLoaded ? 0.7 : 0, transition: "opacity 0.5s, transform 0.7s" }}
          onLoad={() => setImgLoaded(true)}
          onError={() => { setImgSrc(getPhoto(item.sector)); }}
        />
        {/* Sector colour wash — plain overlay, no blend mode */}
        <div className="absolute inset-0" style={{ backgroundColor: getAccent(item.sector), opacity: 0.28 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        {/* Sector badge — sector accent color */}
        <div className="absolute top-3 left-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest font-bold"
          style={{ backgroundColor: accent, color: "#000" }}>
          {item.sector}
        </div>
        <div className="absolute bottom-3 right-3 font-mono text-[9px] text-white/40">{item.date}</div>
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: accent }} />
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">{item.province}</p>
        <a {...linkProps(item.url)} className="text-[13px] font-extrabold uppercase tracking-tight leading-snug transition line-clamp-2 mb-3 text-white/90"
          style={{ ["--hover-color" as string]: accent }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = accent)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--news-headline)")}>
          {item.headline}
        </a>
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-3 flex-1">{item.summary}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">Source · {item.source}</span>
          {isRealUrl(item.url) && (
            <a {...linkProps(item.url)} className="font-mono text-[9px] uppercase tracking-widest transition"
              style={{ color: accent }}>
              Read →
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
function NewsPage() {
  const { data: newsItems = NEWS } = useNews();
  const sectors = useMemo(() => Array.from(new Set(newsItems.map((n) => n.sector))).sort(), [newsItems]);
  const provinces = useMemo(() => Array.from(new Set(newsItems.map((n) => n.province))).sort(), [newsItems]);
  const [sector, setSector]     = useState("All");
  const [province, setProvince] = useState("All");
  const [view, setView]         = useState<"grid" | "list">("grid");

  const sorted  = [...newsItems].sort((a, b) => b.date.localeCompare(a.date));
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
                    style={{ backgroundColor: view === v ? "#ff510020" : "transparent", color: view === v ? "#ff5100" : "var(--news-toggle-inactive)" }}>
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
            {filtered.map((n) => {
              const accent = getAccent(n.sector);
              return (
              <li key={n.id} className="flex gap-0 hover:bg-white/3 transition group">
                {/* Sector accent strip */}
                <div className="w-1 shrink-0 transition-all group-hover:w-1.5" style={{ backgroundColor: accent }} />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">
                    <span className="px-2 py-0.5 font-bold text-[9px]"
                      style={{ backgroundColor: accent, color: "#000" }}>{n.sector}</span>
                    <span>{n.province}</span>
                    <span className="ml-auto">{n.date}</span>
                  </div>
                  <a {...linkProps(n.url)} className="text-[13px] font-bold leading-snug transition text-white/90"
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = accent)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--news-headline)")}>
                    {n.headline}
                  </a>
                  <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed line-clamp-2">{n.summary}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mt-2">Source · {n.source}</p>
                </div>
              </li>
            )})}
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
