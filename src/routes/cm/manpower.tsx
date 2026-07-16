import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, ProjectPicker, useSelectedProject, Card, inputCls, labelCls, useCMTheme,
  FieldSelect, LocationSelect, Sheet, PhotoPicker, SegmentedField, WeekCalendarStrip,
} from "@/components/cm/shared";
import { parseWorkbookRows, type BoqSheet } from "@/lib/cm-boq-import";
import {
  detectManpowerHeaderRow, rowsToManpowerDraftRows, MANPOWER_IMPORT_FIELDS,
  type ManpowerColumnMapping,
} from "@/lib/cm-manpower-import";
import {
  useCMDailyLogs, useCMManpowerRoster, addCMManpowerRosterItem, removeCMManpowerRosterItem,
  useCMProjectSubcontractors, useCMProjectLocations, locationBreadcrumb,
  findOrCreateCMDailyLog, updateCMDailyLog, logCMActivity, stampAndUploadCMPhotos,
  cmLaborHours, CM_WORKER_CATEGORIES,
  useCMManpowerPlans, createCMManpowerPlan, updateCMManpowerPlan, deleteCMManpowerPlan,
  useCMWorkers, createCMWorker, deleteCMWorker, useCMWorkerAttendance, setCMWorkerAttendance,
  type CMDailyLog, type CMManpowerRow, type CMManpowerPlan, type CMAttendanceStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/manpower")({
  head: () => ({ meta: [{ title: "Manpower Record — Construction Management App" }] }),
  component: CMManpowerPage,
});

const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";

/** Suggested trades per the Manpower spec — merged with whatever trades the
 *  project has actually used, so the picker never blocks a custom trade. */
const DEFAULT_TRADES = [
  "Civil", "Concrete", "Reinforcement", "Formwork", "Steel Erection", "Roofing",
  "Cladding", "Masonry", "Plastering", "Painting", "Electrical", "Mechanical",
  "Plumbing", "Fire Protection", "Infrastructure", "Landscaping", "Cleaning",
  "Security", "Other",
];

function dailyHeadcount(log: CMDailyLog) {
  return log.manpower.reduce((s, m) => s + m.count, 0);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** A predefined per-project list of trade/company pairs Site Diary picks
 *  from instead of retyping every day — the roster itself carries no
 *  headcount; that's still entered fresh per day and aggregated live. */
function ManpowerRosterSection({ ownerId, projectId, canCreate, canDelete }: {
  ownerId: string; projectId: string; canCreate: boolean; canDelete: boolean;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: roster } = useCMManpowerRoster(projectId);
  const [adding, setAdding] = useState(false);
  const [trade, setTrade] = useState("");
  const [company, setCompany] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_manpower_roster", projectId] });

  const handleAdd = async () => {
    if (!trade.trim()) return;
    await addCMManpowerRosterItem(ownerId, projectId, trade.trim(), company.trim() || null);
    setTrade(""); setCompany(""); setAdding(false);
    invalidate();
  };

  return (
    <Card title={t("manpower.roster")}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(roster ?? []).map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[10px] bg-white/5 text-white/60">
              {r.company ? `${r.company} — ` : ""}{r.trade}
              {canDelete && (
                <button onClick={() => removeCMManpowerRosterItem(r.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-4 h-4 rounded-full flex items-center justify-center">×</button>
              )}
            </span>
          ))}
        </div>
        {(roster?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("manpower.noRoster")}</p>}
        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder={t("siteDiary.trade")} value={trade} onChange={(e) => setTrade(e.target.value)} />
              <input className={inputCls} placeholder={t("siteDiary.company")} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!trade.trim()} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("manpower.addRosterItem")}</button>
        ))}
      </div>
    </Card>
  );
}

/** Quick-entry sheet per the spec: company → trade → category → workers →
 *  location → activity → hours. Also handles editing an existing row and the
 *  duplicate check (same company + trade + location must not be silently
 *  combined — the user chooses Edit Existing / Add New / Cancel). */
