import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { DockWorkspaceProvider, useDockWorkspace } from "@/components/tender/DockWorkspace";
import { QuickDocumentsPanel } from "@/components/tender/QuickDocumentsPanel";
import { useTender } from "@/lib/tender-data";

/* ── Shared design-system primitives for TenderAI (/tender/*) ──────────
 * Lean, Phase 1 subset — mirrors src/components/cm/shared.tsx's role for
 * the CM app. Grows as each new tender page needs a new primitive, rather
 * than speculatively building the whole set up front.
 *
 * Design direction (per the full product spec): one fixed professional
 * look — dark-navy sidebar/chrome + light-neutral main workspace, always
 * — not a user-toggled dark/light theme. `data-theme="light"` is forced
 * on the root regardless of the site's global theme toggle, which lets
 * every existing dark-styled class (bg-[#0d0d0e], text-white,
 * border-white/N — used throughout Card/DataTable/StatusBadge/etc.)
 * invert to a light-on-white reading via the [data-theme="light"]
 * override sweep in styles.css, without having to rewrite every route
 * file's classNames by hand. `.tender-dark-chrome` re-inverts specific
 * elements (the sidebar, the bottom dock toolbar) back to dark navy so
 * they stay visually anchored as permanent chrome against the light
 * content area — see the matching CSS block in styles.css. */

