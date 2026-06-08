import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { Footer } from "@/components/site/Footer";
import { PROJECTS, SECTORS, type Sector, type TrackedProject } from "@/data/platform";
import { useProjects } from "@/lib/data";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [
      { title: "Industrial Project Tracker — The Gentry Lab" },
      { name: "description", content: "Live tracker of factory, warehouse and data-center projects across Cambodia. Filter by sector, province and status." },
      { property: "og:title", content: "Cambodia Industrial Project Tracker" },
      { property: "og:description", content: "Track manufacturing investments across Cambodia." },
    ],
  }),
  component: TrackerPage,
});

const STATUSES = ["Planned", "Under Construction", "Operational"] as const;

/* Convert "Mon YYYY" → "YYYY-MM" for sortable comparison */
const MONTH_IDX: Record<string, string> = {
  Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
  Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
};
function cdcSortKey(d: string | undefined, fallback: string): string {
  if (!d) return fallback;
  const [mon, yr] = d.split(" ");
  if (yr && MONTH_IDX[mon]) return `${yr}-${MONTH_IDX[mon]}`;
  return fallback;
}

/* ── Photo + visual config per sector ───────────────────── */
const SECTOR_VISUAL: Record<string, { photo: string; gradient: string; accent: string }> = {
  Garment:         { photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%)", accent: "#a78bfa" },
  Electronics:     { photo: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#0c1a2e 0%,#1e3a8a 100%)", accent: "#38bdf8" },
  "Food Processing":{ photo: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#052e16 0%,#166534 100%)", accent: "#34d399" },
  Warehousing:     { photo: "https://images.unsplash.com/photo-1485083269755-a7b559a4fe5e?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#1c1917 0%,#44403c 100%)", accent: "#d6d3d1" },
  "Data Center":   { photo: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#0c0a1a 0%,#1e3a8a 100%)", accent: "#818cf8" },
  Automotive:      { photo: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#0a0a0b 0%,#7f1d1d 100%)", accent: "#f87171" },
  Energy:          { photo: "https://images.unsplash.com/photo-1466611653911-0265b219a3df?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#1a1200 0%,#713f12 100%)", accent: "#fbbf24" },
};
const DEFAULT_VISUAL = { photo: "https://images.unsplash.com/photo-1581922815928-45c4b2e35e34?w=800&q=80&fit=crop", gradient: "linear-gradient(135deg,#0a0a0b 0%,#7c2d12 100%)", accent: "#ff5100" };

const STATUS_ORDER = ["Planned", "Under Construction", "Operational"] as const;
const STATUS_COLOR: Record<string, string> = {
  Planned: "#fbbf24",
  "Under Construction": "#ff5100",
  Operational: "#34d399",
};

/* ── "New this week" helper ─────────────────────────────── */
function isNewThisWeek(updated: string): boolean {
  try {
    const diff = Date.now() - new Date(updated).getTime();
    return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

/* ── Origin country flags ───────────────────────────────── */
const ORIGIN_FLAG: Record<string, string> = {
  China: "🇨🇳", Japan: "🇯🇵", Korea: "🇰🇷", USA: "🇺🇸", Germany: "🇩🇪",
  Thailand: "🇹🇭", Malaysia: "🇲🇾", Singapore: "🇸🇬", Denmark: "🇩🇰",
  Cambodia: "🇰🇭", "Cambodia/Singapore": "🇰🇭🇸🇬",
};

/* ── Detail panel ───────────────────────────────────────── */
function ProjectDetail({ project, onClose }: { project: TrackedProject; onClose: () => void }) {
  const vis = SECTOR_VISUAL[project.sector] ?? DEFAULT_VISUAL;
  const statusIdx = STATUS_ORDER.indexOf(project.status as typeof STATUS_ORDER[number]);
  const sc = STATUS_COLOR[project.status] ?? "#94a3b8";
  const flag = ORIGIN_FLAG[project.origin] ?? "🌐";

  return (
    <div className="border border-white/10 overflow-hidden bg-[#0d0d0e] flex flex-col">

      {/* ── Cover photo ── */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ height: 200 }}>
        <div className="absolute inset-0" style={{ background: vis.gradient }} />
        {/* Sector fallback photo */}
        <img
          src={vis.photo} alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.3, mixBlendMode: "luminosity" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        {/* Real project OG image (from agent) — plain overlay, no blend mode */}
        {project.image_url && (
          <img
            src={project.image_url} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.35 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(${vis.accent}08 1px,transparent 1px),linear-gradient(90deg,${vis.accent}08 1px,transparent 1px)`,
          backgroundSize: "28px 28px",
        }} />
        {/* Glow */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 70% at 80% 20%,${vis.accent}30 0%,transparent 65%)` }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-[#0d0d0e] to-transparent" />

        {/* Sector badge */}
        <div className="absolute top-4 left-4">
          <span className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest font-bold"
            style={{ backgroundColor: vis.accent, color: "#000" }}>
            {project.sector}
          </span>
        </div>

        {/* Status badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 border border-white/10 px-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: sc, boxShadow: project.status === "Under Construction" ? `0 0 6px ${sc}` : "none" }} />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{project.status}</span>
        </div>

        {/* Flag + investor bottom-left */}
        <div className="absolute bottom-4 left-4 right-10">
          <p className="font-extrabold text-base uppercase tracking-tight text-white leading-tight line-clamp-2">
            {project.name}
          </p>
          <p className="font-mono text-[10px] text-white/45 mt-1">{flag} {project.investor} · {project.origin}</p>
        </div>

        {/* Close */}
        <button onClick={onClose}
          className="absolute bottom-4 right-4 w-7 h-7 flex items-center justify-center bg-black/60 border border-white/15 text-white/50 hover:text-white transition text-lg leading-none">
          ×
        </button>
      </div>

      {/* ── Status pipeline ── */}
      <div className="px-5 py-4 border-b border-white/8">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-3">Project Pipeline</p>
        <div className="flex items-center gap-0">
          {STATUS_ORDER.map((s, i) => {
            const done  = i <= statusIdx;
            const color = done ? STATUS_COLOR[s] : "rgba(255,255,255,0.12)";
            const isLast = i === STATUS_ORDER.length - 1;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all"
                    style={{ borderColor: color, backgroundColor: done ? `${color}25` : "transparent" }}>
                    {done && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                  </div>
                  <p className="font-mono text-[8px] uppercase tracking-wider mt-1.5 text-center leading-tight"
                    style={{ color: done ? color : "rgba(255,255,255,0.2)" }}>
                    {s.replace(" ", "\n")}
                  </p>
                </div>
                {!isLast && (
                  <div className="h-px flex-1 mb-5 -mx-2" style={{ backgroundColor: i < statusIdx ? STATUS_COLOR[STATUS_ORDER[i + 1]] : "rgba(255,255,255,0.1)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-px bg-white/8 border-b border-white/8">
        {[
          { label: "Province",   value: project.province },
          { label: "Scale",      value: project.size },
          { label: "Last update",value: project.updated },
          { label: "Origin",     value: `${flag} ${project.origin}` },
        ].map((row) => (
          <div key={row.label} className="bg-[#0d0d0e] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">{row.label}</p>
            <p className="text-[12px] font-bold text-white/85 leading-snug">{row.value}</p>
          </div>
        ))}
        {/* Google Maps location row */}
        {project.lat && (
          <a
            href={project.maps_url ?? `https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 bg-[#0d0d0e] px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition group"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className="text-white/25 group-hover:text-[#ff5100] transition shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Location</p>
              <p className="text-[12px] font-bold text-white/85 group-hover:text-white transition truncate">
                {project.province} · View on Google Maps ↗
              </p>
            </div>
          </a>
        )}
      </div>

      {/* ── Summary ── */}
      <div className="px-5 py-4 flex-1 border-b border-white/8">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">Summary</p>
        <p className="text-[12px] text-white/65 leading-relaxed">{project.summary}</p>
      </div>

      {/* ── Latest news coverage ── */}
      {project.latest_news_headline && (
        <div className="border-b border-white/8">
          <div className="px-5 pt-4 pb-1 flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">Latest Coverage</p>
            {project.latest_news_date && (
              <span className="font-mono text-[9px] text-white/25">{project.latest_news_date}</span>
            )}
          </div>
          {/* News image strip */}
          {project.image_url && (
            <div className="mx-5 mb-3 relative overflow-hidden" style={{ height: 80 }}>
              <img
                src={project.image_url}
                alt=""
                className="w-full h-full object-cover"
                style={{ opacity: 0.75 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            </div>
          )}
          <div className="px-5 pb-4">
            {project.latest_news_url ? (
              <a
                href={project.latest_news_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-white/75 hover:text-white transition leading-snug block"
              >
                {project.latest_news_headline} ↗
              </a>
            ) : (
              <p className="text-[12px] text-white/65 leading-snug">{project.latest_news_headline}</p>
            )}
            {project.latest_news_url && (
              <p className="font-mono text-[9px] text-white/25 mt-1">
                {(() => { try { return new URL(project.latest_news_url).hostname; } catch { return ""; } })()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Source link ── */}
      {project.source_url && (
        <div className="px-5 py-3 border-b border-white/8">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">Announcement Source</p>
          <a
            href={project.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-white/40 hover:text-white/70 transition"
          >
            {(() => { try { return new URL(project.source_url).hostname; } catch { return project.source_url; } })()} ↗
          </a>
        </div>
      )}

      {/* ── Advisory CTA ── */}
      <div className="px-5 py-4 bg-[#0e0e10]">
        <a
          href={`mailto:advisory@thegentrylab.io?subject=Project%20intel%20-%20${encodeURIComponent(project.name)}`}
          className="flex items-center justify-between group"
        >
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "#ff5100" }}>GentryLab Advisory</p>
            <p className="text-[11px] text-white/45 group-hover:text-white/70 transition">Request deeper intelligence on this project →</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-white/20 group-hover:text-[#ff5100] transition">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/20 mt-3">Illustrative · Confirm with primary sources</p>
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────── */
function EmptyPanel() {
  return (
    <div className="border border-white/8 bg-[#0d0d0e] flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className="w-14 h-14 border border-white/10 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="18" height="15" rx="1"/>
          <path d="M2 8h18M7 2v6M15 2v6"/>
          <line x1="6" y1="13" x2="10" y2="13"/>
          <line x1="6" y1="16" x2="14" y2="16"/>
        </svg>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/20 mb-1">Project intel</p>
        <p className="text-sm text-white/30">Select any project from the list to view its full profile, pipeline status, and advisory link.</p>
      </div>
      <div className="flex flex-col gap-2 w-full mt-2">
        {["Sector · Province · Scale", "Pipeline status timeline", "Investor + origin"].map((l) => (
          <div key={l} className="flex items-center gap-2.5 text-[11px] text-white/20 font-mono">
            <span className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mobile bottom sheet ────────────────────────────────── */
function MobileBottomSheet({ project, onClose }: { project: TrackedProject | null; onClose: () => void }) {
  const isOpen = !!project;
  const savedScrollY = useRef(0);

  /*
   * iOS-safe body scroll lock — MOBILE ONLY.
   * The sheet is lg:hidden so on desktop this effect must be a no-op,
   * otherwise selecting a project locks the body and breaks desktop scroll.
   *
   * Technique: position:fixed + saved scrollY (prevents iOS rubber-band).
   * Simple overflow:hidden does NOT stop Safari overscroll.
   */
  useEffect(() => {
    // Never lock the body on desktop — the sheet is hidden there anyway
    if (window.innerWidth >= 1024) return;

    const unlock = () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
    };

    if (isOpen) {
      savedScrollY.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      unlock();
      window.scrollTo(0, savedScrollY.current);
    }
    return unlock;
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40 transition-all duration-300"
        style={{
          backgroundColor: isOpen ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0)",
          pointerEvents: isOpen ? "auto" : "none",
          backdropFilter: isOpen ? "blur(2px)" : "none",
        }}
        onClick={onClose}
      />

      {/* Sheet
          - position:fixed so it sits above the locked body
          - overflowY:auto + WebkitOverflowScrolling for momentum scroll inside
          - overscrollBehavior:contain stops inner scroll from propagating to body
      */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-[400ms]"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          maxHeight: "88svh",
          overflowY: isOpen ? "auto" : "hidden",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          transitionTimingFunction: isOpen ? "cubic-bezier(0.32,0.72,0,1)" : "ease-in",
        }}
      >
        {/* Drag handle — sticky so it stays visible while scrolling content */}
        <div className="bg-[#0d0d0e] border-t border-white/10 flex justify-center pt-3 pb-1 sticky top-0 z-10">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {project && <ProjectDetail project={project} onClose={onClose} />}
      </div>
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
function TrackerPage() {
  const { data: projects = PROJECTS } = useProjects();
  const provinces = useMemo(() => Array.from(new Set(projects.map((p) => p.province))).sort(), [projects]);
  const [sector,   setSector]   = useState<Sector | "All">("All");
  const [province, setProvince] = useState("All");
  const [status,   setStatus]   = useState("All");
  const [selected, setSelected] = useState<TrackedProject | null>(null);

  const filtered = useMemo(() =>
    projects.filter((p) =>
      (sector   === "All" || p.sector   === sector)  &&
      (province === "All" || p.province === province) &&
      (status   === "All" || p.status   === status),
    ).sort((a, b) =>
      cdcSortKey(b.cdc_approval_date, b.updated).localeCompare(
        cdcSortKey(a.cdc_approval_date, a.updated)
      )
    ),
    [projects, sector, province, status],
  );

  /* Status summary counts */
  const counts = useMemo(() => ({
    Operational:          projects.filter((p) => p.status === "Operational").length,
    "Under Construction": projects.filter((p) => p.status === "Under Construction").length,
    Planned:              projects.filter((p) => p.status === "Planned").length,
  }), [projects]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans flex flex-col">
      <TopNav />

      {/* ── Header ── */}
      <div className="border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
          <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: "#ff5100" }}>
            Industrial Project Tracker
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold uppercase tracking-tighter leading-[0.9]">
                What's being built<br />in Cambodia
              </h1>
              <p className="text-white/50 max-w-xl mt-3 text-sm leading-relaxed">
                Curated registry of active and planned industrial projects — updated from CDC approvals, ground intelligence, and developer announcements.
              </p>
            </div>
            {/* Status summary chips */}
            <div className="flex gap-3 shrink-0">
              {(["Operational", "Under Construction", "Planned"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(status === s ? "All" : s)}
                  className="flex flex-col items-center border px-3 py-2.5 md:px-4 md:py-3 transition-all hover:border-white/25"
                  style={{
                    borderColor: status === s ? STATUS_COLOR[s] : "rgba(255,255,255,0.1)",
                    backgroundColor: status === s ? `${STATUS_COLOR[s]}10` : "transparent",
                  }}
                >
                  <span className="text-xl md:text-2xl font-extrabold tabular-nums" style={{ color: STATUS_COLOR[s] }}>{counts[s]}</span>
                  <span className="font-mono text-[7px] md:text-[8px] uppercase tracking-widest text-white/35 mt-1 whitespace-nowrap">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-12 py-6 md:py-8 w-full">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 md:gap-3 mb-5 md:mb-6 font-mono text-[11px] uppercase tracking-widest">
          <Select label="Sector"   value={sector}   onChange={(v) => setSector(v as Sector | "All")} options={["All", ...SECTORS]} />
          <Select label="Province" value={province} onChange={setProvince} options={["All", ...provinces]} />
          <Select label="Status"   value={status}   onChange={setStatus}   options={["All", ...STATUSES]} />
          <div className="ml-auto self-center font-mono text-[10px] text-white/30">
            {filtered.length} project{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Mobile tap hint */}
        <p className="lg:hidden font-mono text-[9px] uppercase tracking-widest text-white/25 mb-3 text-center">
          Tap a project to view full details ↓
        </p>

        {/* Two-col layout: list always full-width on mobile; side panel only lg+ */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* Project list
              Desktop: constrained height + independent scroll so both columns
              are visible simultaneously without scrolling the page.
              Mobile: unconstrained — page scrolls naturally, sheet handles detail. */}
          <div className="border border-white/8 divide-y divide-white/8 bg-[#0d0d0e] lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto">
            {filtered.map((p) => {
              const vis = SECTOR_VISUAL[p.sector] ?? DEFAULT_VISUAL;
              const sc  = STATUS_COLOR[p.status] ?? "#94a3b8";
              const isSelected = selected?.id === p.id;
              const isNew = isNewThisWeek(p.updated);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(isSelected ? null : p)}
                  className="w-full flex items-stretch text-left transition-colors duration-150 group cursor-pointer hover:bg-white/[0.03]"
                  style={{
                    /* Only apply accent bg when selected — lets hover:bg work when unselected */
                    ...(isSelected ? { backgroundColor: `${vis.accent}0d` } : {}),
                    touchAction: "pan-y",
                  }}
                >
                  {/* Sector thread — always visible at low opacity, brightens on hover, full gradient when selected */}
                  <div
                    className={`w-1 shrink-0 transition-all duration-200 ${
                      isSelected
                        ? "opacity-100"
                        : "opacity-[0.18] group-hover:opacity-75"
                    }`}
                    style={{ background: isSelected ? vis.gradient : vis.accent }}
                  />

                  {/* Row content */}
                  <div className="flex-1 px-3 py-3 md:px-4 md:py-4">
                    {/* Row 1: name + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <p
                          className="font-bold text-[13px] transition-colors duration-150 leading-snug group-hover:text-white"
                          style={{ color: isSelected ? "#fff" : "rgba(255,255,255,0.72)" }}
                        >
                          {p.name}
                        </p>
                        {isNew && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest font-bold rounded-sm"
                            style={{ backgroundColor: "#34d39922", color: "#34d399", border: "1px solid #34d39944" }}>
                            <span className="w-1 h-1 rounded-full bg-[#34d399] animate-pulse" />
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full transition-transform duration-150 group-hover:scale-125" style={{ backgroundColor: sc }} />
                        {/* md+: sector badge */}
                        <span
                          className="hidden md:inline-block px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest transition-colors duration-150"
                          style={{
                            backgroundColor: isSelected ? `${vis.accent}28` : `${vis.accent}14`,
                            color: vis.accent,
                          }}
                        >
                          {p.sector}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: CDC subtitle */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {/* Mobile: sector badge */}
                      <span
                        className="md:hidden text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5"
                        style={{ backgroundColor: `${vis.accent}14`, color: vis.accent }}
                      >
                        {p.sector}
                      </span>
                      {p.cdc_approval_date && (
                        <span className="font-mono text-[10px] font-bold" style={{ color: "#ff5100" }}>
                          {p.cdc_approval_date}
                        </span>
                      )}
                      {p.cdc_approval_date && <span className="w-0.5 h-0.5 rounded-full bg-white/20" />}
                      <span className="font-mono text-[10px] text-white/40">{p.province}</span>
                      {p.investment_usd && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                          <span className="font-mono text-[10px] text-white/55">{p.investment_usd}</span>
                        </>
                      )}
                      {p.planned_finish && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                          <span className="font-mono text-[10px] text-white/35">→ {p.planned_finish}</span>
                        </>
                      )}
                      <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                      <span className="font-mono text-[10px]">{ORIGIN_FLAG[p.origin] ?? "🌐"}</span>
                    </div>
                  </div>

                  {/* Desktop arrow — invisible until hover, accent-coloured when selected */}
                  <div className="hidden lg:flex w-6 items-center justify-center shrink-0">
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none"
                      className="transition-all duration-150"
                      style={{
                        opacity: isSelected ? 1 : 0,
                        color: vis.accent,
                        transform: isSelected ? "translateX(1px)" : "translateX(-2px)",
                      }}
                    >
                      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>

                  {/* Mobile chevron — brightens on hover */}
                  <div className="lg:hidden flex w-8 items-center justify-center shrink-0">
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none"
                      className="transition-all duration-150 opacity-20 group-hover:opacity-60"
                      style={{ color: "rgba(255,255,255,1)" }}
                    >
                      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="px-6 py-14 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/25">No projects match current filters</p>
              </div>
            )}
          </div>

          {/* Detail panel — desktop only (lg+) */}
          <div
            className="hidden lg:block sticky top-[4.5rem] overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 5rem)" }}
          >
            {selected
              ? <ProjectDetail project={selected} onClose={() => setSelected(null)} />
              : <EmptyPanel />
            }
          </div>
        </div>
      </main>

      {/* Mobile bottom sheet */}
      <MobileBottomSheet project={selected} onClose={() => setSelected(null)} />

      <Footer />
    </div>
  );
}

/* ── Shared ──────────────────────────────────────────────── */
function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[];
}) {
  return (
    <label className="flex items-center gap-2 border border-white/10 px-3 py-2 hover:bg-white/5 transition cursor-pointer">
      <span className="text-white/35 font-mono text-[10px] uppercase tracking-widest">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-white font-mono text-[10px] uppercase tracking-widest">
        {options.map((o) => <option key={o} value={o} className="bg-[#0a0a0b] text-white">{o}</option>)}
      </select>
    </label>
  );
}
