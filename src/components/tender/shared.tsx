import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, type ReactNode } from "react";
import { DockWorkspaceProvider, useDockWorkspace } from "@/components/tender/DockWorkspace";
import { QuickDocumentsPanel } from "@/components/tender/QuickDocumentsPanel";
import { useTender } from "@/lib/tender-data";

/* ── TenderAI design system (/tender/*) ────────────────────────────────
 *
 * Design direction: Autodesk Construction Cloud's Docs module — white and
 * light-gray surfaces, thin 1px borders (never card shadows), one restrained
 * accent, dense tables. `data-theme="light"` is forced on the root regardless
 * of the site's global theme toggle: this should always render light, it is
 * not a user-facing dark/light choice.
 *
 * Four rules hold the module together. Every page imports its primitives from
 * here rather than hand-rolling a button/select/modal, which is how the
 * module previously drifted into three button radii and six differently
 * styled <select>s.
 *
 * 1. TYPE SCALE — four steps, nothing in between:
 *      11px  meta / captions / table footers
 *      12px  labels, secondary text, small controls
 *      13px  body and table cells (the workhorse)
 *      15 / 17 / 20px  headings
 *    There is deliberately no 9px or 10px. Both were in use for real content
 *    (categories, deadlines, source citations) and sit below comfortable
 *    reading size at any color.
 *
 * 2. TEXT COLOR — contrast-checked against white, never decorative:
 *      gray-900  primary           (17.7:1)
 *      gray-700  table cells       (10.3:1)
 *      gray-600  secondary         ( 7.6:1)
 *      gray-500  meta — the floor  ( 4.8:1, AA)
 *    gray-400 is 2.8:1 and fails AA, so it is reserved for genuinely
 *    decorative marks (separators, disabled glyphs) and never used for text
 *    the reader has to parse.
 *
 * 3. RADIUS — rounded-md (6px) for controls, rounded-lg (8px) for surfaces.
 *    No rounded-xl/2xl; ACC's chrome is squarer than that.
 *
 * 4. ACCENT — two shades of one blue, split by whether text is involved.
 *    See ACCENT / ACCENT_TEXT below.
 */

/** Autodesk's brand blue (brand.autodesk.com/visual-system/color). Used for
 *  NON-TEXT fills only — the logo chip, active-nav tints, progress bars,
 *  folder icons, focus rings, drag-over borders. Against white it measures
 *  3.31:1, which clears WCAG's 3:1 bar for non-text UI but falls short of
 *  the 4.5:1 that text needs. */
export const ACCENT = "#0696D7";

/** The same hue darkened until it passes AA — 5.8:1 on white, and 5.8:1 for
 *  white text sitting on top of it. Used wherever the accent carries text:
 *  link text, small accent labels, the primary button's fill. Keeping these
 *  as two tokens is what lets the module look like #0696D7 while staying
 *  readable; white on raw #0696D7 at 12-13px is only 3.31:1. */
export const ACCENT_TEXT = "#046C9B";

export const inputCls = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#0696D7] focus:ring-2 focus:ring-[#0696D7]/20 transition-all";
export const labelCls = "text-[12px] font-medium text-gray-600";
export const selectCls = "bg-white border border-gray-300 rounded-md px-2.5 py-2 text-[12px] text-gray-800 focus:outline-none focus:border-[#0696D7] focus:ring-2 focus:ring-[#0696D7]/20 transition-all";

/* ── Buttons ────────────────────────────────────────────────────────────
 * One base plus four variants, so no page writes `style={{backgroundColor:
 * "#0696D7"}}` inline again — there were 14 such copies before this.
 * `buttonCls` exists for the cases that must render as a router <Link>
 * rather than a <button>. */

const BTN_BASE = "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0696D7]/40";

const BTN_SIZE = {
  sm: "px-2.5 py-1.5 text-[12px]",
  md: "px-3.5 py-2 text-[13px]",
} as const;

const BTN_VARIANT = {
  // Fill is ACCENT_TEXT, not ACCENT — white label text needs 4.5:1 and raw
  // #0696D7 only gives 3.31:1. Hover goes one step darker again.
  primary: "bg-[#046C9B] text-white border border-transparent hover:bg-[#03567B]",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900",
  ghost: "bg-transparent text-gray-600 border border-transparent hover:bg-gray-100 hover:text-gray-900",
  danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
} as const;

export type ButtonVariant = keyof typeof BTN_VARIANT;
export type ButtonSize = keyof typeof BTN_SIZE;

export function buttonCls(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  return `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]}`;
}

