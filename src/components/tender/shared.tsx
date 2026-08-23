import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DockWorkspaceProvider, useDockWorkspace } from "@/components/tender/DockWorkspace";
import { QuickDocumentsPanel } from "@/components/tender/QuickDocumentsPanel";

/* ── Shared design-system primitives for TenderAI (/tender/*) ──────────
 * Lean, Phase 1 subset — mirrors src/components/cm/shared.tsx's role for
 * the CM app. Grows as each new tender page needs a new primitive, rather
 * than speculatively building the whole set up front. */

export const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:bg-white/[0.07] focus:border-[#2563eb]/70 focus:ring-2 focus:ring-[#2563eb]/15 transition-all";
export const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
export const btnPrimaryCls = "px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-colors";

export function PageShell({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <TenderTopNav />
      <main className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-8 pb-24">
        <div className="flex items-center justify-between mb-6 gap-3">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">{title}</h1>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}

export function TenderTopNav() {
  return (
    <header className="border-b border-white/8 bg-[#0d0d0e]">
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
const TENDER_TABS: { key: string; label: string; to: string }[] = [
  { key: "overview", label: "Overview", to: "/tender/$tenderId" },
  { key: "documents", label: "Documents", to: "/tender/$tenderId/documents" },
  { key: "requirements", label: "Requirements", to: "/tender/$tenderId/requirements" },
  { key: "checklist", label: "Checklist", to: "/tender/$tenderId/checklist" },
  { key: "compliance", label: "Compliance", to: "/tender/$tenderId/compliance" },
  { key: "gaps", label: "Gaps", to: "/tender/$tenderId/gaps" },
  { key: "risks", label: "Risks", to: "/tender/$tenderId/risks" },
  { key: "clarifications", label: "Clarifications", to: "/tender/$tenderId/clarifications" },
];

export function TenderShell({ tenderId, title, subtitle, action, children }: {
  tenderId: string; title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    <DockWorkspaceProvider>
      <div className="min-h-screen bg-[#0a0a0b] text-white font-sans pb-14">
        <TenderTopNav />
        <div className="border-b border-white/8 bg-[#0d0d0e]">
          <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6 pb-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight truncate">{title}</h1>
                {subtitle && <div className="text-[12px] text-white/40 mt-0.5">{subtitle}</div>}
              </div>
              {action}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {TENDER_TABS.map((tab) => (
                <Link key={tab.key} to={tab.to} params={{ tenderId }}
                  activeOptions={{ exact: tab.key === "overview" }}
                  className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-white/45 border-b-2 border-transparent whitespace-nowrap transition-colors hover:text-white"
                  activeProps={{ className: "px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-[#2563eb] border-b-2 border-[#2563eb] whitespace-nowrap" }}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <main className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8">
          {children}
        </main>
        <DockToolbar tenderId={tenderId} />
      </div>
    </DockWorkspaceProvider>
  );
}

/** Bottom-docked launcher bar for floating panels — visible on every
 *  tender tab, mirroring the always-available toolbar pattern from
 *  Autodesk's viewer, applied to document-oriented panels instead of
 *  3D navigation tools. */
function DockToolbar({ tenderId }: { tenderId: string }) {
  const { openPanel } = useDockWorkspace();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/8 bg-[#0d0d0e]/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-11 flex items-center gap-1">
        <button
          onClick={() => openPanel("documents", "Documents", <QuickDocumentsPanel tenderId={tenderId} />)}
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