function ManpowerEntrySheet({ ownerId, projectId, rows, editIndex, companyOptions, tradeOptions, onSave, onClose }: {
  ownerId: string;
  projectId: string;
  rows: CMManpowerRow[];
  editIndex: number | null;
  companyOptions: string[];
  tradeOptions: string[];
  onSave: (next: CMManpowerRow[]) => Promise<void>;
  onClose: () => void;
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

  return (
    <Sheet title={editTarget != null ? t("manpower.editEntry") : t("manpower.addEntry")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              <button type="button" className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}
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
              <button type="submit" className={`${smallBtn} bg-white/10 text-white/70`}>{t("manpower.addNew")}</button>
              <button type="button" className={`${smallBtn} text-white/40`} onClick={() => setDupIndex(null)}>{t("common.cancel")}</button>
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2 mt-1">
          <button type="submit" disabled={saving || !trade.trim()} className={`${smallBtn} disabled:opacity-40 px-5 py-2.5`} style={{ backgroundColor: "#ff5100", color: "#000" }}>
            {saving ? t("common.loading") : t("common.save")}
          </button>
          <button type="button" onClick={onClose} className={`${smallBtn} px-5 py-2.5 text-white/40`}>{t("common.cancel")}</button>
        </div>
      </form>
    </Sheet>
  );
}

/** Daily manpower Excel import (spec §7): same detect-then-confirm flow as
 *  the BOQ importer — upload, correct the column mapping, preview, then the
 *  parsed crews are appended to the day's shared Site Diary record. Location
 *  text cells resolve to project locations by name; unmatched text is kept
 *  in the row's activity so nothing typed in the sheet silently disappears. */
function ImportManpowerSheet({ projectId, date, onImport, onClose }: {
  projectId: string; date: string;
  onImport: (rows: CMManpowerRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useCMLang();
  const { data: locations } = useCMProjectLocations(projectId);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [sheets, setSheets] = useState<BoqSheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [mapping, setMapping] = useState<ManpowerColumnMapping>({
    company: null, trade: null, category: null, count: null,
    normalHours: null, otHours: null, location: null, activity: null,
  });

  const handleFile = async (file: File) => {
    setError("");
    try {
      const parsed = (await parseWorkbookRows(file)).filter((s) => s.rows.length > 0);
      if (parsed.length === 0) { setError(t("boq.import.noRows")); return; }
      const withHeader = parsed.map((s, i) => ({ i, detected: detectManpowerHeaderRow(s.rows) })).find((x) => x.detected);
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

  const draftRows = useMemo(
    () => (sheet ? rowsToManpowerDraftRows(sheet.rows, headerRowIdx, mapping) : []),
    [sheet, headerRowIdx, mapping],
  );

  const locationIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations ?? []) {
      map.set(l.name.trim().toLowerCase(), l.id);
      map.set(locationBreadcrumb(l, locations ?? []).trim().toLowerCase(), l.id);
    }
    return map;
  }, [locations]);

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      const rows: CMManpowerRow[] = draftRows.map((d) => {
        const locId = d.location_text ? locationIdByName.get(d.location_text.toLowerCase()) ?? null : null;
        const unresolvedLocation = d.location_text && !locId ? d.location_text : null;
        return {
          trade: d.trade,
          company: d.company,
          count: d.count,
          roster_item_id: null,
          category: d.category,
          location_id: locId,
          activity: [d.activity, unresolvedLocation].filter(Boolean).join(" — ") || null,
          normal_hours: d.normal_hours ?? 8,
          ot_hours: d.ot_hours ?? 0,
        };
      });
      await onImport(rows);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import manpower");
      setImporting(false);
    }
  };

  return (
    <Sheet title={t("manpower.import.title")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
        {step === "upload" && (
          <>
            <p className="text-[12px] text-white/40">{t("manpower.import.uploadHint", { date })}</p>
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
                    const detected = detectManpowerHeaderRow(sheets[idx].rows);
                    setHeaderRowIdx(detected?.rowIndex ?? 0);
                    if (detected) setMapping(detected.mapping);
                  }}
                  options={sheets.map((s, i) => ({ value: String(i), label: s.sheetName }))}
                  disabled={importing}
                />
              </label>
            )}
            {MANPOWER_IMPORT_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className={labelCls}>{t(`manpower.import.field.${field}`)}</span>
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
              {draftRows.slice(0, 6).map((d, i) => (
                <p key={i} className="text-[11px] text-white/60 truncate">
                  {d.company ? `${d.company} — ` : ""}{d.trade}: {d.count} × {d.normal_hours ?? 8}h{(d.ot_hours ?? 0) > 0 ? ` + ${d.ot_hours} OT` : ""}
                </p>
              ))}
              {draftRows.length === 0 && <p className="text-[11px] text-white/30">{t("boq.import.noItemsDetected")}</p>}
            </div>

            <div className="rounded-xl bg-white/3 p-3 text-[12px] text-white/60">
              {t("manpower.import.summary", { count: String(draftRows.length), workers: String(draftRows.reduce((s, d) => s + d.count, 0)), date })}
            </div>

            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <button type="button" onClick={handleImport} disabled={importing || draftRows.length === 0}
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

const ATTENDANCE_CYCLE: (CMAttendanceStatus | null)[] = [null, "Present", "Absent", "Leave"];
const ATTENDANCE_COLOR: Record<CMAttendanceStatus, string> = {
  Present: "#4ade80", Absent: "#f87171", Leave: "#fbbf24",
};

/** Named attendance (spec §9 Level 2) — an optional register of workers with
 *  a per-day Present/Absent/Leave toggle. Deliberately separate from the
 *  headcount rows: attendance never writes into the shared Site Diary record
 *  by itself; "Add present crews to headcount" is an explicit action that
 *  only adds company+trade pairs not already recorded, so nothing merges
 *  silently and headcount-only projects never have to touch this. */
function AttendanceSection({ userId, projectId, date, rows, canCreate, canDelete, companyOptions, tradeOptions, onAddToHeadcount }: {
  userId: string; projectId: string; date: string; rows: CMManpowerRow[];
  canCreate: boolean; canDelete: boolean;
  companyOptions: string[]; tradeOptions: string[];
  onAddToHeadcount: (crews: CMManpowerRow[]) => Promise<void>;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: workers } = useCMWorkers(projectId);
  const { data: attendance } = useCMWorkerAttendance(projectId, date);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState("");
  // Optimistic status overrides so toggles respond instantly; reverted on a
  // failed write, cleared when the day changes.
  const [overrides, setOverrides] = useState<Map<string, CMAttendanceStatus | null>>(new Map());
  useEffect(() => { setOverrides(new Map()); }, [projectId, date]);

  const activeWorkers = useMemo(() => (workers ?? []).filter((w) => w.active), [workers]);
  const serverStatus = useMemo(() => {
    const map = new Map<string, CMAttendanceStatus>();
    for (const a of attendance ?? []) map.set(a.worker_id, a.status);
    return map;
  }, [attendance]);
  const statusOf = (workerId: string) =>
    overrides.has(workerId) ? overrides.get(workerId)! : serverStatus.get(workerId) ?? null;

  const invalidateWorkers = () => qc.invalidateQueries({ queryKey: ["cm_workers", projectId] });
  const invalidateAttendance = () => qc.invalidateQueries({ queryKey: ["cm_worker_attendance", projectId, date] });

  const toggle = (workerId: string) => {
    const current = statusOf(workerId);
    const next = ATTENDANCE_CYCLE[(ATTENDANCE_CYCLE.indexOf(current) + 1) % ATTENDANCE_CYCLE.length];
    setOverrides((m) => new Map(m).set(workerId, next));
    setCMWorkerAttendance(userId, projectId, workerId, date, next)
      .then(invalidateAttendance)
      .catch(() => setOverrides((m) => { const c = new Map(m); c.delete(workerId); return c; }));
  };

  const handleAddWorker = async () => {
    if (!name.trim()) return;
    await createCMWorker(userId, projectId, {
      name: name.trim(), worker_code: code.trim() || null,
      company: company.trim() || null, trade: trade.trim() || null,
    });
    logCMActivity(projectId, userId, "worker_added", "manpower", null, { name: name.trim() });
    setName(""); setCode(""); setAdding(false);
    invalidateWorkers();
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof activeWorkers>();
    for (const w of activeWorkers) {
      const key = w.company?.trim() || "";
      groups.set(key, [...(groups.get(key) ?? []), w]);
    }
    return [...groups.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));
  }, [activeWorkers]);

  const counts = useMemo(() => {
    let present = 0, absent = 0;
    for (const w of activeWorkers) {
      const s = statusOf(w.id);
      if (s === "Present") present++;
      else if (s === "Absent") absent++;
    }
    return { present, absent, total: activeWorkers.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkers, serverStatus, overrides]);

  // Present workers grouped into crews, minus company+trade pairs the day's
  // headcount already has — the explicit bridge from Level 2 back to Level 1.
  const pendingCrews = useMemo(() => {
    const existing = new Set(rows.map((r) => `${(r.company ?? "").trim().toLowerCase()}|${r.trade.trim().toLowerCase()}`));
    const crews = new Map<string, CMManpowerRow>();
    for (const w of activeWorkers) {
      if (statusOf(w.id) !== "Present") continue;
      const companyKey = (w.company ?? "").trim();
      const tradeKey = (w.trade ?? "").trim() || t("manpower.attendance.generalTrade");
      const key = `${companyKey.toLowerCase()}|${tradeKey.toLowerCase()}`;
      if (existing.has(key)) continue;
      const crew = crews.get(key) ?? {
        trade: tradeKey, company: companyKey || null, count: 0, roster_item_id: null,
        category: null, location_id: null, activity: null, normal_hours: 8, ot_hours: 0,
      };
      crew.count += 1;
      crews.set(key, crew);
    }
    return [...crews.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkers, rows, serverStatus, overrides, t]);

  return (
    <Card title={t("manpower.attendance.title")}>
      <div className="flex flex-col gap-2">
        {activeWorkers.length === 0 && !adding && <p className="text-white/30 text-[12px]">{t("manpower.attendance.noWorkers")}</p>}
        {activeWorkers.length > 0 && (
          <p className="text-[11px] font-mono text-white/45">
            {t("manpower.attendance.summary", { present: String(counts.present), absent: String(counts.absent), total: String(counts.total) })}
          </p>
        )}
        {grouped.map(([groupKey, groupWorkers]) => (
          <div key={groupKey || "-"} className="flex flex-col gap-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mt-1">{groupKey || t("manpower.noCompany")}</p>
            {groupWorkers.map((w) => {
              const s = statusOf(w.id);
              return (
                <div key={w.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/80 truncate">{w.name}{w.worker_code ? <span className="text-white/30 font-mono text-[10px]"> · {w.worker_code}</span> : null}</p>
                    {w.trade && <p className="text-[10px] text-white/30 truncate">{w.trade}</p>}
                  </div>
                  <button onClick={() => toggle(w.id)}
                    className="shrink-0 font-mono text-[10px] px-2.5 py-1 rounded-full min-w-[64px] text-center transition-colors"
                    style={s ? { color: ATTENDANCE_COLOR[s], backgroundColor: `${ATTENDANCE_COLOR[s]}1a` } : { color: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    {s ? t(`manpower.attendance.${s.toLowerCase()}`) : "—"}
                  </button>
                  {canDelete && (
                    <button onClick={() => deleteCMWorker(w.id).then(invalidateWorkers)} className="shrink-0 w-5 h-5 rounded-full text-white/20 hover:text-red-400 flex items-center justify-center">×</button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {canCreate && pendingCrews.length > 0 && (
          <div className="mt-1">
            <button onClick={() => onAddToHeadcount(pendingCrews)} className={`${smallBtn} px-4 py-2`} style={{ backgroundColor: "#ff5100", color: "#000" }}>
              {t("manpower.attendance.addToHeadcount", { count: String(pendingCrews.reduce((sum, c) => sum + c.count, 0)) })}
            </button>
            <p className="text-[10px] text-white/25 mt-1.5">{t("manpower.attendance.addToHeadcountHint")}</p>
          </div>
        )}

        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder={t("manpower.attendance.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
              <input className={inputCls} placeholder={t("manpower.attendance.codePlaceholder")} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldSelect value={company} onChange={setCompany} searchable allowCustom placeholder={t("manpower.selectCompany")}
                options={[{ value: "", label: t("common.none") }, ...companyOptions.map((c) => ({ value: c, label: c }))]} />
              <FieldSelect value={trade} onChange={setTrade} searchable allowCustom placeholder={t("manpower.selectTrade")}
                options={tradeOptions.map((tr) => ({ value: tr, label: tr }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddWorker} disabled={!name.trim()} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("manpower.attendance.addWorker")}</button>
        ))}
      </div>
    </Card>
  );
}

/** Planned vs Actual (spec §14): planning targets per company+trade for the
 *  selected date, matched against the day's actual crews by text. Variance
 *  is labelled Under-resourced / On plan / Over-resourced — over-resourced
 *  deliberately gets a neutral color, since more workers than planned is a
 *  deviation to look at, not automatically good performance. */
function PlannedVsActualSection({ userId, projectId, date, rows, canCreate, canEdit, canDelete, companyOptions, tradeOptions }: {
  userId: string; projectId: string; date: string; rows: CMManpowerRow[];
  canCreate: boolean; canEdit: boolean; canDelete: boolean;
  companyOptions: string[]; tradeOptions: string[];
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: plans } = useCMManpowerPlans(projectId);
  const dayPlans = useMemo(() => (plans ?? []).filter((p) => p.plan_date === date), [plans, date]);
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState("");
  const [count, setCount] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_manpower_plans", projectId] });

  const actualFor = (p: CMManpowerPlan) => rows
    .filter((r) =>
      (r.company ?? "").trim().toLowerCase() === (p.company ?? "").trim().toLowerCase()
      && r.trade.trim().toLowerCase() === p.trade.trim().toLowerCase())
    .reduce((s, r) => s + r.count, 0);

  const totals = {
    planned: dayPlans.reduce((s, p) => s + p.planned_count, 0),
    actual: rows.reduce((s, r) => s + r.count, 0),
  };

  const handleAdd = async () => {
    if (!trade.trim()) return;
    await createCMManpowerPlan(userId, projectId, {
      plan_date: date, company: company.trim() || null, trade: trade.trim(), activity: null,
      planned_count: Math.max(0, parseInt(count, 10) || 0),
    });
    logCMActivity(projectId, userId, "manpower_plan_added", "manpower", null, { date, trade: trade.trim() });
    setCompany(""); setTrade(""); setCount(""); setAdding(false);
    invalidate();
  };

  const varianceBadge = (planned: number, actual: number) => {
    const v = actual - planned;
    const [label, color] = v < 0
      ? [t("manpower.underResourced"), "#fbbf24"]
      : v === 0
        ? [t("manpower.onPlan"), "#4ade80"]
        : [t("manpower.overResourced"), "#93c5fd"];
    return (
      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ color, backgroundColor: `${color}1a` }}>
        {v > 0 ? `+${v}` : v} · {label}
      </span>
    );
  };

  if (dayPlans.length === 0 && !canCreate) return null;

  return (
    <Card title={t("manpower.plannedVsActual")}>
      <div className="flex flex-col gap-2">
        {dayPlans.length === 0 && !adding && <p className="text-white/30 text-[12px]">{t("manpower.noPlans")}</p>}
        {dayPlans.map((p) => {
          const actual = actualFor(p);
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white/80 truncate">{p.company ? `${p.company} — ` : ""}{p.trade}</p>
                <p className="text-[10px] text-white/30">
                  {t("manpower.planned")} {canEdit ? (
                    <input
                      type="number" min={0} defaultValue={p.planned_count} key={`${p.id}-${p.planned_count}`}
                      className="w-12 bg-transparent border-b border-white/15 text-white/60 text-[10px] text-center focus:outline-none focus:border-[#ff5100]/60"
                      onBlur={(e) => {
                        const next = Math.max(0, parseInt(e.target.value, 10) || 0);
                        if (next !== p.planned_count) updateCMManpowerPlan(p.id, { planned_count: next }).then(invalidate);
                      }}
                    />
                  ) : p.planned_count} · {t("manpower.actual")} {actual}
                </p>
              </div>
              {varianceBadge(p.planned_count, actual)}
              {canDelete && (
                <button onClick={() => deleteCMManpowerPlan(p.id).then(invalidate)} className="shrink-0 w-5 h-5 rounded-full text-white/20 hover:text-red-400 flex items-center justify-center">×</button>
              )}
            </div>
          );
        })}
        {dayPlans.length > 0 && (
          <div className="flex items-center justify-between px-3 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/35">{t("siteDiary.total")}</span>
            <span className="text-[11px] font-mono text-white/60">
              {t("manpower.planned")} {totals.planned} · {t("manpower.actual")} {totals.actual}
            </span>
          </div>
        )}
        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <FieldSelect value={company} onChange={setCompany} searchable allowCustom placeholder={t("manpower.selectCompany")}
              options={[{ value: "", label: t("common.none") }, ...companyOptions.map((c) => ({ value: c, label: c }))]} />
            <div className="grid grid-cols-2 gap-2">
              <FieldSelect value={trade} onChange={setTrade} searchable allowCustom placeholder={t("manpower.selectTrade")}
                options={tradeOptions.map((tr) => ({ value: tr, label: tr }))} />
              <input className={inputCls} type="number" min={0} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder={t("manpower.workers")} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!trade.trim()} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("manpower.addPlan")}</button>
        ))}
      </div>
    </Card>
  );
}

function CMManpowerPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const theme = useCMTheme();
  const qc = useQueryClient();
  const chartGrid = theme === "light" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const chartTick = theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)";
  const chartTooltipBg = theme === "light" ? "#ffffff" : "#181818";
  const chartTooltipBorder = theme === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)";
  const chartTooltipLabel = theme === "light" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)";
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: logs, isLoading } = useCMDailyLogs(projectId || undefined);
  const { data: roster } = useCMManpowerRoster(projectId || undefined);
  const { data: subcontractors } = useCMProjectSubcontractors(projectId || undefined);
  const { data: locations } = useCMProjectLocations(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "manpower", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "manpower", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "manpower", "delete");
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [view, setView] = useState<"company" | "trade" | "location">("company");
  const [sheet, setSheet] = useState<{ editIndex: number | null } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const dayLog = useMemo(() => (logs ?? []).find((l) => l.log_date === date), [logs, date]);
  const serverRows = dayLog?.manpower ?? [];

  // Optimistic local copy so the +/- steppers respond instantly; the debounced
  // persist below writes the whole array back to the day's shared Site Diary
  // record. Cleared whenever the underlying day changes.
  const [localRows, setLocalRows] = useState<CMManpowerRow[] | null>(null);
  useEffect(() => { setLocalRows(null); }, [projectId, date]);
  const rows = localRows ?? serverRows;

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (persistTimer.current) clearTimeout(persistTimer.current); }, []);

  const persistRows = async (next: CMManpowerRow[], action: string) => {
    if (!user || !projectId) return;
    const log = dayLog ?? await findOrCreateCMDailyLog(user.id, projectId, date);
    await updateCMDailyLog(log.id, { manpower: next });
    qc.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] });
    logCMActivity(projectId, user.id, action, "manpower", log.id, { date, entries: next.length });
  };

  const adjustCount = (index: number, delta: number) => {
    const next = rows.map((r, i) => (i === index ? { ...r, count: Math.max(0, r.count + delta) } : r));
    setLocalRows(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => { persistRows(next, "manpower_adjusted"); }, 700);
  };

  const removeRow = async (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    setLocalRows(next);
    setDeleteIndex(null);
    await persistRows(next, "manpower_removed");
  };

  const handleSheetSave = async (next: CMManpowerRow[]) => {
    setLocalRows(next);
    await persistRows(next, sheet?.editIndex != null ? "manpower_updated" : "manpower_added");
  };

  // Copy Previous Day: latest earlier log that actually has manpower, copied
  // in as a starting draft the engineer then adjusts with the steppers.
  const prevLog = useMemo(() => {
    return (logs ?? [])
      .filter((l) => l.log_date < date && l.manpower.length > 0)
      .sort((a, b) => b.log_date.localeCompare(a.log_date))[0];
  }, [logs, date]);

  const copyPreviousDay = async () => {
    if (!prevLog) return;
    const copied = prevLog.manpower.map((r) => ({ ...r }));
    setLocalRows(copied);
    await persistRows(copied, "manpower_copied");
  };

  // Picker suggestions: companies and trades the project already uses
  // (roster, assigned subcontractors, past entries) + spec default trades.
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster ?? []) if (r.company) set.add(r.company);
    for (const s of subcontractors ?? []) if (s.contact.company) set.add(s.contact.company);
    for (const l of logs ?? []) for (const m of l.manpower) if (m.company) set.add(m.company);
    return [...set].sort();
  }, [roster, subcontractors, logs]);

  const tradeOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_TRADES);
    for (const r of roster ?? []) set.add(r.trade);
    for (const s of subcontractors ?? []) if (s.contact.trade) set.add(s.contact.trade);
    for (const l of logs ?? []) for (const m of l.manpower) if (m.trade) set.add(m.trade);
    return [...set].sort();
  }, [roster, subcontractors, logs]);

  const locationLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations ?? []) map.set(l.id, locationBreadcrumb(l, locations ?? []));
    return map;
  }, [locations]);

  // Day summary — the "generate daily manpower summary" step of the spec's
  // first workflow, always live at the top of the screen.
  const summary = useMemo(() => {
    const companies = new Set<string>();
    const trades = new Set<string>();
    let workers = 0;
    for (const r of rows) {
      workers += r.count;
      if (r.company) companies.add(r.company.trim().toLowerCase());
      if (r.trade) trades.add(r.trade.trim().toLowerCase());
    }
    return { workers, companies: companies.size, trades: trades.size, hours: cmLaborHours(rows) };
  }, [rows]);

  // The day's rows grouped by the active view — By Company (default mobile
  // view per the spec), By Trade, or By Location. Empty keys sort last.
  const grouped = useMemo(() => {
    const keyOf = (row: CMManpowerRow) => {
      if (view === "trade") return row.trade.trim();
      if (view === "location") return row.location_id ? (locationLabelById.get(row.location_id) ?? "") : "";
      return row.company?.trim() || "";
    };
    const groups = new Map<string, { index: number; row: CMManpowerRow }[]>();
    rows.forEach((row, index) => {
      const key = keyOf(row);
      const list = groups.get(key) ?? [];
      list.push({ index, row });
      groups.set(key, list);
    });
    return [...groups.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));
  }, [rows, view, locationLabelById]);

  const emptyGroupLabel = view === "location" ? t("manpower.noLocation") : view === "trade" ? t("common.none") : t("manpower.noCompany");

  // Missing-submission detection (spec §19): assigned subcontractor
  // companies with nothing recorded for the selected day. Display only —
  // there's no email/SMS channel to push reminders through.
  const missingCompanies = useMemo(() => {
    const recorded = new Set(rows.map((r) => (r.company ?? "").trim().toLowerCase()).filter(Boolean));
    const assigned = new Map<string, string>();
    for (const s of subcontractors ?? []) {
      const name = s.contact.company?.trim();
      if (name) assigned.set(name.toLowerCase(), name);
    }
    return [...assigned.entries()].filter(([key]) => !recorded.has(key)).map(([, name]) => name).sort();
  }, [rows, subcontractors]);

  const daysWithManpower = useMemo(() => {
    let list = (logs ?? []).filter((l) => l.manpower.length > 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((l) => l.manpower.some((m) => [m.trade, m.company, m.activity, m.category].some((f) => f?.toLowerCase().includes(q))));
    list = [...list].sort((a, b) => a.log_date.localeCompare(b.log_date));
    return sortAsc ? list : [...list].reverse();
  }, [logs, search, sortAsc]);

  const chartData = useMemo(
    () => [...(logs ?? [])].sort((a, b) => a.log_date.localeCompare(b.log_date)).map((l) => ({ date: l.log_date, headcount: dailyHeadcount(l) })),
    [logs],
  );

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>{t("common.signInGoogle")}</button>
      </div>
    );
  }

  const stat = (label: string, value: string | number, accent = false) => (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="font-mono text-[16px] leading-none" style={accent ? { color: "#ff5100" } : undefined}>{value}</span>
      <span className="text-[9px] uppercase tracking-widest text-white/30 text-center">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("manpower.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <p className="text-[12px] text-white/35 mb-5">{t("manpower.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {/* Date selector — the shared Site Diary week strip; clearing
                the selection jumps back to today since Manpower always
                operates on a concrete day. */}
            <WeekCalendarStrip
              items={(logs ?? []).filter((l) => l.manpower.length > 0)}
              dateOf={(l) => l.log_date}
              lang={lang}
              selected={date}
              onSelect={(d) => setDate(d ?? todayStr())}
            />

            {/* Day summary */}
            <div className="rounded-2xl bg-[#0d0d0e] px-4 py-3.5 mb-3 grid grid-cols-5 gap-2">
              {stat(t("manpower.totalWorkersShort"), summary.workers, true)}
              {stat(t("manpower.companiesShort"), summary.companies)}
              {stat(t("manpower.tradesShort"), summary.trades)}
              {stat(t("manpower.normalHoursShort"), summary.hours.normal)}
              {stat(t("manpower.otHoursShort"), summary.hours.ot)}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mb-4">
              {canCreate && (
                <button onClick={() => setSheet({ editIndex: null })} className={`${smallBtn} px-4 py-2`} style={{ backgroundColor: "#ff5100", color: "#000" }}>
                  {t("manpower.addEntry")}
                </button>
              )}
              {canCreate && rows.length === 0 && prevLog && (
                <button onClick={copyPreviousDay} className={`${smallBtn} px-4 py-2 bg-white/10 text-white/70`}>
                  {t("manpower.copyPreviousDay")} ({prevLog.log_date})
                </button>
              )}
              {canCreate && (
                <button onClick={() => setShowImport(true)} className={`${smallBtn} px-4 py-2 bg-white/10 text-white/70`}>
                  {t("manpower.import.title")}
                </button>
              )}
            </div>

            {/* Missing daily manpower from assigned subcontractors */}
            {missingCompanies.length > 0 && date <= todayStr() && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 mb-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-amber-200/70 mb-1.5">{t("manpower.missingToday")} ({missingCompanies.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingCompanies.map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-full text-[10px] bg-amber-500/10 text-amber-200/80">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* The day's shared Site Diary manpower record, grouped by view */}
            {rows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-10 flex items-center justify-center text-center px-4 mb-4">
                <p className="text-white/40 text-sm">{t("manpower.noEntriesForDay")}</p>
              </div>
            )}
            {rows.length > 0 && (
              <div className="mb-3">
                <SegmentedField
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "company", label: t("manpower.byCompany") },
                    { value: "trade", label: t("manpower.byTrade") },
                    { value: "location", label: t("manpower.byLocation") },
                  ]}
                />
              </div>
            )}
            {grouped.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-4">
                {grouped.map(([groupKey, items]) => (
                  <div key={groupKey || "-"} className="rounded-2xl bg-[#0d0d0e] px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] text-white/75 font-medium truncate">{groupKey || emptyGroupLabel}</span>
                      <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{items.reduce((s, i) => s + i.row.count, 0)}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {items.map(({ index, row }) => (
                        <div key={index} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                          <button className="flex-1 min-w-0 text-left" onClick={() => canEdit && setSheet({ editIndex: index })} disabled={!canEdit}>
                            <p className="text-[12px] text-white/80 truncate">
                              {view === "company" ? row.trade : (row.company || row.trade)}
                              {row.category ? <span className="text-white/35"> · {t(`workerCategory.${row.category}`)}</span> : null}
                            </p>
                            <p className="text-[10px] text-white/30 truncate">
                              {[
                                view !== "company" && row.company ? row.trade : null,
                                view !== "location" && row.location_id ? locationLabelById.get(row.location_id) : null,
                                row.activity,
                                `${row.normal_hours ?? 8}h${(row.ot_hours ?? 0) > 0 ? ` + ${row.ot_hours} OT` : ""}`,
                              ].filter(Boolean).join(" · ")}
                            </p>
                            {(row.photos?.length ?? 0) > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {row.photos!.slice(0, 4).map((url, i) => (
                                  <img key={i} src={row.photo_thumbs?.[i] || url} alt="" className="w-9 h-9 rounded-md object-cover" />
                                ))}
                                {row.photos!.length > 4 && <span className="w-9 h-9 rounded-md bg-white/5 text-white/40 text-[10px] flex items-center justify-center">+{row.photos!.length - 4}</span>}
                              </div>
                            )}
                          </button>
                          {canEdit ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => adjustCount(index, -1)} className="w-7 h-7 rounded-lg bg-white/5 text-white/50 flex items-center justify-center text-[14px]" aria-label="decrease">−</button>
                              <span className="font-mono text-[13px] w-8 text-center">{row.count}</span>
                              <button onClick={() => adjustCount(index, 1)} className="w-7 h-7 rounded-lg bg-white/5 text-white/50 flex items-center justify-center text-[14px]" aria-label="increase">+</button>
                            </div>
                          ) : (
                            <span className="font-mono text-[13px] shrink-0">{row.count}</span>
                          )}
                          {canDelete && (
                            deleteIndex === index ? (
                              <button onClick={() => removeRow(index)} className="shrink-0 text-[9px] font-mono uppercase tracking-widest text-red-400 px-1.5">{t("common.delete")}</button>
                            ) : (
                              <button onClick={() => setDeleteIndex(index)} className="shrink-0 w-5 h-5 rounded-full text-white/20 hover:text-red-400 flex items-center justify-center">×</button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rows.length > 0 && (
              <p className="text-[10px] text-white/25 mb-5">{t("manpower.sharedWithSiteDiary")}</p>
            )}

            <div className="mb-4">
              <PlannedVsActualSection
                userId={user.id} projectId={projectId} date={date} rows={rows}
                canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
                companyOptions={companyOptions} tradeOptions={tradeOptions}
              />
            </div>

            <div className="mb-4">
              <AttendanceSection
                userId={user.id} projectId={projectId} date={date} rows={rows}
                canCreate={canCreate} canDelete={canDelete}
                companyOptions={companyOptions} tradeOptions={tradeOptions}
                onAddToHeadcount={async (crews) => {
                  const next = [...rows, ...crews];
                  setLocalRows(next);
                  await persistRows(next, "manpower_attendance_to_headcount");
                }}
              />
            </div>

            <div className="mb-4">
              <ManpowerRosterSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} />
            </div>

            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && chartData.length > 0 && (
              <div className="rounded-2xl bg-[#0d0d0e] p-4 mb-4" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tick={{ fill: chartTick, fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={{ background: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 12, fontSize: 11 }}
                      labelStyle={{ color: chartTooltipLabel }} />
                    <Bar dataKey="headcount" name={t("manpower.headcount")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {daysWithManpower.map((log) => (
                <button key={log.id} className="rounded-2xl bg-[#0d0d0e] px-4 py-3 text-left" onClick={() => setDate(log.log_date)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] text-white/70">{log.log_date}</span>
                    <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{t("manpower.total")} {dailyHeadcount(log)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {log.manpower.map((m, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-[10px] bg-white/5 text-white/60">
                        {m.company ? `${m.company} — ` : ""}{m.trade}: {m.count}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {showImport && projectId && (
        <ImportManpowerSheet
          projectId={projectId}
          date={date}
          onImport={async (imported) => {
            const next = [...rows, ...imported];
            setLocalRows(next);
            await persistRows(next, "manpower_imported");
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {sheet && projectId && (
        <ManpowerEntrySheet
          ownerId={user.id}
          projectId={projectId}
          rows={rows}
          editIndex={sheet.editIndex}
          companyOptions={companyOptions}
          tradeOptions={tradeOptions}
          onSave={handleSheetSave}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
