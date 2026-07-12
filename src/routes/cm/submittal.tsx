import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { BackButton, Sheet, FAB, PhotoPicker, ProjectPicker, useSelectedProject, inputCls, labelCls } from "@/components/cm/shared";
import {
  useCMSubmittals,
  createCMSubmittal,
  updateCMSubmittal,
  deleteCMSubmittal,
  uploadCMPhoto,
  type CMSubmittal,
  type SubmittalStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/submittal")({
  head: () => ({ meta: [{ title: "Submittal — Construction Management App" }] }),
  component: CMSubmittalPage,
});

const STATUS_COLOR: Record<SubmittalStatus, string> = {
  Draft: "#94a3b8", Submitted: "#fbbf24", "Under Review": "#38bdf8", Approved: "#34d399",
  "Approved as Noted": "#34d399", "Revise & Resubmit": "#f97316", Rejected: "#f43f5e",
};
const STATUS_OPTIONS: SubmittalStatus[] = ["Draft", "Submitted", "Under Review", "Approved", "Approved as Noted", "Revise & Resubmit", "Rejected"];

function NewSubmittalSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [title, setTitle] = useState("");
  const [specSection, setSpecSection] = useState("");
  const [status, setStatus] = useState<SubmittalStatus>("Draft");
  const [dueDate, setDueDate] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const item = await createCMSubmittal(ownerId, projectId, {
        title: title.trim(), spec_section: specSection.trim() || null, status,
        due_date: dueDate || null, reviewer: reviewer.trim() || null, notes: notes.trim() || null,
        submitted_date: status !== "Draft" ? new Date().toISOString().slice(0, 10) : null,
      });
      if (photos.length > 0) {
        const urls = await Promise.all(photos.map((f) => uploadCMPhoto(ownerId, projectId, f)));
        await updateCMSubmittal(item.id, { photos: urls });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create submittal");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("submittal.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("submittal.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("submittal.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.specSection")}</span>
            <input className={inputCls} value={specSection} onChange={(e) => setSpecSection(e.target.value)} placeholder={t("submittal.specSectionPlaceholder")} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.status")}</span>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SubmittalStatus)} disabled={saving}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`submittalStatus.${s}`)}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.dueDate")}</span>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.reviewer")}</span>
            <input className={inputCls} value={reviewer} onChange={(e) => setReviewer(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("submittal.notes")}</span>
          <textarea className={`${inputCls} resize-y min-h-[48px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("submittal.creating") : t("submittal.create")}
        </button>
      </form>
    </Sheet>
  );
}

function SubmittalCard({ item, onChanged, onOpenPhoto }: { item: CMSubmittal; onChanged: () => void; onOpenPhoto: (url: string) => void }) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);
  const sc = STATUS_COLOR[item.status];

  const handleStatusChange = async (status: SubmittalStatus) => {
    setBusy(true);
    try {
      const patch: Partial<CMSubmittal> = { status };
      if (status !== "Draft" && !item.submitted_date) patch.submitted_date = new Date().toISOString().slice(0, 10);
      await updateCMSubmittal(item.id, patch);
      onChanged();
    } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this submittal?")) return;
    setBusy(true);
    try { await deleteCMSubmittal(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] px-5 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-white leading-tight truncate">{item.title}</h3>
          {item.spec_section && <p className="font-mono text-[10px] text-white/30 mt-0.5">{item.spec_section} · Rev {item.revision}</p>}
        </div>
        <button onClick={handleDelete} disabled={busy} className="text-white/25 hover:text-red-400 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <select value={item.status} disabled={busy} onChange={(e) => handleStatusChange(e.target.value as SubmittalStatus)}
          className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 border-0" style={{ color: sc }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`submittalStatus.${s}`)}</option>)}
        </select>
        {item.reviewer && <span className="text-[11px] text-white/40">{item.reviewer}</span>}
        {item.due_date && <span className="font-mono text-[10px] text-white/30">{item.due_date}</span>}
      </div>
      {item.photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {item.photos.map((url) => (
            <button key={url} type="button" onClick={() => onOpenPhoto(url)}>
              <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CMSubmittalPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: submittals, isLoading } = useCMSubmittals(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_submittals", projectId] }); setShowNew(false); };

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
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("submittal.title")}</h1>
        </div>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && (submittals?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("submittal.noneYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(submittals ?? []).map((s) => <SubmittalCard key={s.id} item={s} onChanged={invalidate} onOpenPhoto={setLightbox} />)}
            </div>
            <FAB label={t("submittal.newBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewSubmittalSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-xl">×</button>
        </div>
      )}
    </div>
  );
}
