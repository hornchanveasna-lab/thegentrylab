import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, ProjectPicker, FieldSelect, RepeatingRows, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, setPendingHighlight, MODULE_ROUTES, MODULE_COLOR, MODULE_ICON, CMDailyActivityList,
  MiniCalendar, ViewToggle, type ModuleView,
} from "@/components/cm/shared";
import {
  useCMDailyLogs,
  useAllCMDailyLogs,
  useCMDailyActivity,
  findOrCreateCMDailyLog,
  mergeDuplicateCMDailyLogs,
  flattenCMDailyActivityPhotos,
  updateCMDailyLog,
  deleteCMDailyLog,
  uploadCMPhotoWithThumb,
  useCMBOQItems,
  type CMDailyLog,
  type CMDailyLogWithProject,
  type CMManpowerRow,
  type CMDeliveryRow,
  type CMVisitorRow,
  type CMVisitorKind,
  type CMDelayRow,
  type CMDelayCause,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/site-diary")({
  head: () => ({ meta: [{ title: "Site Diary — Construction Management App" }] }),
  component: CMSiteDiaryPage,
});

const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain", "Storm"];
const VISITOR_KIND_OPTIONS: CMVisitorKind[] = ["visitor", "instruction"];
const DELAY_CAUSE_OPTIONS: CMDelayCause[] = ["Weather", "Material", "Labor", "Other"];

const EMPTY_MANPOWER: CMManpowerRow = { trade: "", company: null, count: 0 };
const EMPTY_DELIVERY: CMDeliveryRow = { material: "", quantity: "", unit: null, supplier: null, boq_item_id: null };
const EMPTY_VISITOR: CMVisitorRow = { name: "", organization: null, kind: "visitor", note: "" };
const EMPTY_DELAY: CMDelayRow = { cause: "Weather", description: "", hours_lost: 0 };

function totalManpower(rows: CMManpowerRow[]) {
  return rows.reduce((sum, r) => sum + (r.count || 0), 0);
}

