import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  ModuleHeader, BackButton, Sheet, FAB, PhotoPicker, ProjectPicker, FieldSelect, RepeatingRows, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, setPendingHighlight, setLastProject, MODULE_ROUTES, MODULE_COLOR, MODULE_ICON, CMDailyActivityList,
  MiniCalendar, ViewToggle, CALENDAR_MONTH_LOCALE, type ModuleView,
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

const WEATHER_ICON: Record<string, React.ReactNode> = {
  Sunny: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </svg>
  ),
  "Partly Cloudy": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="8.5" r="3.3" />
      <path d="M8.5 2.8v1.7M3.6 5.9l1.3 1.3M2.2 10.9h1.7" />
      <path d="M9.8 20.2h8.6a3.6 3.6 0 0 0 .5-7.16 4.6 4.6 0 0 0-8.83-1.5 3.9 3.9 0 0 0-3.17 3.86c0 .3.03.58.09.86A3.6 3.6 0 0 0 9.8 20.2z" />
    </svg>
  ),
  Cloudy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.8 19.2h11.4a3.9 3.9 0 0 0 .5-7.77 5 5 0 0 0-9.6-1.63 4.3 4.3 0 0 0-3.44 4.2c0 .33.03.64.1.95A3.9 3.9 0 0 0 6.8 19.2z" />
    </svg>
  ),
  "Light Rain": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.3 15.2h11.4a3.9 3.9 0 0 0 .5-7.77 5 5 0 0 0-9.6-1.63 4.3 4.3 0 0 0-3.44 4.2c0 .33.03.64.1.95a3.9 3.9 0 0 0 1.04 4.25z" />
      <path d="M9 18.4l-1 2.2M13 18.4l-1 2.2" />
    </svg>
  ),
  "Heavy Rain": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.3 14.2h11.4a3.9 3.9 0 0 0 .5-7.77 5 5 0 0 0-9.6-1.63 4.3 4.3 0 0 0-3.44 4.2c0 .33.03.64.1.95a3.9 3.9 0 0 0 1.04 4.25z" />
      <path d="M7.5 17.4l-1.2 2.7M12 17.4l-1.2 2.7M16.5 17.4l-1.2 2.7" />
    </svg>
  ),
  Storm: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.3 12.7h11.4a3.9 3.9 0 0 0 .5-7.77 5 5 0 0 0-9.6-1.63 4.3 4.3 0 0 0-3.44 4.2c0 .33.03.64.1.95a3.9 3.9 0 0 0 1.04 4.25z" />
      <path d="M13 14.5l-3 4.2h2.6l-2 4.3 4.6-5.4h-2.6l1.9-3.1z" strokeLinejoin="round" />
    </svg>
  ),
};
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

