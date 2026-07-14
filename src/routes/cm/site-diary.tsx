import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, ProjectPicker, FieldSelect, RepeatingRows, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, setPendingHighlight, setLastProject, MODULE_ROUTES, MODULE_COLOR, MODULE_ICON,
  MiniCalendar, CALENDAR_MONTH_LOCALE, SegmentedField, ConfirmationDialog,
} from "@/components/cm/shared";
import {
  useCMDailyLogs,
  useAllCMDailyLogs,
  useCMDailyActivity,
  useCMEquipment,
  useCMScheduleItems,
  projectPlanPercent,
  findOrCreateCMDailyLog,
  mergeDuplicateCMDailyLogs,
  flattenCMDailyActivityPhotos,
  updateCMDailyLog,
  deleteCMDailyLog,
  uploadCMPhotoWithThumb,
  useCMBOQItems,
  useCMManpowerRoster,
  useCMProjectSubcontractors,
  type CMDailyLog,
  type CMDailyLogWithProject,
  type CMManpowerRow,
  type CMDeliveryRow,
  type CMVisitorRow,
  type CMVisitorKind,
  type CMDelayRow,
  type CMDelayCause,
  type CMPhotoModule,
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
const RAIN_WEATHER = new Set(["Light Rain", "Heavy Rain", "Storm"]);

const EMPTY_MANPOWER: CMManpowerRow = { trade: "", company: null, count: 0, roster_item_id: null };
const EMPTY_DELIVERY: CMDeliveryRow = { material: "", quantity: "", unit: null, supplier: null, boq_item_id: null, photos: [], photo_thumbs: [] };
const EMPTY_VISITOR: CMVisitorRow = { name: "", organization: null, kind: "visitor", note: "", photos: [], photo_thumbs: [] };
const EMPTY_DELAY: CMDelayRow = { cause: "Weather", description: "", hours_lost: 0 };

function totalManpower(rows: CMManpowerRow[]) {
  return rows.reduce((sum, r) => sum + (r.count || 0), 0);
}

function rainHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round((minutes / 60) * 10) / 10;
}

/** Small tap-to-add photo strip reused wherever a sub-row (Visitor,
 *  Delivery) needs its own attachments — same upload-then-thumbnail
 *  pattern as the top-level PhotoPicker, just inline and immediate
 *  since these rows don't have a separate "save" step of their own. */
