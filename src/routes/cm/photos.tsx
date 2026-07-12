import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  BackButton, Sheet, FAB, ProjectPicker, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, MODULE_ROUTES, setPendingHighlight,
} from "@/components/cm/shared";
import {
  useAllCMPhotos,
  useCMAccountSettings,
  upsertCMAccountSettings,
  stampPhoto,
  uploadCMPhoto,
  createCMDailyLog,
  updateCMDailyLog,
  createCMInspection,
  updateCMInspection,
  createCMTask,
  updateCMTask,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  createCMSubmittal,
  updateCMSubmittal,
  type CMPhotoModule,
  type CMPhotoWithContext,
  type CMProject,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/photos")({
  head: () => ({ meta: [{ title: "Photos — Construction Management App" }] }),
  component: CMPhotosPage,
});

const MODULE_OPTIONS: CMPhotoModule[] = ["siteDiary", "inspection", "punchList", "safety", "submittal"];
type GroupBy = "date" | "project" | "type";
const GROUP_OPTIONS: GroupBy[] = ["date", "project", "type"];

function ToggleRow({ icon, label, hint, checked, disabled, onChange }: {
  icon: React.ReactNode; label: string; hint: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,81,0,0.14)", color: "#ff5100" }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white/85 font-medium">{label}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className="w-11 h-6 rounded-full relative shrink-0 transition-colors disabled:opacity-40"
        style={{ backgroundColor: checked ? "#ff5100" : "rgba(255,255,255,0.15)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }} />
      </button>
    </div>
  );
}

function PhotoSettingsSheet({ ownerId, watermark, timestamp, onClose, onChanged }: {
  ownerId: string; watermark: boolean; timestamp: boolean; onClose: () => void; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);

  const toggle = async (patch: { photo_watermark?: boolean; photo_timestamp?: boolean }) => {
    setBusy(true);
    try { await upsertCMAccountSettings(ownerId, patch); onChanged(); } finally { setBusy(false); }
  };

  return (
    <Sheet title={t("photos.settingsTitle")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-3">
        <ToggleRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.2 2.2 4.8-4.8" strokeWidth="1.6" />
            </svg>
          }
          label={t("photos.watermark")} hint={t("photos.watermarkHint")} checked={watermark} disabled={busy}
          onChange={(v) => toggle({ photo_watermark: v })}
        />
        <ToggleRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" />
            </svg>
          }
          label={t("photos.timestamp")} hint={t("photos.timestampHint")} checked={timestamp} disabled={busy}
          onChange={(v) => toggle({ photo_timestamp: v })}
        />
      </div>
    </Sheet>
  );
}

function NewPhotoSheet({ ownerId, projects, projectId, setProjectId, companyName, watermark, timestamp, onClose, onCreated }: {
  ownerId: string;
  projects: CMProject[];
  projectId: string;
  setProjectId: (id: string) => void;
  companyName: string | null;
  watermark: boolean;
  timestamp: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [files, setFiles] = useState<File[]>([]);
  const [moduleSel, setModuleSel] = useState<CMPhotoModule | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const canSave = files.length > 0 && !!moduleSel && !!projectId && !saving;

  const handleSubmit = async () => {
    if (!canSave || !moduleSel) return;
    setSaving(true);
    setError("");
    try {
      const stamped = await Promise.all(files.map((f) => stampPhoto(f, { companyName, watermark, timestamp })));
      const urls = await Promise.all(stamped.map((f) => uploadCMPhoto(ownerId, projectId, f)));
      const today = new Date().toISOString().slice(0, 10);
      const title = caption.trim() || `${t(`tile.${moduleSel}`)} — ${today}`;

      if (moduleSel === "siteDiary") {
        const log = await createCMDailyLog(ownerId, projectId, { log_date: today, notes: caption.trim() || null });
        await updateCMDailyLog(log.id, { photos: urls });
      } else if (moduleSel === "inspection") {
        const item = await createCMInspection(ownerId, projectId, { title, status: "Scheduled", inspection_date: today });
        await updateCMInspection(item.id, { photos: urls });
      } else if (moduleSel === "punchList") {
        const item = await createCMTask(ownerId, projectId, { title, status: "To Do", priority: "Medium" });
        await updateCMTask(item.id, { photos: urls });
      } else if (moduleSel === "safety") {
        const item = await createCMSafetyRecord(ownerId, projectId, { title, record_type: "Hazard Observation", severity: "Low", record_date: today });
        await updateCMSafetyRecord(item.id, { photos: urls });
      } else if (moduleSel === "submittal") {
        const item = await createCMSubmittal(ownerId, projectId, { title, status: "Draft" });
        await updateCMSubmittal(item.id, { photos: urls });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save photo");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("photos.capture")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="flex gap-3">
          <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-bold uppercase tracking-widest text-black cursor-pointer text-center"
            style={{ backgroundColor: "#ff5100" }}>
            {t("photos.takePhoto")}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={saving}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-bold uppercase tracking-widest text-white/70 bg-white/5 hover:bg-white/10 cursor-pointer text-center transition-colors">
            {t("photos.chooseLibrary")}
            <input type="file" accept="image/*" multiple className="hidden" disabled={saving}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative w-16 h-16">
                <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("photos.forWhat")}</span>
          <div className="flex flex-wrap gap-2">
            {MODULE_OPTIONS.map((m) => (
              <button key={m} type="button" onClick={() => setModuleSel(m)} disabled={saving}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
                style={{ backgroundColor: moduleSel === m ? "#ff5100" : "rgba(255,255,255,0.05)", color: moduleSel === m ? "#000" : "rgba(255,255,255,0.7)" }}>
                {t(`tile.${m}`)}
              </button>
            ))}
          </div>
        </div>

        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("photos.note")}</span>
          <input className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("photos.notePlaceholder")} disabled={saving} />
        </label>

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={!canSave}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("photos.savingPhoto") : t("photos.savePhoto")}
        </button>
      </div>
    </Sheet>
  );
}

