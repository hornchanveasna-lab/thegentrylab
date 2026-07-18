import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FormPage, FAB, PhotoPicker, ProjectPicker, FieldSelect, RepeatingRows, useSelectedProject, inputCls, labelCls,
  setLastProject, moduleDetailRoute, MODULE_COLOR, MODULE_ICON,
  WeekCalendarStrip, CALENDAR_MONTH_LOCALE, SegmentedField, ConfirmationDialog, RecordDetailExtras, LocationSelect, DisciplineSelect,
  ManpowerEntrySheet, type RecordMenuItem,
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
  stampAndUploadCMPhotos,
  useActiveCMBOQItems,
  useCMManpowerRoster,
  useCMProjectSubcontractors,
  useCMProjectLocations,
  locationBreadcrumb,
  createCMInspection,
  updateCMInspection,
  createCMTask,
  updateCMTask,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  enabledDisciplines,
  type CMDailyLog,
  type CMDailyLogWithProject,
  type CMManpowerRow,
  type CMDeliveryRow,
  type CMVisitorRow,
  type CMVisitorKind,
  type CMDelayRow,
  type CMDelayCause,
  type CMPhotoModule,
  type Discipline,
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
type DeliveryDraft = CMDeliveryRow & { _pendingFiles?: File[] };
type VisitorDraft = CMVisitorRow & { _pendingFiles?: File[] };
const EMPTY_DELIVERY: DeliveryDraft = { material: "", quantity: "", unit: null, supplier: null, boq_item_id: null, photos: [], photo_thumbs: [], status: "Reported", certified_quantity: null };
const EMPTY_VISITOR: VisitorDraft = { name: "", organization: null, kind: "visitor", note: "", photos: [], photo_thumbs: [] };
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

type CapturePurpose = "progress" | "inspection" | "punchList" | "safety" | "delivery" | "manpower" | "equipment" | "delay" | "visitor" | "general";
const CAPTURE_PURPOSES: CapturePurpose[] = ["progress", "inspection", "punchList", "safety", "delivery", "manpower", "equipment", "delay", "visitor", "general"];
const CAPTURE_PURPOSE_ICON: Record<CapturePurpose, React.ReactNode> = {
  progress: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>,
  inspection: MODULE_ICON.inspection,
  punchList: MODULE_ICON.punchList,
  safety: MODULE_ICON.safety,
  delivery: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="9" width="14" height="9" rx="1" /><path d="M15 12h4l3 3v3h-7z" /><circle cx="6" cy="20" r="1.6" /><circle cx="17.5" cy="20" r="1.6" /></svg>,
  manpower: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a7 7 0 0 0-7 7v3h14v-3a7 7 0 0 0-7-7z" /><path d="M3 16h18" /></svg>,
  equipment: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4z" /></svg>,
  delay: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  visitor: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.2" r="2.1" /><path d="M3.3 20c0-3.3 2.5-5.6 5.7-5.6s5.7 2.3 5.7 5.6" /><path d="M14.8 14.9c2.5.4 4.4 2.5 4.4 5.1" /></svg>,
  general: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="13" height="16" rx="2" /><path d="M8 8.5h5M8 12.5h5" /></svg>,
};
const DISCIPLINE_PURPOSES = new Set<CapturePurpose>(["progress", "inspection", "punchList", "safety"]);

/** Photo-first quick capture: take/pick photos, tap one purpose, confirm a
 *  handful of fields, save — routes into whichever module or Site-Diary
 *  structured array that purpose corresponds to. Deliberately skips the
 *  spec's voice-note transcription and AI photo-grouping/suggestion
 *  features (sections 10-11), which need a speech/AI service this app
 *  doesn't have configured; every other field here is a direct tap/type. */
/** Purposes that add one row to a repeating array — these support the
 *  "Add Another" loop below, since logging several of the same thing
 *  (three crews, three deliveries) is common. Scalar purposes (a single
 *  free-text field) still close on save, since "add another" doesn't
 *  apply to them. */
