import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  BackButton, Sheet, FAB, PhotoPicker, ProjectPicker, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight,
} from "@/components/cm/shared";
import {
  useCMDailyLogs,
  createCMDailyLog,
  updateCMDailyLog,
  deleteCMDailyLog,
  uploadCMPhoto,
  type CMDailyLog,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/site-diary")({
  head: () => ({ meta: [{ title: "Site Diary — Construction Management App" }] }),
  component: CMSiteDiaryPage,
});

const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain", "Storm"];

function NewLogSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(WEATHER_OPTIONS[0]);
  const [temperature, setTemperature] = useState("");
  const [workforceCount, setWorkforceCount] = useState("");
  const [progressPct, setProgressPct] = useState("");
  const [activities, setActivities] = useState("");
  const [materials, setMaterials] = useState("");
  const [equipment, setEquipment] = useState("");
  const [issues, setIssues] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const log = await createCMDailyLog(ownerId, projectId, {
        log_date: logDate,
        weather,
        temperature_c: temperature ? Number(temperature) : null,
        workforce_count: workforceCount ? Number(workforceCount) : null,
        progress_pct: progressPct ? Number(progressPct) : null,
        activities: activities.trim() || null,
        materials_used: materials.trim() || null,
        equipment_used: equipment.trim() || null,
        issues: issues.trim() || null,
        notes: notes.trim() || null,
      });
      if (photos.length > 0) {
        const urls = await Promise.all(photos.map((f) => uploadCMPhoto(ownerId, projectId, f)));
        await updateCMDailyLog(log.id, { photos: urls });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diary entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("siteDiary.newEntry")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.date")}</span>
            <input type="date" className={inputCls} value={logDate} onChange={(e) => setLogDate(e.target.value)} required disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.progressPct")}</span>
            <input type="number" min={0} max={100} className={inputCls} value={progressPct} onChange={(e) => setProgressPct(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 col-span-1">
            <span className={labelCls}>{t("siteDiary.weather")}</span>
            <select className={inputCls} value={weather} onChange={(e) => setWeather(e.target.value)} disabled={saving}>
              {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{t(`weather.${w}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.tempC")}</span>
            <input type="number" className={inputCls} value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.workforce")}</span>
            <input type="number" min={0} className={inputCls} value={workforceCount} onChange={(e) => setWorkforceCount(e.target.value)} disabled={saving} />
          </label>
        </div>
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

function LogCard({ log, onChanged, onOpenPhoto }: { log: CMDailyLog; onChanged: () => void; onOpenPhoto: (photos: string[], index: number) => void }) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("siteDiary", log.id, () => setOpen(true));

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
            {log.workforce_count != null && <Field label={t("siteDiary.workforceField")} value={String(log.workforce_count)} />}
          </div>
          {log.materials_used && <Field label={t("siteDiary.materialsUsed")} value={log.materials_used} />}
          {log.equipment_used && <Field label={t("siteDiary.equipmentUsed")} value={log.equipment_used} />}
          {log.issues && <Field label={t("siteDiary.issues")} value={log.issues} accent="#f43f5e" />}
          {log.notes && <Field label={t("siteDiary.notes")} value={log.notes} />}
          {log.photos.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">{t("common.photos")}</p>
              <div className="flex flex-wrap gap-2">
                {log.photos.map((url, i) => (
                  <button key={url} type="button" data-photo-url={url} onClick={() => onOpenPhoto(log.photos, i)}
                    className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                    <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleDelete} disabled={busy} className="self-start font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
            {t("siteDiary.deleteEntry")}
          </button>
        </div>
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
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: logs, isLoading } = useCMDailyLogs(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] }); setShowNew(false); };

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
      <main className="max-w-md mx-auto w-full px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("siteDiary.title")}</h1>
        </div>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && (logs?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("siteDiary.noneYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(logs ?? []).map((l) => <LogCard key={l.id} log={l} onChanged={invalidate} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />)}
            </div>
            <FAB label={t("siteDiary.newEntryBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewLogSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {lightbox && (
        <PhotoLightbox
          items={lightbox.photos.map((url) => ({ url }))}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((lb) => lb && { ...lb, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