function dateLabel(date: string, t: (k: string) => string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return t("photos.today");
  if (date === yesterday) return t("photos.yesterday");
  return date;
}

function CMPhotosPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: photos, isLoading } = useAllCMPhotos(user?.id);
  const { data: account } = useCMAccountSettings(user?.id);
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | CMPhotoModule>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_all_photos", user?.id] });
    setShowNew(false);
  };
  const invalidateAccount = () => queryClient.invalidateQueries({ queryKey: ["cm_account_settings", user?.id] });

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    (photos ?? []).forEach((p) => map.set(p.projectId, p.projectName));
    return Array.from(map.entries());
  }, [photos]);

  const filtered = (photos ?? []).filter((p) =>
    (projectFilter === "all" || p.projectId === projectFilter) && (typeFilter === "all" || p.module === typeFilter));

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: CMPhotoWithContext[] }>();
    for (const p of filtered) {
      const key = groupBy === "date" ? p.date : groupBy === "project" ? p.projectId : p.module;
      const label = groupBy === "date" ? dateLabel(p.date, t) : groupBy === "project" ? p.projectName : t(`tile.${p.module}`);
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values());
  }, [filtered, groupBy, t]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md mx-auto w-full px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1">{t("photos.title")}</h1>
          <button onClick={() => setShowSettings(true)} aria-label={t("photos.settingsTitle")}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0 text-white/60 hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {projectOptions.length > 1 && (
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
              className="flex-1 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff5100]/60 min-w-[120px]">
              <option value="all">{t("photos.allProjects")}</option>
              {projectOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | CMPhotoModule)}
            className="flex-1 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff5100]/60 min-w-[120px]">
            <option value="all">{t("photos.allTypes")}</option>
            {MODULE_OPTIONS.map((m) => <option key={m} value={m}>{t(`tile.${m}`)}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{t("photos.groupBy")}</span>
          <div className="flex gap-1.5">
            {GROUP_OPTIONS.map((g) => (
              <button key={g} onClick={() => setGroupBy(g)}
                className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest transition-colors"
                style={{ backgroundColor: groupBy === g ? "#ff5100" : "rgba(255,255,255,0.05)", color: groupBy === g ? "#000" : "rgba(255,255,255,0.55)" }}>
                {t(`photos.group${g === "date" ? "Date" : g === "project" ? "Project" : "Type"}`)}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
        {!isLoading && filtered.length === 0 && <p className="text-white/30 text-sm">{t("photos.noneYet")}</p>}

        <div className="flex flex-col gap-6">
          {groups.map((group, gi) => (
            <div key={gi}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2.5">{group.label}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {group.items.map((p, i) => {
                  const badge = groupBy === "project" ? t(`tile.${p.module}`) : groupBy === "type" ? p.projectName : `${p.projectName} · ${t(`tile.${p.module}`)}`;
                  return (
                    <button key={`${p.url}-${i}`} onClick={() => setLightboxIndex(filtered.indexOf(p))} className="relative aspect-square group">
                      <img src={p.url} alt="" className="w-full h-full rounded-2xl object-cover" />
                      <span className="absolute bottom-1.5 left-1.5 right-1.5 font-mono text-[8px] px-1.5 py-0.5 rounded-full bg-black/70 text-white/60 truncate text-left">{badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <FAB label={t("photos.newBtn")} onClick={() => setShowNew(true)} />
      </main>

      {showNew && (
        <NewPhotoSheet
          ownerId={user.id}
          projects={projects}
          projectId={projectId}
          setProjectId={setProjectId}
          companyName={account?.company_name ?? null}
          watermark={account?.photo_watermark ?? true}
          timestamp={account?.photo_timestamp ?? true}
          onClose={() => setShowNew(false)}
          onCreated={invalidate}
        />
      )}

      {showSettings && (
        <PhotoSettingsSheet
          ownerId={user.id}
          watermark={account?.photo_watermark ?? true}
          timestamp={account?.photo_timestamp ?? true}
          onClose={() => setShowSettings(false)}
          onChanged={invalidateAccount}
        />
      )}

      {lightboxIndex != null && (
        <PhotoLightbox
          items={filtered}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onShowInReport={(item) => {
            if (!item.module || !item.recordId || !item.projectId) return;
            setPendingHighlight(item.module, item.recordId, item.projectId, item.url);
            setLightboxIndex(null);
            navigate({ to: MODULE_ROUTES[item.module] });
          }}
        />
      )}
    </div>
  );
}