const REPEATABLE_PURPOSES = new Set<CapturePurpose>(["delivery", "manpower", "delay", "visitor"]);

function CaptureSheet({ ownerId, projectId, disciplines, onClose, onSaved, onCreated }: {
  ownerId: string; projectId: string; disciplines: Discipline[]; onClose: () => void; onSaved: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [files, setFiles] = useState<File[]>([]);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [purpose, setPurpose] = useState<CapturePurpose | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [note, setNote] = useState("");
  const [company, setCompany] = useState("");
  const [count, setCount] = useState("1");
  const [hoursLost, setHoursLost] = useState("1");
  const [delayCause, setDelayCause] = useState<CMDelayCause>("Weather");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setPickerOpen(false);
    setSavedFlash(false);
  };

  const handleSave = async () => {
    if (!purpose || saving) return;
    setSaving(true);
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const uploaded = await stampAndUploadCMPhotos(ownerId, projectId, files);
      const urls = uploaded.map((u) => u.url);
      const thumbs = uploaded.map((u) => u.thumbUrl);
      const log = await findOrCreateCMDailyLog(ownerId, projectId, today);
      if (urls.length > 0) {
        await updateCMDailyLog(log.id, { photos: [...log.photos, ...urls], photo_thumbs: [...log.photo_thumbs, ...thumbs] });
      }

      if (purpose === "progress") {
        const text = [log.activities, note.trim()].filter(Boolean).join("\n");
        await updateCMDailyLog(log.id, { activities: text || null });
      } else if (purpose === "inspection") {
        const created = await createCMInspection(ownerId, projectId, { title: note.trim() || t("siteDiary.capture.inspection"), location_id: locationId, discipline, inspection_date: today });
        if (urls.length > 0) await updateCMInspection(created.id, { photos: urls, photo_thumbs: thumbs });
      } else if (purpose === "punchList") {
        const created = await createCMTask(ownerId, projectId, { title: note.trim() || t("siteDiary.capture.punchList"), location_id: locationId, priority: "Medium", status: "To Do" });
        if (urls.length > 0) await updateCMTask(created.id, { photos: urls, photo_thumbs: thumbs });
      } else if (purpose === "safety") {
        const created = await createCMSafetyRecord(ownerId, projectId, { title: note.trim() || t("siteDiary.capture.safety"), record_type: "Safety Observation", severity: "Low", record_date: today });
        if (urls.length > 0) await updateCMSafetyRecord(created.id, { photos: urls, photo_thumbs: thumbs });
      } else if (purpose === "delivery") {
        const row: CMDeliveryRow = { material: note.trim() || t("siteDiary.capture.delivery"), quantity: "", unit: null, supplier: company.trim() || null, boq_item_id: null, photos: urls, photo_thumbs: thumbs, status: "Reported", certified_quantity: null };
        await updateCMDailyLog(log.id, { deliveries: [...log.deliveries, row] });
      } else if (purpose === "manpower") {
        const row: CMManpowerRow = { trade: note.trim() || t("siteDiary.capture.manpower"), company: company.trim() || null, count: parseInt(count, 10) || 0, roster_item_id: null };
        await updateCMDailyLog(log.id, { manpower: [...log.manpower, row] });
      } else if (purpose === "equipment") {
        const text = [log.equipment_used, note.trim()].filter(Boolean).join("\n");
        await updateCMDailyLog(log.id, { equipment_used: text || null });
      } else if (purpose === "delay") {
        const row: CMDelayRow = { cause: delayCause, description: note.trim(), hours_lost: parseFloat(hoursLost) || 0 };
        await updateCMDailyLog(log.id, { delays: [...log.delays, row] });
      } else if (purpose === "visitor") {
        const row: CMVisitorRow = { name: note.trim() || t("siteDiary.capture.visitor"), organization: company.trim() || null, kind: "visitor", note: "", photos: urls, photo_thumbs: thumbs };
        await updateCMDailyLog(log.id, { visitors: [...log.visitors, row] });
      } else {
        const text = [log.notes, note.trim()].filter(Boolean).join("\n");
        await updateCMDailyLog(log.id, { notes: text || null });
      }
      if (purpose && REPEATABLE_PURPOSES.has(purpose)) {
        // Loop back to the photo step for the same purpose instead of
        // closing — logging several of the same thing (three crews, three
        // deliveries) shouldn't mean running the whole sheet from scratch
        // each time. The underlying data is already saved and refreshed;
        // closing via the sheet's own × is "Done" at any point from here.
        onSaved();
        setFiles([]);
        setNote("");
        setCompany("");
        setCount("1");
        setHoursLost("1");
        setDelayCause("Weather");
        setPickerOpen(true);
        setSavedFlash(true);
        setSaving(false);
        return;
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  if (files.length === 0 || pickerOpen) {
    return (
      <Sheet title={t("siteDiary.capture.title")} onClose={onClose}>
        <div className="px-6 pb-8 pt-4 flex flex-col gap-3">
          {savedFlash && (
            <p className="text-[12px] text-emerald-400">{t("siteDiary.capture.savedAddAnother")}</p>
          )}
          {files.length > 0 && (
            <button type="button" onClick={() => setPickerOpen(false)}
              className="self-start font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors mb-1">
              ← {t("siteDiary.capture.backToReview", { count: String(files.length) })}
            </button>
          )}
          <label className="relative flex flex-col items-center justify-center gap-3 py-10 rounded-3xl text-black cursor-pointer text-center transition-transform active:scale-[0.98]" style={{ backgroundColor: "#ff5100" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" />
            </svg>
            <span className="text-[13px] font-bold uppercase tracking-widest">{t("photos.takePhoto")}</span>
            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="relative flex flex-col items-center justify-center gap-3 py-10 rounded-3xl text-white/70 bg-white/5 hover:bg-white/10 cursor-pointer text-center transition-colors">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L4 20" />
            </svg>
            <span className="text-[13px] font-bold uppercase tracking-widest">{t("photos.chooseLibrary")}</span>
            <input type="file" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </Sheet>
    );
  }

  if (!purpose) {
    return (
      <Sheet title={t("siteDiary.capture.purposeTitle")} onClose={onClose}>
        <div className="px-6 pb-8 pt-2">
          <div className="flex flex-wrap gap-2 mb-4">
            {files.slice(0, 6).map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="w-12 h-12 rounded-lg object-cover" />)}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {CAPTURE_PURPOSES.map((p) => (
              <button key={p} type="button" onClick={() => setPurpose(p)}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors px-3 py-4 text-center">
                <span className="text-white/70">{CAPTURE_PURPOSE_ICON[p]}</span>
                <span className="text-[11px] text-white/80">{t(`siteDiary.capture.${p}`)}</span>
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t(`siteDiary.capture.${purpose}`)} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <button type="button" onClick={() => setPurpose(null)}
          className="self-start font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
          ← {t("siteDiary.capture.changePurpose")}
        </button>

        {(purpose === "progress" || purpose === "inspection" || purpose === "punchList" || purpose === "safety") && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("common.location")}</span>
            <LocationSelect projectId={projectId} value={locationId} onChange={setLocationId} disabled={saving} />
          </label>
        )}
        {DISCIPLINE_PURPOSES.has(purpose) && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("common.discipline")}</span>
            <DisciplineSelect value={discipline} onChange={setDiscipline} disabled={saving} disciplines={disciplines} />
          </label>
        )}
        {(purpose === "delivery" || purpose === "manpower" || purpose === "visitor") && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{purpose === "visitor" ? t("siteDiary.organization") : t("siteDiary.company")}</span>
            <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} disabled={saving} />
          </label>
        )}
        {purpose === "manpower" && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.headcount")}</span>
            <input type="number" min="0" className={inputCls} value={count} onChange={(e) => setCount(e.target.value)} disabled={saving} />
          </label>
        )}
        {purpose === "delay" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.delayCause")}</span>
              <FieldSelect value={delayCause} onChange={setDelayCause} disabled={saving} options={DELAY_CAUSE_OPTIONS.map((c) => ({ value: c, label: t(`siteDiary.delayCause.${c}`) }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.hoursLost")}</span>
              <input type="number" min="0" step="0.5" className={inputCls} value={hoursLost} onChange={(e) => setHoursLost(e.target.value)} disabled={saving} />
            </label>
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{purpose === "visitor" ? t("siteDiary.visitorName") : t("siteDiary.capture.note")}</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} autoFocus />
        </label>

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="button" onClick={handleSave} disabled={saving}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("inspection.saving") : t("common.save")}
        </button>
      </div>
    </Sheet>
  );
}

/** Uploads and stamps any pending photo files a draft row is carrying,
 *  merging the results into its persisted `photos`/`photo_thumbs` and
 *  stripping the transient `_pendingFiles` field before the row is saved —
 *  the same defer-until-submit model as the sheet's top-level Photos field,
 *  now shared by every row instead of Delivery/Visitor rows uploading
 *  immediately on pick. */
async function resolveDraftRowPhotos<T extends { photos?: string[] | null; photo_thumbs?: string[] | null; _pendingFiles?: File[] }>(
  ownerId: string, projectId: string, rows: T[],
): Promise<Omit<T, "_pendingFiles">[]> {
  return Promise.all(rows.map(async (r) => {
    const { _pendingFiles, ...rest } = r;
    if (_pendingFiles && _pendingFiles.length > 0) {
      const uploaded = await stampAndUploadCMPhotos(ownerId, projectId, _pendingFiles);
      return {
        ...rest,
        photos: [...(rest.photos ?? []), ...uploaded.map((u) => u.url)],
        photo_thumbs: [...(rest.photo_thumbs ?? []), ...uploaded.map((u) => u.thumbUrl)],
      };
    }
    return rest;
  }));
}

type LogSectionKey = "weather" | "manpower" | "deliveries" | "visitors" | "delays" | "notes";

export function NewLogSheet({ ownerId, projectId, existing, logs, backTo, onCreated }: {
  ownerId: string; projectId: string; existing?: CMDailyLog; logs?: (CMDailyLog | CMDailyLogWithProject)[];
  backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const { data: boqItems } = useActiveCMBOQItems(projectId);
  const { data: roster } = useCMManpowerRoster(projectId);
  const { data: subcontractors } = useCMProjectSubcontractors(projectId);
  const { data: locations } = useCMProjectLocations(projectId);

  // Company/trade suggestions for the reused Manpower quick-entry sheet,
  // sourced the same way as the Manpower module's own picker options.
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster ?? []) if (r.company) set.add(r.company);
    for (const s of subcontractors ?? []) if (s.contact.company) set.add(s.contact.company);
    return [...set].sort();
  }, [roster, subcontractors]);
  const tradeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster ?? []) set.add(r.trade);
    for (const s of subcontractors ?? []) if (s.contact.trade) set.add(s.contact.trade);
    return [...set].sort();
  }, [roster, subcontractors]);
  const locationLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations ?? []) map.set(l.id, locationBreadcrumb(l, locations ?? []));
    return map;
  }, [locations]);

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
  const [deliveries, setDeliveries] = useState<DeliveryDraft[]>(existing?.deliveries ?? []);
  const [visitors, setVisitors] = useState<VisitorDraft[]>(existing?.visitors ?? []);
  const [delays, setDelays] = useState<CMDelayRow[]>(existing?.delays ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The FAB's "New Entry" doesn't know in advance whether the selected date
  // already has a log — reactively pull it in here (by date, from the
  // already-loaded list) so reopening for a day with existing data shows
  // what's there instead of silently starting blank and clobbering it on
  // submit. Skipped when `existing` is passed directly (the Edit Entry path,
  // whose Date field is locked, so there's nothing for it to react to).
  useEffect(() => {
    if (existing) return;
    const match = logs?.find((l) => l.log_date === logDate);
    if (!match) return;
    setWeather(match.weather ?? WEATHER_OPTIONS[0]);
    setTemperature(match.temperature_c != null ? String(match.temperature_c) : "");
    setRainStart(match.rain_start_time ?? "");
    setRainEnd(match.rain_end_time ?? "");
    setProgressPct(match.progress_pct != null ? String(match.progress_pct) : "");
    setActivities(match.activities ?? "");
    setMaterials(match.materials_used ?? "");
    setEquipment(match.equipment_used ?? "");
    setIssues(match.issues ?? "");
    setNotes(match.notes ?? "");
    setManpower(match.manpower ?? []);
    setDeliveries(match.deliveries ?? []);
    setVisitors(match.visitors ?? []);
    setDelays(match.delays ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate, logs, existing]);

  const [manpowerSheet, setManpowerSheet] = useState<{ editIndex: number | null } | null>(null);
  const [manpowerDeleteIndex, setManpowerDeleteIndex] = useState<number | null>(null);
  const adjustManpowerCount = (index: number, delta: number) =>
    setManpower((prev) => prev.map((r, i) => (i === index ? { ...r, count: Math.max(0, r.count + delta) } : r)));
  const removeManpowerRow = (index: number) => { setManpower((prev) => prev.filter((_, i) => i !== index)); setManpowerDeleteIndex(null); };

  // True tabs: exactly one section visible at a time, one tap away via the
  // chip row below. Always starts on Weather regardless of which sections
  // already carry data — every section is one tap away either way.
  const [activeTab, setActiveTab] = useState<LogSectionKey>("weather");
  const TAB_OPTIONS = [
    { value: "weather" as const, label: t("siteDiary.weather"), badge: weather ? t(`weather.${weather}`) : undefined },
    { value: "manpower" as const, label: t("siteDiary.manpower"), badge: totalManpower(manpower) || undefined },
    { value: "deliveries" as const, label: t("siteDiary.deliveries"), badge: deliveries.length || undefined },
    { value: "visitors" as const, label: t("siteDiary.visitors"), badge: visitors.length || undefined },
    { value: "delays" as const, label: t("siteDiary.delays"), badge: delays.length || undefined },
    { value: "notes" as const, label: t("siteDiary.notes") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const [uploadedTopPhotos, resolvedDeliveries, resolvedVisitors] = await Promise.all([
        stampAndUploadCMPhotos(ownerId, projectId, photos),
        resolveDraftRowPhotos(ownerId, projectId, deliveries.filter((r) => r.material.trim())),
        resolveDraftRowPhotos(ownerId, projectId, visitors.filter((r) => r.name.trim())),
      ]);
      // Whether editing directly or creating for a day the preload effect
      // above already found, the form's local state is now the full desired
      // state either way — no more separate merge-vs-replace branches.
      const log = existing ?? await findOrCreateCMDailyLog(ownerId, projectId, logDate, {});
      await updateCMDailyLog(log.id, {
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
        deliveries: resolvedDeliveries,
        visitors: resolvedVisitors,
        delays: delays.filter((r) => r.description.trim()),
        photos: [...log.photos, ...uploadedTopPhotos.map((u) => u.url)],
        photo_thumbs: [...log.photo_thumbs, ...uploadedTopPhotos.map((u) => u.thumbUrl)],
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diary entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormPage title={t(existing ? "siteDiary.editEntry" : "siteDiary.newEntry")} backTo={backTo}>
      <div className="sticky top-0 z-10 bg-[#0a0a0b] pb-2 pt-1 -mx-4 px-4">
        <SegmentedField options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} disabled={saving} />
      </div>
      <form onSubmit={handleSubmit} className="pt-3 flex flex-col gap-4">
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

        {activeTab === "weather" && (
          <div className="flex flex-col gap-4">
            <SegmentedField value={weather} onChange={setWeather} disabled={saving}
              options={WEATHER_OPTIONS.map((w) => ({ value: w, label: t(`weather.${w}`), icon: WEATHER_ICON[w] }))} />
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.tempC")}</span>
              <input type="number" className={inputCls} value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={saving} />
            </label>
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
          </div>
        )}

        {activeTab === "manpower" && (
          <div className="flex flex-col gap-4">
            {manpower.length === 0 && <p className="text-white/30 text-[12px]">{t("manpower.noEntriesForDay")}</p>}
            <div className="flex flex-col gap-1.5">
              {manpower.map((row, index) => (
                <div key={index} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setManpowerSheet({ editIndex: index })} disabled={saving}>
                    <p className="text-[12px] text-white/80 truncate">{row.trade}{row.company ? ` — ${row.company}` : ""}</p>
                    <p className="text-[10px] text-white/30 truncate">
                      {[row.category ? t(`workerCategory.${row.category}`) : null, row.location_id ? locationLabelById.get(row.location_id) : null, row.activity].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => adjustManpowerCount(index, -1)} disabled={saving} className="w-7 h-7 rounded-lg bg-white/5 text-white/50 flex items-center justify-center text-[14px]" aria-label="decrease">−</button>
                    <span className="font-mono text-[13px] w-7 text-center">{row.count}</span>
                    <button type="button" onClick={() => adjustManpowerCount(index, 1)} disabled={saving} className="w-7 h-7 rounded-lg bg-white/5 text-white/50 flex items-center justify-center text-[14px]" aria-label="increase">+</button>
                  </div>
                  {manpowerDeleteIndex === index ? (
                    <button type="button" onClick={() => removeManpowerRow(index)} className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-red-400 px-1.5">{t("common.delete")}</button>
                  ) : (
                    <button type="button" onClick={() => setManpowerDeleteIndex(index)} className="shrink-0 w-6 h-6 rounded-full text-white/20 hover:text-red-400 flex items-center justify-center">×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setManpowerSheet({ editIndex: null })} disabled={saving}
              className="self-start font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("siteDiary.addManpower")}</button>
          </div>
        )}

        {activeTab === "deliveries" && (
          <div className="flex flex-col gap-4">
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
                  {(row.photos?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {row.photos!.map((url, i) => <img key={i} src={row.photo_thumbs?.[i] || url} alt="" className="w-12 h-12 rounded-lg object-cover" />)}
                    </div>
                  )}
                  <PhotoPicker photos={row._pendingFiles ?? []} setPhotos={(fn) => update({ _pendingFiles: fn(row._pendingFiles ?? []) })} disabled={saving} />
                </div>
              )}
            />
          </div>
        )}

        {activeTab === "visitors" && (
          <div className="flex flex-col gap-4">
            <RepeatingRows
              label={t("siteDiary.visitors")}
              addLabel={t("siteDiary.addVisitor")}
              rows={visitors}
              onChange={setVisitors}
              emptyRow={EMPTY_VISITOR}
              renderRow={(row, update) => (
                <div className="flex flex-col gap-2">
                  <SegmentedField value={row.kind} onChange={(v) => update({ kind: v })} disabled={saving}
                    options={VISITOR_KIND_OPTIONS.map((k) => ({ value: k, label: t(`siteDiary.visitorKind.${k}`) }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} placeholder={t("siteDiary.visitorName")} value={row.name} onChange={(e) => update({ name: e.target.value })} disabled={saving} />
                    <input className={inputCls} placeholder={t("siteDiary.organization")} value={row.organization ?? ""} onChange={(e) => update({ organization: e.target.value || null })} disabled={saving} />
                  </div>
                  <textarea className={`${inputCls} resize-y min-h-[40px]`} placeholder={t("siteDiary.note")} value={row.note} onChange={(e) => update({ note: e.target.value })} disabled={saving} />
                  {(row.photos?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {row.photos!.map((url, i) => <img key={i} src={row.photo_thumbs?.[i] || url} alt="" className="w-12 h-12 rounded-lg object-cover" />)}
                    </div>
                  )}
                  <PhotoPicker photos={row._pendingFiles ?? []} setPhotos={(fn) => update({ _pendingFiles: fn(row._pendingFiles ?? []) })} disabled={saving} />
                </div>
              )}
            />
          </div>
        )}

        {activeTab === "delays" && (
          <div className="flex flex-col gap-4">
            <RepeatingRows
              label={t("siteDiary.delays")}
              addLabel={t("siteDiary.addDelay")}
              rows={delays}
              onChange={setDelays}
              emptyRow={EMPTY_DELAY}
              renderRow={(row, update) => (
                <div className="flex flex-col gap-2">
                  <SegmentedField value={row.cause} onChange={(v) => update({ cause: v })} disabled={saving}
                    options={DELAY_CAUSE_OPTIONS.map((c) => ({ value: c, label: t(`siteDiary.delayCause.${c}`) }))} />
                  <input type="number" min={0} step="0.5" className={inputCls} placeholder={t("siteDiary.hoursLost")} value={row.hours_lost || ""} onChange={(e) => update({ hours_lost: Number(e.target.value) || 0 })} disabled={saving} />
                  <textarea className={`${inputCls} resize-y min-h-[40px]`} placeholder={t("siteDiary.description")} value={row.description} onChange={(e) => update({ description: e.target.value })} disabled={saving} />
                </div>
              )}
            />
          </div>
        )}

        {activeTab === "notes" && (
          <div className="flex flex-col gap-4">
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
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.issues")}</span>
              <textarea className={`${inputCls} resize-y min-h-[48px]`} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder={t("siteDiary.issuesPlaceholder")} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("siteDiary.notes")}</span>
              <textarea className={`${inputCls} resize-y min-h-[40px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
            </label>
          </div>
        )}

        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("siteDiary.saving") : t("siteDiary.saveEntry")}
        </button>
      </form>

      {manpowerSheet && (
        <ManpowerEntrySheet
          ownerId={ownerId} projectId={projectId}
          rows={manpower} editIndex={manpowerSheet.editIndex}
          companyOptions={companyOptions} tradeOptions={tradeOptions}
          onSave={async (next) => setManpower(next)}
          onClose={() => setManpowerSheet(null)}
        />
      )}
    </FormPage>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function LogCard({ log, projectName }: { log: CMDailyLog; projectName?: string }) {
  const { t } = useCMLang();
  return (
    <Link to="/cm/site-diary/$id" params={{ id: log.id }}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#0d0d0e] hover:bg-white/3 transition-colors">
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
    </Link>
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

/** One row inside Today's Activities / HSE: tap navigates straight into
 *  the record's own full page (via `moduleDetailRoute`, the same helper
 *  CMDailyActivityList's consumers use), with that record's own photos
 *  shown directly beneath it instead of everything pooled into one
 *  gallery. */
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
export function DayDetailContent({ log, projectName, canEdit, canDelete, userId, flashPhotoUrl, onChanged, onOpenPhoto, onMenuItems }: {
  log: CMDailyLog | CMDailyLogWithProject;
  projectName?: string;
  canEdit: boolean;
  canDelete: boolean;
  userId: string;
  flashPhotoUrl: string | null;
  onChanged: () => void;
  onOpenPhoto: (items: LightboxItem[], index: number) => void;
  /** Reports this record's Edit/Delete actions up to the parent page so
   *  they render in the page header's "⋮" menu (`RecordActionsMenu`)
   *  instead of as text links at the bottom of the page. */
  onMenuItems?: (items: RecordMenuItem[]) => void;
}) {
  const { t } = useCMLang();
  const navigate = useNavigate();
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

  useEffect(() => {
    const items: RecordMenuItem[] = [];
    if (canEdit) items.push({ label: t("siteDiary.editEntry"), onClick: () => navigate({ to: "/cm/site-diary/$id/edit", params: { id: log.id } }) });
    if (canDelete) items.push({ label: t("siteDiary.deleteEntry"), onClick: () => setConfirmingDelete(true), destructive: true, disabled: busy });
    onMenuItems?.(items);
  }, [canEdit, canDelete, busy, log.id]);

  const goTo = (to: "/cm/manpower" | "/cm/equipment" | "/cm/boq" | "/cm/photos") => { setLastProject(log.project_id); navigate({ to }); };
  const goToReport = () => {
    setLastProject(log.project_id);
    navigate({ to: "/cm/reports", search: { project: log.project_id, from: log.log_date, to: log.log_date } });
  };
  const openModuleItem = (module: CMPhotoModule, recordId: string) => {
    navigate(moduleDetailRoute(module, recordId));
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

      {confirmingDelete && (
        <ConfirmationDialog message={t("siteDiary.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}

      <RecordDetailExtras projectId={log.project_id} entityType="site_diary" module="siteDiary" entityId={log.id} userId={userId} />
    </div>
  );
}

function CMSiteDiaryPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const activeProject = projects.find((p) => p.id === projectId);
  const projectDisciplines = enabledDisciplines(activeProject);
  const canCreate = usePermission(projectId || undefined, user?.id, "site_diary", "create");
  const [viewAll, setViewAll] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const { data: singleLogs, isLoading: singleLoading } = useCMDailyLogs(!viewAll ? (projectId || undefined) : undefined);
  const { data: allLogs, isLoading: allLoading } = useAllCMDailyLogs(viewAll ? user?.id : undefined);
  const logs: (CMDailyLog | CMDailyLogWithProject)[] | undefined = viewAll ? allLogs : singleLogs;
  const isLoading = viewAll ? allLoading : singleLoading;
  const [showCapture, setShowCapture] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  // Picking a date jumps straight to that day's full page when it's
  // unambiguous (the common single-project case — one log per day).
  // When several projects reported the same date ("All projects"), the
  // date alone doesn't say which one to open, so just filter the list
  // and let the user tap the specific report's card.
  const selectDate = (date: string | null) => {
    setDateFilter(date);
    if (date) {
      const matches = (logs ?? []).filter((l) => l.log_date === date);
      if (matches.length === 1) navigate({ to: "/cm/site-diary/$id", params: { id: matches[0].id } });
    }
  };
  const clearDateFilter = () => setDateFilter(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_daily_logs", user?.id] });
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
        <ModuleHeader title={t("siteDiary.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/site-diary/settings" />
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        {!viewAll && projectId && canCreate && (
          <button type="button" onClick={() => setShowCapture(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 mb-4 text-[13px] font-bold uppercase tracking-widest text-black transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "#ff5100" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" />
            </svg>
            {t("siteDiary.captureBtn")}
          </button>
        )}

        {(viewAll || projectId) && (
          <>
            <WeekCalendarStrip items={logs ?? []} dateOf={(l) => l.log_date} lang={lang} selected={dateFilter} onSelect={selectDate} />

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
              <div className="flex flex-col gap-3">
                {visibleLogs.map((l) => (
                  <LogCard key={l.id} log={l} projectName={viewAll ? (l as CMDailyLogWithProject).projectName : undefined} />
                ))}
              </div>
            )}
            {!viewAll && canCreate && <FAB label={t("siteDiary.newEntryBtn")} onClick={() => navigate({ to: "/cm/site-diary/new" })} />}
          </>
        )}
      </main>

      {showCapture && !viewAll && projectId && canCreate && (
        <CaptureSheet ownerId={user.id} projectId={projectId} disciplines={projectDisciplines}
          onClose={() => setShowCapture(false)} onSaved={invalidate} onCreated={() => { invalidate(); setShowCapture(false); }} />
      )}
    </div>
  );
}
