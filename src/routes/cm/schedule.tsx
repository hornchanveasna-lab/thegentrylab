import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, Card, ProjectPicker, FieldSelect, LocationSelect, SegmentedField,
  useSelectedProject, inputCls, labelCls, ConfirmationDialog,
} from "@/components/cm/shared";
import {
  useCMScheduleItems,
  createCMScheduleItem,
  updateCMScheduleItem,
  deleteCMScheduleItem,
  scheduleItemPlanPercent,
  projectPlanPercent,
  cmScheduleStatus,
  cmBOQCategoryProgress,
  useActiveCMBOQItems,
  useCMDailyLogs,
  useCMProjectLocations,
  locationBreadcrumb,
  logCMActivity,
  type CMScheduleItem,
  type CMScheduleStatus,
} from "@/lib/cm-data";
import { parseWorkbookRows, type BoqSheet } from "@/lib/cm-boq-import";
import {
  detectScheduleHeaderRow, rowsToScheduleDraftActivities, SCHEDULE_IMPORT_FIELDS,
  type ScheduleColumnMapping,
} from "@/lib/cm-schedule-import";

const STATUS_COLOR: Record<CMScheduleStatus, string> = {
  "Not Started": "#94a3b8", "In Progress": "#60a5fa", Completed: "#34d399", Delayed: "#f43f5e",
};

export const Route = createFileRoute("/cm/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Construction Management App" }] }),
  component: CMSchedulePage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function varianceColor(actual: number, plan: number): string {
  if (actual >= plan - 3) return "#34d399";
  if (actual >= plan - 10) return "#fbbf24";
  return "#f43f5e";
}

function NewActivitySheet({ ownerId, projectId, groupOptions, boqCategoryOptions, onClose, onCreated }: {
  ownerId: string; projectId: string; groupOptions: string[]; boqCategoryOptions: string[];
  onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [groupLabel, setGroupLabel] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [boqCategory, setBoqCategory] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [planStart, setPlanStart] = useState(today());
  const [planFinish, setPlanFinish] = useState(today());
  const [weight, setWeight] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "planning">("details");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupLabel.trim() || !title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMScheduleItem(ownerId, projectId, {
        group_label: groupLabel.trim(), title: title.trim(),
        activity_code: code.trim() || null,
        boq_category: boqCategory || null,
        location_id: locationId,
        plan_start: planStart, plan_finish: planFinish,
        weight: Number(weight) || 1,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add activity");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("schedule.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("schedule.groupLabel")}</span>
          <input className={inputCls} list="schedule-group-options" value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} required autoFocus disabled={saving} />
          <datalist id="schedule-group-options">
            {groupOptions.map((g) => <option key={g} value={g} />)}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("schedule.activityTitle")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required disabled={saving} />
        </label>
        <SegmentedField value={tab} onChange={setTab} disabled={saving}
          options={[
            { value: "details" as const, label: t("schedule.newActivityDetailsTab") },
            { value: "planning" as const, label: t("schedule.planningTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("schedule.activityCode")}</span>
              <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SCH-021" disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("schedule.boqCategory")}</span>
              <FieldSelect
                value={boqCategory}
                onChange={setBoqCategory}
                disabled={saving}
                placeholder={t("projectSettings.none")}
                options={[{ value: "", label: t("projectSettings.none") }, ...boqCategoryOptions.map((c) => ({ value: c, label: c }))]}
              />
            </label>
          </div>
        )}

        {tab === "planning" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("manpower.location")}</span>
              <LocationSelect projectId={projectId} value={locationId} onChange={setLocationId} disabled={saving} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("schedule.planStart")}</span>
                <input type="date" className={inputCls} value={planStart} onChange={(e) => setPlanStart(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("schedule.planFinish")}</span>
                <input type="date" className={inputCls} value={planFinish} onChange={(e) => setPlanFinish(e.target.value)} disabled={saving} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("schedule.weight")}</span>
              <input type="number" min={0} step="0.1" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} disabled={saving} />
            </label>
          </div>
        )}

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !groupLabel.trim() || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("schedule.adding") : t("schedule.addActivity")}
        </button>
      </form>
    </Sheet>
  );
}