export function Button({ variant = "secondary", size = "md", className, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button {...rest} className={`${buttonCls(variant, size)}${className ? ` ${className}` : ""}`} />;
}

/** Accent-colored inline text link — ACCENT_TEXT so it passes AA. */
export const linkCls = "text-[12px] font-medium text-[#046C9B] hover:text-[#03567B] hover:underline transition-colors";

/* ── Dates ──────────────────────────────────────────────────────────────
 * The module previously called `toLocaleDateString()` with no arguments in
 * six places, so the same deadline rendered "9/19/2026" or "19/09/2026"
 * depending on the viewer's locale — ambiguous for the one date that decides
 * whether a bid is late. Pinned to an unambiguous day-month-year form. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Whole days from today to `iso` — negative once past. Compared at midnight
 *  boundaries so "due tomorrow" doesn't flip to "due today" purely because of
 *  the time of day. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(target); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export interface DeadlineUrgency {
  days: number;
  level: "overdue" | "critical" | "soon" | "upcoming" | "distant";
  color: string;
  phrase: string;
}

/** Urgency banding for a submission deadline. All four colors are AA on
 *  white, so the phrase can render as plain text in that color. */
export function deadlineUrgency(iso: string | null | undefined): DeadlineUrgency | null {
  const days = daysUntil(iso);
  if (days === null) return null;
  if (days < 0) return { days, level: "overdue", color: "#b91c1c", phrase: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` };
  if (days === 0) return { days, level: "critical", color: "#b91c1c", phrase: "Closes today" };
  if (days <= 3) return { days, level: "critical", color: "#b91c1c", phrase: `Closes in ${days} day${days === 1 ? "" : "s"}` };
  if (days <= 7) return { days, level: "soon", color: "#c2410c", phrase: `Closes in ${days} days` };
  if (days <= 14) return { days, level: "upcoming", color: "#a16207", phrase: `Closes in ${days} days` };
  return { days, level: "distant", color: "#4b5563", phrase: `Closes in ${days} days` };
}

/** Deadline as a table cell: the date, plus an urgency line underneath once
 *  it is inside two weeks. Silent on anything further out, so color only ever
 *  appears when it means something. */
export function DeadlineCell({ iso }: { iso: string | null | undefined }) {
  const urgency = deadlineUrgency(iso);
  if (!iso || !urgency) return <span className="text-gray-500">—</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-gray-700 tabular-nums">{formatDate(iso)}</span>
      {urgency.level !== "distant" && (
        <span className="text-[11px] font-medium mt-0.5" style={{ color: urgency.color }}>{urgency.phrase}</span>
      )}
    </span>
  );
}

/* ── Shell ──────────────────────────────────────────────────────────────*/

export function PageShell({ title, subtitle, action, children }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    // Wrapped (rather than putting data-theme directly on .tenderai-scope)
    // so the existing "[data-theme=light] .tenderai-scope ..." override
    // selectors — written when data-theme lived on <html> via the global
    // toggle — still match via the descendant combinator.
    <div data-theme="light">
      <div className="tenderai-scope min-h-screen bg-white text-gray-900 font-sans">
        <TenderTopNav />
        {/* Sticky title row, matching TenderShell's. Previously only the
            workspace pages had one, so the portfolio's header and its
            primary action scrolled away on a long list. */}
        <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-6xl mx-auto w-full px-4 md:px-8 h-16 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate">{title}</h1>
              {subtitle && <div className="text-[12px] text-gray-600 mt-0.5">{subtitle}</div>}
            </div>
            {action}
          </div>
        </div>
        <main className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-6 pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}

export function TenderTopNav() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <Link to="/tender" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: ACCENT }}>T</span>
          <span className="font-semibold tracking-tight text-[14px] text-gray-900">TenderAI</span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px] font-medium text-gray-600">
          <Link to="/tender" className="hover:text-gray-900 transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-[13px] font-semibold text-gray-900" }}>Dashboard</Link>
          <Link to="/tender/list" className="hover:text-gray-900 transition-colors" activeProps={{ className: "text-[13px] font-semibold text-gray-900" }}>Tenders</Link>
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

/** Left sidebar navigation for a tender workspace — white background with a
 *  light-blue tinted active state, matching Autodesk Construction Cloud's
 *  Docs sidebar (Files/Reviews/Transmittals/... rail).
 *
 *  Every tab except Overview passes its own section name (e.g. "Documents")
 *  as TenderShell's page title, which meant the tender's own name only ever
 *  showed up on Overview — once you clicked into any other tab there was
 *  nothing on screen identifying which tender you were in. Showing it here,
 *  once, persistently, fixes that regardless of which tab is active. */
function TenderSidebar({ tenderId, tenderName, deadline }: { tenderId: string; tenderName?: string; deadline?: string | null }) {
  const urgency = deadlineUrgency(deadline);
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen sticky top-0">
      <Link to="/tender" className="h-14 flex items-center gap-2 px-4 border-b border-gray-200 shrink-0">
        <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: ACCENT }}>T</span>
        <span className="font-semibold tracking-tight text-[14px] text-gray-900">TenderAI</span>
      </Link>
      {tenderName && (
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">Current tender</p>
          <p className="text-[13px] font-medium text-gray-900 truncate" title={tenderName}>{tenderName}</p>
          {/* The deadline is the one fact that changes what you should do
              next, so it rides along with the tender name on every tab
              rather than living only on Overview. */}
          {urgency && (
            <p className="text-[11px] font-medium mt-1" style={{ color: urgency.color }}>{urgency.phrase}</p>
          )}
        </div>
      )}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {TENDER_TABS.map((tab) => (
          <Link key={tab.key} to={tab.to} params={{ tenderId }}
            activeOptions={{ exact: tab.key === "overview" }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900 hover:bg-gray-50"
            activeProps={{ className: "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-semibold whitespace-nowrap", style: { color: ACCENT_TEXT, backgroundColor: `color-mix(in srgb, ${ACCENT} 10%, white)` } }}
          >
            <NavIcon name={tab.icon} />
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-200 shrink-0">
        <Link to="/tender/list" className="text-[12px] font-medium text-gray-600 hover:text-gray-900 transition-colors">← All tenders</Link>
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
      <div className="tenderai-scope min-h-screen bg-white text-gray-900 font-sans flex">
        <DockWorkspaceProvider>
          <TenderSidebar tenderId={tenderId} tenderName={tender?.name} deadline={tender?.submission_deadline} />
          <div className="flex-1 min-w-0 flex flex-col pb-14">
            <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
              <div className="px-6 h-16 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate text-gray-900">{title}</h1>
                  {subtitle && <div className="text-[12px] text-gray-600 mt-0.5">{subtitle}</div>}
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

/** Bottom-docked launcher bar for floating panels — visible on every tender
 *  tab, mirroring the always-available toolbar pattern from Autodesk's
 *  viewer, applied to document-oriented panels instead of 3D navigation
 *  tools. Offset by the sidebar width so it doesn't overlap the nav rail. */
function DockToolbar({ tenderId, tenderName }: { tenderId: string; tenderName?: string }) {
  const { openPanel } = useDockWorkspace();
  return (
    <div className="fixed bottom-0 left-56 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="px-6 h-11 flex items-center gap-1">
        <button
          onClick={() => openPanel("documents", `Documents — ${tenderName ?? "…"}`, <QuickDocumentsPanel tenderId={tenderId} />)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: ACCENT }}>
            <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Documents
        </button>
      </div>
    </div>
  );
}

/* ── Toolbar ────────────────────────────────────────────────────────────*/

/** The filter/search strip that sits above a table — grouped into one row so
 *  a page's filters read as part of the table they act on. */
export function Toolbar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-56 bg-white border border-gray-300 rounded-md pl-8 pr-3 py-2 text-[12px] text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#0696D7] focus:ring-2 focus:ring-[#0696D7]/20 transition-all"
      />
    </div>
  );
}

/* ── Summary tiles ──────────────────────────────────────────────────────*/

/** A clickable count tile for the portfolio header. Selecting one filters the
 *  table below it — the previous version rendered six inert numbers, several
 *  of which are permanently zero on a new account. */
export function SummaryTile({ label, count, selected, accent, onClick }: {
  label: string; count: number; selected?: boolean; accent?: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left rounded-lg border px-3.5 py-3 transition-colors ${
        selected ? "border-[#0696D7] bg-[#0696D7]/[0.07]" : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
      }`}
    >
      <span className="flex items-center gap-1.5 mb-1.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />}
        <span className="text-[12px] font-medium text-gray-600 truncate">{label}</span>
      </span>
      <span className="block text-[22px] font-semibold leading-none text-gray-900 tabular-nums">{count}</span>
    </button>
  );
}

