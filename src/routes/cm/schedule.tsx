import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FormPage, FAB, EmptyState, ProjectPicker, FieldSelect, LocationSelect, SegmentedField,
  useSelectedProject, inputCls, labelCls, ConfirmationDialog, useCMTheme,
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
  cmBOQItemProgress,
  useActiveCMBOQItems,
  createCMBOQItem,
  useCMDailyLogs,
  useCMProjectLocations,
  locationBreadcrumb,
  logCMActivity,
  useCMProject,
  useCMWBSNodes,
  useCMAiCredits,
  createCMWBSNode,
  updateCMWBSNode,
  deleteCMWBSNode,
  wbsBreadcrumb,
  wbsFlatten,
  wbsIsLeaf,
  type CMScheduleItem,
  type CMScheduleStatus,
  type CMBOQItem,
  type CMWBSNode,
} from "@/lib/cm-data";
import { resolveSetting, writeSettingAndSync, SETTING_DEFINITIONS } from "@/lib/cm-settings";
import { parseWorkbookRows, parsePdfRows, type BoqSheet } from "@/lib/cm-boq-import";
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

export function NewActivitySheet({ ownerId, projectId, groupOptions, boqCategoryOptions, boqItems, existing, backTo, onCreated }: {
  ownerId: string; projectId: string; groupOptions: string[]; boqCategoryOptions: string[]; boqItems?: CMBOQItem[];
  existing?: CMScheduleItem; backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [groupLabel, setGroupLabel] = useState(existing?.group_label ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [code, setCode] = useState(existing?.activity_code ?? "");
  const [boqCategory, setBoqCategory] = useState(existing?.boq_category ?? "");
  const [boqItemId, setBoqItemId] = useState(existing?.boq_item_id ?? "");
  const [wbsNodeId, setWbsNodeId] = useState(existing?.wbs_node_id ?? "");
  const [locationId, setLocationId] = useState<string | null>(existing?.location_id ?? null);
  const { data: wbsNodes } = useCMWBSNodes(projectId);
  const [planStart, setPlanStart] = useState(existing?.plan_start ?? today());
  const [planFinish, setPlanFinish] = useState(existing?.plan_finish ?? today());
  const [actualStart, setActualStart] = useState(existing?.actual_start ?? "");
  const [actualEnd, setActualEnd] = useState(existing?.actual_end ?? "");
  const [weight, setWeight] = useState(existing ? String(existing.weight) : "1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "planning">("details");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupLabel.trim() || !title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {
        group_label: groupLabel.trim(), title: title.trim(),
        activity_code: code.trim() || null,
        boq_category: boqCategory || null,
        boq_item_id: boqItemId || null,
        wbs_node_id: wbsNodeId || null,
        location_id: locationId,
        plan_start: planStart, plan_finish: planFinish,
        actual_start: actualStart || null, actual_end: actualEnd || null,
        weight: Number(weight) || 1,
      };
      if (existing) {
        await updateCMScheduleItem(existing.id, patch);
        logCMActivity(projectId, ownerId, "updated", "schedule", existing.id, { weight: patch.weight, title: patch.title });
      } else {
        await createCMScheduleItem(ownerId, projectId, patch, wbsNodes ?? []);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add activity");
      setSaving(false);
    }
  };

  return (
    <FormPage title={t(existing ? "schedule.edit" : "schedule.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            {boqItems && boqItems.length > 0 && (
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("schedule.boqItem")}</span>
                <FieldSelect
                  value={boqItemId}
                  onChange={setBoqItemId}
                  disabled={saving}
                  searchable
                  placeholder={t("projectSettings.none")}
                  options={[{ value: "", label: t("projectSettings.none") }, ...boqItems.map((b) => ({ value: b.id, label: b.description }))]}
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("schedule.wbsNode")}</span>
              <FieldSelect
                value={wbsNodeId} onChange={setWbsNodeId} disabled={saving} searchable
                placeholder={t("projectSettings.none")}
                options={[{ value: "", label: t("projectSettings.none") }, ...(wbsNodes ?? []).map((n) => ({ value: n.id, label: wbsBreadcrumb(n, wbsNodes ?? []) }))]}
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
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 -mb-1">{t("schedule.actualDatesHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("schedule.actualStart")}</span>
                <input type="date" className={inputCls} value={actualStart} onChange={(e) => setActualStart(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("schedule.actualFinish")}</span>
                <input type="date" className={inputCls} value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} disabled={saving || !actualStart} min={actualStart || undefined} />
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
    </FormPage>
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

  const { data: wbsNodes } = useCMWBSNodes(projectId);

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      // Pre-create every distinct group's folder up front, sequentially —
      // avoids a race where two concurrently-created activities under the
      // same brand-new group each spawn their own duplicate folder.
      let allNodes = [...(wbsNodes ?? [])];
      for (const group of new Set(drafts.map((d) => d.group_label))) {
        if (allNodes.some((n) => n.parent_id === null && n.level === "Group" && n.name === group)) continue;
        const folder = await createCMWBSNode(ownerId, projectId, { name: group, level: "Group", parent_id: null });
        allNodes = [...allNodes, folder];
      }
      const chunkSize = 20;
      for (let i = 0; i < drafts.length; i += chunkSize) {
        await Promise.all(drafts.slice(i, i + chunkSize).map((d) => createCMScheduleItem(ownerId, projectId, d, allNodes)));
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

function ActivityRow({ item, projectId, actorId, canEdit, canDelete, locationLabel, suggestedPct, delayThresholdPct, onChanged }: {
  item: CMScheduleItem; projectId: string; actorId: string; canEdit: boolean; canDelete: boolean;
  locationLabel: string | null; suggestedPct: number | null; delayThresholdPct: number; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const [actual, setActual] = useState(String(item.actual_percent));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const plan = scheduleItemPlanPercent(item, today());
  const status = cmScheduleStatus(item, today(), delayThresholdPct);
  // Only suggest forward movement — site records can't un-build work.
  const showSuggestion = canEdit && suggestedPct != null && suggestedPct > item.actual_percent;

  const applySuggestion = async () => {
    if (suggestedPct == null || busy) return;
    setBusy(true);
    try {
      await updateCMScheduleItem(item.id, { actual_percent: suggestedPct });
      logCMActivity(projectId, actorId, "updated", "schedule", item.id, { actual_percent: suggestedPct, title: item.title });
      setActual(String(suggestedPct));
      onChanged();
    } finally { setBusy(false); }
  };

  const commitActual = async () => {
    const value = Math.max(0, Math.min(100, Number(actual) || 0));
    if (value === item.actual_percent) return;
    setBusy(true);
    try {
      await updateCMScheduleItem(item.id, { actual_percent: value });
      logCMActivity(projectId, actorId, "updated", "schedule", item.id, { actual_percent: value, title: item.title });
      onChanged();
    } finally { setBusy(false); }
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
      {canEdit && (
        <Link to="/cm/schedule/$id/edit" params={{ id: item.id }}
          className="text-white/25 hover:text-white/70 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </Link>
      )}
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

/** WBS and Schedule share one underlying node tree (`cm_wbs_nodes`) — this
 *  page is the single place to browse and edit it, rather than splitting
 *  "structure" and "schedule" into two separate modules that both read the
 *  same table. A tree row is one of three things, decided purely from the
 *  node's own fields: a schedule activity (has plan dates — rendered via
 *  `ActivityRow`), a BOQ line item (has a quantity — shown inline), or a
 *  bare structural folder (rendered via `WBSNodeRow` with a weighted
 *  roll-up of every schedule activity in its subtree). */
const WBS_LEVEL_SUGGESTIONS = ["Zone", "Building", "Floor", "Area", "Discipline", "Work Category", "Item"];

function buildChildrenMap(nodes: CMWBSNode[]): Map<string | null, CMWBSNode[]> {
  const map = new Map<string | null, CMWBSNode[]>();
  for (const n of nodes) {
    if (!map.has(n.parent_id)) map.set(n.parent_id, []);
    map.get(n.parent_id)!.push(n);
  }
  return map;
}

/** Every schedule activity in `nodeId`'s subtree (including itself) — used
 *  to roll a weighted plan/actual % up to folder nodes that have no dates
 *  of their own. */
function subtreeScheduleItems(nodeId: string, childrenMap: Map<string | null, CMWBSNode[]>, scheduleById: Map<string, CMScheduleItem>): CMScheduleItem[] {
  const out: CMScheduleItem[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const item = scheduleById.get(id);
    if (item) out.push(item);
    for (const child of childrenMap.get(id) ?? []) stack.push(child.id);
  }
  return out;
}

function WBSNodeRow({ node, depth, isLeaf, rollup, canEdit, canDelete, editing, editValue, onStartEdit, onEditValueChange, onCommitEdit, onCancelEdit, onDelete }: {
  node: CMWBSNode; depth: number; isLeaf: boolean; rollup: { plan: number; actual: number } | null;
  canEdit: boolean; canDelete: boolean; editing: boolean; editValue: string;
  onStartEdit: () => void; onEditValueChange: (v: string) => void; onCommitEdit: () => void; onCancelEdit: () => void; onDelete: () => void;
}) {
  const { t } = useCMLang();
  return (
    <div className="rounded-xl bg-white/3 px-3 py-2.5" style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-3">
        {editing && canEdit ? (
          <input
            className="flex-1 min-w-0 bg-transparent text-[12px] text-white/80 focus:outline-none border-b border-[#ff5100]/60"
            value={editValue} autoFocus onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") onCancelEdit(); }}
          />
        ) : (
          <p onClick={canEdit ? onStartEdit : undefined} className={`text-[12px] text-white/80 flex-1 truncate ${canEdit ? "cursor-text" : ""}`}>
            {node.name}
          </p>
        )}
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{node.level}</span>
        {isLeaf && node.quantity == null && (
          <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>{t("wbs.leaf")}</span>
        )}
        {rollup && (
          <span className="font-mono text-[10px] shrink-0" style={{ color: varianceColor(rollup.actual, rollup.plan) }}>
            {rollup.actual.toFixed(0)}% / {rollup.plan.toFixed(0)}%
          </span>
        )}
        {canDelete && <button onClick={onDelete} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>}
      </div>
      {node.quantity != null && (
        <p className="text-[10px] text-white/35 truncate mt-1 pl-1">{node.quantity} {node.unit ?? ""} @ {node.unit_cost ?? 0}</p>
      )}
    </div>
  );
}

interface ProposedNode { tempId: string; parentTempId: string | null; name: string; level: string }
interface ProposedItem { nodeTempId: string; description: string; unit: string | null; quantity: number; unit_cost: number; confidence: number }
interface ProposedActivity { nodeTempId: string; title: string; plan_start: string; plan_finish: string; weight: number }
type ScheduleSource = "file" | "inferred" | "mixed";
interface WBSProposal {
  nodes: ProposedNode[]; items: ProposedItem[]; activities: ProposedActivity[];
  scheduleSource: ScheduleSource; anomalies: { message: string }[];
  creditsCharged?: number; creditsRemaining?: number;
}

/** Walks a proposed node's parentTempId chain up to its root — used as the
 *  Schedule module's group_label so AI-proposed activities land in the same
 *  "phase" bucket a person would have typed by hand. */
function rootProposedNodeName(tempId: string, nodes: ProposedNode[]): string {
  let current = nodes.find((n) => n.tempId === tempId);
  if (!current) return "General";
  while (current.parentTempId) {
    const parent = nodes.find((n) => n.tempId === current!.parentTempId);
    if (!parent) break;
    current = parent;
  }
  return current.name;
}

/** One file upload -> AI proposes the whole structure (folders + BOQ items
 *  + schedule activities) at once -> review -> apply. Meant for onboarding
 *  a project from a raw BOQ/quote file rather than typing the tree by hand. */
function AIImportPanel({ ownerId, projectId, projectStartDate, projectEndDate, accessToken, onClose, onApplied }: {
  ownerId: string; projectId: string; projectStartDate: string | null; projectEndDate: string | null;
  accessToken: string | undefined; onClose: () => void; onApplied: () => void;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: aiCredits } = useCMAiCredits(projectId);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<BoqSheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [insufficientBalance, setInsufficientBalance] = useState<number | null>(null);
  const [proposal, setProposal] = useState<WBSProposal | null>(null);
  const [applying, setApplying] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    setParseError("");
    setSheets(null);
    try {
      const parsed = /\.pdf$/i.test(f.name) ? await parsePdfRows(f) : await parseWorkbookRows(f);
      const nonEmpty = parsed.filter((s) => s.rows.length > 0);
      setSheets(nonEmpty.length > 0 ? nonEmpty : parsed);
      // Default to the sheet with the most rows — usually the real BOQ, not a cover/notes tab.
      const best = nonEmpty.reduce((a, b, i) => (b.rows.length > (nonEmpty[a]?.rows.length ?? 0) ? i : a), 0);
      setSheetIndex(best);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read this file");
    }
  };

  const runAnalyze = async () => {
    if (!accessToken || !sheets) return;
    const sheet = sheets[sheetIndex];
    setLoading(true);
    setError("");
    setInsufficientBalance(null);
    try {
      const res = await fetch("/api/cm-wbs-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          rows: sheet.rows, sheetName: sheet.sheetName, projectId, ownerId,
          projectStartDate, projectEndDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 402) { setInsufficientBalance(json.balance ?? 0); return; }
        throw new Error(json.error ?? "Request failed");
      }
      // The AI call itself streams internally (to stay under the edge
      // runtime's timeout on large sheets), so a failure there still comes
      // back as HTTP 200 with an `error` field rather than a 4xx/5xx status.
      if (json.error) throw new Error(json.error);
      // Defensive: a large/truncated generation can come back missing a
      // field the tool schema marks required — never let that crash the
      // review screen, just show whatever did come through.
      setProposal({
        nodes: Array.isArray(json.nodes) ? json.nodes : [],
        items: Array.isArray(json.items) ? json.items : [],
        activities: Array.isArray(json.activities) ? json.activities : [],
        scheduleSource: json.scheduleSource ?? "inferred",
        anomalies: Array.isArray(json.anomalies) ? json.anomalies : [],
        creditsCharged: json.creditsCharged,
        creditsRemaining: json.creditsRemaining,
      });
      qc.invalidateQueries({ queryKey: ["cm_ai_credits", projectId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze file");
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      const tempToRealId = new Map<string, string>();
      const remaining = [...proposal.nodes];
      let guard = 0;
      while (remaining.length > 0 && guard < 30) {
        guard += 1;
        for (let i = remaining.length - 1; i >= 0; i -= 1) {
          const n = remaining[i];
          if (n.parentTempId && !tempToRealId.has(n.parentTempId)) continue;
          const created = await createCMWBSNode(ownerId, projectId, {
            name: n.name, level: n.level || "Group",
            parent_id: n.parentTempId ? tempToRealId.get(n.parentTempId)! : null,
          });
          tempToRealId.set(n.tempId, created.id);
          remaining.splice(i, 1);
        }
      }
      for (const item of proposal.items) {
        const nodeId = tempToRealId.get(item.nodeTempId);
        if (!nodeId) continue;
        await createCMBOQItem(ownerId, projectId, {
          description: item.description, unit: item.unit, quantity: item.quantity, unit_cost: item.unit_cost,
          wbs_node_id: nodeId,
        });
      }
      for (const activity of proposal.activities) {
        const nodeId = tempToRealId.get(activity.nodeTempId);
        if (!nodeId) continue;
        await createCMScheduleItem(ownerId, projectId, {
          group_label: rootProposedNodeName(activity.nodeTempId, proposal.nodes),
          title: activity.title, plan_start: activity.plan_start, plan_finish: activity.plan_finish,
          weight: activity.weight, wbs_node_id: nodeId,
        });
      }
      onApplied();
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-6" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-[#141415] rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14px] font-bold text-white/85">{t("wbs.aiImport")}</p>

        {!proposal && (
          <>
            <p className="text-[12px] text-white/45">{t("wbs.aiImportHint")}</p>
            {aiCredits && <p className="text-[10px] text-white/30">{t("wbs.creditsBalance").replace("{n}", String(aiCredits.balance))}</p>}
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="text-[12px] text-white/60 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:text-black"
              style={{ colorScheme: "dark" }} />
            {parseError && <p className="text-[12px] text-red-400">{parseError}</p>}
            {sheets && sheets.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("wbs.sheet")}</span>
                <FieldSelect value={String(sheetIndex)} onChange={(v) => setSheetIndex(Number(v))}
                  options={sheets.map((s, i) => ({ value: String(i), label: `${s.sheetName} (${s.rows.length})` }))} />
              </label>
            )}
            {sheets && <p className="text-[11px] text-white/30">{t("wbs.rowsFound").replace("{n}", String(sheets[sheetIndex]?.rows.length ?? 0))}</p>}
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            {insufficientBalance != null && (
              <p className="text-[12px] text-red-400">{t("wbs.insufficientCredits").replace("{n}", String(insufficientBalance))}</p>
            )}
            <button onClick={runAnalyze} disabled={loading || !sheets}
              className="w-full py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {loading ? t("wbs.aiSuggesting") : t("wbs.aiSuggestRun")}
            </button>
            <button onClick={onClose} className="w-full py-2.5 rounded-2xl text-[12px] uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
          </>
        )}

        {proposal && (
          <>
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-white/60">
                {proposal.scheduleSource === "file" ? t("wbs.scheduleFromFile")
                  : proposal.scheduleSource === "mixed" ? t("wbs.scheduleMixed")
                  : t("wbs.scheduleInferred")}
              </p>
              {proposal.creditsCharged != null && (
                <p className="text-[10px] text-white/30 mt-1">
                  {t("wbs.creditsUsed").replace("{used}", String(proposal.creditsCharged)).replace("{n}", String(proposal.creditsRemaining ?? 0))}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {proposal.nodes.map((n) => {
                const isLeafProposal = !proposal.nodes.some((o) => o.parentTempId === n.tempId);
                const depth = (() => {
                  let d = 0; let cur: ProposedNode | undefined = n;
                  while (cur?.parentTempId) { d += 1; cur = proposal.nodes.find((o) => o.tempId === cur!.parentTempId); }
                  return d;
                })();
                const nodeActivities = proposal.activities.filter((a) => a.nodeTempId === n.tempId);
                return (
                  <div key={n.tempId} className="rounded-xl bg-white/3 px-3 py-2" style={{ marginLeft: depth * 16 }}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{n.level}</span>
                      <p className="text-[12px] text-white/80 truncate">{n.name}</p>
                    </div>
                    {isLeafProposal && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {proposal.items.filter((it) => it.nodeTempId === n.tempId).map((it, i) => (
                          <p key={i} className="text-[10px] text-white/35 truncate pl-2">
                            · {it.description} — {it.quantity} {it.unit ?? ""} @ {it.unit_cost} <span className="text-white/20">({Math.round(it.confidence * 100)}%)</span>
                          </p>
                        ))}
                      </div>
                    )}
                    {nodeActivities.length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {nodeActivities.map((a, i) => (
                          <p key={i} className="text-[10px] pl-2" style={{ color: "#ff9d66" }}>
                            ▸ {a.title} — {a.plan_start} → {a.plan_finish}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {proposal.anomalies.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 px-3 py-2.5 flex flex-col gap-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70">{t("wbs.anomalies")}</p>
                {proposal.anomalies.map((a, i) => <p key={i} className="text-[11px] text-amber-300/80">{a.message}</p>)}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={applyProposal} disabled={applying}
                className="flex-1 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold disabled:opacity-40"
                style={{ backgroundColor: "#ff5100" }}>
                {applying ? t("wbs.aiApplying") : t("wbs.aiApply")}
              </button>
              <button onClick={() => { setProposal(null); setFile(null); setSheets(null); }} className="px-5 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Simple mobile Gantt (spec §3): one shared time axis from the earliest
 *  plan start to the latest plan finish, a plan bar per activity with an
 *  actual-progress fill, and a today line. No dependencies/critical path —
 *  this is deliberately not Primavera. */
const MS_PER_WEEK = 7 * 24 * 3600 * 1000;

interface GanttRow {
  title: string;
  estOffset: number;
  estDuration: number;
  actOffset: number;
  actDuration: number;
  estLabel: string;
  actLabel: string | null;
}

function GanttTooltip({ active, payload, accent, bg, border, text }: {
  active?: boolean; payload?: { payload: GanttRow }[]; accent: string; bg: string; border: string; text: string;
}) {
  const { t } = useCMLang();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl px-3.5 py-2.5 shadow-lg" style={{ background: bg, border: `1px solid ${border}` }}>
      <p className="text-[12px] font-bold mb-1.5" style={{ color: text }}>{row.title}</p>
      <p className="text-[11px]" style={{ color: `color-mix(in srgb, ${accent} 55%, ${text})` }}>{t("schedule.estimated")}: {row.estLabel}</p>
      {row.actLabel && <p className="text-[11px] font-bold" style={{ color: accent }}>{t("schedule.actual")}: {row.actLabel}</p>}
    </div>
  );
}

function GanttView({ groups }: { groups: [string, CMScheduleItem[]][] }) {
  const { t } = useCMLang();
  const theme = useCMTheme();
  const chartGrid = theme === "light" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.08)";
  const chartTick = theme === "light" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)";
  const chartText = theme === "light" ? "#17130f" : "#ffffff";
  const chartTooltipBg = theme === "light" ? "#ffffff" : "#181818";
  const chartTooltipBorder = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const estColor = "color-mix(in srgb, var(--color-brand-accent) 38%, transparent)";
  const actColor = "var(--color-brand-accent)";

  const all = groups.flatMap(([, items]) => items);
  const allDates = all.flatMap((i) => [i.plan_start, i.plan_finish, i.actual_start, i.actual_end].filter((d): d is string => !!d));
  const minMs = Math.min(...allDates.map((d) => new Date(d).getTime()));
  const maxMs = Math.max(...allDates.map((d) => new Date(d).getTime()), new Date(today()).getTime());
  const maxWeek = Math.max(1, Math.ceil((maxMs - minMs) / MS_PER_WEEK));
  const weekOf = (date: string) => (new Date(date).getTime() - minMs) / MS_PER_WEEK;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-white/40 px-1">{t("schedule.ganttHint")}</p>
      {groups.map(([groupLabel, items]) => {
        const rows: GanttRow[] = items.map((item) => {
          const estStart = weekOf(item.plan_start);
          const estEnd = weekOf(item.plan_finish);
          const estDuration = Math.max(0.4, estEnd - estStart);
          const hasActualStart = !!item.actual_start;
          const actStart = hasActualStart ? weekOf(item.actual_start!) : estStart;
          const inProgress = item.actual_percent > 0 && item.actual_percent < 100 && !item.actual_end;
          const actEnd = item.actual_end ? weekOf(item.actual_end) : inProgress ? weekOf(today()) : actStart;
          const showActual = hasActualStart || item.actual_end || inProgress;
          const actDuration = showActual ? Math.max(0.4, actEnd - actStart) : 0;
          return {
            title: item.title,
            estOffset: estStart, estDuration,
            actOffset: showActual ? actStart : 0, actDuration,
            estLabel: `wk ${Math.round(estStart)}–${Math.round(estEnd)} (${Math.round(estEnd - estStart)} wk)`,
            actLabel: showActual ? `wk ${Math.round(actStart)}–${Math.round(actStart + actDuration)} (${Math.round(actDuration)} wk)` : null,
          };
        });
        return (
          <div key={groupLabel} className="rounded-2xl bg-[#0d0d0e] px-4 py-4">
            <p className="text-[11px] text-white/60 font-medium mb-2">{groupLabel}</p>
            <div style={{ height: rows.length * 46 + 40 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                  <XAxis type="number" domain={[0, maxWeek]} tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false}
                    tickFormatter={(w: number) => `${Math.round(w)} wk`} />
                  <YAxis type="category" dataKey="title" width={110} tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<GanttTooltip accent={actColor} bg={chartTooltipBg} border={chartTooltipBorder} text={chartText} />} cursor={{ fill: "transparent" }} />
                  <Legend
                    payload={[{ value: t("schedule.estimated"), type: "square", color: "color-mix(in srgb, var(--color-brand-accent) 55%, transparent)" }, { value: t("schedule.actual"), type: "square", color: actColor }]}
                    wrapperStyle={{ fontSize: 10, color: chartTick }} />
                  <Bar dataKey="estOffset" stackId="est" fill="transparent" legendType="none" isAnimationActive={false} />
                  <Bar dataKey="estDuration" stackId="est" fill={estColor} radius={2} barSize={7} legendType="none" isAnimationActive={false} />
                  <Bar dataKey="actOffset" stackId="act" fill="transparent" legendType="none" isAnimationActive={false} />
                  <Bar dataKey="actDuration" stackId="act" fill={actColor} radius={2} barSize={7} legendType="none" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleQuickSettings({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: project } = useCMProject(projectId);
  const canEdit = usePermission(projectId, userId, "settings", "edit");
  const [busy, setBusy] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null);
  if (!project) return null;
  const ctx = { ownerId: project.owner_id, project, actorId: userId };
  const thresholdValue = thresholdDraft ?? String(resolveSetting(SETTING_DEFINITIONS.scheduleDelayThresholdPct, { project }).value);

  const run = async (p: Promise<void>) => {
    setBusy(true);
    try { await p; } finally { setBusy(false); }
  };

  const commit = () => {
    if (thresholdDraft === null) return;
    const n = Number(thresholdDraft);
    if (Number.isFinite(n) && n >= 0) run(writeSettingAndSync(SETTING_DEFINITIONS.scheduleDelayThresholdPct, n, ctx, queryClient));
    setThresholdDraft(null);
  };

  return (
    <div className="w-full flex items-center gap-3.5 px-4 py-3">
      <span className="text-white/70 shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
      </span>
      <span className="min-w-0 flex-1 text-[14px] text-white/90">{t("schedule.settingsThreshold")}</span>
      <input type="number" min={0} step="1" value={thresholdValue} disabled={!canEdit || busy}
        onChange={(e) => setThresholdDraft(e.target.value)}
        onBlur={commit}
        className="w-16 bg-white/8 rounded-full px-3 py-1.5 text-[11px] font-mono text-white/85 text-right focus:outline-none" />
    </div>
  );
}

function CMSchedulePage() {
  const { user, session, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const delayThresholdPct = activeProject?.schedule_delay_threshold_pct ?? 10;
  const { data: items, isLoading } = useCMScheduleItems(projectId || undefined);
  const { data: wbsNodes } = useCMWBSNodes(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const { data: logs } = useCMDailyLogs(projectId || undefined);
  const { data: locations } = useCMProjectLocations(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "schedule", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "schedule", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "schedule", "delete");
  // Structural edits (adding/renaming/deleting folders) stay gated by the
  // "settings" permission, same as the standalone WBS page used to —
  // restructuring cascades into BOQ too, so it's kept separate from
  // day-to-day schedule-activity editing.
  const canCreateStructure = usePermission(projectId || undefined, user?.id, "settings", "create");
  const canEditStructure = usePermission(projectId || undefined, user?.id, "settings", "edit");
  const canDeleteStructure = usePermission(projectId || undefined, user?.id, "settings", "delete");
  const [showImport, setShowImport] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [view, setView] = useState<"list" | "gantt">("list");
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const [structureAdding, setStructureAdding] = useState(false);
  const [structureName, setStructureName] = useState("");
  const [structureLevel, setStructureLevel] = useState("");
  const [structureParentId, setStructureParentId] = useState("");
  const [structureEditingId, setStructureEditingId] = useState<string | null>(null);
  const [structureEditValue, setStructureEditValue] = useState("");
  const [structureDeletingId, setStructureDeletingId] = useState<string | null>(null);

  const locationLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations ?? []) map.set(l.id, locationBreadcrumb(l, locations ?? []));
    return map;
  }, [locations]);

  // Progress suggested by site records: delivered % of each activity's
  // linked BOQ category, from Site Diary deliveries (spec §7-9). Activities
  // with the real boq_item_id FK set prefer itemSuggestions instead — it
  // isn't broken by a BOQ category rename the way the string match is.
  const suggestions = useMemo(() => cmBOQCategoryProgress(boqItems ?? [], logs ?? []), [boqItems, logs]);
  const itemSuggestions = useMemo(() => cmBOQItemProgress(boqItems ?? [], logs ?? []), [boqItems, logs]);

  // Spec §2 main-screen numbers, computed from the same items the list shows.
  const summary = useMemo(() => {
    const list = items ?? [];
    const d = today();
    const planned = projectPlanPercent(list, d);
    const totalWeight = list.reduce((s, i) => s + i.weight, 0) || 1;
    const actual = list.reduce((s, i) => s + i.weight * i.actual_percent, 0) / totalWeight;
    const dueToday = list.filter((i) => i.plan_start <= d && i.plan_finish >= d && i.actual_percent < 100).length;
    const overdue = list.filter((i) => i.plan_finish < d && i.actual_percent < 100).length;
    const delayed = list.filter((i) => cmScheduleStatus(i, d, delayThresholdPct) === "Delayed").length;
    return { planned, actual, variance: actual - planned, dueToday, overdue, delayed };
  }, [items, delayThresholdPct]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_wbs_nodes", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_active_boq_items", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_ai_credits", projectId] });
  };

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

  const scheduleById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const childrenMap = useMemo(() => buildChildrenMap(wbsNodes ?? []), [wbsNodes]);
  const flat = useMemo(() => wbsFlatten(wbsNodes ?? []), [wbsNodes]);
  // The tree, unlike the flat schedule list above, keeps matches visible by
  // ancestry — searching for an activity name should still show the
  // folders it lives under, not just the matching row in isolation.
  const visibleNodeIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const byId = new Map((wbsNodes ?? []).map((n) => [n.id, n]));
    const matched = new Set<string>();
    for (const n of wbsNodes ?? []) {
      const text = [n.name, scheduleById.get(n.id)?.title].filter(Boolean).join(" ").toLowerCase();
      if (text.includes(q)) matched.add(n.id);
    }
    const visible = new Set<string>();
    for (const id of matched) {
      let cur = byId.get(id);
      while (cur) { visible.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    }
    return visible;
  }, [search, wbsNodes, scheduleById]);

  const handleStructureAdd = async () => {
    if (!structureName.trim() || !projectId || !activeProject) return;
    await createCMWBSNode(activeProject.owner_id, projectId, {
      name: structureName.trim(), level: structureLevel.trim() || undefined, parent_id: structureParentId || undefined,
    });
    setStructureName(""); setStructureLevel(""); setStructureParentId(""); setStructureAdding(false);
    invalidate();
  };
  const startStructureEdit = (n: CMWBSNode) => { setStructureEditingId(n.id); setStructureEditValue(n.name); };
  const commitStructureEdit = async () => {
    if (!structureEditingId) return;
    const id = structureEditingId;
    const trimmed = structureEditValue.trim();
    setStructureEditingId(null);
    if (trimmed) { await updateCMWBSNode(id, { name: trimmed }); invalidate(); }
  };
  const handleStructureDelete = async (id: string) => {
    setStructureDeletingId(null);
    await deleteCMWBSNode(id);
    invalidate();
  };

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
        <ModuleHeader title={t("schedule.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/schedule/settings"
          quickSettings={projectId ? <ScheduleQuickSettings projectId={projectId} userId={user.id} /> : undefined} />
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
              {(wbsNodes?.length ?? 0) > 0 && (
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
              {canCreateStructure && (
                <button onClick={() => setAiOpen(true)} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-white/5 hover:bg-white/10 transition-colors" style={{ color: "#ff5100" }}>
                  {t("wbs.aiImport")}
                </button>
              )}
            </div>

            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && (wbsNodes?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("schedule.nothingYet")}</p>
              </div>
            )}
            {view === "gantt" && groups.length > 0 ? (
              <GanttView groups={groups} />
            ) : (
              <div className="flex flex-col gap-2">
                {flat.filter(({ node: n }) => !visibleNodeIds || visibleNodeIds.has(n.id)).map(({ node: n, depth }) => {
                  const scheduleItem = scheduleById.get(n.id);
                  if (scheduleItem) {
                    return (
                      <div key={n.id} style={{ marginLeft: depth * 16 }}>
                        <ActivityRow item={scheduleItem} projectId={projectId ?? ""} actorId={user.id} canEdit={canEdit} canDelete={canDelete} onChanged={invalidate}
                          locationLabel={scheduleItem.location_id ? locationLabelById.get(scheduleItem.location_id) ?? null : null}
                          suggestedPct={scheduleItem.boq_item_id ? itemSuggestions.get(scheduleItem.boq_item_id) ?? null : scheduleItem.boq_category ? suggestions.get(scheduleItem.boq_category) ?? null : null}
                          delayThresholdPct={delayThresholdPct} />
                      </div>
                    );
                  }
                  const isLeafNode = wbsIsLeaf(n, wbsNodes ?? []);
                  const rollupItems = !isLeafNode ? subtreeScheduleItems(n.id, childrenMap, scheduleById) : [];
                  const rollupWeight = rollupItems.reduce((s, i) => s + i.weight, 0);
                  const rollup = rollupWeight > 0 ? {
                    plan: rollupItems.reduce((s, i) => s + i.weight * scheduleItemPlanPercent(i, today()), 0) / rollupWeight,
                    actual: rollupItems.reduce((s, i) => s + i.weight * i.actual_percent, 0) / rollupWeight,
                  } : null;
                  return (
                    <WBSNodeRow key={n.id} node={n} depth={depth} isLeaf={isLeafNode} rollup={rollup}
                      canEdit={canEditStructure} canDelete={canDeleteStructure}
                      editing={structureEditingId === n.id} editValue={structureEditValue}
                      onStartEdit={() => startStructureEdit(n)} onEditValueChange={setStructureEditValue}
                      onCommitEdit={commitStructureEdit} onCancelEdit={() => setStructureEditingId(null)}
                      onDelete={() => setStructureDeletingId(n.id)} />
                  );
                })}
                {(wbsNodes?.length ?? 0) === 0 && !structureAdding && <EmptyState message={t("wbs.noneYet")} />}
                {canCreateStructure && (structureAdding ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <input className={inputCls} placeholder={t("wbs.name")} value={structureName} onChange={(e) => setStructureName(e.target.value)} autoFocus />
                    <input className={inputCls} placeholder={t("wbs.levelPlaceholder")} list="schedule-wbs-level-suggestions" value={structureLevel} onChange={(e) => setStructureLevel(e.target.value)} />
                    <datalist id="schedule-wbs-level-suggestions">
                      {WBS_LEVEL_SUGGESTIONS.map((lv) => <option key={lv} value={lv} />)}
                    </datalist>
                    <FieldSelect
                      value={structureParentId} onChange={setStructureParentId} placeholder={t("wbs.parent")}
                      options={[{ value: "", label: t("wbs.parent") }, ...(wbsNodes ?? []).map((n) => ({ value: n.id, label: wbsBreadcrumb(n, wbsNodes ?? []) }))]}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleStructureAdd} className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest" style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
                      <button onClick={() => setStructureAdding(false)} className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setStructureAdding(true)} className="self-start px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest mt-1" style={{ color: "#ff5100" }}>{t("wbs.add")}</button>
                ))}
              </div>
            )}
            {canCreate && <FAB label={t("schedule.newBtn")} onClick={() => navigate({ to: "/cm/schedule/new" })} />}
          </>
        )}
      </main>

      {showImport && projectId && canCreate && (
        <ImportScheduleSheet ownerId={user.id} projectId={projectId} onImported={invalidate} onClose={() => setShowImport(false)} />
      )}
      {aiOpen && projectId && activeProject && (
        <AIImportPanel
          ownerId={activeProject.owner_id} projectId={projectId}
          projectStartDate={activeProject.start_date} projectEndDate={activeProject.target_end_date}
          accessToken={session?.access_token}
          onClose={() => setAiOpen(false)} onApplied={invalidate}
        />
      )}
      {structureDeletingId && (
        <ConfirmationDialog message={t("wbs.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={() => handleStructureDelete(structureDeletingId)} onCancel={() => setStructureDeletingId(null)} />
      )}
    </div>
  );
}
