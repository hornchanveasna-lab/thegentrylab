import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCMProjects, type CMProject, type CMPhotoModule, type CMDailyActivity, type EquipmentStatus, DISCIPLINES, type Discipline,
  useCMProjectLocations, locationBreadcrumb, useCMCompanies, createCMCompany,
} from "@/lib/cm-data";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";

export const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
export const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const fieldSelectTriggerCls = "w-full flex items-center justify-between gap-2 bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white disabled:opacity-40 transition-colors";

export interface FieldSelectOption<T extends string> {
  value: T;
  label: string;
}

export const EQUIPMENT_STATUS_OPTIONS: EquipmentStatus[] = ["Operational", "Maintenance", "Out of Service"];
export const EQUIPMENT_STATUS_COLOR: Record<EquipmentStatus, string> = { Operational: "#34d399", Maintenance: "#fbbf24", "Out of Service": "#f43f5e" };

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
  const updateRow = (i: number, patch: Partial<T>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>{label}</span>
      {rows.map((row, i) => (
        <div key={i} className="relative rounded-xl bg-white/[0.03] p-3 pr-9">
          {renderRow(row, (patch) => updateRow(i, patch))}
          <button type="button" onClick={() => removeRow(i)}
            className="absolute top-2 right-2 text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
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
export function FieldSelect<T extends string>({ value, options, onChange, className, triggerClassName, triggerStyle, disabled, placeholder, searchable, searchPlaceholder, allowCustom, onCreateCustom }: {
  value: T;
  options: FieldSelectOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
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
  const [search, setSearch] = useState("");
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
    <div className={`relative ${className ?? ""}`}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={triggerClassName ?? fieldSelectTriggerCls} style={triggerStyle}>
        <span className="truncate text-left">{selected?.label ?? placeholder ?? ""}</span>
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl overflow-hidden shadow-xl menu-surface backdrop-blur-xl">
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
        </>
      )}
    </div>
  );
}

/** Discipline picker shared across modules — thin wrapper over FieldSelect
 *  so every module presents the same discipline list the same way. */
export function DisciplineSelect({ value, onChange, disabled }: {
  value: Discipline | null; onChange: (v: Discipline | null) => void; disabled?: boolean;
}) {
  const { t } = useCMLang();
  return (
    <FieldSelect
      value={value ?? ""}
      onChange={(v) => onChange((v || null) as Discipline | null)}
      disabled={disabled}
      placeholder={t("common.selectDiscipline")}
      options={[{ value: "", label: t("common.none") }, ...DISCIPLINES.map((d) => ({ value: d, label: t(`discipline.${d}`) }))]}
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
export function ModuleHeader({ title, search, onSearchChange, searchPlaceholder, sortAsc, onToggleSort }: {
  title: string;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  sortAsc: boolean;
  onToggleSort: (v: boolean) => void;
}) {
  const { t } = useCMLang();
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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
      <div className="relative shrink-0">
        <button type="button" aria-label={t("common.sort")} onClick={() => setShowMenu((v) => !v)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const CALENDAR_MONTH_LOCALE: Record<CMLang, string> = { en: "en-US", km: "km-KH", zh: "zh-CN" };

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

export function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-7 right-6 w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_8px_24px_rgba(255,81,0,0.4)] active:scale-95 transition-transform z-30"
      style={{ backgroundColor: "#ff5100" }}
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

export interface SegmentedOption<T extends string> { value: T; label: string; color?: string }

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
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 ${
              opt.color ? "bg-white/5" : active ? "" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
            style={
              opt.color
                ? { color: opt.color, boxShadow: active ? `inset 0 0 0 1.5px ${opt.color}` : undefined }
                : active ? { backgroundColor: "#ff5100", color: "#000" } : undefined
            }
          >
            {opt.label}
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
    if (!onDelete || !window.confirm(t("photos.deleteConfirm"))) return;
    await onDelete(item);
  };

  const goPrev = () => index > 0 && onIndexChange(index - 1);
  const goNext = () => index < items.length - 1 && onIndexChange(index + 1);

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
              <button onClick={handleSave} className="w-full text-left px-4 py-3 text-[13px] text-white/[0.85] hover:bg-white/[0.05] border-b border-white/[0.06]">{t("photos.save")}</button>
              <button onClick={handleShare} className={`w-full text-left px-4 py-3 text-[13px] text-white/[0.85] hover:bg-white/[0.05] ${onDelete ? "border-b border-white/[0.06]" : ""}`}>{t("photos.share")}</button>
              {onDelete && (
                <button onClick={handleDelete} className="w-full text-left px-4 py-3 text-[13px] text-red-400 hover:bg-white/[0.05]">{t("photos.delete")}</button>
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
          className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2 text-left transition-colors">
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