/* ── Banners ────────────────────────────────────────────────────────────*/

const BANNER_TONE = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-green-200 bg-green-50 text-green-900",
} as const;

/** Inline status message. Replaces the bare red <p> tags each page used for
 *  upload/extract errors, which had no container and were easy to miss. */
export function Banner({ tone = "info", children, action }: {
  tone?: keyof typeof BANNER_TONE; children: ReactNode; action?: ReactNode;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 mb-4 text-[12px] ${BANNER_TONE[tone]}`}>
      <div className="min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────────────────────
 * Both of the module's modals previously rendered on `bg-[#0d0d10]` — a
 * near-black surface left over from the pre-light design — and only looked
 * right because a `.tenderai-scope` !important rule in styles.css repainted
 * it. This renders a real white surface, and closes on Escape. */

export function Modal({ title, description, onClose, children, footer }: {
  title: string; description?: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="w-full max-w-md rounded-lg bg-white border border-gray-200 shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">{title}</p>
        {description && <div className="text-[12px] text-gray-600 mb-4 leading-relaxed">{description}</div>}
        {children}
        {footer && <div className="flex items-center justify-end gap-2 mt-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ── KPI tiles ──────────────────────────────────────────────────────────*/

/** Grouped panel of icon+number tiles for the Overview page's stat row. */
export function KpiPanel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} action={action}>
      <div className="flex flex-wrap gap-3">{children}</div>
    </Card>
  );
}

export function KpiTile({ icon, value, label, color = ACCENT, hint }: {
  icon: ReactNode; value: ReactNode; label: string; color?: string; hint?: ReactNode;
}) {
  return (
    <div className="flex-1 min-w-[130px] rounded-lg border border-gray-200 bg-white p-3.5 flex flex-col gap-2.5">
      {/* Tinted chip behind the glyph — a bare icon floating in whitespace
          read as an unfinished placeholder at this size. */}
      <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, white)` }}>
        {icon}
      </span>
      <p className="text-[20px] font-semibold leading-none text-gray-900 tabular-nums">{value}</p>
      <p className="text-[12px] text-gray-600 leading-tight">{label}</p>
      {hint && <p className="text-[11px] text-gray-500 leading-tight">{hint}</p>}
    </div>
  );
}

/* ── Data table ─────────────────────────────────────────────────────────*/

/** Column-based dense table — the one list pattern every tender data page
 *  (Requirements, Checklist, Gaps, Clarifications, Compliance, Risks, and now
 *  the portfolio itself) shares, matching Autodesk Docs' file-list table:
 *  plain-weight gray headers, thin row borders, light-gray hover, an optional
 *  sortable column (click header → toggle asc/desc, shows an arrow) and an
 *  optional "Showing N items" footer. */
export interface DataTableColumn<T> {
  header: string;
  width?: string;
  /** Right-aligns the header and its cells — for actions and numeric columns. */
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  /** Enables click-to-sort on this column. `sortKey` extracts the comparable
   *  value from a row (string or number). */
  sortKey?: (row: T) => string | number;
}

export function DataTable<T>({ columns, rows, keyFn, onRowClick, expandedKey, renderExpanded, footerCount, footerLabel, sort, onSortChange, emptyMessage }: {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  expandedKey?: string | null;
  renderExpanded?: (row: T) => ReactNode;
  /** Shows a "Showing N items" footer under the table, matching Autodesk
   *  Docs' file-list footer. */
  footerCount?: boolean;
  /** Overrides the footer text entirely, e.g. "Showing 4 of 26 tenders". */
  footerLabel?: ReactNode;
  /** Current sort state, for columns with `sortKey` set. Omit if the page
   *  doesn't want sorting even though a column defines `sortKey`. */
  sort?: { columnIndex: number; direction: "asc" | "desc" };
  onSortChange?: (next: { columnIndex: number; direction: "asc" | "desc" }) => void;
  /** Shown in place of the body when `rows` is empty but the table itself
   *  should stay on screen — e.g. a filter that matched nothing. */
  emptyMessage?: string;
}) {
  return (
    <div>
      <div className="overflow-x-auto -mx-5 -mt-1">
        <table className="w-full text-[13px] border-collapse table-fixed">
          <thead>
            <tr className="text-left border-b border-gray-200">
              {columns.map((c, i) => {
                const isSorted = sort?.columnIndex === i;
                const canSort = !!c.sortKey && !!onSortChange;
                return (
                  <th key={i} className={`text-[12px] font-medium text-gray-600 pb-2 pl-5 pr-3 first:pl-5 ${c.align === "right" ? "text-right" : ""}`} style={c.width ? { width: c.width } : undefined}>
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => onSortChange!({ columnIndex: i, direction: isSorted && sort!.direction === "asc" ? "desc" : "asc" })}
                        className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${c.align === "right" ? "ml-auto" : ""}`}
                      >
                        {c.header}
                        {isSorted && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={sort!.direction === "desc" ? "rotate-180" : undefined}>
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && emptyMessage ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-[13px] text-gray-600">{emptyMessage}</td>
              </tr>
            ) : rows.map((row) => {
              const key = keyFn(row);
              return (
                <Fragment key={key}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={onRowClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : undefined}
                  >
                    {columns.map((c, i) => (
                      <td key={i} className={`py-2.5 pl-5 pr-3 first:pl-5 align-top text-gray-700 ${c.align === "right" ? "text-right" : ""}`}>{c.render(row)}</td>
                    ))}
                  </tr>
                  {expandedKey === key && renderExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="pb-3 pl-5 pr-3 bg-gray-50">{renderExpanded(row)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {(footerLabel || footerCount) && (
        <p className="text-[11px] text-gray-500 mt-3">
          {footerLabel ?? `Showing ${rows.length} item${rows.length !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
}

/** Sorts `rows` per a DataTable `sort` state and the same columns array
 *  passed to DataTable — pulled out as a helper so pages don't each
 *  re-implement the same comparator logic. */
export function sortRows<T>(rows: T[], columns: DataTableColumn<T>[], sort: { columnIndex: number; direction: "asc" | "desc" } | undefined): T[] {
  if (!sort) return rows;
  const col = columns[sort.columnIndex];
  if (!col?.sortKey) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = col.sortKey!(a);
    const bv = col.sortKey!(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  return sort.direction === "desc" ? sorted.reverse() : sorted;
}

/* ── Surfaces ───────────────────────────────────────────────────────────*/

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-5">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <p className="text-[13px] font-semibold text-gray-900">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Small caption above a value, for the label/value pairs in headers and
 *  detail panes. */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <div className="text-[13px] text-gray-800 truncate">{children}</div>
    </div>
  );
}

/* ── Status ─────────────────────────────────────────────────────────────
 * Every color below is AA against white (4.5:1+). The previous palette used
 * Tailwind's 400/500 shades — #eab308 measured 1.9:1 and #22c55e 2.3:1, so
 * those status bars were effectively invisible on a white row, which is the
 * whole job of a status bar. The hues are unchanged; only lightness moved.
 *
 * Blue stays its own hue here, separate from the brand accent — these badges
 * mean "info / AI-in-progress / needs clarification", which has to read as
 * distinct from "high severity" and "deviation" (both orange). */
const STATUS_COLOR: Record<string, string> = {
  // tender status
  draft: "#6b7280", processing: "#a16207", analysis: "#0369a1", submission: "#c2410c", submitted: "#15803d", archived: "#57534e",
  // document status
  uploaded: "#6b7280", processed: "#15803d", failed: "#b91c1c",
  // requirement / checklist status
  open: "#6b7280", in_progress: "#a16207", missing_info: "#b91c1c", missing_information: "#b91c1c",
  ready: "#15803d", approved: "#15803d", not_started: "#6b7280", ai_drafted: "#0369a1", in_review: "#a16207",
  // severity
  critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#15803d",
  // compliance
  comply: "#15803d", partially_comply: "#a16207", deviation: "#c2410c", not_applicable: "#6b7280",
  need_clarification: "#0369a1", missing: "#b91c1c",
};

export function statusColor(value: string): string {
  return STATUS_COLOR[value] ?? "#6b7280";
}

/** Autodesk's Issues panel shows status as a small colored bar + plain text
 *  ("In progress • Clash"), not a rounded pill — matches that instead of a
 *  colored-background chip. */
export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: statusColor(value) }} />
      <span className="text-[12px] font-medium text-gray-700 whitespace-nowrap">{label ?? humanize(value)}</span>
    </span>
  );
}

/* ── States ─────────────────────────────────────────────────────────────*/

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-lg py-14 px-6 text-center">
      <p className="text-[14px] font-medium text-gray-900 mb-1.5">{title}</p>
      {hint && <p className="text-[12px] text-gray-600 mb-4 max-w-md mx-auto leading-relaxed">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg py-6 px-5 text-center">
      <p className="text-[12px] text-red-800">{message}</p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: ACCENT }} />
    </div>
  );
}

/** Full-page placeholder while auth/session resolves. Every page rendered its
 *  own `<div className="min-h-screen bg-white" />` for this; named so the
 *  intent is legible and the treatment stays in one place. */
export function PageLoading() {
  return <div className="min-h-screen bg-white" />;
}

/** Sentence-friendly label from a snake_case constant. */
export function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
