import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, WeekCalendarStrip,
  PriorityBadge, StatusBadge, ConfirmationDialog, LocationSelect, RecordDetailExtras,
} from "@/components/cm/shared";
import {
  useCMTasks,
  createCMTask,
  updateCMTask,
  deleteCMTask,
  stampAndUploadCMPhotos,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  useCMProjectLocations,
  useCMProjectMembers,
  addCMComment,
  logCMActivity,
  locationBreadcrumb,
  type CMTask,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/punch-list")({
  head: () => ({ meta: [{ title: "Punch List — Construction Management App" }] }),
  component: CMPunchListPage,
});

const STATUS_COLOR: Record<TaskStatus, string> = {
  "To Do": "#94a3b8", "In Progress": "#ff5100", Blocked: "#f43f5e", "Ready for Check": "#a78bfa", Done: "#34d399",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = { Low: "#94a3b8", Medium: "#fbbf24", High: "#f43f5e" };
const STATUS_OPTIONS: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Ready for Check", "Done"];
const PRIORITY_OPTIONS: TaskPriority[] = ["Low", "Medium", "High"];

function NewPunchItemSheet({ ownerId, projectId, existing, canApprove, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMTask; canApprove: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || (s !== "Done" && s !== "Ready for Check") || s === existing?.status);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "To Do");
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? "Medium");
  const [locationId, setLocationId] = useState<string | null>(existing?.location_id ?? null);
  const [assignee, setAssignee] = useState(existing?.assignee ?? "");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "assignment">("details");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {
        title: title.trim(), description: description.trim() || null, status, priority, location_id: locationId,
        assignee: assignee.trim() || null, due_date: dueDate || null,
      };
      const item = existing ?? await createCMTask(ownerId, projectId, patch);
      if (existing) await updateCMTask(existing.id, patch);
      if (photos.length > 0 || files.length > 0) {
        const [uploadedPhotos, uploadedFiles] = await Promise.all([
          stampAndUploadCMPhotos(ownerId, projectId, photos),
          files.length > 0 ? Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f))) : Promise.resolve([]),
        ]);
        await updateCMTask(item.id, {
          photos: [...item.photos, ...uploadedPhotos.map((u) => u.url)],
          photo_thumbs: [...item.photo_thumbs, ...uploadedPhotos.map((u) => u.thumbUrl)],
          files: [...item.files, ...uploadedFiles],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "add"} work item`);
      setSaving(false);
    }
  };

  return (
    <Sheet title={t(existing ? "punchList.edit" : "punchList.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("punchList.whatNeedsDone")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("punchList.whatNeedsDonePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <SegmentedField value={tab} onChange={setTab} disabled={saving}
          options={[
            { value: "details" as const, label: t("punchList.detailsTab") },
            { value: "assignment" as const, label: t("punchList.assignmentTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("punchList.details")}</span>
              <textarea className={`${inputCls} resize-y min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("punchList.status")}</span>
                <SegmentedField value={status} onChange={setStatus} disabled={saving} options={statusOptions.map((s) => ({ value: s, label: t(`taskStatus.${s}`) }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("punchList.priority")}</span>
                <SegmentedField value={priority} onChange={setPriority} disabled={saving} options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: t(`taskPriority.${p}`) }))} />
              </label>
            </div>
          </div>
        )}

        {tab === "assignment" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("common.location")}</span>
              <LocationSelect projectId={projectId} value={locationId} onChange={setLocationId} disabled={saving} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("punchList.assignedTo")}</span>
                <input className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("punchList.dueDate")}</span>
                <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} />
              </label>
            </div>
          </div>
        )}

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
          {existing ? (saving ? t("punchList.saving") : t("punchList.saveChanges")) : (saving ? t("punchList.adding") : t("punchList.addToPunchList"))}
        </button>
      </form>
    </Sheet>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function PunchItemCard({ item, canEdit, canApprove, canDelete, userId, onChanged, onOpenPhoto }: {
  item: CMTask; canEdit: boolean; canApprove: boolean; canDelete: boolean; userId: string;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("punchList", item.id, () => setOpen(true));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [showAfterPicker, setShowAfterPicker] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { data: locations } = useCMProjectLocations(item.project_id);
  const { data: members } = useCMProjectMembers(item.project_id);
  const location = locations?.find((l) => l.id === item.location_id);
  const isClosed = item.status === "Done";
  const isReadyForCheck = item.status === "Ready for Check";
  // Closed punches cannot be edited or deleted — only an approver can reopen
  // one (a real permission, not just anyone re-editing a signed-off record).
  const editableNow = canEdit && (!isClosed || canApprove);
  const deletableNow = canDelete && !isClosed;
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || (s !== "Done" && s !== "Ready for Check") || s === item.status);
  const memberLabel = (id: string | null) => {
    if (!id) return null;
    const m = members?.find((x) => x.user_id === id);
    return m?.display_name || m?.email || null;
  };
  const handleStatusChange = async (status: TaskStatus) => {
    setBusy(true);
    try { await updateCMTask(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMTask(item.id); onChanged(); } finally { setBusy(false); }
  };
  const handleSubmitForCheck = async () => {
    if (afterPhotos.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await stampAndUploadCMPhotos(item.owner_id, item.project_id, afterPhotos);
      await updateCMTask(item.id, {
        after_photos: [...item.after_photos, ...uploaded.map((u) => u.url)],
        after_photo_thumbs: [...item.after_photo_thumbs, ...uploaded.map((u) => u.thumbUrl)],
        status: "Ready for Check",
      });
      await logCMActivity(item.project_id, userId, "submitted_for_check", "punch_list", item.id, { title: item.title });
      setAfterPhotos([]);
      setShowAfterPicker(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const handleAcceptClose = async () => {
    setBusy(true);
    try {
      await updateCMTask(item.id, { status: "Done", verified_by: userId, closed_at: new Date().toISOString() });
      await logCMActivity(item.project_id, userId, "closed", "punch_list", item.id, { title: item.title });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      await addCMComment(item.project_id, "punch_list", item.id, userId, `${t("punchList.rejectedPrefix")}: ${rejectReason.trim()}`);
      await updateCMTask(item.id, { status: "In Progress" });
      await logCMActivity(item.project_id, userId, "rejected", "punch_list", item.id, { reason: rejectReason.trim() });
      setRejecting(false);
      setRejectReason("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const sc = STATUS_COLOR[item.status];
  const pc = PRIORITY_COLOR[item.priority];
  const verifierName = memberLabel(item.verified_by);

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.created_at.slice(0, 10)}</span>
          {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
          <span className={`text-[12px] truncate ${item.status === "Done" ? "text-white/40 line-through" : "text-white/70"}`}>{item.title}</span>
        </div>
        <StatusBadge label={t(`taskStatus.${item.status}`)} color={sc} />
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {item.description && <p className="text-[12px] text-white/45">{item.description}</p>}
          {editableNow ? (
            <SegmentedField
              options={statusOptions.map((s) => ({ value: s, label: t(`taskStatus.${s}`), color: STATUS_COLOR[s] }))}
              value={item.status} disabled={busy} onChange={handleStatusChange}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge size="sm" label={t(`taskPriority.${item.priority}`)} color={pc} />
            {location && <span className="text-[11px] text-white/40">{locationBreadcrumb(location, locations ?? [])}</span>}
            {item.assignee && <span className="text-[11px] text-white/40">{item.assignee}</span>}
            {item.due_date && <span className="font-mono text-[10px] text-white/30">{item.due_date}</span>}
          </div>
          {item.photos.length > 0 && (
            <div className="flex flex-col gap-1">
              {item.after_photos.length > 0 && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{t("punchList.beforePhotos")}</span>}
              <div className="flex flex-wrap gap-2 mt-1">
                {item.photos.map((url, i) => (
                  <button key={url} type="button" data-photo-url={url}
                    onClick={() => onOpenPhoto(item.photos.map((u, idx) => ({ url: u, thumbUrl: item.photo_thumbs[idx] || u })), i)}
                    className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                    <img src={item.photo_thumbs[i] || url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {item.after_photos.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{t("punchList.afterPhotos")}</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {item.after_photos.map((url, i) => (
                  <button key={url} type="button" data-photo-url={url}
                    onClick={() => onOpenPhoto(item.after_photos.map((u, idx) => ({ url: u, thumbUrl: item.after_photo_thumbs[idx] || u })), i)}
                    className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                    <img src={item.after_photo_thumbs[i] || url} alt="" className="w-16 h-16 rounded-xl object-cover" style={{ boxShadow: "0 0 0 1.5px #22c55e55" }} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <FileAttachmentList files={item.files} />

          {/* Contractor: submit an after-photo to move the item to Ready for Check. */}
          {canEdit && !isClosed && !isReadyForCheck && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/6">
              {!showAfterPicker ? (
                <button type="button" onClick={() => setShowAfterPicker(true)} disabled={busy}
                  className="self-start text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#a78bfa22", color: "#a78bfa" }}>
                  {t("punchList.uploadAfterPhoto")}
                </button>
              ) : (
                <>
                  <PhotoPicker photos={afterPhotos} setPhotos={setAfterPhotos} disabled={busy} />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSubmitForCheck} disabled={busy || afterPhotos.length === 0}
                      className="flex-1 py-2 rounded-xl text-[11px] uppercase tracking-widest font-bold text-black disabled:opacity-40" style={{ backgroundColor: "#a78bfa" }}>
                      {t("punchList.submitForCheck")}
                    </button>
                    <button type="button" onClick={() => { setShowAfterPicker(false); setAfterPhotos([]); }} disabled={busy}
                      className="px-4 py-2 rounded-xl text-[11px] uppercase tracking-widest font-bold text-white/50 bg-white/5">
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Engineer verification: compare before/after, accept & close or reject. */}
          {canApprove && isReadyForCheck && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/6">
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "#a78bfa" }}>{t("punchList.readyForCheck")}</span>
              {!rejecting ? (
                <div className="flex gap-2">
                  <button type="button" onClick={handleAcceptClose} disabled={busy}
                    className="flex-1 py-2 rounded-xl text-[11px] uppercase tracking-widest font-bold text-black disabled:opacity-40" style={{ backgroundColor: "#34d399" }}>
                    {t("punchList.acceptClose")}
                  </button>
                  <button type="button" onClick={() => setRejecting(true)} disabled={busy}
                    className="flex-1 py-2 rounded-xl text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-40" style={{ backgroundColor: "#f43f5e" }}>
                    {t("punchList.reject")}
                  </button>
                </div>
              ) : (
                <>
                  <textarea className={`${inputCls} resize-y min-h-[56px]`} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t("punchList.rejectReasonPlaceholder")} disabled={busy} autoFocus />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleReject} disabled={busy || !rejectReason.trim()}
                      className="flex-1 py-2 rounded-xl text-[11px] uppercase tracking-widest font-bold text-white disabled:opacity-40" style={{ backgroundColor: "#f43f5e" }}>
                      {t("punchList.confirmReject")}
                    </button>
                    <button type="button" onClick={() => { setRejecting(false); setRejectReason(""); }} disabled={busy}
                      className="px-4 py-2 rounded-xl text-[11px] uppercase tracking-widest font-bold text-white/50 bg-white/5">
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {isClosed && (verifierName || item.closed_at) && (
            <p className="font-mono text-[10px] text-white/30">
              {t("punchList.closedBy")} {verifierName ?? t("punchList.unknownUser")}{item.closed_at ? ` — ${item.closed_at.slice(0, 10)}` : ""}
            </p>
          )}

          <div className="flex items-center gap-4">
            {editableNow && <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">{t("punchList.edit")}</button>}
            {deletableNow && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("common.delete")}</button>}
          </div>

          <RecordDetailExtras projectId={item.project_id} entityType="punch_list" module="punchList" entityId={item.id} userId={userId} locationId={item.location_id} />
        </div>
      )}
      {editing && (
        <NewPunchItemSheet ownerId={item.owner_id} projectId={item.project_id} existing={item} canApprove={canApprove}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("punchList.confirmRemove")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CMPunchListPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMTasks(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "punch_list", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "punch_list", "edit");
  const canApprove = usePermission(projectId || undefined, user?.id, "punch_list", "approve");
  const canDelete = usePermission(projectId || undefined, user?.id, "punch_list", "delete");
  const [showNew, setShowNew] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_tasks", projectId] }); setShowNew(false); };

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items ?? [];
    if (dateFilter) list = list.filter((it) => it.created_at.slice(0, 10) === dateFilter);
    if (q) list = list.filter((it) => [it.title, it.description].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [items, search, sortAsc, dateFilter]);

  const open = visibleItems.filter((t) => t.status !== "Done");
  const done = visibleItems.filter((t) => t.status === "Done");

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
        <ModuleHeader title={t("punchList.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {projectId && (
          <WeekCalendarStrip items={items ?? []} dateOf={(it) => it.created_at.slice(0, 10)} lang={lang}
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
                {!isLoading && open.length === 0 && done.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                    <p className="text-white/40 text-sm">{t("punchList.nothingYet")}</p>
                  </div>
                )}
                {!isLoading && open.length === 0 && done.length > 0 && (
                  <p className="text-white/30 text-sm mb-3">{t("punchList.allDone")}</p>
                )}
                <div className="flex flex-col gap-3">
                  {open.map((t) => <PunchItemCard key={t.id} item={t} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
                </div>

                {done.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowCompleted((v) => !v)} className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/55 transition-colors">
                      {showCompleted ? t("punchList.hideCompleted") : t("punchList.showCompleted")} {done.length} {t("punchList.completedSuffix")}
                    </button>
                    {showCompleted && (
                      <div className="flex flex-col gap-3 mt-3">
                        {done.map((t) => <PunchItemCard key={t.id} item={t} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
                      </div>
                    )}
                  </div>
                )}
            </>

            {canCreate && <FAB label={t("punchList.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && <NewPunchItemSheet ownerId={user.id} projectId={projectId} canApprove={canApprove} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {showQuickUpload && projectId && (
        <QuickUploadSheet
          sheetTitle={t("punchList.new")}
          titleLabel={t("punchList.whatNeedsDone")}
          titlePlaceholder={t("punchList.whatNeedsDonePlaceholder")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const item = await createCMTask(user.id, projectId, { title });
            if (files.length > 0) {
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(user.id, projectId, files);
              await updateCMTask(item.id, { photos: images.map((i) => i.url), photo_thumbs: images.map((i) => i.thumbUrl), files: otherFiles });
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