function NewLogSheet({ ownerId, projectId, existing, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMDailyLog; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const { data: boqItems } = useCMBOQItems(projectId);
  const [logDate, setLogDate] = useState(() => existing?.log_date ?? new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(existing?.weather ?? WEATHER_OPTIONS[0]);
  const [temperature, setTemperature] = useState(existing?.temperature_c != null ? String(existing.temperature_c) : "");
  const [progressPct, setProgressPct] = useState(existing?.progress_pct != null ? String(existing.progress_pct) : "");
  const [activities, setActivities] = useState(existing?.activities ?? "");
  const [materials, setMaterials] = useState(existing?.materials_used ?? "");
  const [equipment, setEquipment] = useState(existing?.equipment_used ?? "");
  const [issues, setIssues] = useState(existing?.issues ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [manpower, setManpower] = useState<CMManpowerRow[]>(existing?.manpower ?? []);
  const [deliveries, setDeliveries] = useState<CMDeliveryRow[]>(existing?.deliveries ?? []);
  const [visitors, setVisitors] = useState<CMVisitorRow[]>(existing?.visitors ?? []);
  const [delays, setDelays] = useState<CMDelayRow[]>(existing?.delays ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const uploaded = photos.length > 0 ? await Promise.all(photos.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f))) : [];
      if (existing) {
        // Editing replaces the field values outright — the form was
        // preloaded with the entry's current contents, so what's on screen
        // now IS the full desired state (unlike create, there's no separate
        // "old" copy to merge against). Photos still only append, since
        // there's no per-photo remove control on this sheet.
        await updateCMDailyLog(existing.id, {
          weather: weather || null,
          temperature_c: temperature ? Number(temperature) : null,
          progress_pct: progressPct ? Number(progressPct) : null,
          activities: activities.trim() || null,
          materials_used: materials.trim() || null,
          equipment_used: equipment.trim() || null,
          issues: issues.trim() || null,
          notes: notes.trim() || null,
          manpower: manpower.filter((r) => r.trade.trim()),
          deliveries: deliveries.filter((r) => r.material.trim()),
          visitors: visitors.filter((r) => r.name.trim()),
          delays: delays.filter((r) => r.description.trim()),
          photos: [...existing.photos, ...uploaded.map((u) => u.url)],
          photo_thumbs: [...existing.photo_thumbs, ...uploaded.map((u) => u.thumbUrl)],
        });
      } else {
        // Find-or-create that day's single entry, then merge this submission's
        // fields into it (append rows/photos, keep new scalar values where the
        // form provided one) — this is the fix for the "one report per day"
        // duplicate-entry bug: re-opening "New Entry" for a day that already
        // has data adds to it instead of inserting a second row.
        const log = await findOrCreateCMDailyLog(ownerId, projectId, logDate, {});
        await updateCMDailyLog(log.id, {
          weather: weather || log.weather,
          temperature_c: temperature ? Number(temperature) : log.temperature_c,
          progress_pct: progressPct ? Number(progressPct) : log.progress_pct,
          activities: activities.trim() || log.activities,
          materials_used: materials.trim() || log.materials_used,
          equipment_used: equipment.trim() || log.equipment_used,
          issues: issues.trim() || log.issues,
          notes: notes.trim() || log.notes,
          manpower: [...log.manpower, ...manpower.filter((r) => r.trade.trim())],
          deliveries: [...log.deliveries, ...deliveries.filter((r) => r.material.trim())],
          visitors: [...log.visitors, ...visitors.filter((r) => r.name.trim())],
          delays: [...log.delays, ...delays.filter((r) => r.description.trim())],
          photos: [...log.photos, ...uploaded.map((u) => u.url)],
          photo_thumbs: [...log.photo_thumbs, ...uploaded.map((u) => u.thumbUrl)],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diary entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={t(existing ? "siteDiary.editEntry" : "siteDiary.newEntry")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.date")}</span>
            <input type="date" className={inputCls} value={logDate} onChange={(e) => setLogDate(e.target.value)} required disabled={saving || !!existing} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.progressPct")}</span>
            <input type="number" min={0} max={100} className={inputCls} value={progressPct} onChange={(e) => setProgressPct(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.weather")}</span>
            <FieldSelect value={weather} onChange={setWeather} disabled={saving} options={WEATHER_OPTIONS.map((w) => ({ value: w, label: t(`weather.${w}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.tempC")}</span>
            <input type="number" className={inputCls} value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={saving} />
          </label>
        </div>

        <RepeatingRows
          label={`${t("siteDiary.manpower")} (${t("siteDiary.total")}: ${totalManpower(manpower)})`}
          addLabel={t("siteDiary.addManpower")}
          rows={manpower}
          onChange={setManpower}
          emptyRow={EMPTY_MANPOWER}
          renderRow={(row, update) => (
            <div className="grid grid-cols-3 gap-2">
              <input className={inputCls} placeholder={t("siteDiary.trade")} value={row.trade} onChange={(e) => update({ trade: e.target.value })} disabled={saving} />
              <input className={inputCls} placeholder={t("siteDiary.company")} value={row.company ?? ""} onChange={(e) => update({ company: e.target.value || null })} disabled={saving} />
              <input type="number" min={0} className={inputCls} placeholder={t("siteDiary.headcount")} value={row.count || ""} onChange={(e) => update({ count: Number(e.target.value) || 0 })} disabled={saving} />
            </div>
          )}
        />

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.activities")}</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder={t("siteDiary.activitiesPlaceholder")} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.materialsUsed")}</span>
            <textarea className={`${inputCls} resize-y min-h-[48px]`} value={materials} onChange={(e) => setMaterials(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.equipmentUsed")}</span>
            <textarea className={`${inputCls} resize-y min-h-[48px]`} value={equipment} onChange={(e) => setEquipment(e.target.value)} disabled={saving} />
          </label>
        </div>
        <RepeatingRows
          label={t("siteDiary.deliveries")}
          addLabel={t("siteDiary.addDelivery")}
          rows={deliveries}
          onChange={setDeliveries}
          emptyRow={EMPTY_DELIVERY}
          renderRow={(row, update) => (
            <div className="flex flex-col gap-2">
              <FieldSelect
                value={row.boq_item_id ?? ""}
                onChange={(id) => {
                  if (!id) { update({ boq_item_id: null }); return; }
                  const item = (boqItems ?? []).find((b) => b.id === id);
                  update({ boq_item_id: id, material: item?.description ?? row.material, unit: item?.unit ?? row.unit });
                }}
                placeholder={t("siteDiary.customMaterial")}
                options={[{ value: "", label: t("siteDiary.customMaterial") }, ...(boqItems ?? []).map((b) => ({ value: b.id, label: b.description }))]}
                disabled={saving}
              />
              {!row.boq_item_id && (
                <input className={inputCls} placeholder={t("siteDiary.material")} value={row.material} onChange={(e) => update({ material: e.target.value })} disabled={saving} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder={t("siteDiary.quantity")} value={row.quantity} onChange={(e) => update({ quantity: e.target.value })} disabled={saving} />
                <input className={inputCls} placeholder={t("siteDiary.unit")} value={row.unit ?? ""} onChange={(e) => update({ unit: e.target.value || null })} disabled={saving} />
              </div>
              <input className={inputCls} placeholder={t("siteDiary.supplier")} value={row.supplier ?? ""} onChange={(e) => update({ supplier: e.target.value || null })} disabled={saving} />
            </div>
          )}
        />

        <RepeatingRows
          label={t("siteDiary.visitors")}
          addLabel={t("siteDiary.addVisitor")}
          rows={visitors}
          onChange={setVisitors}
          emptyRow={EMPTY_VISITOR}
          renderRow={(row, update) => (
            <div className="flex flex-col gap-2">
              <FieldSelect value={row.kind} onChange={(v) => update({ kind: v })} disabled={saving}
                options={VISITOR_KIND_OPTIONS.map((k) => ({ value: k, label: t(`siteDiary.visitorKind.${k}`) }))} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder={t("siteDiary.visitorName")} value={row.name} onChange={(e) => update({ name: e.target.value })} disabled={saving} />
                <input className={inputCls} placeholder={t("siteDiary.organization")} value={row.organization ?? ""} onChange={(e) => update({ organization: e.target.value || null })} disabled={saving} />
              </div>
              <textarea className={`${inputCls} resize-y min-h-[40px]`} placeholder={t("siteDiary.note")} value={row.note} onChange={(e) => update({ note: e.target.value })} disabled={saving} />
            </div>
          )}
        />

        <RepeatingRows
          label={t("siteDiary.delays")}
          addLabel={t("siteDiary.addDelay")}
          rows={delays}
          onChange={setDelays}
          emptyRow={EMPTY_DELAY}
          renderRow={(row, update) => (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <FieldSelect value={row.cause} onChange={(v) => update({ cause: v })} disabled={saving}
                  options={DELAY_CAUSE_OPTIONS.map((c) => ({ value: c, label: t(`siteDiary.delayCause.${c}`) }))} />
                <input type="number" min={0} step="0.5" className={inputCls} placeholder={t("siteDiary.hoursLost")} value={row.hours_lost || ""} onChange={(e) => update({ hours_lost: Number(e.target.value) || 0 })} disabled={saving} />
              </div>
              <textarea className={`${inputCls} resize-y min-h-[40px]`} placeholder={t("siteDiary.description")} value={row.description} onChange={(e) => update({ description: e.target.value })} disabled={saving} />
            </div>
          )}
        />

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.issues")}</span>
          <textarea className={`${inputCls} resize-y min-h-[48px]`} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder={t("siteDiary.issuesPlaceholder")} disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.notes")}</span>
          <textarea className={`${inputCls} resize-y min-h-[40px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("siteDiary.saving") : t("siteDiary.saveEntry")}
        </button>
      </form>
    </Sheet>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function LogCard({ log, projectName, onChanged, onOpenPhoto }: {
  log: CMDailyLog; projectName?: string; onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("siteDiary", log.id, () => setOpen(true));
  const { data: activity } = useCMDailyActivity(log.project_id, log.log_date, { enabled: open });

  // "Today's pictures" combines the diary's own photos with every other
  // module's photos from the same project+day, so this one gallery is the
  // full picture of what was captured that day — not just the diary's own.
  const allDayPhotos = useMemo(() => {
    const own = log.photos.map((url, i) => ({ url, thumbUrl: log.photo_thumbs[i] || url, module: "siteDiary" as const, recordId: log.id }));
    return [...own, ...flattenCMDailyActivityPhotos(activity)];
  }, [log, activity]);

  const handleDelete = async () => {
    if (!confirm(t("siteDiary.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMDailyLog(log.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{log.log_date}</span>
          {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
          {log.weather && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`weather.${log.weather}`)}</span>}
          {log.activities && <span className="text-[12px] text-white/45 truncate">{log.activities}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {log.progress_pct != null && <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{log.progress_pct}%</span>}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="transition-transform text-white/25" style={{ transform: open ? "rotate(180deg)" : "none" }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            {log.temperature_c != null && <Field label={t("siteDiary.temperature")} value={`${log.temperature_c}°C`} />}
            {log.manpower.length > 0 && <Field label={t("siteDiary.workforceField")} value={String(totalManpower(log.manpower))} />}
          </div>
          {log.manpower.length > 0 && (
            <Field label={t("siteDiary.manpower")} value={log.manpower.map((m) => `${m.company ? `${m.company} — ` : ""}${m.trade}: ${m.count}`).join(", ")} />
          )}
          {log.materials_used && <Field label={t("siteDiary.materialsUsed")} value={log.materials_used} />}
          {log.equipment_used && <Field label={t("siteDiary.equipmentUsed")} value={log.equipment_used} />}
          {log.deliveries.length > 0 && (
            <Field label={t("siteDiary.deliveries")} value={log.deliveries.map((d) => `${d.material} (${d.quantity}${d.unit ? ` ${d.unit}` : ""})${d.supplier ? ` — ${d.supplier}` : ""}`).join("; ")} />
          )}
          {log.visitors.length > 0 && (
            <Field label={t("siteDiary.visitors")} value={log.visitors.map((v) => `[${t(`siteDiary.visitorKind.${v.kind}`)}] ${v.name}${v.organization ? ` (${v.organization})` : ""}${v.note ? `: ${v.note}` : ""}`).join("; ")} />
          )}
          {log.delays.length > 0 && (
            <Field label={t("siteDiary.delays")} value={log.delays.map((d) => `${t(`siteDiary.delayCause.${d.cause}`)} — ${d.description} (${d.hours_lost}h)`).join("; ")} accent="#f43f5e" />
          )}
          {log.issues && <Field label={t("siteDiary.issues")} value={log.issues} accent="#f43f5e" />}
          {log.notes && <Field label={t("siteDiary.notes")} value={log.notes} />}
          <CMDailyActivityList activity={activity} projectId={log.project_id}
            onOpenItem={(module, recordId, projectId) => {
              setPendingHighlight(module, recordId, projectId, "");
              navigate({ to: MODULE_ROUTES[module] });
            }} />
          {allDayPhotos.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">{t("common.photos")}</p>
              <div className="flex flex-wrap gap-2">
                {allDayPhotos.map((p, i) => (
                  <button key={`${p.module}-${p.recordId}-${p.url}`} type="button" data-photo-url={p.url}
                    onClick={() => onOpenPhoto(allDayPhotos.map((d) => ({ url: d.url, thumbUrl: d.thumbUrl })), i)}
                    className={`relative rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === p.url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                    <img src={p.thumbUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                    <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-black/60" style={{ color: MODULE_COLOR[p.module] }}>
                      {MODULE_ICON[p.module]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
              {t("siteDiary.editEntry")}
            </button>
            <button onClick={handleDelete} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
              {t("siteDiary.deleteEntry")}
            </button>
          </div>
        </div>
      )}
      {editing && (
        <NewLogSheet ownerId={log.owner_id} projectId={log.project_id} existing={log}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: accent ?? "rgba(255,255,255,0.25)" }}>{label}</p>
      <p className="text-[12px] text-white/65 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

function CMSiteDiaryPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [viewAll, setViewAll] = useState(false);
  const [view, setView] = useState<ModuleView>("list");
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const { data: singleLogs, isLoading: singleLoading } = useCMDailyLogs(!viewAll ? (projectId || undefined) : undefined);
  const { data: allLogs, isLoading: allLoading } = useAllCMDailyLogs(viewAll ? user?.id : undefined);
  const logs: (CMDailyLog | CMDailyLogWithProject)[] | undefined = viewAll ? allLogs : singleLogs;
  const isLoading = viewAll ? allLoading : singleLoading;
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_daily_logs", user?.id] });
    setShowNew(false);
  };

  const pickerProjects = useMemo(() => [{ id: "all", name: t("photos.allProjects") }, ...projects], [projects, t]);
  const handlePickerChange = (id: string) => {
    if (id === "all") { setViewAll(true); return; }
    setViewAll(false);
    setProjectId(id);
  };

  // Silently merges any project+day that ended up with more than one entry
  // (see mergeDuplicateCMDailyLogs) whenever the log list loads — no button,
  // self-terminates once a re-fetch finds nothing left to merge.
  const mergingRef = useRef(false);
  useEffect(() => {
    if (!logs || logs.length === 0 || mergingRef.current) return;
    const counts = new Map<string, number>();
    for (const l of logs) {
      const key = `${l.project_id}|${l.log_date}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (![...counts.values()].some((c) => c > 1)) return;
    mergingRef.current = true;
    mergeDuplicateCMDailyLogs(logs).then((merged) => {
      if (merged) invalidate();
      mergingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  const visibleLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = logs ?? [];
    if (dateFilter) list = list.filter((l) => l.log_date === dateFilter);
    if (q) {
      list = list.filter((l) =>
        [l.activities, l.notes, l.materials_used, l.equipment_used, l.issues].some((f) => f?.toLowerCase().includes(q)));
    }
    return sortAsc ? [...list].reverse() : list;
  }, [logs, search, sortAsc, dateFilter]);

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
        <ModuleHeader title={t("siteDiary.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        <div className="flex justify-end mb-3">
          <ViewToggle view={view} onChange={setView} />
        </div>

        {dateFilter && (
          <button onClick={() => setDateFilter(null)} aria-label={t("common.clearFilter")}
            className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {dateFilter} <span className="text-[13px] leading-none">×</span>
          </button>
        )}

        {(viewAll || projectId) && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {view === "calendar" ? (
              <MiniCalendar items={logs ?? []} dateOf={(l) => l.log_date} lang={lang}
                onOpenDay={(dayItems) => { setDateFilter(dayItems[0].log_date); setView("list"); }} />
            ) : (
              <>
                {!isLoading && visibleLogs.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                    <p className="text-white/40 text-sm">{t("siteDiary.noneYet")}</p>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {visibleLogs.map((l) => (
                    <LogCard key={l.id} log={l} projectName={viewAll ? (l as CMDailyLogWithProject).projectName : undefined}
                      onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />
                  ))}
                </div>
              </>
            )}
            {!viewAll && <FAB label={t("siteDiary.newEntryBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && !viewAll && projectId && <NewLogSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {lightbox && (
        <PhotoLightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((lb) => lb && { ...lb, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
