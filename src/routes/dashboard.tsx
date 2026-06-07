import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  resetConfig,
  type SiteConfig,
  type StatItem,
  type RoadmapItem,
} from "@/lib/siteConfig";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

/* ─── tiny primitives ──────────────────────────────────────────── */

function Field({
  label, value, onChange, textarea = false, mono = false, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  textarea?: boolean; mono?: boolean; type?: string;
}) {
  const cls =
    `w-full bg-[#111113] border border-white/10 rounded-md px-3 py-2
     text-[13px] text-white placeholder-white/20 focus:outline-none
     focus:border-brand-accent/50 transition-colors
     ${mono ? "font-mono" : ""}`;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">
        {label}
      </span>
      {textarea ? (
        <textarea
          className={`${cls} resize-y min-h-[72px]`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-16 rounded cursor-pointer bg-transparent border border-white/10"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#111113] border border-white/10 rounded-md px-3 py-2 text-[13px] font-mono text-white focus:outline-none focus:border-brand-accent/50 transition-colors"
        />
      </div>
    </label>
  );
}

function SectionCard({ id, title, icon, children }: {
  id: string; title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-[#0e0e10] border border-white/8 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <h2 className="font-extrabold text-sm uppercase tracking-tight text-white">{title}</h2>
      </div>
      <div className="px-6 py-5 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-accent/15 text-brand-accent text-[10px] font-mono uppercase tracking-widest">
      {label}
    </span>
  );
}

/* ─── main dashboard ───────────────────────────────────────────── */

function Dashboard() {
  const [cfg, setCfg] = useState<SiteConfig>(() => loadConfig());
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("branding");

  const set = useCallback(<K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    saveConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (confirm("Reset all settings to defaults?")) {
      const def = resetConfig();
      setCfg(def);
      setSaved(false);
    }
  };

  /* stat helpers */
  const setStat = (i: number, field: keyof StatItem, val: string) => {
    const next = cfg.stats.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    set("stats", next);
  };
  const addStat = () => set("stats", [...cfg.stats, { value: "0", suffix: "", label: "New stat" }]);
  const removeStat = (i: number) => set("stats", cfg.stats.filter((_, idx) => idx !== i));

  /* roadmap helpers */
  const setRoadmap = (i: number, field: keyof RoadmapItem, val: string) => {
    const next = cfg.roadmap.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    set("roadmap", next);
  };
  const addRoadmap = () => {
    const n = String(cfg.roadmap.length + 1).padStart(2, "0");
    set("roadmap", [...cfg.roadmap, { n, title: "New Feature", desc: "Description here." }]);
  };
  const removeRoadmap = (i: number) => set("roadmap", cfg.roadmap.filter((_, idx) => idx !== i));

  /* ticker helpers */
  const setTicker = (i: number, val: string) => {
    const next = cfg.ticker.map((t, idx) => (idx === i ? val : t));
    set("ticker", next);
  };
  const addTicker = () => set("ticker", [...cfg.ticker, "New Item"]);
  const removeTicker = (i: number) => set("ticker", cfg.ticker.filter((_, idx) => idx !== i));

  const NAV = [
    { id: "branding",  label: "Branding",  icon: "🎨" },
    { id: "hero",      label: "Hero",      icon: "🏔️" },
    { id: "stats",     label: "Stats Bar", icon: "📊" },
    { id: "roadmap",   label: "Roadmap",   icon: "🗺️" },
    { id: "ticker",    label: "Ticker",    icon: "📡" },
    { id: "map",       label: "Map",       icon: "🗾" },
    { id: "footer",    label: "Footer",    icon: "📝" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      {/* ── Top bar ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0a0a0b]/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-widest">Back to site</span>
            </Link>
            <span className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-accent pulse-dot" />
              <span className="font-extrabold text-sm uppercase tracking-tight">Management Dashboard</span>
            </div>
            <Badge label="Local" />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[11px] font-mono uppercase tracking-widest transition-all"
            >
              Reset defaults
            </button>
            <button
              onClick={handleSave}
              className={`px-5 py-2 rounded-lg text-[11px] font-mono uppercase tracking-widest font-bold transition-all ${
                saved
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-brand-accent text-black hover:brightness-110"
              }`}
            >
              {saved ? "✓ Saved!" : "Save changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* ── Sidebar nav ─────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-white/8 py-8 px-4 gap-1 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25 px-3 mb-3">Sections</p>
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => setActiveSection(n.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all ${
                activeSection === n.id
                  ? "bg-brand-accent/10 text-brand-accent"
                  : "text-white/45 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </a>
          ))}

          <div className="mt-auto pt-6 border-t border-white/8">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/20 px-3 mb-2">Quick links</p>
            <Link to="/" className="flex items-center gap-2 px-3 py-2 text-[11px] text-white/30 hover:text-white transition-colors">
              <span>🏠</span> Home
            </Link>
            <Link to="/tracker" className="flex items-center gap-2 px-3 py-2 text-[11px] text-white/30 hover:text-white transition-colors">
              <span>📍</span> Tracker
            </Link>
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <main className="flex-1 px-6 py-8 flex flex-col gap-6 min-w-0">
          {/* Info banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-brand-accent/8 border border-brand-accent/20">
            <span className="text-brand-accent mt-0.5">ℹ</span>
            <p className="text-[12px] text-white/60 leading-relaxed">
              Changes are saved to <strong className="text-white/80">your browser's localStorage</strong> and apply instantly to the site. Click <strong className="text-white/80">Save changes</strong> to persist. Use <em>Reset defaults</em> to restore original values.
            </p>
          </div>

          {/* ── BRANDING ───────────────────────────────────── */}
          <SectionCard id="branding" title="Branding" icon="🎨">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColorField
                label="Accent colour"
                value={cfg.accentColor}
                onChange={(v) => set("accentColor", v)}
              />
              <Field label="Tagline (nav)" value={cfg.tagline} onChange={(v) => set("tagline", v)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label='Logo line 1 ("The")' value={cfg.logoLine1} onChange={(v) => set("logoLine1", v)} />
              <Field label='Logo line 2 ("Gentry")' value={cfg.logoLine2} onChange={(v) => set("logoLine2", v)} />
              <Field label='Logo line 3 ("Lab")' value={cfg.logoLine3} onChange={(v) => set("logoLine3", v)} />
            </div>
            {/* Live preview */}
            <div className="border border-white/8 rounded-lg p-4 bg-[#0a0a0b]">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-3">Logo preview</p>
              <div className="flex items-center gap-3">
                <svg width="34" height="32" viewBox="0 0 100 95" fill="none">
                  <rect x="0"  y="0"  width="17" height="95" fill={cfg.accentColor}/>
                  <rect x="0"  y="0"  width="61" height="17" fill={cfg.accentColor}/>
                  <rect x="33" y="17" width="67" height="17" fill={cfg.accentColor}/>
                  <rect x="33" y="34" width="17" height="25" fill={cfg.accentColor}/>
                  <rect x="33" y="59" width="67" height="17" fill={cfg.accentColor}/>
                  <rect x="0"  y="78" width="100" height="17" fill={cfg.accentColor}/>
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="font-extrabold text-[10px] uppercase tracking-[0.18em] text-white/50">{cfg.logoLine1}</span>
                  <span className="font-extrabold text-[15px] uppercase tracking-tighter text-white leading-tight">{cfg.logoLine2}</span>
                  <span className="font-extrabold text-[15px] uppercase tracking-tighter leading-tight" style={{ color: cfg.accentColor }}>{cfg.logoLine3}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── HERO ───────────────────────────────────────── */}
          <SectionCard id="hero" title="Hero Section" icon="🏔️">
            <Field label="Eyebrow label" value={cfg.heroEyebrow} onChange={(v) => set("heroEyebrow", v)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Headline line 1" value={cfg.heroLine1} onChange={(v) => set("heroLine1", v)} />
              <Field
                label='Headline line 2 (gradient word)'
                value={cfg.heroLine2}
                onChange={(v) => set("heroLine2", v)}
              />
              <Field label="Headline line 3" value={cfg.heroLine3} onChange={(v) => set("heroLine3", v)} textarea />
            </div>
            <Field label="Sub-text paragraph" value={cfg.heroSubtext} onChange={(v) => set("heroSubtext", v)} textarea />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary CTA label" value={cfg.heroCta1} onChange={(v) => set("heroCta1", v)} />
              <Field label="Secondary CTA label" value={cfg.heroCta2} onChange={(v) => set("heroCta2", v)} />
            </div>
          </SectionCard>

          {/* ── STATS ──────────────────────────────────────── */}
          <SectionCard id="stats" title="Stats Bar" icon="📊">
            <p className="text-[11px] text-white/35">The four animated counters shown below the hero.</p>
            {cfg.stats.map((s, i) => (
              <div key={i} className="grid grid-cols-[80px_60px_1fr_auto] gap-3 items-end">
                <Field label="Value" value={s.value} onChange={(v) => setStat(i, "value", v)} mono />
                <Field label="Suffix" value={s.suffix} onChange={(v) => setStat(i, "suffix", v)} mono />
                <Field label="Label" value={s.label} onChange={(v) => setStat(i, "label", v)} />
                <button
                  onClick={() => removeStat(i)}
                  className="mb-0.5 h-[38px] px-3 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] transition-colors"
                >✕</button>
              </div>
            ))}
            <button
              onClick={addStat}
              className="self-start px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[11px] font-mono transition-all"
            >
              + Add stat
            </button>
          </SectionCard>

          {/* ── ROADMAP ────────────────────────────────────── */}
          <SectionCard id="roadmap" title="Roadmap Cards" icon="🗺️">
            <p className="text-[11px] text-white/35">Feature cards shown in the Coming Next grid.</p>
            {cfg.roadmap.map((r, i) => (
              <div key={i} className="grid grid-cols-[56px_1fr_2fr_auto] gap-3 items-end">
                <Field label="#" value={r.n} onChange={(v) => setRoadmap(i, "n", v)} mono />
                <Field label="Title" value={r.title} onChange={(v) => setRoadmap(i, "title", v)} />
                <Field label="Description" value={r.desc} onChange={(v) => setRoadmap(i, "desc", v)} />
                <button
                  onClick={() => removeRoadmap(i)}
                  className="mb-0.5 h-[38px] px-3 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] transition-colors"
                >✕</button>
              </div>
            ))}
            <button
              onClick={addRoadmap}
              className="self-start px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[11px] font-mono transition-all"
            >
              + Add card
            </button>
          </SectionCard>

          {/* ── TICKER ─────────────────────────────────────── */}
          <SectionCard id="ticker" title="Marquee Ticker" icon="📡">
            <p className="text-[11px] text-white/35">Items that scroll across the bottom ticker strip.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {cfg.ticker.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={t}
                    onChange={(e) => setTicker(i, e.target.value)}
                    className="flex-1 bg-[#111113] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white focus:outline-none focus:border-brand-accent/50 transition-colors"
                  />
                  <button
                    onClick={() => removeTicker(i)}
                    className="h-[38px] w-9 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] transition-colors shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              onClick={addTicker}
              className="self-start px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[11px] font-mono transition-all"
            >
              + Add item
            </button>
          </SectionCard>

          {/* ── MAP ────────────────────────────────────────── */}
          <SectionCard id="map" title="Map Defaults" icon="🗾">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field
                label="Center latitude"
                value={String(cfg.mapCenter[0])}
                onChange={(v) => set("mapCenter", [parseFloat(v) || 11.55, cfg.mapCenter[1]])}
                mono
              />
              <Field
                label="Center longitude"
                value={String(cfg.mapCenter[1])}
                onChange={(v) => set("mapCenter", [cfg.mapCenter[0], parseFloat(v) || 104.9])}
                mono
              />
              <Field
                label="Default zoom (1–18)"
                value={String(cfg.mapZoom)}
                onChange={(v) => set("mapZoom", parseInt(v) || 7)}
                mono
              />
            </div>
            <p className="text-[11px] text-white/25">
              Cambodia center ≈ lat 11.55, lng 104.90. Phnom Penh ≈ 11.57, 104.92.
            </p>
          </SectionCard>

          {/* ── FOOTER ─────────────────────────────────────── */}
          <SectionCard id="footer" title="Footer Text" icon="📝">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Left text" value={cfg.footerLeft} onChange={(v) => set("footerLeft", v)} />
              <Field label="Right text" value={cfg.footerRight} onChange={(v) => set("footerRight", v)} />
            </div>
          </SectionCard>

          {/* ── Bottom save bar ────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-4 rounded-xl border border-white/8 bg-[#0e0e10] mt-2">
            <p className="text-[12px] text-white/35">
              {saved
                ? "✓ All changes saved to localStorage"
                : "Unsaved changes — click Save to apply"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white text-[11px] font-mono uppercase tracking-widest transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                className={`px-6 py-2 rounded-lg text-[11px] font-mono uppercase tracking-widest font-bold transition-all ${
                  saved
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-brand-accent text-black hover:brightness-110"
                }`}
              >
                {saved ? "✓ Saved!" : "Save changes"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
