import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { IndustrialMap } from "@/components/site/IndustrialMap";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";

export const Route = createFileRoute("/")({
  component: Index,
});

/* ── Streak data ─────────────────────────────────────────── */
const STREAKS = [
  { left: "10%",  top: "80%", width: 320, duration: 2.8, delay: 0.0 },
  { left: "5%",   top: "70%", width: 180, duration: 3.4, delay: 0.6 },
  { left: "20%",  top: "90%", width: 260, duration: 2.5, delay: 1.2 },
  { left: "35%",  top: "85%", width: 400, duration: 3.1, delay: 0.3 },
  { left: "15%",  top: "60%", width: 220, duration: 4.0, delay: 1.8 },
  { left: "50%",  top: "95%", width: 300, duration: 2.7, delay: 0.9 },
  { left: "60%",  top: "75%", width: 160, duration: 3.6, delay: 2.1 },
  { left: "40%",  top: "55%", width: 280, duration: 2.9, delay: 0.4 },
  { left: "70%",  top: "88%", width: 200, duration: 3.2, delay: 1.5 },
  { left: "25%",  top: "40%", width: 140, duration: 4.2, delay: 2.6 },
  { left: "80%",  top: "65%", width: 350, duration: 2.6, delay: 0.7 },
  { left: "55%",  top: "50%", width: 190, duration: 3.8, delay: 1.1 },
];

/* ── Scroll reveal hook ───────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── Animated counter ─────────────────────────────────────── */
function Counter({ value }: { value: string }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const target = parseInt(value);
          const duration = 1400;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(String(Math.round(eased * target)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref}>{display}</span>;
}

/* ── Main component ───────────────────────────────────────── */
function Index() {
  useReveal();
  const [cfg, setCfg] = useState<SiteConfig>(() => loadConfig());

  // Re-load config whenever the dashboard saves a new version
  useEffect(() => {
    const handler = (e: Event) => {
      setCfg((e as CustomEvent<SiteConfig>).detail);
    };
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);

  const accent = cfg.accentColor;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans overflow-x-hidden">
      <TopNav cfg={cfg} />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden scanlines">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 90% 55% at 40% 100%, ${accent}28 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 50% 40% at 20% 85%, ${accent}18 0%, transparent 65%)`
          }}
        />

        {/* Animated speed streaks */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          {STREAKS.map((s, i) => (
            <div
              key={i}
              className="streak"
              style={{
                left: s.left,
                top: s.top,
                width: s.width,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
                transform: "rotate(-32deg)",
                transformOrigin: "left center",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 px-6 md:px-12 pb-20 pt-28 max-w-7xl mx-auto w-full">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-5 reveal" style={{ color: accent }}>
            {cfg.heroEyebrow}
          </p>

          <h1 className="font-extrabold uppercase leading-[0.88] tracking-tighter text-[clamp(2.8rem,7.5vw,6.5rem)] max-w-5xl reveal reveal-delay-1">
            {cfg.heroLine1}{" "}
            <span className="text-gradient">{cfg.heroLine2}</span>
            <br />
            {cfg.heroLine3.split("\n").map((line, i) => (
              <span key={i}>{line}{i < cfg.heroLine3.split("\n").length - 1 && <br />}</span>
            ))}
          </h1>

          <p className="text-white/55 text-lg max-w-md mt-8 leading-relaxed reveal reveal-delay-2">
            {cfg.heroSubtext}
          </p>

          <div className="flex flex-wrap gap-4 mt-10 reveal reveal-delay-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              style={{
                backgroundColor: accent,
                color: "#000",
                boxShadow: `0 0 24px ${accent}66`,
              }}
            >
              {cfg.heroCta1}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/15 text-white font-bold text-sm uppercase tracking-wider hover:border-white/40 hover:bg-white/5 transition-all"
            >
              {cfg.heroCta2}
            </Link>
          </div>

          <div className="flex flex-wrap gap-6 mt-14 reveal reveal-delay-4">
            {["CDC Data", "EDC Grid Intel", "MPWT Roads", "SEZ Board"].map((b) => (
              <span key={b} className="font-mono text-[10px] uppercase tracking-widest text-white/25">
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#0a0a0b] to-transparent z-10" />
      </section>

      {/* ── STATS BAR ────────────────────────────────────── */}
      <section className="border-y border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/8">
          {cfg.stats.map((s, i) => (
            <div key={s.label} className={`px-8 py-8 reveal reveal-delay-${i + 1}`}>
              <p className="text-4xl font-extrabold tracking-tighter tabular-nums" style={{ color: accent }}>
                <Counter value={s.value} />{s.suffix}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mt-1.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MAP SECTION ──────────────────────────────────── */}
      <section className="border-b border-white/8">
        <div className="px-6 md:px-12 py-3.5 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Interactive Map</p>
            <span className="w-px h-3 bg-white/15" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">
              9 Corridors · 6 Layers · Click any site to inspect
            </p>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: accent }} />
            Live Intelligence
          </span>
        </div>
        <IndustrialMap />
      </section>

      {/* ── ROADMAP ──────────────────────────────────────── */}
      <section className="border-b border-white/8 px-6 md:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="reveal">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: accent }}>
                Roadmap · Phase 02—03
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.92]">
                Coming next to
                <br />
                the platform
              </h2>
            </div>
            <Link
              to="/about"
              className="font-mono text-[11px] uppercase tracking-widest text-white/35 hover:text-white transition-colors reveal reveal-delay-2"
              style={{ ["--tw-text-opacity" as string]: "1" }}
            >
              About The Gentry Lab →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/8 border border-white/8">
            {cfg.roadmap.map((r, i) => (
              <div
                key={r.n}
                className={`bg-[#0a0a0b] p-8 group hover:bg-[#111113] hover-glow border border-transparent transition-all cursor-default reveal reveal-delay-${i + 1}`}
              >
                <span className="font-mono text-xs" style={{ color: accent }}>{r.n}</span>
                <h3 className="font-extrabold uppercase text-sm tracking-tight mt-3 mb-2 group-hover:transition-colors">
                  {r.title}
                </h3>
                <p className="text-[12px] text-white/35 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEE TICKER ───────────────────────────────── */}
      <div className="border-b border-white/8 py-4 overflow-hidden bg-[#0d0d0e]">
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center gap-10 pr-10">
              {cfg.ticker.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-white/20 whitespace-nowrap"
                >
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: `${accent}80` }} />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="px-6 md:px-12 py-8 font-mono text-[10px] uppercase tracking-widest text-white/20 flex flex-col sm:flex-row justify-between gap-2 max-w-7xl mx-auto">
        <p>{cfg.footerLeft}</p>
        <p>{cfg.footerRight}</p>
      </footer>
    </div>
  );
}
