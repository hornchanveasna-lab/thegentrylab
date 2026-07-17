import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCMProjects, type CMProject, type CMPhotoModule, type CMDailyActivity, type EquipmentStatus, DISCIPLINES, type Discipline,
  useCMProjectLocations, locationBreadcrumb, useCMCompanies, createCMCompany,
  type ProjectStatus, type CMComputedHealth,
  useCMComments, addCMComment, deleteCMComment,
  useCMProjectMembers,
  useCMRelatedItems, type CMRelatedItem,
  useCMEntityAuditLog,
  useCMNotifications,
  useCMWorkflowSteps,
  type CMFileAttachment,
  type CMManpowerRow, stampAndUploadCMPhotos, CM_WORKER_CATEGORIES,
} from "@/lib/cm-data";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";

export const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
export const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const fieldSelectTriggerCls = "w-full flex items-center justify-between gap-2 bg-white/5 hover:bg-white/[0.08] rounded-xl border border-white/15 px-3.5 py-3 text-[13px] text-white disabled:opacity-40 transition-colors";

export interface FieldSelectOption<T extends string> {
  value: T;
  label: string;
}

/** Closes an open dropdown/menu on any tap outside its bounds, without
 *  changing whatever was selected — used instead of a `fixed inset-0`
 *  backdrop div, which can silently fail to catch outside taps when nested
 *  inside an ancestor that establishes its own CSS containing block (e.g.
 *  Sheet's `backdrop-blur` wrapper). Listens on `pointerdown` in the capture
 *  phase so it fires before any click handler underneath, and reads the
 *  latest `onOutside` via a ref so the listener itself doesn't need to be
 *  re-attached every render. */
export function useClickOutside<T extends HTMLElement>(active: boolean, onOutside: () => void) {
  const ref = useRef<T>(null);
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideRef.current();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [active]);
  return ref;
}

/** Reactive read of the `data-theme` attribute `settings.tsx`'s applyTheme()
 *  sets on <html> — for the rare case (Recharts inline style props) where a
 *  color can't be expressed as a CSS class the light-mode stylesheet can
 *  override, and has to be picked in JS instead. */
export function useCMTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark",
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme((document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export const EQUIPMENT_STATUS_OPTIONS: EquipmentStatus[] = ["Operational", "Maintenance", "Out of Service"];
export const EQUIPMENT_STATUS_COLOR: Record<EquipmentStatus, string> = { Operational: "#34d399", Maintenance: "#fbbf24", "Out of Service": "#f43f5e" };

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "Draft", "Tender", "Planning", "Pre-Construction", "Active", "On Hold", "Delayed",
  "Defect Liability", "Handover", "Completed", "Closed", "Archived",
];
export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  Draft: "#94a3b8",
  Tender: "#94a3b8",
  Planning: "#94a3b8",
  "Pre-Construction": "#94a3b8",
  Active: "#ff5100",
  "On Hold": "#fbbf24",
  Delayed: "#f43f5e",
  "Defect Liability": "#a78bfa",
  Handover: "#a78bfa",
  Completed: "#34d399",
  Closed: "#34d399",
  Archived: "#64748b",
};
/** Health is computed from the schedule (cmComputedHealth), never hand-set. */
export const PROJECT_HEALTH_OPTIONS: CMComputedHealth[] = ["Ahead", "OnSchedule", "Behind"];
export const PROJECT_HEALTH_COLOR: Record<CMComputedHealth, string> = {
  Ahead: "#60a5fa", OnSchedule: "#34d399", Behind: "#f43f5e", NoSchedule: "#94a3b8",
};

/** A read-only colored pill, extracted from what every module was hand-
 *  rolling inline for its status/priority chips. `PriorityBadge` is the
 *  same shape under a clearer call-site name. */
export function StatusBadge({ label, color, size = "xs" }: { label: string; color: string; size?: "xs" | "sm" }) {
  return (
    <span className={`px-2.5 py-1 rounded-full font-mono uppercase tracking-widest shrink-0 ${size === "xs" ? "text-[9px]" : "text-[10px]"}`}
      style={{ backgroundColor: `${color}15`, color }}>
      {label}
    </span>
  );
}
export const PriorityBadge = StatusBadge;

/** Dashed-border placeholder for an empty list, reused across modules
 *  instead of each one duplicating the same markup. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
      <p className="text-white/40 text-sm">{message}</p>
    </div>
  );
}

/** Shown when a module's query fails — every module today only handled
 *  isLoading, so a failed fetch silently rendered nothing. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useCMLang();
  return (
    <div className="rounded-2xl border border-dashed border-red-400/20 py-16 flex flex-col items-center justify-center gap-3 text-center px-4">
      <p className="text-red-400/70 text-sm">{message}</p>
      {onRetry && <button onClick={onRetry} className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80">{t("common.retry")}</button>}
    </div>
  );
}

/** Replaces native window.confirm() with an in-app modal that matches the
 *  rest of the design system. */
export function ConfirmationDialog({ message, confirmLabel, onConfirm, onCancel, destructive = true }: {
  message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; destructive?: boolean;
}) {
  const { t } = useCMLang();
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6" onClick={onCancel}>
      <div className="w-full max-w-xs bg-[#141415] rounded-3xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[13px] text-white/80 text-center">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[12px] font-mono uppercase tracking-widest bg-white/5 text-white/60 hover:bg-white/10">{t("common.cancel")}</button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-[12px] font-mono uppercase tracking-widest ${destructive ? "text-red-400 bg-red-500/10 hover:bg-red-500/15" : "text-black"}`}
            style={destructive ? undefined : { backgroundColor: "#ff5100" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A titled card shell used by Project Settings and the new dedicated
 *  BOQ/Schedule/Manpower/Equipment/Dashboard pages, so every module-level
 *  "section" reads the same. */
export function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#0d0d0e] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Small editable string list — chips with a × remove, plus an add row —
 *  used by per-module Settings pages to let a project admin extend a
 *  suggestion list (e.g. Manpower's default trades, BOQ's category list)
 *  without touching code. Not for enums with fixed business meaning. */
export function StringListEditor({ label, hint, values, onChange, canEdit }: {
  label: string; hint?: string; values: string[]; onChange: (next: string[]) => void; canEdit: boolean;
}) {
  const [draft, setDraft] = useState("");
  const { t } = useCMLang();

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>{label}</span>
      {hint && <p className="text-[12px] text-white/45">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[10px] bg-white/5 text-white/60">
            {v}
            {canEdit && (
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-white/25 hover:text-red-400 w-4 h-4 rounded-full flex items-center justify-center">×</button>
            )}
          </span>
        ))}
        {values.length === 0 && <p className="text-white/30 text-[12px]">{t("projectSettings.none")}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" onClick={add} disabled={!draft.trim()}
            className="px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest shrink-0 disabled:opacity-40"
            style={{ backgroundColor: "#ff5100", color: "#000" }}>
            {t("common.add")}
          </button>
        </div>
      )}
    </div>
  );
}

/** A collapsible card section — same visual shell as the accordion cards
 *  used across Inspection/Safety/Punch List/Submittal list rows
 *  (`rounded-2xl bg-[#0d0d0e]`, tappable header, collapsible body), reused
 *  here as a generic building block for long forms that want jump-to-section
 *  navigation instead of one uninterrupted scroll. `badge` renders on the
 *  header's right side (e.g. a running total); the chevron always shows the
 *  open/closed state. */
