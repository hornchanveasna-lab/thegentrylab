import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet, ProjectPicker, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, WeekCalendarStrip,
  StatusBadge, EmptyState, ErrorState, ConfirmationDialog, RecordDetailExtras,
} from "@/components/cm/shared";
import {
  useCMSafetyRecords,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  deleteCMSafetyRecord,
  stampAndUploadCMPhotos,
  uploadCMFile,
  type CMSafetyRecord,
  type SafetyRecordType,
  type SafetySeverity,
  SAFETY_RECORD_TYPES,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/safety")({
  head: () => ({ meta: [{ title: "Safety — Construction Management App" }] }),
  component: CMSafetyPage,
});

const SEVERITY_COLOR: Record<SafetySeverity, string> = { Low: "#94a3b8", Medium: "#fbbf24", High: "#f97316", Critical: "#f43f5e" };
const TYPE_OPTIONS: SafetyRecordType[] = [...SAFETY_RECORD_TYPES];
const SEVERITY_OPTIONS: SafetySeverity[] = ["Low", "Medium", "High", "Critical"];

function NewSafetySheet({ ownerId, projectId, existing, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMSafetyRecord; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [recordType, setRecordType] = useState<SafetyRecordType>(existing?.record_type ?? "Toolbox Talk");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [severity, setSeverity] = useState<SafetySeverity>(existing?.severity ?? "Low");
  const [recordDate, setRecordDate] = useState(() => existing?.record_date ?? new Date().toISOString().slice(0, 10));
  const [involved, setInvolved] = useState(existing?.involved ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {
        title: title.trim(), record_type: recordType, description: description.trim() || null,
        severity, record_date: recordDate, involved: involved.trim() || null,
      };
      const record = existing ?? await createCMSafetyRecord(ownerId, projectId, patch);
      if (existing) await updateCMSafetyRecord(existing.id, patch);
      if (photos.length > 0 || files.length > 0) {
        const [uploadedPhotos, uploadedFiles] = await Promise.all([
          stampAndUploadCMPhotos(ownerId, projectId, photos),
          files.length > 0 ? Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f))) : Promise.resolve([]),
        ]);
        await updateCMSafetyRecord(record.id, {
          photos: [...record.photos, ...uploadedPhotos.map((u) => u.url)],
          photo_thumbs: [...record.photo_thumbs, ...uploadedPhotos.map((u) => u.thumbUrl)],
          files: [...record.files, ...uploadedFiles],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "create"} safety record`);
      setSaving(false);
    }
  };

  return (
    <Sheet title={t(existing ? "safety.edit" : "safety.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("safety.type")}</span>
            <FieldSelect value={recordType} onChange={setRecordType} disabled={saving} options={TYPE_OPTIONS.map((rt) => ({ value: rt, label: t(`safetyType.${rt}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("safety.severity")}</span>
            <FieldSelect value={severity} onChange={setSeverity} disabled={saving} options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: t(`safetySeverity.${s}`) }))} />
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
        {existing && existing.files.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("common.attachedFiles")}</span>
            <FileAttachmentList files={existing.files} />
          </div>
        )}
        <FilePicker files={files} setFiles={setFiles} disabled={saving} />
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

type LightboxItem = { url: string; thumbUrl: string };

function SafetyCard({ item, canEdit, canApprove, canDelete, userId, onChanged, onOpenPhoto }: {
  item: CMSafetyRecord; canEdit: boolean; canApprove: boolean; canDelete: boolean; userId: string;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("safety", item.id, () => setOpen(true));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const sc = SEVERITY_COLOR[item.severity];

  const handleResolve = async () => {
    setBusy(true);
    try { await updateCMSafetyRecord(item.id, { status: item.status === "Open" ? "Resolved" : "Open" }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMSafetyRecord(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.record_date}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`safetyType.${item.record_type}`)}</span>
          {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <StatusBadge label={t(`safetySeverity.${item.severity}`)} color={sc} />
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {item.description && <p className="text-[12px] text-white/65 whitespace-pre-wrap">{item.description}</p>}
          {item.involved && <p className="text-[12px] text-white/50">{t("safety.involved")}: {item.involved}</p>}
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
          <FileAttachmentList files={item.files} />
          <div className="flex items-center gap-3">
            {canApprove && (
              <button onClick={handleResolve} disabled={busy} className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest"
                style={{ backgroundColor: item.status === "Open" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", color: item.status === "Open" ? "#34d399" : "rgba(255,255,255,0.5)" }}>
                {item.status === "Open" ? t("safety.markResolved") : t("safety.resolved")}
              </button>
            )}
            {canEdit && (
              <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">{t("safety.edit")}</button>
            )}
            {canDelete && (
              <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("safety.delete")}</button>
            )}
          </div>
          <RecordDetailExtras projectId={item.project_id} entityType="safety" module="safety" entityId={item.id} userId={userId} />
        </div>
      )}
      {editing && (
        <NewSafetySheet ownerId={item.owner_id} projectId={item.project_id} existing={item}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("safety.confirmDelete")} confirmLabel={t("safety.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CMSafetyPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: records, isLoading, isError, refetch } = useCMSafetyRecords(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "safety", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "safety", "edit");
  const canApprove = usePermission(projectId || undefined, user?.id, "safety", "approve");
  const canDelete = usePermission(projectId || undefined, user?.id, "safety", "delete");
  const [showNew, setShowNew] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_safety_records", projectId] }); setShowNew(false); };

  const visibleRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = records ?? [];
    if (dateFilter) list = list.filter((r) => r.record_date === dateFilter);
    if (q) list = list.filter((r) => [r.title, r.description, r.involved].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [records, search, sortAsc, dateFilter]);

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
        <ModuleHeader title={t("safety.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {projectId && (
          <WeekCalendarStrip items={records ?? []} dateOf={(r) => r.record_date} lang={lang}
            selected={dateFilter} onSelect={setDateFilter} />
        )}

        {dateFilter && (
          <button onClick={() => setDateFilter(null)} aria-label={t("common.clearFilter")}
            className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {dateFilter} <span className="text-[13px] leading-none">×</span>
          </button>
        )}

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {isError && <ErrorState message={t("common.error")} onRetry={() => refetch()} />}
            {!isError && (
              <>
                {!isLoading && visibleRecords.length === 0 && <EmptyState message={t("safety.noneYet")} />}
                <div className="flex flex-col gap-3">
                  {visibleRecords.map((s) => <SafetyCard key={s.id} item={s} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
                </div>
              </>
            )}
            {canCreate && <FAB label={t("safety.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && <NewSafetySheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {showQuickUpload && projectId && (
        <QuickUploadSheet
          sheetTitle={t("safety.new")}
          titleLabel={t("safety.titleField")}
          titlePlaceholder={t("safety.titlePlaceholder")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const record = await createCMSafetyRecord(user.id, projectId, { title, record_date: new Date().toISOString().slice(0, 10) });
            if (files.length > 0) {
              const uploaded = await Promise.all(files.map((f) => uploadCMFile(user.id, projectId, f)));
              await updateCMSafetyRecord(record.id, { files: uploaded });
            }
            invalidate();
          }}
        />
      )}

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