function RowPhotoPicker({ ownerId, projectId, photos, photoThumbs, onChange, disabled }: {
  ownerId: string; projectId: string; photos: string[]; photoThumbs: string[];
  onChange: (photos: string[], photoThumbs: string[]) => void; disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
      onChange([...photos, ...uploaded.map((u) => u.url)], [...photoThumbs, ...uploaded.map((u) => u.thumbUrl)]);
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (i: number) => onChange(photos.filter((_, idx) => idx !== i), photoThumbs.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-wrap gap-2">
      {photoThumbs.map((thumb, i) => (
        <div key={i} className="relative">
          <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover" />
          <button type="button" onClick={() => removeAt(i)} disabled={disabled}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/70 text-white/70 text-[10px] leading-none flex items-center justify-center">×</button>
        </div>
      ))}
      <label className={`w-12 h-12 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-white/30 text-[16px] cursor-pointer ${disabled || uploading ? "opacity-50 pointer-events-none" : ""}`}>
        {uploading ? "…" : "+"}
        <input type="file" accept="image/*" multiple className="hidden" disabled={disabled || uploading} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </label>
    </div>
  );
}

function NewLogSheet({ ownerId, projectId, existing, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMDailyLog; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const { data: boqItems } = useCMBOQItems(projectId);
  const { data: roster } = useCMManpowerRoster(projectId);
  const { data: subcontractors } = useCMProjectSubcontractors(projectId);

  // Manpower picker options merge two sources: the manually-maintained
  // roster and the distinct trade/company pairs already assigned as
  // Subcontractors — deduped by trade+company text so the same pairing
  // maintained in both places doesn't show twice.
  const manpowerOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string; trade: string; company: string | null }[] = [];
    for (const r of roster ?? []) {
      const key = `${r.trade}|${r.company ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ value: `roster:${r.id}`, label: r.company ? `${r.trade} — ${r.company}` : r.trade, trade: r.trade, company: r.company });
    }
    for (const s of subcontractors ?? []) {
      if (!s.contact.trade) continue;
      const key = `${s.contact.trade}|${s.contact.company ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: `sub:${s.id}`,
        label: s.contact.company ? `${s.contact.trade} — ${s.contact.company}` : s.contact.trade,
        trade: s.contact.trade,
        company: s.contact.company,
      });
    }
    return options;
  }, [roster, subcontractors]);
  const [logDate, setLogDate] = useState(() => existing?.log_date ?? new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(existing?.weather ?? WEATHER_OPTIONS[0]);
  const [temperature, setTemperature] = useState(existing?.temperature_c != null ? String(existing.temperature_c) : "");
  const [rainStart, setRainStart] = useState(existing?.rain_start_time ?? "");
  const [rainEnd, setRainEnd] = useState(existing?.rain_end_time ?? "");
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
          rain_start_time: RAIN_WEATHER.has(weather) ? rainStart || null : null,
          rain_end_time: RAIN_WEATHER.has(weather) ? rainEnd || null : null,
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
          rain_start_time: RAIN_WEATHER.has(weather) ? rainStart || log.rain_start_time : null,
          rain_end_time: RAIN_WEATHER.has(weather) ? rainEnd || log.rain_end_time : null,
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
        {RAIN_WEATHER.has(weather) && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.rainStart")}</span>
              <input type="time" className={inputCls} value={rainStart} onChange={(e) => setRainStart(e.target.value)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.rainEnd")}</span>
              <input type="time" className={inputCls} value={rainEnd} onChange={(e) => setRainEnd(e.target.value)} disabled={saving} />
            </label>
            {rainHours(rainStart, rainEnd) != null && (
              <p className="col-span-2 font-mono text-[10px] text-white/35">{t("siteDiary.rainHours", { hours: String(rainHours(rainStart, rainEnd)) })}</p>
            )}
          </div>
        )}

        <RepeatingRows
          label={`${t("siteDiary.manpower")} (${t("siteDiary.total")}: ${totalManpower(manpower)})`}
          addLabel={t("siteDiary.addManpower")}
          rows={manpower}
          onChange={setManpower}
          emptyRow={EMPTY_MANPOWER}
          renderRow={(row, update) => (
            <div className="flex flex-col gap-2">
              <FieldSelect
                value={row.roster_item_id ?? ""}
                onChange={(id) => {
                  if (!id) { update({ roster_item_id: null }); return; }
                  const item = manpowerOptions.find((o) => o.value === id);
                  update({ roster_item_id: id, trade: item?.trade ?? row.trade, company: item?.company ?? row.company });
                }}
                placeholder={t("siteDiary.customManpower")}
                options={[{ value: "", label: t("siteDiary.customManpower") }, ...manpowerOptions.map((o) => ({ value: o.value, label: o.label }))]}
                disabled={saving}
              />
              {!row.roster_item_id && (
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder={t("siteDiary.trade")} value={row.trade} onChange={(e) => update({ trade: e.target.value })} disabled={saving} />
                  <input className={inputCls} placeholder={t("siteDiary.company")} value={row.company ?? ""} onChange={(e) => update({ company: e.target.value || null })} disabled={saving} />
                </div>
              )}
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
              <RowPhotoPicker ownerId={ownerId} projectId={projectId} photos={row.photos ?? []} photoThumbs={row.photo_thumbs ?? []}
                onChange={(photos, photo_thumbs) => update({ photos, photo_thumbs })} disabled={saving} />
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
              <RowPhotoPicker ownerId={ownerId} projectId={projectId} photos={row.photos ?? []} photoThumbs={row.photo_thumbs ?? []}
                onChange={(photos, photo_thumbs) => update({ photos, photo_thumbs })} disabled={saving} />
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

function LogCard({ log, projectName, onSelect }: {
  log: CMDailyLog; projectName?: string; onSelect: (log: CMDailyLog, flashPhotoUrl?: string) => void;
}) {
  const { t } = useCMLang();
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("siteDiary", log.id);

  useEffect(() => {
    if (flash) onSelect(log, matchedPhotoUrl ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => onSelect(log)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{log.log_date}</span>
          {log.doc_number && <span className="font-mono text-[10px] text-white/30 shrink-0">{log.doc_number}</span>}
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
      className="w-full flex items-center gap-3 rounded-2xl bg-[#0d0d0e] hover:bg-white/4 px-4 py-3 transition-colors text-left">
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

const EQUIPMENT_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4z" />
  </svg>
);

const BOQ_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h9l3 3v17H6z" /><path d="M9 7h6M9 11h6M9 15h4" />
  </svg>
);

const VISITOR_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
  </svg>
);

const DELIVERY_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5z" /><path d="M3 8.5v7L12 20l9-4.5v-7" /><path d="M12 13v7" />
  </svg>
);

interface ActivityRow {
  module: CMPhotoModule;
  recordId: string;
  title: string;
  status: string;
  photos: string[];
  photo_thumbs: string[];
}

function toActivityRows<T extends { id: string; title: string; status: string; photos: string[]; photo_thumbs: string[] }>(
  rows: T[], module: CMPhotoModule,
): ActivityRow[] {
  return rows.map((r) => ({ module, recordId: r.id, title: r.title, status: r.status, photos: r.photos, photo_thumbs: r.photo_thumbs }));
}

/** One row inside Today's Activities / HSE: tap navigates into the real
 *  module (deep-linked via the same setPendingHighlight/MODULE_ROUTES
 *  pattern as CMDailyActivityList), with that record's own photos shown
 *  directly beneath it instead of everything pooled into one gallery. */
function ModuleActivityRow({ row, onOpenItem, onOpenPhoto, flashPhotoUrl }: {
  row: ActivityRow;
  onOpenItem: (module: CMPhotoModule, recordId: string) => void;
  onOpenPhoto: (items: LightboxItem[], index: number) => void;
  flashPhotoUrl: string | null;
}) {
  const thumbs = row.photo_thumbs ?? [];
  const urls = row.photos ?? [];
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => onOpenItem(row.module, row.recordId)}
        className="w-full flex items-center gap-2.5 rounded-xl bg-white/3 hover:bg-white/6 px-3 py-2 text-left transition-colors">
        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ color: MODULE_COLOR[row.module], backgroundColor: `${MODULE_COLOR[row.module]}22` }}>
          {MODULE_ICON[row.module]}
        </span>
        <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate">{row.title}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{row.status}</span>
      </button>
      {thumbs.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-3">
          {thumbs.map((thumb, i) => (
            <button key={i} type="button" data-photo-url={urls[i]}
              onClick={() => onOpenPhoto(thumbs.map((th, j) => ({ url: urls[j] || th, thumbUrl: th })), i)}
              className={`relative rounded-xl transition-shadow duration-500 ${flashPhotoUrl === urls[i] ? "ring-2 ring-[#ff5100]" : ""}`}>
              <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Site Diary's own Visitor/Delivery sub-rows: same shape as
 *  ModuleActivityRow but non-navigating (there's no dedicated module page
 *  for these — they live only inside the diary entry itself). */
function InlineActivityRow({ icon, title, subtitle, photos, photoThumbs, onOpenPhoto, flashPhotoUrl }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  photos: string[]; photoThumbs: string[];
  onOpenPhoto: (items: LightboxItem[], index: number) => void;
  flashPhotoUrl: string | null;
}) {
  const thumbs = photoThumbs ?? [];
  const urls = photos ?? [];
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full flex items-center gap-2.5 rounded-xl bg-white/3 px-3 py-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white/50 bg-white/5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-white/70 truncate">{title}</p>
          {subtitle && <p className="text-[10px] text-white/35 truncate">{subtitle}</p>}
        </div>
      </div>
      {thumbs.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-3">
          {thumbs.map((thumb, i) => (
            <button key={i} type="button" data-photo-url={urls[i]}
              onClick={() => onOpenPhoto(thumbs.map((th, j) => ({ url: urls[j] || th, thumbUrl: th })), i)}
              className={`relative rounded-xl transition-shadow duration-500 ${flashPhotoUrl === urls[i] ? "ring-2 ring-[#ff5100]" : ""}`}>
              <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The per-day screen: week strip to hop between days, icon-led weather +
 *  manpower + attachments (the latter two navigate to their real modules
 *  instead of expanding inline), the rest of the log's fields, and a
 *  Preview report link into the existing print-ready report for this day. */
/** The full detail content for one day — rendered directly inline on the
 *  list page (below the calendar strip + date chip) once a date is
 *  selected, rather than as a separate screen. No header/back-button/
 *  week-strip of its own since the page already provides those via
 *  CalendarStrip; a project name label is shown only in "all projects"
 *  mode, where more than one project can share the same selected date. */
function DayDetailContent({ log, projectName, canEdit, canDelete, flashPhotoUrl, onChanged, onOpenPhoto }: {
  log: CMDailyLog | CMDailyLogWithProject;
  projectName?: string;
  canEdit: boolean;
  canDelete: boolean;
  flashPhotoUrl: string | null;
  onChanged: () => void;
  onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [resourceTab, setResourceTab] = useState<"manpower" | "equipment">("manpower");
  const [workTab, setWorkTab] = useState<"progress" | "boq">("progress");
  const { data: activity } = useCMDailyActivity(log.project_id, log.log_date, { enabled: true });
  const { data: equipment } = useCMEquipment(log.project_id);
  const { data: scheduleItems } = useCMScheduleItems(log.project_id);

  const allDayPhotosCount = useMemo(() => log.photos.length + flattenCMDailyActivityPhotos(activity).length, [log, activity]);

  const planPct = useMemo(() => {
    if (!scheduleItems || scheduleItems.length === 0) return null;
    return Math.round(projectPlanPercent(scheduleItems, log.log_date));
  }, [scheduleItems, log.log_date]);

  const boqDeliveryCount = useMemo(() => log.deliveries.filter((d) => d.boq_item_id).length, [log.deliveries]);

  const activityRows = useMemo(() => activity ? [
    ...toActivityRows(activity.inspections, "inspection"),
    ...toActivityRows(activity.tasks, "punchList"),
    ...toActivityRows(activity.submittals, "submittal"),
  ] : [], [activity]);
  const hseRows = useMemo(() => (activity ? toActivityRows(activity.safetyRecords, "safety") : []), [activity]);

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMDailyLog(log.id); onChanged(); } finally { setBusy(false); }
  };

  const goTo = (to: "/cm/manpower" | "/cm/equipment" | "/cm/boq" | "/cm/photos") => { setLastProject(log.project_id); navigate({ to }); };
  const goToReport = () => {
    setLastProject(log.project_id);
    navigate({ to: "/cm/reports", search: { project: log.project_id, from: log.log_date, to: log.log_date } });
  };
  const openModuleItem = (module: CMPhotoModule, recordId: string) => {
    setPendingHighlight(module, recordId, log.project_id, "");
    navigate({ to: MODULE_ROUTES[module] });
  };
  const rainH = rainHours(log.rain_start_time, log.rain_end_time);

  return (
    <div className="flex flex-col gap-4">
      {(projectName || log.doc_number) && (
        <div className="flex items-center gap-2">
          {projectName && <p className="text-[12px] font-medium text-white/50">{projectName}</p>}
          {log.doc_number && <span className="font-mono text-[10px] text-white/30">{log.doc_number}</span>}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-2xl bg-[#0d0d0e] px-4 py-3">
        <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
          {log.weather ? WEATHER_ICON[log.weather] : WEATHER_ICON.Sunny}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-white/80">{log.weather ? t(`weather.${log.weather}`) : "—"}</p>
          <p className="font-mono text-[10px] text-white/35">
            {log.temperature_c != null ? `${log.temperature_c}°C` : t("siteDiary.temperature")}
            {rainH != null && ` · ${t("siteDiary.rainHours", { hours: String(rainH) })}`}
          </p>
        </div>
      </div>

      {log.activities && <Field label={t("siteDiary.activities")} value={log.activities} />}

      <div className="flex flex-col gap-3 rounded-2xl bg-[#0d0d0e] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>{t("siteDiary.resources")}</span>
          <SegmentedField
            options={[{ value: "manpower", label: t("siteDiary.manpowerTab") }, { value: "equipment", label: t("siteDiary.equipmentTab") }]}
            value={resourceTab} onChange={setResourceTab} />
        </div>
        {resourceTab === "manpower" ? (
          <CategoryRow icon={MANPOWER_ICON} label={t("siteDiary.manpower")} count={totalManpower(log.manpower)} onClick={() => goTo("/cm/manpower")} />
        ) : (
          <CategoryRow icon={EQUIPMENT_ICON} label={t("siteDiary.equipmentTab")} count={(equipment ?? []).length} onClick={() => goTo("/cm/equipment")} />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-[#0d0d0e] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>{t("siteDiary.workDone")}</span>
          <SegmentedField
            options={[{ value: "progress", label: t("siteDiary.progressTab") }, { value: "boq", label: t("siteDiary.boqTab") }]}
            value={workTab} onChange={setWorkTab} />
        </div>
        {workTab === "progress" ? (
          log.progress_pct != null ? (
            <div>
              <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
                {planPct != null && <span className="text-emerald-400/70">{t("siteDiary.plan")} {planPct}%</span>}
                <span style={{ color: "#ff5100" }}>{t("siteDiary.actual")} {log.progress_pct}%</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${log.progress_pct}%`, backgroundColor: "#ff5100" }} />
                {planPct != null && <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-300" style={{ left: `${Math.min(planPct, 100)}%` }} />}
              </div>
            </div>
          ) : <p className="text-[12px] text-white/30">—</p>
        ) : (
          <CategoryRow icon={BOQ_ICON} label={t("siteDiary.boqDeliveredToday", { count: String(boqDeliveryCount) })} onClick={() => goTo("/cm/boq")} />
        )}
        {log.photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {log.photos.map((url, i) => {
              const thumb = log.photo_thumbs[i] || url;
              return (
                <button key={url} type="button" data-photo-url={url}
                  onClick={() => onOpenPhoto(log.photos.map((u, j) => ({ url: u, thumbUrl: log.photo_thumbs[j] || u })), i)}
                  className={`relative rounded-xl transition-shadow duration-500 ${flashPhotoUrl === url ? "ring-2 ring-[#ff5100]" : ""}`}>
                  <img src={thumb} alt="" className="w-16 h-16 rounded-xl object-cover" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        {log.materials_used && <Field label={t("siteDiary.materialsUsed")} value={log.materials_used} />}
        {log.equipment_used && <Field label={t("siteDiary.equipmentUsed")} value={log.equipment_used} />}
      </div>
      {log.delays.length > 0 && (
        <Field label={t("siteDiary.delays")} value={log.delays.map((d) => `${t(`siteDiary.delayCause.${d.cause}`)} — ${d.description} (${d.hours_lost}h)`).join("; ")} accent="#f43f5e" />
      )}
      {log.issues && <Field label={t("siteDiary.issues")} value={log.issues} accent="#f43f5e" />}
      {log.notes && <Field label={t("siteDiary.notes")} value={log.notes} />}

      {(activityRows.length > 0 || log.visitors.length > 0 || log.deliveries.length > 0) && (
        <div className="flex flex-col gap-2">
          <span className={labelCls}>{t("siteDiary.activitiesSection")}</span>
          {activityRows.map((row) => (
            <ModuleActivityRow key={`${row.module}-${row.recordId}`} row={row} onOpenItem={openModuleItem} onOpenPhoto={onOpenPhoto} flashPhotoUrl={flashPhotoUrl} />
          ))}
          {log.visitors.map((v, i) => (
            <InlineActivityRow key={`visitor-${i}`} icon={VISITOR_ICON}
              title={`[${t(`siteDiary.visitorKind.${v.kind}`)}] ${v.name}`}
              subtitle={[v.organization, v.note].filter(Boolean).join(" — ") || undefined}
              photos={v.photos ?? []} photoThumbs={v.photo_thumbs ?? []} onOpenPhoto={onOpenPhoto} flashPhotoUrl={flashPhotoUrl} />
          ))}
          {log.deliveries.map((d, i) => (
            <InlineActivityRow key={`delivery-${i}`} icon={DELIVERY_ICON}
              title={d.material} subtitle={`${d.quantity}${d.unit ? ` ${d.unit}` : ""}${d.supplier ? ` — ${d.supplier}` : ""}`}
              photos={d.photos ?? []} photoThumbs={d.photo_thumbs ?? []} onOpenPhoto={onOpenPhoto} flashPhotoUrl={flashPhotoUrl} />
          ))}
        </div>
      )}

      {hseRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={labelCls}>{t("siteDiary.hse")}</span>
          {hseRows.map((row) => (
            <ModuleActivityRow key={`${row.module}-${row.recordId}`} row={row} onOpenItem={openModuleItem} onOpenPhoto={onOpenPhoto} flashPhotoUrl={flashPhotoUrl} />
          ))}
        </div>
      )}

      <CategoryRow icon={REPORT_ICON} label={t("siteDiary.previewReport")} onClick={goToReport} />

      <CategoryRow icon={PHOTOS_ICON} label={t("common.photos")} count={allDayPhotosCount} onClick={() => goTo("/cm/photos")} />

      <div className="flex items-center gap-4 pt-1">
        {canEdit && (
          <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
            {t("siteDiary.editEntry")}
          </button>
        )}
        {canDelete && (
          <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
            {t("siteDiary.deleteEntry")}
          </button>
        )}
      </div>
      {confirmingDelete && (
        <ConfirmationDialog message={t("siteDiary.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}

      {editing && canEdit && (
        <NewLogSheet ownerId={log.owner_id} projectId={log.project_id} existing={log}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
    </div>
  );
}

/** Replaces the old List/Calendar mode toggle with one always-visible
 *  screen: a 7-day week strip pinned above the list, swipeable left/right
 *  to page through weeks, plus a chevron/swipe-down handle that expands it
 *  into the full MiniCalendar month grid for browsing further back.
 *  Tapping a day (in either form) filters the list below instead of
 *  navigating away, so the day's content is visible immediately. */
function CalendarStrip({ logs, lang, dateFilter, onSelectDate, expanded, onToggleExpand }: {
  logs: (CMDailyLog | CMDailyLogWithProject)[];
  lang: CMLang;
  dateFilter: string | null;
  onSelectDate: (date: string | null) => void;
  expanded: boolean;
  onToggleExpand: (v: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [visibleWeek, setVisibleWeek] = useState(3);

  const logByDate = useMemo(() => {
    const map = new Map<string, CMDailyLog | CMDailyLogWithProject>();
    for (const l of logs) map.set(l.log_date, l);
    return map;
  }, [logs]);

  // Seven Monday-start weeks (three back, today's, three ahead) so each
  // page is exactly 7 days — the same shape as the old day-detail week
  // strip — and swiping left/right pages a full week at a time via
  // native scroll-snap instead of one long 35-day overflow row.
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
    if (!el) return;
    el.scrollLeft = 3 * el.clientWidth;
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setVisibleWeek(Math.round(el.scrollLeft / el.clientWidth));
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 40) onToggleExpand(true);
    else if (delta < -40) onToggleExpand(false);
    touchStartY.current = null;
  };

  if (expanded) {
    return (
      <div className="flex flex-col gap-2 mb-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <MiniCalendar items={logs} dateOf={(l) => l.log_date} lang={lang}
          onOpenDay={(dayItems) => { onSelectDate(dayItems[0].log_date); onToggleExpand(false); }} />
        <button type="button" onClick={() => onToggleExpand(false)}
          className="self-center text-white/25 hover:text-white/50 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <button type="button" onClick={() => onToggleExpand(true)}
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
              const entry = logByDate.get(d);
              const isSelected = d === dateFilter;
              const isToday = d === today;
              const dateObj = new Date(`${d}T00:00:00`);
              return (
                <button key={d} type="button" onClick={() => onSelectDate(isSelected ? null : d)}
                  className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">{dateObj.toLocaleDateString(CALENDAR_MONTH_LOCALE[lang], { weekday: "narrow" })}</span>
                  <span
                    className={`relative aspect-square w-9 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors ${
                      isSelected ? "text-black" : entry ? "text-white/80 bg-white/5" : "text-white/25"
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

function CMSiteDiaryPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const canCreate = usePermission(projectId || undefined, user?.id, "site_diary", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "site_diary", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "site_diary", "delete");
  const [viewAll, setViewAll] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const { data: singleLogs, isLoading: singleLoading } = useCMDailyLogs(!viewAll ? (projectId || undefined) : undefined);
  const { data: allLogs, isLoading: allLoading } = useAllCMDailyLogs(viewAll ? user?.id : undefined);
  const logs: (CMDailyLog | CMDailyLogWithProject)[] | undefined = viewAll ? allLogs : singleLogs;
  const isLoading = viewAll ? allLoading : singleLoading;
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [flashPhotoUrl, setFlashPhotoUrl] = useState<string | null>(null);
  // Which specific log (by id) to show full detail for. Only meaningful
  // when a date has more than one entry — i.e. "All projects" and several
  // projects reported the same day — where the date alone doesn't say
  // which one to open. Left null when picking a date from the calendar
  // (unknown which project yet); set together with dateFilter whenever a
  // specific card is tapped, so that always jumps straight to its detail.
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const selectDay = (log: CMDailyLog | CMDailyLogWithProject, photoUrl?: string) => {
    setDateFilter(log.log_date);
    setSelectedLogId(log.id);
    setFlashPhotoUrl(photoUrl ?? null);
  };
  const selectDate = (date: string | null) => {
    setDateFilter(date);
    setSelectedLogId(null);
    setFlashPhotoUrl(null);
  };
  const clearDateFilter = () => { setDateFilter(null); setSelectedLogId(null); setFlashPhotoUrl(null); };

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

        {(viewAll || projectId) && (
          <>
            <CalendarStrip logs={logs ?? []} lang={lang} dateFilter={dateFilter} onSelectDate={selectDate}
              expanded={calendarExpanded} onToggleExpand={setCalendarExpanded} />

            {dateFilter && (
              <button onClick={clearDateFilter} aria-label={t("common.clearFilter")}
                className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
                {dateFilter} <span className="text-[13px] leading-none">×</span>
              </button>
            )}

            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && visibleLogs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("siteDiary.noneYet")}</p>
              </div>
            )}
            {visibleLogs.length > 0 && (
              dateFilter ? (
                visibleLogs.length === 1 || selectedLogId ? (
                  (() => {
                    const log = (selectedLogId && visibleLogs.find((l) => l.id === selectedLogId)) || visibleLogs[0];
                    return (
                      <div className="flex flex-col gap-3">
                        {visibleLogs.length > 1 && (
                          <button onClick={() => setSelectedLogId(null)}
                            className="self-start flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {t("siteDiary.backToProjects")}
                          </button>
                        )}
                        <DayDetailContent log={log} projectName={viewAll ? (log as CMDailyLogWithProject).projectName : undefined}
                          canEdit={canEdit} canDelete={canDelete}
                          flashPhotoUrl={flashPhotoUrl} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />
                      </div>
                    );
                  })()
                ) : (
                  // Several projects reported this same date ("All projects") —
                  // show who has a report first, so it's easy to scan, then
                  // drill into one to see its full content.
                  <div className="flex flex-col gap-3">
                    {visibleLogs.map((l) => (
                      <LogCard key={l.id} log={l} projectName={(l as CMDailyLogWithProject).projectName} onSelect={selectDay} />
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleLogs.map((l) => (
                    <LogCard key={l.id} log={l} projectName={viewAll ? (l as CMDailyLogWithProject).projectName : undefined}
                      onSelect={selectDay} />
                  ))}
                </div>
              )
            )}
            {!viewAll && canCreate && <FAB label={t("siteDiary.newEntryBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && !viewAll && projectId && canCreate && <NewLogSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

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