export const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:bg-white/[0.07] focus:border-[#2563eb]/70 focus:ring-2 focus:ring-[#2563eb]/15 transition-all";
export const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
export const btnPrimaryCls = "px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-colors";

export function PageShell({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    // Wrapped (rather than putting data-theme directly on .tenderai-scope)
    // so the existing "[data-theme=light] .tenderai-scope ..." override
    // selectors — written when data-theme lived on <html> via the global
    // toggle — still match via the descendant combinator.
    <div data-theme="light">
      <div className="tenderai-scope min-h-screen bg-[#0a0a0b] text-white font-sans">
        <TenderTopNav />
        <main className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-8 pb-24">
          <div className="flex items-center justify-between mb-6 gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">{title}</h1>
            {action}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function TenderTopNav() {
  return (
    <header className="tender-dark-chrome border-b border-white/8 bg-[#0d0d0e]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <Link to="/tender" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#2563eb] flex items-center justify-center text-[11px] font-black">T</span>
          <span className="font-extrabold tracking-tight text-[14px]">TenderAI</span>
        </Link>
        <nav className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-white/50">
          <Link to="/tender" className="hover:text-white transition-colors">Dashboard</Link>
          <Link to="/tender/list" className="hover:text-white transition-colors">Tenders</Link>
        </nav>
      </div>
    </header>
  );
}

// Submission Manager + Tender Chat join this nav once their backing AI
// endpoints exist (they need TENDER_SUPABASE_SERVICE_ROLE_KEY, not yet
// configured — see docs/mvp-roadmap.md's ship order). Every tab below is
// wired to real, currently-empty-until-processed data — no placeholder UI.
const TENDER_TABS: { key: string; label: string; to: string; icon: string }[] = [
  { key: "overview", label: "Overview", to: "/tender/$tenderId", icon: "grid" },
  { key: "documents", label: "Documents", to: "/tender/$tenderId/documents", icon: "file" },
  { key: "requirements", label: "Requirements", to: "/tender/$tenderId/requirements", icon: "list" },
  { key: "checklist", label: "Checklist", to: "/tender/$tenderId/checklist", icon: "check" },
  { key: "compliance", label: "Compliance", to: "/tender/$tenderId/compliance", icon: "shield" },
  { key: "gaps", label: "Gaps", to: "/tender/$tenderId/gaps", icon: "alert" },
  { key: "risks", label: "Risks", to: "/tender/$tenderId/risks", icon: "octagon" },
  { key: "clarifications", label: "Clarifications", to: "/tender/$tenderId/clarifications", icon: "message" },
];

/** Minimal line-icon set for the sidebar nav — one path per TENDER_TABS
 *  icon key, kept as plain <path> strokes so they inherit currentColor
 *  and stay crisp at the small sidebar size without an icon-library dep. */
function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    file: <><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12.5l2.5 2.5L16 9" /></>,
    shield: <path d="M12 2l8 3.5v6c0 5-3.5 8-8 10.5C7.5 19.5 4 16.5 4 11.5v-6L12 2Z" />,
    alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>,
    octagon: <><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8l6-6Z" /><path d="M12 8v5" /><circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" /></>,
    message: <path d="M4 4h16v12H8l-4 4V4Z" />,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {paths[name]}
    </svg>
  );
}

/** Left sidebar navigation for a tender workspace — mirrors Autodesk
 *  Insight's persistent icon+label rail (Dashboards, Risk, Design, ...)
 *  in place of the horizontal tab strip the module started with.
 *
 *  Every tab except Overview passes its own section name (e.g.
 *  "Documents") as TenderShell's page title, which meant the tender's
 *  own name only ever showed up on Overview — once you clicked into any
 *  other tab there was nothing on screen identifying which tender you
 *  were in. Showing it here, once, persistently, fixes that regardless
 *  of which tab is active. */
function TenderSidebar({ tenderId, tenderName }: { tenderId: string; tenderName?: string }) {
  return (
    <aside className="tender-dark-chrome w-56 shrink-0 border-r border-white/8 bg-[#0d0d0e] flex flex-col h-screen sticky top-0">
      <Link to="/tender" className="h-14 flex items-center gap-2 px-4 border-b border-white/8 shrink-0">
        <span className="w-6 h-6 rounded-md bg-[#2563eb] flex items-center justify-center text-[11px] font-black">T</span>
        <span className="font-extrabold tracking-tight text-[14px]">TenderAI</span>
      </Link>
      {tenderName && (
        <div className="px-4 py-3 border-b border-white/8 shrink-0">
          <p className="font-mono text-[8px] uppercase tracking-widest text-white/30 mb-0.5">Current Tender</p>
          <p className="text-[12px] font-semibold truncate" title={tenderName}>{tenderName}</p>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {TENDER_TABS.map((tab) => (
          <Link key={tab.key} to={tab.to} params={{ tenderId }}
            activeOptions={{ exact: tab.key === "overview" }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest text-white/50 transition-colors hover:text-white hover:bg-white/5"
            activeProps={{ className: "flex items-center gap-2.5 px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest whitespace-nowrap", style: { color: "#2563eb", backgroundColor: "color-mix(in srgb, #2563eb 12%, transparent)" } }}
          >
            <NavIcon name={tab.icon} />
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-white/8 shrink-0">
        <Link to="/tender/list" className="font-mono text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors">← All Tenders</Link>
      </div>
    </aside>
  );
}

export function TenderShell({ tenderId, title, subtitle, action, children }: {
  tenderId: string; title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  const { data: tender } = useTender(tenderId);
  return (
    <div data-theme="light">
      <div className="tenderai-scope min-h-screen bg-[#0a0a0b] text-white font-sans flex">
        <DockWorkspaceProvider>
          <TenderSidebar tenderId={tenderId} tenderName={tender?.name} />
          <div className="flex-1 min-w-0 flex flex-col pb-14">
            <div className="border-b border-white/8 bg-[#0d0d0e] sticky top-0 z-10">
              <div className="px-6 h-16 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-extrabold tracking-tight truncate">{title}</h1>
                  {subtitle && <div className="text-[12px] text-white/40 mt-0.5">{subtitle}</div>}
                </div>
                {action}
              </div>
            </div>
            <main className="flex-1 w-full px-6 py-6">
              {children}
            </main>
          </div>
          <DockToolbar tenderId={tenderId} tenderName={tender?.name} />
        </DockWorkspaceProvider>
      </div>
    </div>
  );
}

/** Bottom-docked launcher bar for floating panels — visible on every
 *  tender tab, mirroring the always-available toolbar pattern from
 *  Autodesk's viewer, applied to document-oriented panels instead of
 *  3D navigation tools. Offset by the sidebar width so it doesn't
 *  overlap the nav rail. */
function DockToolbar({ tenderId, tenderName }: { tenderId: string; tenderName?: string }) {
  const { openPanel } = useDockWorkspace();
  return (
    <div className="tender-dark-chrome fixed bottom-0 left-56 right-0 z-50 border-t border-white/8 bg-[#0d0d0e]/95 backdrop-blur">
      <div className="px-6 h-11 flex items-center gap-1">
        <button
          onClick={() => openPanel("documents", `Documents — ${tenderName ?? "…"}`, <QuickDocumentsPanel tenderId={tenderId} />)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: "#2563eb" }}>
            <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Documents
        </button>
      </div>
    </div>
  );
}

/** Grouped panel of icon+number tiles — mirrors Autodesk Insight's
 *  "Design Review Risk Factors" / "Quality Risk Factors" style panels:
 *  a labeled card containing a row of compact stat tiles. */
export function KpiPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} action={action}>
      <div className="flex flex-wrap gap-3">{children}</div>
    </Card>
  );
}

export function KpiTile({ icon, value, label, color = "#2563eb" }: {
  icon: ReactNode; value: ReactNode; label: string; color?: string;
}) {
  return (
    <div className="flex-1 min-w-[110px] rounded-xl border border-white/8 p-3 flex flex-col gap-2">
      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}18`, color }}>
        {icon}
      </div>
      <p className="text-xl font-extrabold font-mono leading-none">{value}</p>
      <p className="font-mono text-[8px] uppercase tracking-widest text-white/35 leading-tight">{label}</p>
    </div>
  );
}

/** Column-based dense table — the one list pattern every tender data page
 *  (Requirements, Checklist, Gaps, Clarifications, Compliance, Risks) should
 *  share once real data volume shows up, instead of each page inventing its
 *  own flex-row or ad-hoc <table>. Matches Risks/Compliance's existing table
 *  styling (font-mono uppercase headers, divide-y rows) so adopting it
 *  elsewhere doesn't introduce a second visual language. */
export interface DataTableColumn<T> {
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, keyFn, onRowClick, expandedKey, renderExpanded }: {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  expandedKey?: string | null;
  renderExpanded?: (row: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto -mx-5 -mt-1">
      <table className="w-full text-[12px] border-collapse table-fixed">
        <thead>
          <tr className="text-left border-b border-white/8">
            {columns.map((c, i) => (
              <th key={i} className="font-mono text-[9px] font-medium uppercase tracking-widest text-white/35 pb-2 pl-5 pr-3 first:pl-5" style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {rows.map((row) => {
            const key = keyFn(row);
            return (
              <Fragment key={key}>
                <tr
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer hover:bg-white/[0.02] transition-colors" : undefined}
                >
                  {columns.map((c, i) => (
                    <td key={i} className="py-2.5 pl-5 pr-3 first:pl-5 align-top">{c.render(row)}</td>
                  ))}
                </tr>
                {expandedKey === key && renderExpanded && (
                  <tr>
                    <td colSpan={columns.length} className="pb-3 pl-5 pr-3 bg-white/[0.015]">{renderExpanded(row)}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#0d0d0e] border border-white/7 p-5">
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 font-bold">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  // tender status
  draft: "#71717a", processing: "#eab308", analysis: "#2563eb", submission: "#f97316", submitted: "#22c55e", archived: "#52525b",
  // document status
  uploaded: "#71717a", failed: "#ef4444",
  // requirement / checklist status
  open: "#71717a", in_progress: "#eab308", missing_info: "#ef4444", missing_information: "#ef4444",
  ready: "#22c55e", approved: "#22c55e", not_started: "#71717a", ai_drafted: "#2563eb", in_review: "#eab308",
  // severity
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
  // compliance
  comply: "#22c55e", partially_comply: "#eab308", deviation: "#f97316", not_applicable: "#71717a",
  need_clarification: "#2563eb", missing: "#ef4444",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const color = STATUS_COLOR[value] ?? "#71717a";
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}18` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color }}>{label ?? value.replace(/_/g, " ")}</span>
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-white/10 rounded-2xl py-14 px-6 text-center">
      <p className="text-[13px] text-white/50 mb-1">{title}</p>
      {hint && <p className="text-[11px] text-white/25 mb-4">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-red-500/20 bg-red-500/5 rounded-2xl py-6 px-5 text-center">
      <p className="text-[12px] text-red-400">{message}</p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Sentence-friendly label from a snake_case constant. */
export function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
