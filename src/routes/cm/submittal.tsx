import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, WeekCalendarStrip, DisciplineSelect, StatusBadge, ConfirmationDialog, RecordDetailExtras,
} from "@/components/cm/shared";
import {
  useCMSubmittals,
  createCMSubmittal,
  updateCMSubmittal,
  deleteCMSubmittal,
  stampAndUploadCMPhotos,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  enabledDisciplines,
  SUBMITTAL_TYPES,
  APPROVAL_CODES,
  type CMSubmittal,
  type SubmittalStatus,
  type SubmittalType,
  type ApprovalCode,
  type Discipline,
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
const APPROVAL_STATUSES: SubmittalStatus[] = ["Approved", "Approved as Noted", "Revise & Resubmit", "Rejected"];
/** i18n key suffixes for SUBMITTAL_TYPES — a few of those values (e.g.
 *  "O&M Manual") aren't safe to use directly as translation keys. */
const SUBMITTAL_TYPE_KEY: Record<SubmittalType, string> = {
  "Shop Drawing": "shopDrawing", "Material Submittal": "materialSubmittal", "Method Statement": "methodStatement",
  "Material Sample": "materialSample", "Technical Datasheet": "technicalDatasheet", Calculation: "calculation",
  RFI: "rfi", ITP: "itp", "Test Report": "testReport", "As-Built Drawing": "asBuiltDrawing",
  "O&M Manual": "omManual", Warranty: "warranty", "Closeout Document": "closeoutDocument",
};

function NewSubmittalSheet({ ownerId, projectId, existing, canApprove, disciplines, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMSubmittal; canApprove: boolean; disciplines: Discipline[]; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || !APPROVAL_STATUSES.includes(s) || s === existing?.status);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [submittalType, setSubmittalType] = useState<SubmittalType | "">(existing?.submittal_type ?? "");
  const [specSection, setSpecSection] = useState(existing?.spec_section ?? "");
  const [discipline, setDiscipline] = useState<Discipline | null>(existing?.discipline ?? null);
  const [status, setStatus] = useState<SubmittalStatus>(existing?.status ?? "Draft");
  const [approvalCode, setApprovalCode] = useState<ApprovalCode | "">(existing?.approval_code ?? "");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [reviewer, setReviewer] = useState(existing?.reviewer ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
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
        title: title.trim(), submittal_type: submittalType || null, spec_section: specSection.trim() || null, discipline, status,
        approval_code: approvalCode || null, due_date: dueDate || null, reviewer: reviewer.trim() || null, notes: notes.trim() || null,
        submitted_date: existing ? existing.submitted_date : (status !== "Draft" ? new Date().toISOString().slice(0, 10) : null),
      };
      const item = existing ?? await createCMSubmittal(ownerId, projectId, patch);
      if (existing) await updateCMSubmittal(existing.id, patch);
      if (photos.length > 0 || files.length > 0) {
        const [uploadedPhotos, uploadedFiles] = await Promise.all([
          stampAndUploadCMPhotos(ownerId, projectId, photos),
          files.length > 0 ? Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f))) : Promise.resolve([]),
        ]);
        await updateCMSubmittal(item.id, {
          photos: [...item.photos, ...uploadedPhotos.map((u) => u.url)],
          photo_thumbs: [...item.photo_thumbs, ...uploadedPhotos.map((u) => u.thumbUrl)],
          files: [...item.files, ...uploadedFiles],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "create"} submittal`);
      setSaving(false);
    }
  };

  return (
    <Sheet title={t(existing ? "submittal.edit" : "submittal.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("submittal.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("submittal.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("submittal.type")}</span>
          <FieldSelect value={submittalType} onChange={setSubmittalType} disabled={saving} placeholder={t("submittal.typePlaceholder")}
            options={[{ value: "", label: t("submittal.typePlaceholder") }, ...SUBMITTAL_TYPES.map((s) => ({ value: s, label: t(`submittalType.${SUBMITTAL_TYPE_KEY[s]}`) }))]} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.specSection")}</span>
            <input className={inputCls} value={specSection} onChange={(e) => setSpecSection(e.target.value)} placeholder={t("submittal.specSectionPlaceholder")} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.status")}</span>
            <SegmentedField value={status} onChange={setStatus} disabled={saving} options={statusOptions.map((s) => ({ value: s, label: t(`submittalStatus.${s}`) }))} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("common.discipline")}</span>
          <DisciplineSelect value={discipline} onChange={setDiscipline} disabled={saving} disciplines={disciplines} />
        </label>
        {canApprove && (
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.approvalCode")}</span>
            <SegmentedField value={approvalCode} onChange={setApprovalCode} disabled={saving}
              options={[{ value: "", label: t("submittal.approvalCodePlaceholder") }, ...APPROVAL_CODES.map((c) => ({ value: c, label: t(`approvalCode.${c}`) }))]} />
          </label>
        )}
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
        {existing && existing.files.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("submittal.existingFiles")}</span>
            <FileAttachmentList files={existing.files} />
          </div>
        )}
        <FilePicker files={files} setFiles={setFiles} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {existing ? (saving ? t("submittal.saving") : t("submittal.saveChanges")) : (saving ? t("submittal.creating") : t("submittal.create"))}
        </button>
      </form>
    </Sheet>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function SubmittalCard({ item, canEdit, canApprove, canDelete, disciplines, userId, onChanged, onOpenPhoto }: {
  item: CMSubmittal; canEdit: boolean; canApprove: boolean; canDelete: boolean; disciplines: Discipline[]; userId: string;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("submittal", item.id, () => setOpen(true));
  const sc = STATUS_COLOR[item.status];
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || !APPROVAL_STATUSES.includes(s) || s === item.status);

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
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMSubmittal(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.submitted_date ?? item.created_at.slice(0, 10)}</span>
          {item.submittal_type && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`submittalType.${SUBMITTAL_TYPE_KEY[item.submittal_type]}`)}</span>}
          {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <StatusBadge label={t(`submittalStatus.${item.status}`)} color={sc} />
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          <p className="font-mono text-[10px] text-white/30">
            {[item.discipline && t(`discipline.${item.discipline}`), item.spec_section, `Rev ${item.revision}`].filter(Boolean).join(" · ")}
          </p>
          {canEdit && (
            <SegmentedField
              options={statusOptions.map((s) => ({ value: s, label: t(`submittalStatus.${s}`), color: STATUS_COLOR[s] }))}
              value={item.status} disabled={busy} onChange={handleStatusChange}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {item.approval_code && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 font-mono text-[10px] text-white/60" title={t(`approvalCode.${item.approval_code}`)}>{item.approval_code}</span>
            )}
            {item.reviewer && <span className="text-[11px] text-white/40">{item.reviewer}</span>}
            {item.due_date && <span className="font-mono text-[10px] text-white/30">{item.due_date}</span>}
          </div>
          {item.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.photos.map((url, i) => (
                <button key={url} type="button" data-photo-url={url}
                  onClick={() => onOpenPhoto(item.photos.map((u, idx) => ({ url: u, thumbUrl: item.photo_thumbs[idx] || u })), i)}
                  className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                  <img src={item.photo_thumbs[i] || url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          )}
          <FileAttachmentList files={item.files} />
          <div className="flex items-center gap-4">
            {canEdit && <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">{t("submittal.edit")}</button>}
            {canDelete && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("common.delete")}</button>}
          </div>
          <RecordDetailExtras projectId={item.project_id} entityType="submittal" module="submittal" entityId={item.id} userId={userId} discipline={item.discipline} />
        </div>
      )}
      {editing && (
        <NewSubmittalSheet ownerId={item.owner_id} projectId={item.project_id} existing={item} canApprove={canApprove} disciplines={disciplines}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("submittal.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CMSubmittalPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const projectDisciplines = enabledDisciplines(activeProject);
  const { data: submittals, isLoading } = useCMSubmittals(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "submittal", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "submittal", "edit");
  const canApprove = usePermission(projectId || undefined, user?.id, "submittal", "approve");
  const canDelete = usePermission(projectId || undefined, user?.id, "submittal", "delete");
  const [showNew, setShowNew] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const dateOf = (s: CMSubmittal) => s.submitted_date ?? s.created_at.slice(0, 10);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_submittals", projectId] }); setShowNew(false); };

  const visibleSubmittals = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = submittals ?? [];
    if (dateFilter) list = list.filter((s) => dateOf(s) === dateFilter);
    if (q) list = list.filter((s) => [s.title, s.spec_section, s.notes, s.reviewer].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [submittals, search, sortAsc, dateFilter]);

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
        <ModuleHeader title={t("submittal.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {projectId && (
          <WeekCalendarStrip items={submittals ?? []} dateOf={dateOf} lang={lang}
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
            <>
              {!isLoading && visibleSubmittals.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                  <p className="text-white/40 text-sm">{t("submittal.noneYet")}</p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {visibleSubmittals.map((s) => <SubmittalCard key={s.id} item={s} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} disciplines={projectDisciplines} userId={user.id} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
              </div>
            </>
            {canCreate && <FAB label={t("submittal.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && <NewSubmittalSheet ownerId={user.id} projectId={projectId} canApprove={canApprove} disciplines={projectDisciplines} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {showQuickUpload && projectId && (
        <QuickUploadSheet
          sheetTitle={t("submittal.new")}
          titleLabel={t("submittal.titleField")}
          titlePlaceholder={t("submittal.titlePlaceholder")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const item = await createCMSubmittal(user.id, projectId, { title });
            if (files.length > 0) {
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(user.id, projectId, files);
              await updateCMSubmittal(item.id, { photos: images.map((i) => i.url), photo_thumbs: images.map((i) => i.thumbUrl), files: otherFiles });
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
