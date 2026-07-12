import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  BackButton, Sheet, FAB, PhotoPicker, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight,
} from "@/components/cm/shared";
import {
  useCMInspections,
  createCMInspection,
  updateCMInspection,
  deleteCMInspection,
  uploadCMPhotoWithThumb,
  type CMInspection,
  type InspectionStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/inspection")({
  head: () => ({ meta: [{ title: "Inspection — Construction Management App" }] }),
  component: CMInspectionPage,
});

const STATUS_COLOR: Record<InspectionStatus, string> = {
  Scheduled: "#94a3b8", Passed: "#34d399", Failed: "#f43f5e", "Not Applicable": "#fbbf24",
};
const STATUS_OPTIONS: InspectionStatus[] = ["Scheduled", "Passed", "Failed", "Not Applicable"];

function NewInspectionSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<InspectionStatus>("Scheduled");
  const [inspector, setInspector] = useState("");
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
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
      const inspection = await createCMInspection(ownerId, projectId, {
        title: title.trim(), status, inspector: inspector.trim() || null, inspection_date: inspectionDate, notes: notes.trim() || null,
      });
      if (photos.length > 0) {
        const uploaded = await Promise.all(photos.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
        await updateCMInspection(inspection.id, { photos: uploaded.map((u) => u.url), photo_thumbs: uploaded.map((u) => u.thumbUrl) });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create inspection");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("inspection.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("inspection.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("inspection.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("inspection.status")}</span>
            <FieldSelect value={status} onChange={setStatus} disabled={saving} options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`inspectionStatus.${s}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("inspection.date")}</span>
            <input type="date" className={inputCls} value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("inspection.inspector")}</span>
          <input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("inspection.notes")}</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("inspection.saving") : t("inspection.save")}
        </button>
      </form>
    </Sheet>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function InspectionCard({ item, onChanged, onOpenPhoto }: { item: CMInspection; onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void }) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("inspection", item.id, () => setOpen(true));
  const sc = STATUS_COLOR[item.status];

  const handleStatusChange = async (status: InspectionStatus) => {
    setBusy(true);
    try { await updateCMInspection(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm(t("inspection.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMInspection(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.inspection_date}</span>
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest shrink-0" style={{ backgroundColor: `${sc}15`, color: sc }}>{t(`inspectionStatus.${item.status}`)}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          <SegmentedField
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`inspectionStatus.${s}`), color: STATUS_COLOR[s] }))}
            value={item.status} disabled={busy} onChange={handleStatusChange}
          />
          {item.inspector && <p className="text-[12px] text-white/60">{t("inspection.inspector")}: {item.inspector}</p>}
          {item.notes && <p className="text-[12px] text-white/65 whitespace-pre-wrap">{item.notes}</p>}
          {item.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.photos.map((url, i) => (
                <button key={url} type="button" data-photo-url={url}
                  onClick={() => onOpenPhoto(item.photos.map((u, idx) => ({ url: u, thumbUrl: item.photo_thumbs[idx] || u })), i)}
                  className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                  <img src={item.photo_thumbs[i] || url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          )}
          <button onClick={handleDelete} disabled={busy} className="self-start font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("inspection.delete")}</button>
        </div>
      )}
    </div>
  );
}

function CMInspectionPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: inspections, isLoading } = useCMInspections(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_inspections", projectId] }); setShowNew(false); };

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
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("inspection.title")}</h1>
        </div>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && (inspections?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("inspection.noneYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(inspections ?? []).map((i) => <InspectionCard key={i.id} item={i} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
            </div>
            <FAB label={t("inspection.newBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewInspectionSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

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
