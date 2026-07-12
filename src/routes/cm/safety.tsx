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
  useCMSafetyRecords,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  deleteCMSafetyRecord,
  uploadCMPhoto,
  type CMSafetyRecord,
  type SafetyRecordType,
  type SafetySeverity,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/safety")({
  head: () => ({ meta: [{ title: "Safety — Construction Management App" }] }),
  component: CMSafetyPage,
});

const SEVERITY_COLOR: Record<SafetySeverity, string> = { Low: "#94a3b8", Medium: "#fbbf24", High: "#f97316", Critical: "#f43f5e" };
const TYPE_OPTIONS: SafetyRecordType[] = ["Incident", "Toolbox Talk", "Hazard Observation"];
const SEVERITY_OPTIONS: SafetySeverity[] = ["Low", "Medium", "High", "Critical"];

function NewSafetySheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [recordType, setRecordType] = useState<SafetyRecordType>("Toolbox Talk");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SafetySeverity>("Low");
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [involved, setInvolved] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const record = await createCMSafetyRecord(ownerId, projectId, {
        title: title.trim(), record_type: recordType, description: description.trim() || null,
        severity, record_date: recordDate, involved: involved.trim() || null,
      });
      if (photos.length > 0) {
        const urls = await Promise.all(photos.map((f) => uploadCMPhoto(ownerId, projectId, f)));
        await updateCMSafetyRecord(record.id, { photos: urls });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create safety record");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("safety.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("safety.type")}</span>
            <select className={inputCls} value={recordType} onChange={(e) => setRecordType(e.target.value as SafetyRecordType)} disabled={saving}>
              {TYPE_OPTIONS.map((rt) => <option key={rt} value={rt}>{t(`safetyType.${rt}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("safety.severity")}</span>
            <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value as SafetySeverity)} disabled={saving}>
              {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{t(`safetySeverity.${s}`)}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("safety.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("safety.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("safety.description")}</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("safety.date")}</span>
            <input type="date" className={inputCls} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("safety.involved")}</span>
            <input className={inputCls} value={involved} onChange={(e) => setInvolved(e.target.value)} placeholder={t("safety.involvedPlaceholder")} disabled={saving} />
          </label>
        </div>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("safety.saving") : t("safety.save")}
        </button>
      </form>
    </Sheet>
  );
}

function SafetyCard({ item, onChanged, onOpenPhoto }: { item: CMSafetyRecord; onChanged: () => void; onOpenPhoto: (photos: string[], index: number) => void }) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("safety", item.id, () => setOpen(true));
  const sc = SEVERITY_COLOR[item.severity];

  const handleResolve = async () => {
    setBusy(true);
    try { await updateCMSafetyRecord(item.id, { status: item.status === "Open" ? "Resolved" : "Open" }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm(t("safety.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMSafetyRecord(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.record_date}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`safetyType.${item.record_type}`)}</span>
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest shrink-0" style={{ backgroundColor: `${sc}15`, color: sc }}>{t(`safetySeverity.${item.severity}`)}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {item.description && <p className="text-[12px] text-white/65 whitespace-pre-wrap">{item.description}</p>}
          {item.involved && <p className="text-[12px] text-white/50">{t("safety.involved")}: {item.involved}</p>}
          {item.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.photos.map((url, i) => (
                <button key={url} type="button" data-photo-url={url} onClick={() => onOpenPhoto(item.photos, i)}
                  className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                  <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={handleResolve} disabled={busy} className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest"
              style={{ backgroundColor: item.status === "Open" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", color: item.status === "Open" ? "#34d399" : "rgba(255,255,255,0.5)" }}>
              {item.status === "Open" ? t("safety.markResolved") : t("safety.resolved")}
            </button>
            <button onClick={handleDelete} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("safety.delete")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CMSafetyPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: records, isLoading } = useCMSafetyRecords(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_safety_records", projectId] }); setShowNew(false); };

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
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("safety.title")}</h1>
        </div>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && (records?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("safety.noneYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(records ?? []).map((s) => <SafetyCard key={s.id} item={s} onChanged={invalidate} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />)}
            </div>
            <FAB label={t("safety.newBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewSafetySheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

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