function LogCard({ log, projectName, onOpen }: {
  log: CMDailyLog; projectName?: string; onOpen: (log: CMDailyLog, flashPhotoUrl?: string) => void;
}) {
  const { t } = useCMLang();
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("siteDiary", log.id);

  useEffect(() => {
    if (flash) onOpen(log, matchedPhotoUrl ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => onOpen(log)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{log.log_date}</span>
          {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
          {log.weather && (
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">
              {WEATHER_ICON[log.weather]}
              {t(`weather.${log.weather}`)}
            </span>
          )}
          {log.activities && <span className="text-[12px] text-white/45 truncate">{log.activities}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {log.progress_pct != null && <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{log.progress_pct}%</span>}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-white/25">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
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

function CategoryRow({ icon, label, count, onClick }: {
  icon: React.ReactNode; label: string; count?: number; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl bg-[#0d0d0e] hover:bg-white/[0.04] px-4 py-3 transition-colors text-left">
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white/70 bg-white/5">{icon}</span>
      <span className="flex-1 min-w-0 text-[13px] text-white/80">{label}</span>
      {count != null && <span className="font-mono text-[12px] text-white/40 shrink-0">{count}</span>}
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-white/25 shrink-0">
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

const MANPOWER_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a7 7 0 0 0-7 7v3h14v-3a7 7 0 0 0-7-7z" /><path d="M3 16h18" /><path d="M12 3v3" />
  </svg>
);

const PHOTOS_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.4" /><circle cx="17.6" cy="10.4" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

const REPORT_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" />
  </svg>
);

/** The per-day screen: week strip to hop between days, icon-led weather +
 *  manpower + attachments (the latter two navigate to their real modules
 *  instead of expanding inline), the rest of the log's fields, and a
 *  Preview report link into the existing print-ready report for this day. */
function DayDetailView({ log, projectName, allLogs, flashPhotoUrl, onBack, onOpen, onChanged, onOpenPhoto }: {
  log: CMDailyLog | CMDailyLogWithProject;
  projectName?: string;
  allLogs: (CMDailyLog | CMDailyLogWithProject)[];
  flashPhotoUrl: string | null;
  onBack: () => void;
  onOpen: (log: CMDailyLog | CMDailyLogWithProject, flashPhotoUrl?: string) => void;
  onChanged: () => void;
  onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: activity } = useCMDailyActivity(log.project_id, log.log_date, { enabled: true });

  const allDayPhotos = useMemo(() => {
    const own = log.photos.map((url, i) => ({ url, thumbUrl: log.photo_thumbs[i] || url, module: "siteDiary" as const, recordId: log.id }));
    return [...own, ...flattenCMDailyActivityPhotos(activity)];
  }, [log, activity]);

  const weekDates = useMemo(() => {
    const base = new Date(`${log.log_date}T00:00:00`);
    const monOffset = (base.getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - monOffset + i);
      return d.toISOString().slice(0, 10);
    });
  }, [log.log_date]);

  const logByDate = useMemo(() => {
    const map = new Map<string, CMDailyLog | CMDailyLogWithProject>();
    for (const l of allLogs) if (l.project_id === log.project_id) map.set(l.log_date, l);
    return map;
  }, [allLogs, log.project_id]);

  const handleDelete = async () => {
    if (!confirm(t("siteDiary.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMDailyLog(log.id); onChanged(); onBack(); } finally { setBusy(false); }
  };

  const goTo = (to: "/cm/manpower" | "/cm/photos") => { setLastProject(log.project_id); navigate({ to }); };
  const goToReport = () => {
    setLastProject(log.project_id);
    navigate({ to: "/cm/reports", search: { project: log.project_id, from: log.log_date, to: log.log_date } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-white truncate">{log.log_date}</h2>
          {projectName && <p className="text-[11px] text-white/40 truncate">{projectName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((d) => {
          const entry = logByDate.get(d);
          const isSelected = d === log.log_date;
          const dateObj = new Date(`${d}T00:00:00`);
          return (
            <button key={d} type="button" disabled={!entry} onClick={() => entry && onOpen(entry)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-colors ${isSelected ? "text-black" : entry ? "text-white/70 hover:bg-white/5" : "text-white/15"}`}
              style={isSelected ? { backgroundColor: "#ff5100" } : undefined}>
              <span className="font-mono text-[9px] uppercase tracking-widest">{dateObj.toLocaleDateString(CALENDAR_MONTH_LOCALE[lang], { weekday: "narrow" })}</span>
              <span className="text-[13px] font-bold">{dateObj.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-[#0d0d0e] px-4 py-3">
        <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
          {log.weather ? WEATHER_ICON[log.weather] : WEATHER_ICON.Sunny}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-white/80">{log.weather ? t(`weather.${log.weather}`) : "—"}</p>
          <p className="font-mono text-[10px] text-white/35">{log.temperature_c != null ? `${log.temperature_c}°C` : t("siteDiary.temperature")}</p>
        </div>
      </div>

      {log.progress_pct != null && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={labelCls}>{t("siteDiary.progressPct")}</span>
            <span className="font-mono text-[11px]" style={{ color: "#ff5100" }}>{log.progress_pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${log.progress_pct}%`, backgroundColor: "#ff5100" }} />
          </div>
        </div>
      )}

      {log.activities && <Field label={t("siteDiary.activities")} value={log.activities} />}

      <CategoryRow icon={MANPOWER_ICON} label={t("siteDiary.manpower")} count={totalManpower(log.manpower)} onClick={() => goTo("/cm/manpower")} />
      <CategoryRow icon={PHOTOS_ICON} label={t("common.photos")} count={allDayPhotos.length} onClick={() => goTo("/cm/photos")} />

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        {log.materials_used && <Field label={t("siteDiary.materialsUsed")} value={log.materials_used} />}
        {log.equipment_used && <Field label={t("siteDiary.equipmentUsed")} value={log.equipment_used} />}
      </div>
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
                className={`relative rounded-xl transition-shadow duration-500 ${flashPhotoUrl === p.url ? "ring-2 ring-[#ff5100]" : ""}`}>
                <img src={p.thumbUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-black/60" style={{ color: MODULE_COLOR[p.module] }}>
                  {MODULE_ICON[p.module]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CategoryRow icon={REPORT_ICON} label={t("siteDiary.previewReport")} onClick={goToReport} />

      <div className="flex items-center gap-4 pt-1">
        <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
          {t("siteDiary.editEntry")}
        </button>
        <button onClick={handleDelete} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
          {t("siteDiary.deleteEntry")}
        </button>
      </div>

      {editing && (
        <NewLogSheet ownerId={log.owner_id} projectId={log.project_id} existing={log}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
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
  const { data: singleLogs, isLoading: singleLoading } = useCMDailyLogs(!viewAll ? (projectId || undefined) : undefined);
  const { data: allLogs, isLoading: allLoading } = useAllCMDailyLogs(viewAll ? user?.id : undefined);
  const logs: (CMDailyLog | CMDailyLogWithProject)[] | undefined = viewAll ? allLogs : singleLogs;
  const isLoading = viewAll ? allLoading : singleLoading;
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const [openFlashPhotoUrl, setOpenFlashPhotoUrl] = useState<string | null>(null);
  // Derived from the live `logs` query (rather than a stashed object) so
  // edits made from inside DayDetailView show up immediately on refetch.
  const openLog = useMemo(() => (logs ?? []).find((l) => l.id === openLogId) ?? null, [logs, openLogId]);

  const openDay = (log: CMDailyLog | CMDailyLogWithProject, flashPhotoUrl?: string) => {
    setOpenLogId(log.id);
    setOpenFlashPhotoUrl(flashPhotoUrl ?? null);
  };

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
    if (q) {
      list = list.filter((l) =>
        [l.activities, l.notes, l.materials_used, l.equipment_used, l.issues].some((f) => f?.toLowerCase().includes(q)));
    }
    return sortAsc ? [...list].reverse() : list;
  }, [logs, search, sortAsc]);

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
        {openLog ? (
          <DayDetailView log={openLog} projectName={viewAll ? (openLog as CMDailyLogWithProject).projectName : undefined}
            allLogs={logs ?? []} flashPhotoUrl={openFlashPhotoUrl}
            onBack={() => { setOpenLogId(null); setOpenFlashPhotoUrl(null); }}
            onOpen={openDay} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />
        ) : (
          <>
            <ModuleHeader title={t("siteDiary.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
            <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

            <div className="flex justify-end mb-3">
              <ViewToggle view={view} onChange={setView} />
            </div>

            {(viewAll || projectId) && (
              <>
                {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
                {view === "calendar" ? (
                  <MiniCalendar items={logs ?? []} dateOf={(l) => l.log_date} lang={lang}
                    onOpenDay={(dayItems) => openDay(dayItems[0])} />
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
                          onOpen={openDay} />
                      ))}
                    </div>
                  </>
                )}
                {!viewAll && <FAB label={t("siteDiary.newEntryBtn")} onClick={() => setShowNew(true)} />}
              </>
            )}
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