/** Same detect-then-confirm import flow as BOQ/Manpower. XER and MS Project
 *  XML are not parsed — the hint tells users to export to Excel first. */
function ImportScheduleSheet({ ownerId, projectId, onImported, onClose }: {
  ownerId: string; projectId: string; onImported: () => void; onClose: () => void;
}) {
  const { t } = useCMLang();
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [sheets, setSheets] = useState<BoqSheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [mapping, setMapping] = useState<ScheduleColumnMapping>({
    code: null, name: null, group: null, start: null, finish: null, progress: null, weight: null,
  });

  const handleFile = async (file: File) => {
    setError("");
    try {
      const parsed = (await parseWorkbookRows(file)).filter((s) => s.rows.length > 0);
      if (parsed.length === 0) { setError(t("boq.import.noRows")); return; }
      const withHeader = parsed.map((s, i) => ({ i, detected: detectScheduleHeaderRow(s.rows) })).find((x) => x.detected);
      if (!withHeader?.detected) { setError(t("boq.import.noHeaderFound")); return; }
      setSheets(parsed);
      setSheetIdx(withHeader.i);
      setHeaderRowIdx(withHeader.detected.rowIndex);
      setMapping(withHeader.detected.mapping);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const sheet = sheets[sheetIdx] as BoqSheet | undefined;
  const headerCells = sheet?.rows[headerRowIdx] ?? [];
  const columnOptions = headerCells.map((cell, i) => ({ value: String(i), label: String(cell || `Col ${i + 1}`) }));
  const drafts = useMemo(
    () => (sheet ? rowsToScheduleDraftActivities(sheet.rows, headerRowIdx, mapping, sheet.sheetName) : []),
    [sheet, headerRowIdx, mapping],
  );

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      const chunkSize = 20;
      for (let i = 0; i < drafts.length; i += chunkSize) {
        await Promise.all(drafts.slice(i, i + chunkSize).map((d) => createCMScheduleItem(ownerId, projectId, d)));
      }
      logCMActivity(projectId, ownerId, "schedule_imported", "schedule", null, { activities: drafts.length });
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import schedule");
      setImporting(false);
    }
  };

  return (
    <Sheet title={t("schedule.import.title")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
        {step === "upload" && (
          <>
            <p className="text-[12px] text-white/40">{t("schedule.import.uploadHint")}</p>
            <label className="flex flex-col items-center justify-center gap-3 py-10 rounded-3xl border border-dashed border-white/15 text-white/60 hover:border-white/30 cursor-pointer text-center transition-colors">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0-12l-4 4m4-4l4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              <span className="text-[13px] font-bold uppercase tracking-widest">{t("boq.import.chooseFile")}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </label>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
          </>
        )}
        {step === "review" && sheet && (
          <>
            <p className="text-[12px] text-white/40">{t("boq.import.reviewHint")}</p>
            {sheets.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("manpower.import.sheet")}</span>
                <FieldSelect
                  value={String(sheetIdx)}
                  onChange={(v) => {
                    const idx = Number(v);
                    setSheetIdx(idx);
                    const detected = detectScheduleHeaderRow(sheets[idx].rows);
                    setHeaderRowIdx(detected?.rowIndex ?? 0);
                    if (detected) setMapping(detected.mapping);
                  }}
                  options={sheets.map((s, i) => ({ value: String(i), label: s.sheetName }))}
                  disabled={importing}
                />
              </label>
            )}
            {SCHEDULE_IMPORT_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className={labelCls}>{t(`schedule.import.field.${field}`)}</span>
                <FieldSelect
                  value={mapping[field] != null ? String(mapping[field]) : ""}
                  onChange={(v) => setMapping((m) => ({ ...m, [field]: v === "" ? null : Number(v) }))}
                  placeholder={t("boq.import.notMapped")}
                  options={[{ value: "", label: t("boq.import.notMapped") }, ...columnOptions]}
                  disabled={importing}
                />
              </label>
            ))}
            <div className="rounded-xl bg-white/3 p-3 flex flex-col gap-1.5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{t("boq.import.preview")} — {sheet.sheetName}</p>
              {drafts.slice(0, 6).map((d, i) => (
                <p key={i} className="text-[11px] text-white/60 truncate">
                  {d.activity_code ? `${d.activity_code} · ` : ""}{d.title} — {d.plan_start} → {d.plan_finish}{d.actual_percent > 0 ? ` · ${d.actual_percent}%` : ""}
                </p>
              ))}
              {drafts.length === 0 && <p className="text-[11px] text-white/30">{t("boq.import.noItemsDetected")}</p>}
            </div>
            <div className="rounded-xl bg-white/3 p-3 text-[12px] text-white/60">
              {t("schedule.import.summary", { count: String(drafts.length), groups: String(new Set(drafts.map((d) => d.group_label)).size) })}
            </div>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <button type="button" onClick={handleImport} disabled={importing || drafts.length === 0}
              className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {importing ? t("boq.import.importing") : t("boq.import.confirmImport")}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function ActivityRow({ item, canEdit, canDelete, locationLabel, suggestedPct, onChanged }: {
  item: CMScheduleItem; canEdit: boolean; canDelete: boolean;
  locationLabel: string | null; suggestedPct: number | null; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const [actual, setActual] = useState(String(item.actual_percent));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const plan = scheduleItemPlanPercent(item, today());
  const status = cmScheduleStatus(item, today());
  // Only suggest forward movement — site records can't un-build work.
  const showSuggestion = canEdit && suggestedPct != null && suggestedPct > item.actual_percent;

  const applySuggestion = async () => {
    if (suggestedPct == null || busy) return;
    setBusy(true);
    try {
      await updateCMScheduleItem(item.id, { actual_percent: suggestedPct });
      setActual(String(suggestedPct));
      onChanged();
    } finally { setBusy(false); }
  };

  const commitActual = async () => {
    const value = Math.max(0, Math.min(100, Number(actual) || 0));
    if (value === item.actual_percent) return;
    setBusy(true);
    try { await updateCMScheduleItem(item.id, { actual_percent: value }); onChanged(); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMScheduleItem(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/3 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-white/80 truncate">
          {item.activity_code ? <span className="font-mono text-[10px] text-white/35">{item.activity_code} · </span> : null}
          {item.title}
        </p>
        <p className="font-mono text-[10px] text-white/30 truncate">
          {item.plan_start} → {item.plan_finish}
          {locationLabel ? ` · ${locationLabel}` : ""}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: STATUS_COLOR[status], backgroundColor: `${STATUS_COLOR[status]}1a` }}>
            {t(`schedule.status.${status.replace(/\s+/g, "")}`)}
          </span>
          {showSuggestion && (
            <button onClick={applySuggestion} disabled={busy}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-[#ff5100]/15 text-[#ff7a3d] hover:bg-[#ff5100]/25 transition-colors">
              {t("schedule.applySiteProgress", { pct: String(suggestedPct) })}
            </button>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[10px] text-white/35">{t("schedule.planPct")} {plan.toFixed(0)}%</p>
        <div className="flex items-center gap-1 mt-0.5">
          {canEdit ? (
            <input type="number" min={0} max={100} value={actual} disabled={busy}
              onChange={(e) => setActual(e.target.value)} onBlur={commitActual}
              className="w-14 text-right bg-white/5 rounded-lg border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white focus:outline-none focus:border-[#ff5100]/60" />
          ) : (
            <span className="font-mono text-[11px] text-white">{item.actual_percent}</span>
          )}
          <span className="font-mono text-[11px]" style={{ color: varianceColor(Number(actual) || 0, plan) }}>%</span>
        </div>
      </div>
      {canDelete && (
        <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="text-white/25 hover:text-red-400 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("schedule.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function GroupSection({ groupLabel, items, canEdit, canDelete, locationLabelById, suggestions, onChanged }: {
  groupLabel: string; items: CMScheduleItem[]; canEdit: boolean; canDelete: boolean;
  locationLabelById: Map<string, string>; suggestions: Map<string, number>; onChanged: () => void;
}) {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
  const groupPlan = items.reduce((s, i) => s + i.weight * scheduleItemPlanPercent(i, today()), 0) / totalWeight;
  const groupActual = items.reduce((s, i) => s + i.weight * i.actual_percent, 0) / totalWeight;

  return (
    <Card title={groupLabel} action={
      <span className="font-mono text-[10px]" style={{ color: varianceColor(groupActual, groupPlan) }}>
        {groupActual.toFixed(0)}% / {groupPlan.toFixed(0)}%
      </span>
    }>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} onChanged={onChanged}
            locationLabel={item.location_id ? locationLabelById.get(item.location_id) ?? null : null}
            suggestedPct={item.boq_category ? suggestions.get(item.boq_category) ?? null : null} />
        ))}
      </div>
    </Card>
  );
}

/** Simple mobile Gantt (spec §3): one shared time axis from the earliest
 *  plan start to the latest plan finish, a plan bar per activity with an
 *  actual-progress fill, and a today line. No dependencies/critical path —
 *  this is deliberately not Primavera. */
function GanttView({ groups }: { groups: [string, CMScheduleItem[]][] }) {
  const all = groups.flatMap(([, items]) => items);
  const min = all.reduce((m, i) => (i.plan_start < m ? i.plan_start : m), all[0].plan_start);
  const max = all.reduce((m, i) => (i.plan_finish > m ? i.plan_finish : m), all[0].plan_finish);
  const span = Math.max(1, new Date(max).getTime() - new Date(min).getTime());
  const pct = (date: string) => Math.max(0, Math.min(100, ((new Date(date).getTime() - new Date(min).getTime()) / span) * 100));
  const todayPct = pct(today());
  const showToday = today() >= min && today() <= max;

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([groupLabel, items]) => (
        <div key={groupLabel} className="rounded-2xl bg-[#0d0d0e] px-4 py-3">
          <p className="text-[11px] text-white/60 font-medium mb-2">{groupLabel}</p>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => {
              const left = pct(item.plan_start);
              const width = Math.max(1.5, pct(item.plan_finish) - left);
              const status = cmScheduleStatus(item, today());
              return (
                <div key={item.id} className="flex items-center gap-2">
                  <p className="w-[38%] shrink-0 text-[10px] text-white/60 truncate">{item.title}</p>
                  <div className="flex-1 h-4 relative rounded bg-white/[0.03]">
                    {showToday && <div className="absolute top-0 bottom-0 w-px bg-[#ff5100]/60 pointer-events-none z-10" style={{ left: `${todayPct}%` }} />}
                    <div className="absolute top-0.5 bottom-0.5 rounded-sm bg-white/10 overflow-hidden" style={{ left: `${left}%`, width: `${width}%` }}>
                      <div className="h-full" style={{ width: `${item.actual_percent}%`, backgroundColor: STATUS_COLOR[status] }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CMSchedulePage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMScheduleItems(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const { data: logs } = useCMDailyLogs(projectId || undefined);
  const { data: locations } = useCMProjectLocations(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "schedule", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "schedule", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "schedule", "delete");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [view, setView] = useState<"list" | "gantt">("list");
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const locationLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations ?? []) map.set(l.id, locationBreadcrumb(l, locations ?? []));
    return map;
  }, [locations]);

  // Progress suggested by site records: delivered % of each activity's
  // linked BOQ category, from Site Diary deliveries (spec §7-9).
  const suggestions = useMemo(() => cmBOQCategoryProgress(boqItems ?? [], logs ?? []), [boqItems, logs]);

  // Spec §2 main-screen numbers, computed from the same items the list shows.
  const summary = useMemo(() => {
    const list = items ?? [];
    const d = today();
    const planned = projectPlanPercent(list, d);
    const totalWeight = list.reduce((s, i) => s + i.weight, 0) || 1;
    const actual = list.reduce((s, i) => s + i.weight * i.actual_percent, 0) / totalWeight;
    const dueToday = list.filter((i) => i.plan_start <= d && i.plan_finish >= d && i.actual_percent < 100).length;
    const overdue = list.filter((i) => i.plan_finish < d && i.actual_percent < 100).length;
    const delayed = list.filter((i) => cmScheduleStatus(i, d) === "Delayed").length;
    return { planned, actual, variance: actual - planned, dueToday, overdue, delayed };
  }, [items]);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_schedule_items", projectId] }); setShowNew(false); };

  const groupOptions = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.group_label))), [items]);
  const boqCategoryOptions = useMemo(
    () => Array.from(new Set((boqItems ?? []).map((b) => b.category).filter((c): c is string => !!c))),
    [boqItems],
  );

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items ?? [];
    if (q) list = list.filter((i) => [i.title, i.group_label].some((f) => f.toLowerCase().includes(q)));
    if (!sortAsc) list = [...list].reverse();
    const map = new Map<string, CMScheduleItem[]>();
    for (const item of list) {
      if (!map.has(item.group_label)) map.set(item.group_label, []);
      map.get(item.group_label)!.push(item);
    }
    return Array.from(map.entries());
  }, [items, search, sortAsc]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>{t("common.signInGoogle")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("schedule.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <p className="text-[12px] text-white/35 mb-5">{t("schedule.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {(items?.length ?? 0) > 0 && (
              <div className="rounded-2xl bg-[#0d0d0e] px-4 py-3.5 mb-3 grid grid-cols-5 gap-2">
                {[
                  { label: t("schedule.summary.planned"), value: `${summary.planned.toFixed(0)}%` },
                  { label: t("schedule.summary.actual"), value: `${summary.actual.toFixed(0)}%`, color: varianceColor(summary.actual, summary.planned) },
                  { label: t("schedule.summary.variance"), value: `${summary.variance >= 0 ? "+" : ""}${summary.variance.toFixed(0)}%`, color: varianceColor(summary.actual, summary.planned) },
                  { label: t("schedule.summary.dueToday"), value: summary.dueToday },
                  { label: t("schedule.summary.overdue"), value: summary.overdue, color: summary.overdue > 0 ? "#f43f5e" : undefined },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center gap-0.5 min-w-0">
                    <span className="font-mono text-[15px] leading-none" style={s.color ? { color: s.color } : undefined}>{s.value}</span>
                    <span className="text-[9px] uppercase tracking-widest text-white/30 text-center">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {(items?.length ?? 0) > 0 && (
                <SegmentedField
                  value={view}
                  onChange={setView}
                  options={[{ value: "list", label: t("schedule.view.list") }, { value: "gantt", label: t("schedule.view.gantt") }]}
                />
              )}
              {canCreate && (
                <button onClick={() => setShowImport(true)} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white/5 text-white/70 hover:bg-white/10 transition-colors">
                  {t("schedule.import.title")}
                </button>
              )}
            </div>

            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && groups.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("schedule.nothingYet")}</p>
              </div>
            )}
            {view === "gantt" && groups.length > 0 ? (
              <GanttView groups={groups} />
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map(([groupLabel, groupItems]) => (
                  <GroupSection key={groupLabel} groupLabel={groupLabel} items={groupItems} canEdit={canEdit} canDelete={canDelete}
                    locationLabelById={locationLabelById} suggestions={suggestions} onChanged={invalidate} />
                ))}
              </div>
            )}
            {canCreate && <FAB label={t("schedule.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && canCreate && (
        <NewActivitySheet ownerId={user.id} projectId={projectId} groupOptions={groupOptions} boqCategoryOptions={boqCategoryOptions}
          onClose={() => setShowNew(false)} onCreated={invalidate} />
      )}
      {showImport && projectId && canCreate && (
        <ImportScheduleSheet ownerId={user.id} projectId={projectId} onImported={invalidate} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