export function AccordionSection({ title, badge, open, onToggle, children }: {
  title: string; badge?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <span className="text-[13px] text-white/80 font-medium">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-white/25 transition-transform"
            style={{ transform: open ? "rotate(90deg)" : undefined }}>
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

/** A person's face photo, or an initials circle when none is set —
 *  reused everywhere a Directory contact appears (Directory itself,
 *  Subcontractors, Consultant people, project Team members). */
export function Avatar({ name, photoUrl, size = 32 }: { name: string; photoUrl?: string | null; size?: number }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white/50"
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

/** A generic add/remove row-list editor — one row card per item with a
 *  remove "×" and an "+ Add" button, used for any small repeatable
 *  sub-section inside a form (manpower, deliveries, visitors, delays,
 *  etc.) instead of writing a bespoke editor per shape. */
export function RepeatingRows<T>({ label, addLabel, rows, onChange, emptyRow, renderRow }: {
  label: string;
  addLabel: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  emptyRow: T;
  renderRow: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const { t } = useCMLang();
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const updateRow = (i: number, patch: Partial<T>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => { onChange(rows.filter((_, idx) => idx !== i)); setConfirmIndex(null); };

  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>{label}</span>
      {rows.map((row, i) => (
        <div key={i} className="relative rounded-xl bg-white/3 p-3 pr-9">
          {renderRow(row, (patch) => updateRow(i, patch))}
          {confirmIndex === i ? (
            <button type="button" onClick={() => removeRow(i)}
              className="absolute top-2 right-2 font-mono text-[9px] uppercase tracking-widest text-red-400 px-1.5 py-1">{t("common.delete")}</button>
          ) : (
            <button type="button" onClick={() => setConfirmIndex(i)}
              className="absolute top-1 right-1 text-white/25 hover:text-red-400 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 text-[15px]">×</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, emptyRow])}
        className="self-start font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{addLabel}</button>
    </div>
  );
}

/** A flat, rounded overlay list with a checkmark on the selected row —
 *  the app's one dropdown pattern, replacing every native `<select>` so
 *  option lists always look and behave the same regardless of platform
 *  (native pickers render wildly differently per OS/browser). */
export function FieldSelect<T extends string>({ value, options, onChange, className, triggerClassName, triggerStyle, triggerIcon, menuClassName, disabled, placeholder, searchable, searchPlaceholder, allowCustom, onCreateCustom }: {
  value: T;
  options: FieldSelectOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  /** Overrides the dropdown panel's positioning/width classes — the panel
   *  defaults to stretching edge-to-edge with the trigger (`left-0 right-0`),
   *  which collapses to a sliver on compact icon-sized triggers (e.g. a
   *  40px sort button) and wraps every option's text into single
   *  characters. Pass e.g. "left-auto right-0 w-56" for a compact trigger
   *  that should still open a normal-width menu. */
  menuClassName?: string;
  /** Renders this icon in the trigger instead of the selected option's
   *  label/chevron — for compact icon-only triggers (e.g. a small sort
   *  button) where showing the label text would overflow the button. */
  triggerIcon?: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** When paired with `searchable`, offers a "+ Create '{search}'" row for
   *  typed text that doesn't match any existing option — used for free-text
   *  fields (like a company name) where the option list is just "everything
   *  already used" rather than a fixed enum. */
  allowCustom?: boolean;
  onCreateCustom?: (value: string) => void;
}) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useClickOutside<HTMLDivElement>(open, () => { setOpen(false); setSearch(""); });
  // A trigger near the bottom of a bottom-sheet form (very common in this
  // app) can otherwise push the panel off-screen with no way to reach the
  // options below the fold — flip it to open upward whenever there isn't
  // reasonably enough room below, so it always lands somewhere tappable.
  const toggleOpen = () => {
    if (!open) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setOpenUpward(window.innerHeight - rect.bottom < 320 && rect.top > window.innerHeight - rect.bottom);
    }
    setOpen((v) => !v);
  };
  const selected = options.find((o) => o.value === value);
  const q = search.trim().toLowerCase();
  const visibleOptions = searchable && q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const trimmedSearch = search.trim();
  const showCreateRow = searchable && allowCustom && trimmedSearch.length > 0
    && !options.some((o) => o.label.toLowerCase() === trimmedSearch.toLowerCase());
  const handleCreate = () => {
    if (onCreateCustom) onCreateCustom(trimmedSearch);
    else onChange(trimmedSearch as T);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button type="button" disabled={disabled} onClick={toggleOpen}
        className={triggerClassName ?? fieldSelectTriggerCls} style={triggerStyle}>
        {triggerIcon ?? (
          <>
            <span className="truncate text-left">{selected?.label ?? placeholder ?? ""}</span>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div className={`absolute z-50 rounded-2xl overflow-hidden shadow-xl menu-surface backdrop-blur-xl ${openUpward ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"} ${menuClassName ?? "left-0 right-0"}`}>
            {searchable && (
              <div className="p-2 border-b border-white/6">
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder}
                  className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white placeholder-white/25 focus:outline-none focus:border-[#ff5100]/60" />
              </div>
            )}
            <div className="max-h-72 overflow-y-auto">
              {visibleOptions.length === 0 && !showCreateRow && (
                <p className="px-4 py-3 text-[12px] text-white/30">—</p>
              )}
              {showCreateRow && (
                <button type="button" onClick={handleCreate}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/6"
                  style={{ color: "#ff5100" }}>
                  <span className="text-[13px] truncate">{t("people.createCompany", { name: trimmedSearch })}</span>
                </button>
              )}
              {visibleOptions.map((opt) => (
                <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/6 last:border-b-0">
                  <span className="text-[13px] text-white/85 truncate">{opt.label}</span>
                  {opt.value === value && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M4 12.5l5 5L20 6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
      )}
    </div>
  );
}

/** Discipline picker shared across modules — thin wrapper over FieldSelect
 *  so every module presents the same discipline list the same way. */
export function DisciplineSelect({ value, onChange, disabled, disciplines }: {
  value: Discipline | null; onChange: (v: Discipline | null) => void; disabled?: boolean;
  /** Restrict the option list — pass a project's enabledDisciplines() so a
   *  project that has disabled a discipline in Settings stops offering it here. */
  disciplines?: Discipline[];
}) {
  const { t } = useCMLang();
  const list = disciplines ?? DISCIPLINES;
  const shown = value && !list.includes(value) ? [value, ...list] : list;
  return (
    <FieldSelect
      value={value ?? ""}
      onChange={(v) => onChange((v || null) as Discipline | null)}
      disabled={disabled}
      placeholder={t("common.selectDiscipline")}
      options={[{ value: "", label: t("common.none") }, ...shown.map((d) => ({ value: d, label: t(`discipline.${d}`) }))]}
    />
  );
}

/** Location picker — per-project (unlike DisciplineSelect's fixed global
 *  list), so it fetches this project's hierarchy and flattens it into
 *  breadcrumb-labeled options ("Building B1 › Ground Floor › Zone A"). */
export function LocationSelect({ projectId, value, onChange, disabled }: {
  projectId: string; value: string | null; onChange: (v: string | null) => void; disabled?: boolean;
}) {
  const { t } = useCMLang();
  const { data: locations } = useCMProjectLocations(projectId);
  const options = useMemo(
    () => (locations ?? []).map((l) => ({ value: l.id, label: locationBreadcrumb(l, locations ?? []) })),
    [locations],
  );
  return (
    <FieldSelect
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
      disabled={disabled}
      searchable
      placeholder={t("common.selectLocation")}
      options={[{ value: "", label: t("common.none") }, ...options]}
    />
  );
}

/** Company picker — owner-scoped (like LocationSelect is project-scoped),
 *  with an inline "+ Create" for a name that doesn't exist yet. onChange
 *  returns both the id (to store as company_id) and the resolved name (to
 *  mirror into the existing free-text `company` field), so callers don't
 *  need their own company lookup. */
export function CompanySelect({ ownerId, value, onChange, disabled }: {
  ownerId: string; value: string | null; onChange: (companyId: string | null, companyName: string) => void; disabled?: boolean;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: companies } = useCMCompanies(ownerId);

  const handleChange = (v: string) => {
    const match = companies?.find((c) => c.id === v);
    onChange(v || null, match?.name ?? "");
  };
  const handleCreate = async (name: string) => {
    const created = await createCMCompany(ownerId, name);
    qc.invalidateQueries({ queryKey: ["cm_companies", ownerId] });
    onChange(created.id, created.name);
  };

  return (
    <FieldSelect
      value={value ?? ""}
      onChange={handleChange}
      onCreateCustom={handleCreate}
      disabled={disabled}
      searchable
      allowCustom
      placeholder={t("directory.company")}
      options={(companies ?? []).map((c) => ({ value: c.id, label: c.name }))}
    />
  );
}

/** A single hook call returns a `bind(key, onLongPress)` factory so each item
 *  in a list can get its own long-press handlers without calling a hook
 *  per-item (which would break the Rules of Hooks as the list's length
 *  changes). A long press suppresses the click that follows it, so it
 *  doesn't also trigger whatever tap action sits underneath. */
export function useLongPress(delay = 500) {
  const state = useRef(new Map<string, { timer: ReturnType<typeof setTimeout> | null; fired: boolean }>());

  return (key: string, onLongPress: () => void) => {
    const get = () => {
      let s = state.current.get(key);
      if (!s) { s = { timer: null, fired: false }; state.current.set(key, s); }
      return s;
    };
    return {
      onPointerDown: () => {
        const s = get();
        s.fired = false;
        s.timer = setTimeout(() => { s.fired = true; onLongPress(); }, delay);
      },
      onPointerUp: () => { const s = get(); if (s.timer) clearTimeout(s.timer); },
      onPointerLeave: () => { const s = get(); if (s.timer) clearTimeout(s.timer); },
      onPointerCancel: () => { const s = get(); if (s.timer) clearTimeout(s.timer); },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onClickCapture: (e: React.MouseEvent) => {
        const s = get();
        if (s.fired) { e.preventDefault(); e.stopPropagation(); }
      },
    };
  };
}

/** Shares the actual photo file(s) to whatever app the user picks (WhatsApp,
 *  Telegram, etc.) via the Web Share API's file support, instead of just a
 *  link — falling back to a link share/clipboard copy on browsers that
 *  can't share files. */
export async function sharePhotoFiles(urls: string[]): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  let files: File[] = [];
  try {
    files = await Promise.all(
      urls.map(async (url, i) => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], `photo-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
      }),
    );
  } catch {
    files = [];
  }
  try {
    if (files.length > 0 && navigator.canShare?.({ files })) {
      await navigator.share({ files });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ url: urls[0] });
      return "shared";
    }
    await navigator.clipboard.writeText(urls.join("\n"));
    return "copied";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
    return "failed";
  }
}

export function BackButton({ onClick, to }: { onClick?: () => void; to?: string }) {
  const content = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
  const cls = "w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0";
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <button onClick={onClick} className={cls}>{content}</button>;
}

export type ModuleView = "list" | "calendar";

/** The grid/calendar two-button toggle first built for the Photos gallery —
 *  pulled out standalone so every module page can offer the same switch
 *  between its flat list and a Calendar view, styled identically. */
export function ViewToggle({ view, onChange }: { view: ModuleView; onChange: (v: ModuleView) => void }) {
  const { t } = useCMLang();
  return (
    <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1 shrink-0">
      <button type="button" onClick={() => onChange("list")} aria-label={t("common.viewList")}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${view === "list" ? "" : "text-white/50"}`}
        style={view === "list" ? { backgroundColor: "#ff5100", color: "#000" } : undefined}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
      <button type="button" onClick={() => onChange("calendar")} aria-label={t("common.viewCalendar")}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${view === "calendar" ? "" : "text-white/50"}`}
        style={view === "calendar" ? { backgroundColor: "#ff5100", color: "#000" } : undefined}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" />
        </svg>
      </button>
    </div>
  );
}

/** The one page-header pattern every module list page shares: a back
 *  button, a title that swaps for a search input, and a "⋮" menu — all
 *  pinned (`sticky`) so they stay visible while the list scrolls beneath
 *  them, matching the Telegram reference the design follows. */
export function ModuleHeader({ title, search, onSearchChange, searchPlaceholder, sortAsc, onToggleSort, settingsTo }: {
  title: string;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  sortAsc: boolean;
  onToggleSort: (v: boolean) => void;
  settingsTo?: string;
}) {
  const { t } = useCMLang();
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(showMenu, () => setShowMenu(false));

  return (
    <div className="sticky top-0 z-30 bg-[#0a0a0b] pt-6 pb-4 flex items-center gap-3">
      <BackButton to="/cm" />
      {showSearch ? (
        <input
          autoFocus
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? t("common.search")}
          className="flex-1 min-w-0 bg-white/5 rounded-xl border border-white/10 px-3.5 py-2 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors"
        />
      ) : (
        <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{title}</h1>
      )}
      <button type="button" aria-label={t("common.search")}
        onClick={() => setShowSearch((v) => { const next = !v; if (!next) onSearchChange(""); return next; })}
        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white shrink-0">
        {showSearch ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        )}
      </button>
      <div ref={menuRef} className="relative shrink-0">
        <button type="button" aria-label={t("common.sort")} onClick={() => setShowMenu((v) => !v)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl overflow-hidden shadow-xl menu-surface backdrop-blur-xl">
            {[{ asc: false, label: t("common.newestFirst") }, { asc: true, label: t("common.oldestFirst") }].map((opt) => (
              <button key={String(opt.asc)} type="button" onClick={() => { onToggleSort(opt.asc); setShowMenu(false); }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/6 last:border-b-0">
                <span className="text-[13px] text-white/85">{opt.label}</span>
                {sortAsc === opt.asc && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M4 12.5l5 5L20 6" />
                  </svg>
                )}
              </button>
            ))}
            {settingsTo && (
              <Link to={settingsTo} onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/5 transition-colors border-t border-white/6">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 shrink-0">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                <span className="text-[13px] text-white/85">{t("common.settings")}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const CALENDAR_MONTH_LOCALE: Record<CMLang, string> = { en: "en-US", km: "km-KH", zh: "zh-CN" };

/** The Site Diary week-strip calendar, generalized so every day-based
 *  module shares the same picker: a 7-day Monday-start strip (three weeks
 *  back, three ahead) swiped left/right via scroll-snap, today ringed in
 *  orange, days with entries highlighted, and a month label that expands
 *  into the full MiniCalendar grid for browsing further back. Tapping a
 *  day selects it; tapping the selected day again clears the selection
 *  (callers that always need a date map null back to today). */
export function WeekCalendarStrip<T>({ items, dateOf, lang, selected, onSelect }: {
  items: T[];
  dateOf: (item: T) => string;
  lang: CMLang;
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [visibleWeek, setVisibleWeek] = useState(3);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const markedDates = useMemo(() => new Set(items.map(dateOf)), [items, dateOf]);

  const weeks = useMemo(() => {
    const base = new Date();
    const monOffset = (base.getDay() + 6) % 7;
    const thisMonday = new Date(base);
    thisMonday.setDate(base.getDate() - monOffset);
    return Array.from({ length: 7 }, (_, w) => {
      const weekStart = new Date(thisMonday);
      weekStart.setDate(thisMonday.getDate() + (w - 3) * 7);
      return Array.from({ length: 7 }, (_, d) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        return day.toISOString().slice(0, 10);
      });
    });
  }, []);

  const monthYearLabel = useMemo(() => {
    const midWeek = weeks[visibleWeek] ?? weeks[3];
    return new Date(`${midWeek[3]}T00:00:00`).toLocaleDateString(CALENDAR_MONTH_LOCALE[lang], { month: "long", year: "numeric" });
  }, [weeks, visibleWeek, lang]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || expanded) return;
    el.scrollLeft = 3 * el.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setVisibleWeek(Math.round(el.scrollLeft / el.clientWidth));
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 40) setExpanded(true);
    else if (delta < -40) setExpanded(false);
    touchStartY.current = null;
  };

  if (expanded) {
    return (
      <div className="flex flex-col gap-2 mb-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <MiniCalendar items={items} dateOf={dateOf} lang={lang}
          onOpenDay={(dayItems) => { onSelect(dateOf(dayItems[0])); setExpanded(false); }} />
        <button type="button" onClick={() => setExpanded(false)}
          className="self-center text-white/25 hover:text-white/50 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <button type="button" onClick={() => setExpanded(true)}
        className="self-start flex items-center gap-1.5 text-[13px] font-bold text-white/80 hover:text-white transition-colors">
        {monthYearLabel}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div ref={scrollRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5 w-full shrink-0 snap-center">
            {week.map((d) => {
              const isSelected = d === selected;
              const isToday = d === today;
              const dateObj = new Date(`${d}T00:00:00`);
              return (
                <button key={d} type="button" onClick={() => onSelect(isSelected ? null : d)}
                  className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">{dateObj.toLocaleDateString(CALENDAR_MONTH_LOCALE[lang], { weekday: "narrow" })}</span>
                  <span
                    className={`relative aspect-square w-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                      isSelected ? "text-black" : markedDates.has(d) ? "text-white/80 bg-white/5" : "text-white/25"
                    }`}
                    style={{
                      backgroundColor: isSelected ? "#ff5100" : undefined,
                      boxShadow: isToday && !isSelected ? "inset 0 0 0 1.5px #ff5100" : undefined,
                    }}>
                    {dateObj.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A month-by-month calendar of marked days — generalized from the Photos
 *  gallery's original calendar so every module can offer the same "track
 *  back to a date" browsing mode instead of only a flat list. Pass
 *  `renderCover` to show something inside a marked day's cell (Photos uses
 *  it for a thumbnail); omit it for a plain highlighted dot, which is all
 *  most record lists need. */
export function MiniCalendar<T>({ items, dateOf, lang, onOpenDay, renderCover }: {
  items: T[];
  dateOf: (item: T) => string;
  lang: CMLang;
  onOpenDay: (dayItems: T[]) => void;
  renderCover?: (dayItems: T[]) => React.ReactNode;
}) {
  const locale = CALENDAR_MONTH_LOCALE[lang];

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "narrow" });
    });
  }, [locale]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const date = dateOf(item);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    }
    return map;
  }, [items, dateOf]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) set.add(dateOf(item).slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [items, dateOf]);

  if (months.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-7 gap-1.5">
        {weekdayLabels.map((w, i) => (
          <div key={i} className="text-center font-mono text-[9px] uppercase tracking-widest text-white/30">{w}</div>
        ))}
      </div>
      {months.map((ym) => {
        const [yearStr, monthStr] = ym.split("-");
        const year = Number(yearStr);
        const monthIdx = Number(monthStr) - 1;
        const daysCount = new Date(year, monthIdx + 1, 0).getDate();
        const firstWeekday = (new Date(year, monthIdx, 1).getDay() + 6) % 7;
        const monthLabel = new Date(year, monthIdx, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
        const cells: Array<{ day: number; dateStr: string } | null> = [];
        for (let i = 0; i < firstWeekday; i++) cells.push(null);
        for (let d = 1; d <= daysCount; d++) cells.push({ day: d, dateStr: `${yearStr}-${monthStr}-${String(d).padStart(2, "0")}` });

        return (
          <div key={ym}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2.5">{monthLabel}</p>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell, i) => {
                if (!cell) return <div key={i} />;
                const dayItems = itemsByDate.get(cell.dateStr);
                const marked = !!dayItems?.length;
                return (
                  <button key={i} disabled={!marked} onClick={() => dayItems && onOpenDay(dayItems)}
                    className="relative aspect-square rounded-full overflow-hidden flex items-center justify-center bg-white/5">
                    {marked && renderCover?.(dayItems!)}
                    {marked && !renderCover && <span className="absolute inset-0 rounded-full" style={{ backgroundColor: "#ff5100" }} />}
                    <span className={`relative text-[12px] font-bold ${marked ? (renderCover ? "text-white/[0.95]" : "text-black") : "text-white/25"}`}
                      style={marked && renderCover ? { textShadow: "0 1px 3px rgba(0,0,0,0.85)" } : undefined}>
                      {cell.day}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-[#0d0d0e] rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-6 pt-4 pb-2 sticky top-0 bg-[#0d0d0e] z-10">
          <h2 className="font-extrabold text-base tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Full-page shell for New/Edit forms — replaces `Sheet` for record-creating
 *  forms so the user gets a whole screen to work with instead of a cramped
 *  overlay panel. Styled like every other full CM page (BackButton + title
 *  inside a centered max-width main). */
export function FormPage({ title, backTo, children }: { title: string; backTo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to={backTo} />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Full-page shell for a single module's own Settings screen (reached from
 *  that module's ⋮ menu) — same header pattern as `FormPage`, but its
 *  children are a vertical stack of `Card`s rather than a form. */
export function ModuleSettingsPage({ title, backTo, children }: { title: string; backTo: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to={backTo} />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{title}</h1>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </main>
    </div>
  );
}

export function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed right-6 w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_8px_24px_rgba(255,81,0,0.4)] active:scale-95 transition-transform z-30"
      style={{ backgroundColor: "#ff5100", bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    </button>
  );
}

export function PhotoPicker({ photos, setPhotos, disabled }: { photos: File[]; setPhotos: (fn: (p: File[]) => File[]) => void; disabled: boolean }) {
  const { t } = useCMLang();
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{t("common.photos")}</span>
      <input type="file" accept="image/*" multiple disabled={disabled}
        onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])])}
        className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((f, i) => (
            <div key={i} className="relative w-16 h-16">
              <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover" />
              <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
    </label>
  );
}

const manpowerSmallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";

/** Quick-entry sheet per the Manpower module's spec: company → trade →
 *  category → workers → location → activity → hours. Also handles editing
 *  an existing row and the duplicate check (same company + trade + location
 *  must not be silently combined — the user chooses Edit Existing / Add New
 *  / Cancel). Shared between the Manpower module's own page and Site
 *  Diary's Manpower section so both use the same fast add/edit flow. */
function ManpowerEntryFields({ ownerId, projectId, rows, editIndex, companyOptions, tradeOptions, onSave, onClose, renderShell }: {
  ownerId: string;
  projectId: string;
  rows: CMManpowerRow[];
  editIndex: number | null;
  companyOptions: string[];
  tradeOptions: string[];
  onSave: (next: CMManpowerRow[]) => Promise<void>;
  onClose: () => void;
  renderShell: (title: string, content: React.ReactNode) => React.ReactNode;
}) {
  const { t } = useCMLang();
  // The duplicate prompt's "Edit Existing" can retarget the sheet at the
  // clashing row mid-flight, so the effective edit target is local state
  // seeded from the prop rather than the prop itself.
  const [editTarget, setEditTarget] = useState<number | null>(editIndex);
  const editing = editTarget != null ? rows[editTarget] : undefined;
  const [company, setCompany] = useState(editing?.company ?? "");
  const [trade, setTrade] = useState(editing?.trade ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [count, setCount] = useState(editing ? String(editing.count) : "");
  const [locationId, setLocationId] = useState<string | null>(editing?.location_id ?? null);
  const [activity, setActivity] = useState(editing?.activity ?? "");
  const [normalHours, setNormalHours] = useState(editing?.normal_hours != null ? String(editing.normal_hours) : "8");
  const [otHours, setOtHours] = useState(editing?.ot_hours != null ? String(editing.ot_hours) : "0");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [dupIndex, setDupIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "hours">("details");

  // New workforce photos are appended to whatever the row already carries —
  // there's no per-photo remove control here, same as the Site Diary sheet.
  const buildRow = async (): Promise<CMManpowerRow> => {
    const uploaded = await stampAndUploadCMPhotos(ownerId, projectId, photoFiles);
    return {
      trade: trade.trim(),
      company: company.trim() || null,
      count: Math.max(0, parseInt(count, 10) || 0),
      roster_item_id: editing?.roster_item_id ?? null,
      category: category || null,
      location_id: locationId,
      activity: activity.trim() || null,
      normal_hours: Math.max(0, Number(normalHours) || 0),
      ot_hours: Math.max(0, Number(otHours) || 0),
      photos: [...(editing?.photos ?? []), ...uploaded.map((u) => u.url)],
      photo_thumbs: [...(editing?.photo_thumbs ?? []), ...uploaded.map((u) => u.thumbUrl)],
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !trade.trim()) return;
    // Duplicate check runs before any photo upload so cancelling costs nothing.
    if (editTarget == null) {
      const dup = rows.findIndex((r) =>
        r.trade.trim().toLowerCase() === trade.trim().toLowerCase()
        && (r.company ?? "").trim().toLowerCase() === company.trim().toLowerCase()
        && (r.location_id ?? null) === (locationId ?? null));
      if (dup >= 0 && dupIndex == null) {
        setDupIndex(dup);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const row = await buildRow();
      const next = editTarget != null ? rows.map((r, i) => (i === editTarget ? row : r)) : [...rows, row];
      await onSave(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const fieldLabel = "text-[10px] font-mono uppercase tracking-widest text-white/35";

  return renderShell(editTarget != null ? t("manpower.editEntry") : t("manpower.addEntry"), (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-6 pb-8 pt-2">
        <div className="flex flex-col gap-1">
          <span className={fieldLabel}>{t("siteDiary.company")}</span>
          <FieldSelect
            value={company}
            onChange={setCompany}
            searchable allowCustom
            placeholder={t("manpower.selectCompany")}
            options={[{ value: "", label: t("common.none") }, ...companyOptions.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={fieldLabel}>{t("siteDiary.trade")}</span>
          <FieldSelect
            value={trade}
            onChange={setTrade}
            searchable allowCustom
            placeholder={t("manpower.selectTrade")}
            options={tradeOptions.map((tr) => ({ value: tr, label: tr }))}
          />
        </div>
        <SegmentedField value={tab} onChange={setTab}
          options={[
            { value: "details" as const, label: t("manpower.detailsTab") },
            { value: "hours" as const, label: t("manpower.hoursTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className={fieldLabel}>{t("manpower.category")}</span>
                <FieldSelect
                  value={category}
                  onChange={setCategory}
                  placeholder={t("common.none")}
                  options={[{ value: "", label: t("common.none") }, ...CM_WORKER_CATEGORIES.map((c) => ({ value: c, label: t(`workerCategory.${c}`) }))]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className={fieldLabel}>{t("manpower.workers")}</span>
                <input className={inputCls} type="number" min={0} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="0" required />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={fieldLabel}>{t("manpower.location")}</span>
              <LocationSelect projectId={projectId} value={locationId} onChange={setLocationId} />
            </div>
          </div>
        )}

        {tab === "hours" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className={fieldLabel}>{t("manpower.activity")}</span>
              <input className={inputCls} value={activity} onChange={(e) => setActivity(e.target.value)} placeholder={t("manpower.activityPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className={fieldLabel}>{t("manpower.normalHours")}</span>
                <input className={inputCls} type="number" min={0} step="0.5" inputMode="decimal" value={normalHours} onChange={(e) => setNormalHours(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <span className={fieldLabel}>{t("manpower.otHours")}</span>
                <input className={inputCls} type="number" min={0} step="0.5" inputMode="decimal" value={otHours} onChange={(e) => setOtHours(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {(editing?.photos?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {editing!.photos!.map((url, i) => (
              <img key={i} src={editing!.photo_thumbs?.[i] || url} alt="" className="w-16 h-16 rounded-xl object-cover" />
            ))}
          </div>
        )}
        <PhotoPicker photos={photoFiles} setPhotos={setPhotoFiles} disabled={saving} />

        {dupIndex != null && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-col gap-2">
            <p className="text-[12px] text-amber-200/90">{t("manpower.duplicateExists")}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={manpowerSmallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}
                onClick={() => {
                  const existing = rows[dupIndex];
                  setCompany(existing.company ?? "");
                  setTrade(existing.trade);
                  setCategory(existing.category ?? "");
                  setCount(String(existing.count));
                  setLocationId(existing.location_id ?? null);
                  setActivity(existing.activity ?? "");
                  setNormalHours(existing.normal_hours != null ? String(existing.normal_hours) : "8");
                  setOtHours(existing.ot_hours != null ? String(existing.ot_hours) : "0");
                  // Switch the sheet into edit mode for that row — a submit
                  // now replaces it instead of appending a twin.
                  setDupIndex(null);
                  setEditTarget(dupIndex);
                }}>{t("manpower.editExisting")}</button>
              <button type="submit" className={`${manpowerSmallBtn} bg-white/10 text-white/70`}>{t("manpower.addNew")}</button>
              <button type="button" className={`${manpowerSmallBtn} text-white/40`} onClick={() => setDupIndex(null)}>{t("common.cancel")}</button>
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={saving || !trade.trim()} className={`${manpowerSmallBtn} disabled:opacity-40 px-5 py-2.5`} style={{ backgroundColor: "#ff5100", color: "#000" }}>
            {saving ? t("common.loading") : t("common.save")}
          </button>
          <button type="button" onClick={onClose} className={`${manpowerSmallBtn} px-5 py-2.5 text-white/40`}>{t("common.cancel")}</button>
        </div>
      </form>
  ));
}

export function ManpowerEntrySheet(props: {
  ownerId: string;
  projectId: string;
  rows: CMManpowerRow[];
  editIndex: number | null;
  companyOptions: string[];
  tradeOptions: string[];
  onSave: (next: CMManpowerRow[]) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <ManpowerEntryFields {...props}
      renderShell={(title, content) => <Sheet title={title} onClose={props.onClose}>{content}</Sheet>} />
  );
}

/** Full-page counterpart to `ManpowerEntrySheet`, used by /cm/manpower's own
 *  standalone New/Edit routes (Site Diary's embedded manpower-row editor
 *  stays a Sheet — see ManpowerEntrySheet — since it's a sub-form within an
 *  already-a-page Edit Entry flow). */
export function ManpowerEntryFormPage(props: {
  ownerId: string;
  projectId: string;
  rows: CMManpowerRow[];
  editIndex: number | null;
  companyOptions: string[];
  tradeOptions: string[];
  onSave: (next: CMManpowerRow[]) => Promise<void>;
  onClose: () => void;
  backTo: string;
}) {
  return (
    <ManpowerEntryFields {...props}
      renderShell={(title, content) => <FormPage title={title} backTo={props.backTo}>{content}</FormPage>} />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
  </svg>
);

/** Like PhotoPicker but for approval documents of any type (PDF, DWG,
 *  DOCX, XLSX, images...) — no `accept` restriction. Pending images show
 *  as real thumbnails (same as PhotoPicker); everything else shows as a
 *  filename+size chip since it isn't renderable as a picture. */
export function FilePicker({ files, setFiles, disabled }: { files: File[]; setFiles: (fn: (f: File[]) => File[]) => void; disabled: boolean }) {
  const { t } = useCMLang();
  const indexed = files.map((f, i) => ({ f, i }));
  const images = indexed.filter(({ f }) => f.type.startsWith("image/"));
  const docs = indexed.filter(({ f }) => !f.type.startsWith("image/"));
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{t("common.files")}</span>
      <input type="file" multiple disabled={disabled}
        onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])}
        className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {images.map(({ f, i }) => (
            <div key={i} className="relative w-16 h-16">
              <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover" />
              <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {docs.map(({ f, i }) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="text-white/40 shrink-0">{FILE_ICON}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-white/80 truncate">{f.name}</p>
                <p className="text-[10px] text-white/30">{formatFileSize(f.size)}</p>
              </div>
              <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 w-5 h-5 rounded-full text-white/25 hover:text-red-400 flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
    </label>
  );
}

/** Read-only list of already-uploaded CMFileAttachments. Images render as
 *  real picture thumbnails (like a photo grid); everything else renders
 *  as a filename+size chip. Both open the file in a new tab (signed URL,
 *  so no extra fetch needed). */
export function FileAttachmentList({ files }: { files: CMFileAttachment[] }) {
  if (files.length === 0) return null;
  const images = files.filter((f) => f.type.startsWith("image/"));
  const docs = files.filter((f) => !f.type.startsWith("image/"));
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer">
              <img src={f.url} alt={f.name} className="w-16 h-16 rounded-xl object-cover" />
            </a>
          ))}
        </div>
      )}
      {docs.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-3 py-2">
          <span className="text-white/40 shrink-0">{FILE_ICON}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-white/80 truncate">{f.name}</p>
            <p className="text-[10px] text-white/30">{formatFileSize(f.size)}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

/** Prominent orange pill button matching Site Diary's Capture button —
 *  opens QuickUploadSheet for modules that just need a quick file-first
 *  record instead of Site Diary's full purpose-routing flow. */
export function QuickUploadButton({ label, onFilesSelected }: { label: string; onFilesSelected: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 mb-4 text-[13px] font-bold uppercase tracking-widest text-black transition-transform active:scale-[0.98]"
        style={{ backgroundColor: "#ff5100" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        {label}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => {
        const picked = Array.from(e.target.files ?? []);
        if (picked.length > 0) onFilesSelected(picked);
        e.target.value = "";
      }} />
    </>
  );
}

/** Generic "Upload File" quick-create sheet — pick file(s) first, then a
 *  title (auto-filled from the first file's name, still editable), saved
 *  as a brand-new record via the caller's onSubmit (which wraps that
 *  module's own minimal-required-field create function). Mirrors Site
 *  Diary's Capture flow without the purpose-routing step, since each
 *  host module is already the purpose. */
export function QuickUploadSheet({ sheetTitle, titleLabel, titlePlaceholder, initialFiles, onClose, onSubmit }: {
  sheetTitle: string;
  titleLabel: string;
  titlePlaceholder?: string;
  initialFiles?: File[];
  onClose: () => void;
  onSubmit: (title: string, files: File[]) => Promise<void>;
}) {
  const { t } = useCMLang();
  const [title, setTitle] = useState(() => initialFiles && initialFiles.length > 0 ? initialFiles[0].name.replace(/\.[^./]+$/, "") : "");
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleFilesChange = (fn: (f: File[]) => File[]) => {
    const next = fn(files);
    setFiles(next);
    if (!title.trim() && files.length === 0 && next.length > 0) {
      setTitle(next[0].name.replace(/\.[^./]+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit(title.trim(), files);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <Sheet title={sheetTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <FilePicker files={files} setFiles={handleFilesChange} disabled={saving} />
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{titleLabel}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titlePlaceholder} required disabled={saving} />
        </label>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full rounded-2xl py-3.5 text-[13px] font-bold uppercase tracking-widest text-black transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("quickUpload.saving") : t("quickUpload.save")}
        </button>
      </form>
    </Sheet>
  );
}

const LAST_PROJECT_KEY = "cm_last_project_id";

/** Set by /cm/join/$token before sending an unauthenticated visitor
 *  through Google sign-in, so the OAuth callback knows to route them
 *  back to finish accepting the invite instead of landing on /cm. */
export const PENDING_INVITE_KEY = "cm_pending_invite_token";

/** Remembers the last project picked across all modules, so returning to any
 *  module (Site Diary, Punch List, Inspection, Safety, Submittal) defaults to
 *  wherever the user was last working — the point is speed, not reselecting. */
export function useSelectedProject(userId: string | undefined) {
  const { data: projects } = useCMProjects(userId);
  const [projectId, setProjectIdState] = useState<string>(() => {
    try { return localStorage.getItem(LAST_PROJECT_KEY) ?? ""; } catch { return ""; }
  });

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const stillExists = projects.some((p) => p.id === projectId);
    if (!projectId || !stillExists) setProjectIdState(projects[0].id);
  }, [projects, projectId]);

  const setProjectId = (id: string) => {
    setProjectIdState(id);
    try { localStorage.setItem(LAST_PROJECT_KEY, id); } catch { /* */ }
  };

  return { projects: projects ?? [], projectId, setProjectId };
}

/** Points the "last selected project" at a specific project before navigating
 *  to a module page that has no per-record deep-link of its own (e.g.
 *  Manpower, Photos) — so the destination opens scoped to the right project
 *  even when the jump happened from an "All projects" view. */
export function setLastProject(projectId: string) {
  try { localStorage.setItem(LAST_PROJECT_KEY, projectId); } catch { /* */ }
}

export interface SegmentedOption<T extends string> {
  value: T; label: string; color?: string; icon?: React.ReactNode;
  badge?: string | number;
}

/** A single-row, swipe-to-browse tap-to-select tab bar — the fast alternative
 *  to a native <select> (one tap instead of open-then-choose) for any small,
 *  fixed option set: module pickers, status changes, language, etc. */
export function SegmentedField<T extends string>({ options, value, onChange, disabled }: {
  options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button key={opt.value} type="button" disabled={disabled} onClick={() => onChange(opt.value)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
              opt.color ? "bg-white/5" : active ? "" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
            style={
              opt.color
                ? { color: opt.color, boxShadow: active ? `inset 0 0 0 1.5px ${opt.color}` : undefined }
                : active ? { backgroundColor: "#ff5100", color: "#000" } : undefined
            }
          >
            {opt.icon}
            {opt.label}
            {opt.badge != null && opt.badge !== "" && (
              <span className="px-1.5 rounded-full font-mono text-[10px] leading-[15px]"
                style={{ backgroundColor: active ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)" }}>
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ProjectPicker({ projects, value, onChange }: { projects: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  const { t } = useCMLang();
  if (projects.length === 0) {
    return (
      <p className="text-[12px] text-white/40 mb-5">
        {t("common.createProjectFirst")} <Link to="/cm/projects" className="underline" style={{ color: "#ff5100" }}>{t("common.project")}</Link> {t("common.first")}
      </p>
    );
  }
  return (
    <FieldSelect
      className="mb-5"
      value={value}
      onChange={onChange}
      options={projects.map((p) => ({ value: p.id, label: p.name }))}
    />
  );
}

/* ── Photo lightbox: pinch/double-tap zoom, swipe, filmstrip, save/share/show-in-report ── */

export interface PhotoLightboxItem {
  url: string;
  thumbUrl?: string;
  recordId?: string;
  module?: CMPhotoModule;
  projectId?: string;
  projectName?: string;
  caption?: string | null;
}

export const MODULE_ROUTES: Record<CMPhotoModule, "/cm/site-diary" | "/cm/inspection" | "/cm/punch-list" | "/cm/safety" | "/cm/submittal"> = {
  siteDiary: "/cm/site-diary",
  inspection: "/cm/inspection",
  punchList: "/cm/punch-list",
  safety: "/cm/safety",
  submittal: "/cm/submittal",
};

/** Jumps straight to a record's own full page instead of its module's list
 *  page — used by every "show in report"/deep-link caller (Photos gallery,
 *  Reports' Today's Activity, Site Diary's own activity rows) now that each
 *  record has a dedicated view. */
export function moduleDetailRoute(module: CMPhotoModule, recordId: string) {
  return { to: `${MODULE_ROUTES[module]}/$id` as const, params: { id: recordId } };
}

export const MODULE_COLOR: Record<CMPhotoModule, string> = {
  siteDiary: "#3b82f6",
  inspection: "#22c55e",
  punchList: "#a855f7",
  safety: "#ef4444",
  submittal: "#06b6d4",
};

export const MODULE_ICON: Record<CMPhotoModule, React.ReactNode> = {
  siteDiary: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="13" height="16" rx="2" /><path d="M8 8.5h5M8 12.5h5" /><path d="M15.3 15.6l4-4 2 2-4 4h-2v-2z" />
    </svg>
  ),
  inspection: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.2" cy="10.2" r="6.4" /><path d="M7.3 10.4l1.9 1.9 3.7-3.7" /><path d="M14.8 14.8L20 20" />
    </svg>
  ),
  punchList: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  safety: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.3 15.2a7.7 7.7 0 0 1 15.4 0" /><rect x="2.8" y="15.2" width="18.4" height="2.8" rx="1.4" />
      <path d="M12 6.3V3.4" /><path d="M12 3.4h2.2" />
    </svg>
  ),
  submittal: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
};

const PENDING_HIGHLIGHT_KEY = "cm_pending_highlight";

interface PendingHighlight { module: CMPhotoModule; recordId: string; photoUrl?: string }

/** Stashes where a photo lives so the destination module page can jump straight
 *  to it — the "Show in report" counterpart of Telegram's "Show in chat". */
export function setPendingHighlight(module: CMPhotoModule, recordId: string, projectId: string, photoUrl: string) {
  try {
    const pending: PendingHighlight = { module, recordId, photoUrl };
    sessionStorage.setItem(PENDING_HIGHLIGHT_KEY, JSON.stringify(pending));
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch { /* */ }
}

function consumePendingHighlight(module: CMPhotoModule, recordId: string): PendingHighlight | null {
  try {
    const raw = sessionStorage.getItem(PENDING_HIGHLIGHT_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingHighlight;
    if (pending.module === module && pending.recordId === recordId) {
      sessionStorage.removeItem(PENDING_HIGHLIGHT_KEY);
      return pending;
    }
  } catch { /* */ }
  return null;
}

/** Auto-expands, scrolls to, and briefly flashes a card when the router just
 *  arrived here via a "Show in report" jump from the Photos gallery. */
export function usePendingHighlight(module: CMPhotoModule, recordId: string, onMatch?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  const [matchedPhotoUrl, setMatchedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const pending = consumePendingHighlight(module, recordId);
    if (!pending) return;
    onMatch?.();
    setFlash(true);
    setMatchedPhotoUrl(pending.photoUrl ?? null);
    const t1 = setTimeout(() => {
      const target = pending.photoUrl
        ? (document.querySelector(`[data-photo-url="${CSS.escape(pending.photoUrl)}"]`) as HTMLElement | null)
        : null;
      (target ?? ref.current)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const t2 = setTimeout(() => setFlash(false), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, flash, matchedPhotoUrl };
}

function ZoomableImage({ src, onSwipeLeft, onSwipeRight }: { src: string; onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number }; moved: boolean } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const lastTapRef = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      dragRef.current = null;
    } else if (pointers.current.size === 1) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: pos, moved: false };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(Math.min(4, Math.max(1, pinchRef.current.scale * (dist / pinchRef.current.dist))));
    } else if (dragRef.current && pointers.current.size === 1) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
      setPos(scale > 1 ? { x: dragRef.current.startPos.x + dx, y: dragRef.current.startPos.y + dy } : { x: dx, y: 0 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    setDragging(false);
    const drag = dragRef.current;
    if (scale <= 1 && drag) {
      if (pos.x < -80) onSwipeLeft();
      else if (pos.x > 80) onSwipeRight();
      setPos({ x: 0, y: 0 });
    }
    if (drag && !drag.moved) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setScale((s) => (s > 1 ? 1 : 2.2));
        setPos({ x: 0, y: 0 });
      }
      lastTapRef.current = now;
    }
    dragRef.current = null;
    pinchRef.current = null;
  };

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden touch-none select-none"
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)" }} />
    </div>
  );
}

type AnnotationTool = "arrow" | "circle" | "text";
interface AnnotationBase { color: string }
type Annotation =
  | (AnnotationBase & { type: "arrow"; x1: number; y1: number; x2: number; y2: number })
  | (AnnotationBase & { type: "circle"; x1: number; y1: number; x2: number; y2: number })
  | (AnnotationBase & { type: "text"; x: number; y: number; text: string });

const ANNOTATION_COLORS = ["#ff3b30", "#ffd60a", "#34c759", "#ffffff"];

function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation) {
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  if (a.type === "arrow") {
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    const headLen = 16;
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - headLen * Math.cos(angle - Math.PI / 7), a.y2 - headLen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(a.x2 - headLen * Math.cos(angle + Math.PI / 7), a.y2 - headLen * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  } else if (a.type === "circle") {
    const r = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
    ctx.beginPath();
    ctx.arc(a.x1, a.y1, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.font = "bold 22px sans-serif";
    ctx.textBaseline = "top";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.strokeText(a.text, a.x, a.y);
    ctx.fillText(a.text, a.x, a.y);
  }
}

/** Freeform arrow/circle/text markup drawn onto a copy of the photo — the
 *  original stored record is untouched; "Done" saves the annotated result
 *  as a new downloaded image, the same way the lightbox's existing "Save"
 *  action works, rather than replacing the photo in whichever module owns it. */
function AnnotationEditor({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const { t } = useCMLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<AnnotationTool>("arrow");
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [liveShape, setLiveShape] = useState<Annotation | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const maxW = containerRef.current?.clientWidth ?? img.naturalWidth;
      const maxH = containerRef.current?.clientHeight ?? img.naturalHeight;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setCanvasSize({ w: Math.round(img.naturalWidth * ratio), h: Math.round(img.naturalHeight * ratio) });
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || canvasSize.w === 0) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvasSize.w, canvasSize.h);
    for (const a of annotations) drawAnnotation(ctx, a);
    if (liveShape) drawAnnotation(ctx, liveShape);
  }, [annotations, liveShape, canvasSize]);

  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPoint(e);
    if (tool === "text") {
      setPendingText(p);
      setTextValue("");
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drawStartRef.current = p;
    setLiveShape({ type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawStartRef.current) return;
    const p = canvasPoint(e);
    setLiveShape({ type: tool as "arrow" | "circle", x1: drawStartRef.current.x, y1: drawStartRef.current.y, x2: p.x, y2: p.y, color });
  };

  const handlePointerUp = () => {
    if (!drawStartRef.current || !liveShape) return;
    setAnnotations((prev) => [...prev, liveShape]);
    setLiveShape(null);
    drawStartRef.current = null;
  };

  const commitText = () => {
    if (pendingText && textValue.trim()) {
      setAnnotations((prev) => [...prev, { type: "text", x: pendingText.x, y: pendingText.y, text: textValue.trim(), color }]);
    }
    setPendingText(null);
    setTextValue("");
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) onDone(blob); }, "image/jpeg", 0.92);
  };

  const TOOL_ICON: Record<AnnotationTool, React.ReactNode> = {
    arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19L19 5" /><path d="M9 5h10v10" /></svg>,
    circle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /></svg>,
    text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14M12 5v14" /></svg>,
  };

  return (
    <div className="fixed inset-0 z-[210] bg-[#000] flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shrink-0">
        <button onClick={onCancel} className="text-[13px] text-white/[0.70] hover:text-white px-2 py-1.5">{t("common.cancel")}</button>
        <p className="text-[12px] font-bold text-white/[0.85]">{t("photos.annotate")}</p>
        <button onClick={handleDone} className="text-[13px] font-bold px-3 py-1.5 rounded-full text-black" style={{ backgroundColor: "#ff5100" }}>{t("common.done")}</button>
      </div>

      <div ref={containerRef} className="flex-1 relative min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
          className="touch-none max-w-full max-h-full" style={{ width: canvasSize.w || undefined, height: canvasSize.h || undefined }} />
        {pendingText && (
          <input
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") { setPendingText(null); setTextValue(""); } }}
            style={{ position: "absolute", left: pendingText.x, top: pendingText.y, color, minWidth: 40 }}
            className="bg-transparent border-b border-dashed border-white/50 text-[22px] font-bold outline-none"
          />
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shrink-0">
        <div className="flex items-center justify-center gap-2">
          {ANNOTATION_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c}
              className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: c, outline: color === c ? "2px solid white" : "none", outlineOffset: 2 }} />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          {(["arrow", "circle", "text"] as AnnotationTool[]).map((tt) => (
            <button key={tt} onClick={() => setTool(tt)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={tool === tt ? { backgroundColor: "#ff5100", color: "#000" } : { backgroundColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.80)" }}>
              {TOOL_ICON[tt]}
            </button>
          ))}
          <button onClick={() => setAnnotations((prev) => prev.slice(0, -1))} disabled={annotations.length === 0}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.10] text-white/[0.80] disabled:opacity-30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PhotoLightbox({ items, index, onIndexChange, onClose, onShowInReport, onDelete }: {
  items: PhotoLightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onShowInReport?: (item: PhotoLightboxItem) => void;
  onDelete?: (item: PhotoLightboxItem) => void | Promise<void>;
}) {
  const { t } = useCMLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const item = items[index];

  useEffect(() => {
    filmstripRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `photo-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setToast(t("photos.saved"));
    } catch {
      window.open(item.url, "_blank");
      setToast(t("photos.saveFailed"));
    }
  };

  const handleShare = async () => {
    setMenuOpen(false);
    const result = await sharePhotoFiles([item.url]);
    if (result === "copied") setToast(t("photos.linkCopied"));
    else if (result === "failed") setToast(t("photos.shareFailed"));
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    setConfirmingDelete(false);
    if (!onDelete) return;
    await onDelete(item);
  };

  const goPrev = () => index > 0 && onIndexChange(index - 1);
  const goNext = () => index < items.length - 1 && onIndexChange(index + 1);

  const handleAnnotationDone = (blob: Blob) => {
    setAnnotating(false);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `photo-annotated-${Date.now()}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setToast(t("photos.annotateSaved"));
  };

  if (annotating) {
    return <AnnotationEditor src={item.url} onCancel={() => setAnnotating(false)} onDone={handleAnnotationDone} />;
  }

  // This viewer is meant to stay a dark, immersive overlay no matter which app
  // theme is active — every color below uses a bracket-arbitrary Tailwind value
  // instead of the plain opacity shorthand, since the app's light-mode
  // stylesheet force-flips shorthand classes like text-white/60 to a dark
  // color globally, which would make this always-dark chrome unreadable.
  return (
    <div className="fixed inset-0 z-[200] bg-[#000] flex flex-col">
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.10] text-white/[0.80] hover:text-white shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        <div className="text-center min-w-0 px-2 flex-1">
          {item.projectName && <p className="text-[12px] font-bold text-white/[0.90] truncate">{item.projectName}</p>}
          {items.length > 1 && <p className="font-mono text-[10px] text-white/[0.45]">{t("photos.counter", { current: String(index + 1), total: String(items.length) })}</p>}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.10] text-white/[0.80] hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-52 rounded-2xl bg-[#181818] border border-white/[0.10] overflow-hidden shadow-xl">
              {onShowInReport && item.recordId && (
                <button onClick={() => { setMenuOpen(false); onShowInReport(item); }}
                  className="w-full text-left px-4 py-3 text-[13px] text-white/[0.85] hover:bg-white/[0.05] border-b border-white/[0.06]">
                  {t("photos.showInReport")}
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); setAnnotating(true); }} className="w-full text-left px-4 py-3 text-[13px] text-white/[0.85] hover:bg-white/[0.05] border-b border-white/[0.06]">{t("photos.annotate")}</button>
              <button onClick={handleSave} className="w-full text-left px-4 py-3 text-[13px] text-white/[0.85] hover:bg-white/[0.05] border-b border-white/[0.06]">{t("photos.save")}</button>
              <button onClick={handleShare} className={`w-full text-left px-4 py-3 text-[13px] text-white/[0.85] hover:bg-white/[0.05] ${onDelete ? "border-b border-white/[0.06]" : ""}`}>{t("photos.share")}</button>
              {onDelete && (
                <button onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }} className="w-full text-left px-4 py-3 text-[13px] text-red-400 hover:bg-white/[0.05]">{t("photos.delete")}</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0" onClick={() => setMenuOpen(false)}>
        <ZoomableImage key={item.url} src={item.url} onSwipeLeft={goNext} onSwipeRight={goPrev} />
      </div>

      {item.caption && <p className="px-6 pb-2 text-center text-[12px] text-white/[0.60] truncate shrink-0">{item.caption}</p>}

      {items.length > 1 && (
        <div ref={filmstripRef}
          className="flex gap-2 overflow-x-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 shrink-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}>
          {items.map((it, i) => (
            <button key={`${it.url}-${i}`} data-idx={i} onClick={() => onIndexChange(i)}
              className="shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-opacity"
              style={{ outline: i === index ? "2px solid #ff5100" : "none", opacity: i === index ? 1 : 0.5 }}>
              <img src={it.thumbUrl ?? it.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {toast && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/[0.15] backdrop-blur text-[12px] text-white/[0.95] z-30">{toast}</div>}
      {confirmingDelete && (
        <ConfirmationDialog message={t("photos.deleteConfirm")} confirmLabel={t("photos.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

interface CMDailyActivityRow {
  module: CMPhotoModule;
  recordId: string;
  title: string;
  status: string;
}

/** Read-only "Today's Activity" list — one tappable row per Inspection/
 *  Safety/Punch List/Submittal item for a given day, shared by Site Diary
 *  and Reports. Deep-links via the same setPendingHighlight +
 *  MODULE_ROUTES flash-and-scroll pattern used for photo-to-record
 *  navigation. Renders nothing when the day has no cross-module activity. */
export function CMDailyActivityList({ activity, projectId, onOpenItem }: {
  activity: CMDailyActivity | undefined;
  projectId: string;
  onOpenItem: (module: CMPhotoModule, recordId: string, projectId: string) => void;
}) {
  const { t } = useCMLang();
  if (!activity) return null;

  const rows: CMDailyActivityRow[] = [
    ...activity.inspections.map((r) => ({ module: "inspection" as const, recordId: r.id, title: r.title, status: r.status })),
    ...activity.safetyRecords.map((r) => ({ module: "safety" as const, recordId: r.id, title: r.title, status: r.status })),
    ...activity.tasks.map((r) => ({ module: "punchList" as const, recordId: r.id, title: r.title, status: r.status })),
    ...activity.submittals.map((r) => ({ module: "submittal" as const, recordId: r.id, title: r.title, status: r.status })),
  ];
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls}>{t("siteDiary.todaysActivity")}</span>
      {rows.map((row) => (
        <button key={`${row.module}-${row.recordId}`} type="button" onClick={() => onOpenItem(row.module, row.recordId, projectId)}
          className="w-full flex items-center gap-2.5 rounded-xl bg-white/3 hover:bg-white/6 px-3 py-2 text-left transition-colors">
          <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ color: MODULE_COLOR[row.module], backgroundColor: `${MODULE_COLOR[row.module]}22` }}>
            {MODULE_ICON[row.module]}
          </span>
          <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate">{row.title}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{row.status}</span>
        </button>
      ))}
    </div>
  );
}

/** Per-record comments thread — shared across every module's detail view
 *  so discussion on any record (site diary, inspection, punch item, safety
 *  record, submittal, ...) looks and behaves the same. */
export function CommentsPanel({ projectId, entityType, entityId, userId }: {
  projectId: string; entityType: string; entityId: string; userId: string;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: comments, isLoading } = useCMComments(entityType, entityId);
  const { data: members } = useCMProjectMembers(projectId);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_comments", entityType, entityId] });

  const authorLabel = (authorId: string) => {
    const m = members?.find((x) => x.user_id === authorId);
    return m?.display_name || m?.email || t("comments.unknownUser");
  };

  const handlePost = async () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await addCMComment(projectId, entityType, entityId, userId, trimmed);
      setBody("");
      invalidate();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <p className="text-white/30 text-[12px]">{t("common.loading")}</p>}
      {!isLoading && (comments?.length ?? 0) === 0 && <p className="text-white/30 text-[12px]">{t("comments.none")}</p>}
      <div className="flex flex-col gap-2">
        {(comments ?? []).map((c) => (
          <div key={c.id} className="rounded-xl bg-white/3 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-bold text-white/70 truncate">{authorLabel(c.author_id)}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[9px] text-white/25">{c.created_at.slice(0, 16).replace("T", " ")}</span>
                {c.author_id === userId && (
                  <button type="button" onClick={() => deleteCMComment(c.id).then(invalidate)}
                    className="text-white/25 hover:text-red-400 w-4 h-4 flex items-center justify-center">×</button>
                )}
              </div>
            </div>
            <p className="text-[12px] text-white/70 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-end">
        <textarea className={`${inputCls} flex-1 resize-y min-h-[44px]`} value={body} disabled={posting}
          onChange={(e) => setBody(e.target.value)} placeholder={t("comments.placeholder")} />
        <button type="button" onClick={handlePost} disabled={posting || !body.trim()}
          className="px-4 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest text-black font-bold disabled:opacity-40 shrink-0"
          style={{ backgroundColor: "#ff5100" }}>
          {t("comments.post")}
        </button>
      </div>
    </div>
  );
}

/** Related records from other modules that share this record's location or
 *  discipline — see useCMRelatedItems for exactly what "related" means
 *  given what the schema actually links today. */
export function RelatedItemsPanel({ items }: { items: CMRelatedItem[] }) {
  const { t } = useCMLang();
  if (items.length === 0) return <p className="text-white/30 text-[12px]">{t("relatedItems.none")}</p>;
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <Link key={`${item.module}-${item.id}`} to={item.to}
          className="flex items-center gap-2.5 rounded-xl bg-white/3 hover:bg-white/6 px-3 py-2.5 transition-colors">
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ color: MODULE_COLOR[item.module], backgroundColor: `${MODULE_COLOR[item.module]}22` }}>
            {MODULE_ICON[item.module]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-white/70 truncate">{item.title}</p>
            {item.docNumber && <p className="font-mono text-[9px] text-white/25">{item.docNumber}</p>}
          </div>
          <span className="text-white/25 shrink-0">›</span>
        </Link>
      ))}
    </div>
  );
}

/** Per-record activity history — distinct from the project-level Insight
 *  Activity tab, this is scoped to one entity_id so a record's own history
 *  survives regardless of how much other activity happens on the project. */
export function ActivityLogPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { t } = useCMLang();
  const { data: entries, isLoading } = useCMEntityAuditLog(entityType, entityId);
  if (isLoading) return <p className="text-white/30 text-[12px]">{t("common.loading")}</p>;
  if (!entries || entries.length === 0) return <p className="text-white/30 text-[12px]">{t("activityLog.none")}</p>;
  return (
    <div className="flex flex-col gap-1">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 px-1 py-1.5">
          <span className="text-[12px] text-white/60">{e.action}</span>
          <span className="font-mono text-[9px] text-white/25 shrink-0">{e.created_at.slice(0, 16).replace("T", " ")}</span>
        </div>
      ))}
    </div>
  );
}

/** Read-only view of the approval chain configured for this module in
 *  Project Settings → Workflows (spec section 35). Only surfaces the
 *  configured steps — it doesn't track per-record approval state, since
 *  that would need a new "who has signed off on this specific record"
 *  table the schema doesn't have yet. */
export function ApprovalChainPanel({ projectId, entityType }: { projectId: string; entityType: string }) {
  const { t } = useCMLang();
  const { data: steps } = useCMWorkflowSteps(projectId);
  const moduleSteps = (steps ?? []).filter((s) => s.module_key === entityType);
  if (moduleSteps.length === 0) return <p className="text-white/30 text-[12px]">{t("approvals.none")}</p>;
  return (
    <div className="flex flex-col gap-2">
      {moduleSteps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5">
          <span className="font-mono text-[10px] text-white/30 shrink-0">{i + 1}.</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-white/80 truncate">{s.approver_value}</p>
            <p className="text-[10px] text-white/35">
              {t(`workflows.approverType.${s.approver_type}`)}
              {s.required_comment && ` · ${t("workflows.requiresComment")}`}
              {s.required_signature && ` · ${t("workflows.requiresSignature")}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bundles Comments + Related Items + Activity Log + Approval Chain behind
 *  one tab switcher so every module's record-detail view wires this in with
 *  a single call instead of duplicating the same panel-tab logic five times. */
export function RecordDetailExtras({ projectId, entityType, module, entityId, userId, locationId, discipline }: {
  projectId: string;
  /** Key used for comments/audit-log/workflow-step rows — matches the
   *  doc-numbering module keys (site_diary/inspection/punch_list/safety/
   *  submittal), which is snake_case for two of these and so isn't always
   *  identical to CMPhotoModule (siteDiary/punchList are camelCase there). */
  entityType: string;
  /** The CMPhotoModule value — used only for related-item icon/color
   *  lookups, kept separate from entityType because of the casing split
   *  above. */
  module: CMPhotoModule;
  entityId: string; userId: string;
  locationId?: string | null; discipline?: string | null;
}) {
  const { t } = useCMLang();
  const [tab, setTab] = useState<"comments" | "related" | "activity" | "approvals">("comments");
  const relatedItems = useCMRelatedItems(projectId, { module, id: entityId, locationId, discipline });

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-white/6">
      <SegmentedField
        options={[
          { value: "comments" as const, label: t("comments.title") },
          { value: "related" as const, label: t("relatedItems.title") },
          { value: "activity" as const, label: t("activityLog.title") },
          { value: "approvals" as const, label: t("approvals.title") },
        ]}
        value={tab} onChange={setTab}
      />
      {tab === "comments" && <CommentsPanel projectId={projectId} entityType={entityType} entityId={entityId} userId={userId} />}
      {tab === "related" && <RelatedItemsPanel items={relatedItems} />}
      {tab === "activity" && <ActivityLogPanel entityType={entityType} entityId={entityId} />}
      {tab === "approvals" && <ApprovalChainPanel projectId={projectId} entityType={entityType} />}
    </div>
  );
}

/** Header icon showing an unread-count badge, linking to /cm/notifications.
 *  Polls via useCMNotifications' refetchInterval rather than a realtime
 *  subscription — consistent with the rest of the app's data layer. */
export function NotificationBell({ userId }: { userId: string | undefined }) {
  const { t } = useCMLang();
  const { data: notifications } = useCMNotifications(userId);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  return (
    <Link to="/cm/notifications" aria-label={t("notifications.bell.title")}
      className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#ff5100] text-[9px] leading-[15px] font-bold text-black text-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
