import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, FormPage, FAB, PhotoPicker, FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet, ProjectPicker, SegmentedField, FieldSelect, SettingControlRow, useSelectedProject, inputCls, labelCls,
  WeekCalendarStrip, CALENDAR_MONTH_LOCALE,
  PriorityBadge, StatusBadge, ConfirmationDialog, LocationSelect, RecordDetailExtras,
  type RecordMenuItem,
} from "@/components/cm/shared";
import {
  useCMTasks,
  useAllCMTasks,
  createCMTask,
  updateCMTask,
  deleteCMTask,
  stampAndUploadCMPhotos,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  useCMProjectLocations,
  useCMProjectMembers,
  useCMProject,
  addCMComment,
  logCMActivity,
  locationBreadcrumb,
  useCMPunchListDocuments,
  useAllCMPunchListDocuments,
  issueCMPunchListDocument,
  closeCMPunchListDocument,
  type CMTask,
  type CMTaskWithProject,
  type TaskStatus,
  type TaskPriority,
  type CMPunchListDocument,
  type CMPunchListDocStatus,
} from "@/lib/cm-data";
import { resolveSetting, writeSettingAndSync, SETTING_DEFINITIONS } from "@/lib/cm-settings";

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

const ip = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  "To Do": <svg {...ip}><circle cx="12" cy="12" r="8" /></svg>,
  "In Progress": <svg {...ip}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>,
  Blocked: <svg {...ip}><circle cx="12" cy="12" r="8" /><path d="M8 8l8 8" /></svg>,
  "Ready for Check": <svg {...ip}><circle cx="12" cy="12" r="8" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>,
  Done: <svg {...ip} fill="currentColor" stroke="none"><circle cx="12" cy="12" r="8" /><path d="M8.5 12.2l2.3 2.3 4.7-4.9" stroke="#0a0a0b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};
const PRIORITY_ICON: Record<TaskPriority, React.ReactNode> = {
  Low: <svg {...ip}><path d="M12 6v12M8 14l4 4 4-4" /></svg>,
  Medium: <svg {...ip}><path d="M6 9h12M6 15h12" /></svg>,
  High: <svg {...ip}><path d="M12 18V6M8 10l4-4 4 4" /></svg>,
};

export function NewPunchItemSheet({ ownerId, projectId, existing, canApprove, defaultPriority, documentId, backTo, onCreated }: {
  ownerId: string; projectId: string; existing?: CMTask; canApprove: boolean; defaultPriority?: TaskPriority;
  /** Attaches a newly created item to this specific Punch List Document
   *  instead of the default (today's document for the project) — used
   *  when adding an item from inside an already-open document, which may
   *  not be today's. Ignored when editing an existing item. */
  documentId?: string;
  backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || (s !== "Done" && s !== "Ready for Check") || s === existing?.status);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "To Do");
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? defaultPriority ?? "Medium");
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
      const item = existing ?? await createCMTask(ownerId, projectId, patch, documentId);
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
    <FormPage title={t(existing ? "punchList.edit" : "punchList.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="pt-2 flex flex-col gap-4">
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
                <SegmentedField value={status} onChange={setStatus} disabled={saving} options={statusOptions.map((s) => ({ value: s, label: t(`taskStatus.${s}`), icon: STATUS_ICON[s], color: STATUS_COLOR[s] }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("punchList.priority")}</span>
                <SegmentedField value={priority} onChange={setPriority} disabled={saving} options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: t(`taskPriority.${p}`), icon: PRIORITY_ICON[p], color: PRIORITY_COLOR[p] }))} />
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
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-white font-bold bg-white/10 border border-white/15 transition-all disabled:opacity-40 shadow-[var(--shadow-sm)]">
          {existing ? (saving ? t("punchList.saving") : t("punchList.saveChanges")) : (saving ? t("punchList.adding") : t("punchList.addToPunchList"))}
        </button>
      </form>
    </FormPage>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

const PUNCH_DOC_STATUS_COLOR: Record<CMPunchListDocStatus, string> = {
  Draft: "#94a3b8", Issued: "#fbbf24", Closed: "#34d399",
};

function formatDayHeader(day: string, lang: CMLang) {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString(CALENDAR_MONTH_LOCALE[lang], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** One row in the punch list, per project/day — either a real Punch List
 *  Document (the single sendable unit, with its own doc_number and
 *  Issue/Close workflow) or, for items raised before documents existed
 *  (document_id null), a plain day group with no document actions. */
interface PunchGroupRow {
  key: string;
  date: string;
  projectId: string;
  doc: CMPunchListDocument | null;
  tasks: (CMTask | CMTaskWithProject)[];
}

function isRowClosed(row: PunchGroupRow): boolean {
  if (row.doc) return row.doc.status === "Closed";
  return row.tasks.length > 0 && row.tasks.every((t) => t.status === "Done");
}

function PunchListDocumentCard({ row, viewAll, canCreate, canApprove, userId, onChanged }: {
  row: PunchGroupRow; viewAll: boolean; canCreate: boolean; canApprove: boolean; userId: string; onChanged: () => void;
}) {
  const { t, lang } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"issue" | "close" | null>(null);
  const doc = row.doc;
  const openCount = row.tasks.filter((it) => it.status !== "Done").length;
  const projectName = viewAll ? (row.tasks[0] as CMTaskWithProject | undefined)?.projectName : undefined;

  const runAction = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      if (confirmAction === "issue") await issueCMPunchListDocument(doc.id, doc.project_id, userId, doc.doc_number);
      if (confirmAction === "close") await closeCMPunchListDocument(doc.id, doc.project_id, userId, doc.doc_number);
      onChanged();
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden shadow-[var(--shadow-sm)]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {doc?.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{doc.doc_number}</span>}
              <span className="text-[12px] text-white/80 truncate">{formatDayHeader(row.date, lang)}</span>
              {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
            </div>
            <p className="font-mono text-[10px] text-white/30">{row.tasks.length} {t("punchList.itemsSuffix")}{openCount > 0 ? ` · ${openCount} ${t("punchList.openSuffix")}` : ""}</p>
          </div>
        </div>
        {doc ? (
          <StatusBadge label={t(`punchListDocStatus.${doc.status}`)} color={PUNCH_DOC_STATUS_COLOR[doc.status]} />
        ) : (
          <StatusBadge label={isRowClosed(row) ? t("punchListDocStatus.Closed") : t("punchListDocStatus.Draft")} color={isRowClosed(row) ? PUNCH_DOC_STATUS_COLOR.Closed : PUNCH_DOC_STATUS_COLOR.Draft} />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-white/6 pt-4">
          <div className="flex flex-col gap-2">
            {row.tasks.map((item) => <PunchItemCard key={item.id} item={item} showDate={false} />)}
            {row.tasks.length === 0 && <p className="text-white/30 text-[12px]">{t("punchList.nothingYet")}</p>}
          </div>
          <div className="flex items-center gap-4 flex-wrap pt-1">
            {canCreate && (
              <Link to="/cm/punch-list/new" search={doc ? { document: doc.id } : {}}
                className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-brand-accent)" }}>
                {t("punchList.addItem")}
              </Link>
            )}
            {doc && canApprove && doc.status === "Draft" && (
              <button onClick={() => setConfirmAction("issue")} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors">
                {t("punchList.issue")}
              </button>
            )}
            {doc && canApprove && doc.status === "Issued" && (
              <button onClick={() => setConfirmAction("close")} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors">
                {t("punchList.close")}
              </button>
            )}
          </div>
        </div>
      )}
      {confirmAction && (
        <ConfirmationDialog
          message={t(confirmAction === "issue" ? "punchList.confirmIssue" : "punchList.confirmClose")}
          confirmLabel={t(confirmAction === "issue" ? "punchList.issue" : "punchList.close")}
          destructive={false} onConfirm={runAction} onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function PunchItemCard({ item, projectName, showDate = true }: { item: CMTask; projectName?: string; showDate?: boolean }) {
  const { t } = useCMLang();
  const sc = STATUS_COLOR[item.status];
  const isOpen = item.status !== "Done";
  return (
    <Link to="/cm/punch-list/$id" params={{ id: item.id }}
      className="relative w-full flex items-center justify-between gap-3 pl-6 pr-5 py-4 rounded-2xl bg-[#0d0d0e] hover:bg-white/3 hover:-translate-y-0.5 transition-all shadow-[var(--shadow-sm)] overflow-hidden">
      {isOpen && <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: sc }} />}
      <div className="flex items-center gap-4 min-w-0">
        {showDate && <span className="font-mono text-[12px] text-white/70 shrink-0">{item.created_at.slice(0, 10)}</span>}
        {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
        {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
        <span className={`text-[12px] truncate ${item.status === "Done" ? "text-white/40 line-through" : "text-white/70"}`}>{item.title}</span>
      </div>
      <StatusBadge label={t(`taskStatus.${item.status}`)} color={sc} variant="dot" />
    </Link>
  );
}

export function PunchListDetail({ item, canEdit, canApprove, canDelete, userId, requireAfterPhoto, flash, matchedPhotoUrl, onChanged, onOpenPhoto, onMenuItems }: {
  item: CMTask; canEdit: boolean; canApprove: boolean; canDelete: boolean; userId: string; requireAfterPhoto: boolean;
  flash?: boolean; matchedPhotoUrl?: string | null;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
  onMenuItems?: (items: RecordMenuItem[]) => void;
}) {
  const { t } = useCMLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
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
    if (requireAfterPhoto && afterPhotos.length === 0) return;
    setBusy(true);
    try {
      const uploaded = afterPhotos.length > 0 ? await stampAndUploadCMPhotos(item.owner_id, item.project_id, afterPhotos) : [];
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

  useEffect(() => {
    const items: RecordMenuItem[] = [];
    if (editableNow) items.push({ label: t("punchList.edit"), onClick: () => navigate({ to: "/cm/punch-list/$id/edit", params: { id: item.id } }) });
    if (deletableNow) items.push({ label: t("common.delete"), onClick: () => setConfirmingDelete(true), destructive: true, disabled: busy });
    onMenuItems?.(items);
  }, [editableNow, deletableNow, busy, item.id]);

  return (
    <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[12px] text-white/70">{item.created_at.slice(0, 10)}</span>
        {item.doc_number && <span className="font-mono text-[9px] text-white/25">{item.doc_number}</span>}
      </div>
      <p className="text-[14px] text-white/85">{item.title}</p>
      {item.description && <p className="text-[12px] text-white/45">{item.description}</p>}
      {editableNow ? (
        <SegmentedField
          options={statusOptions.map((s) => ({ value: s, label: t(`taskStatus.${s}`), color: STATUS_COLOR[s] }))}
          value={item.status} disabled={busy} onChange={handleStatusChange}
        />
      ) : (
        <StatusBadge label={t(`taskStatus.${item.status}`)} color={sc} />
      )}
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
                <img src={item.photo_thumbs[i] || url} alt="" className="w-20 h-20 rounded-xl object-cover" />
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
                <img src={item.after_photo_thumbs[i] || url} alt="" className="w-20 h-20 rounded-xl object-cover" style={{ boxShadow: "0 0 0 1.5px #22c55e55" }} />
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
                <button type="button" onClick={handleSubmitForCheck} disabled={busy || (requireAfterPhoto && afterPhotos.length === 0)}
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

      <RecordDetailExtras projectId={item.project_id} entityType="punch_list" module="punchList" entityId={item.id} userId={userId} locationId={item.location_id} />
      {confirmingDelete && (
        <ConfirmationDialog message={t("punchList.confirmRemove")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function PunchListQuickSettings({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: project } = useCMProject(projectId);
  const canEdit = usePermission(projectId, userId, "settings", "edit");
  const [busy, setBusy] = useState(false);
  if (!project) return null;
  const ctx = { ownerId: project.owner_id, project, actorId: userId };
  const priority = resolveSetting(SETTING_DEFINITIONS.punchListPriority, { project });
  const requireAfterPhoto = resolveSetting(SETTING_DEFINITIONS.punchListRequireAfterPhoto, { project });

  const run = async (p: Promise<void>) => {
    setBusy(true);
    try { await p; } finally { setBusy(false); }
  };

  return (
    <>
      <SettingControlRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>}
        label={t("punchList.settingsDefaultPriority")} resolved={priority} disabled={!canEdit || busy}
        options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: t(`taskPriority.${p}`) }))}
        onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.punchListPriority, v, ctx, queryClient))}
        onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.punchListPriority, SETTING_DEFINITIONS.punchListPriority.defaultValue, ctx, queryClient))}
      />
      <SettingControlRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>}
        label={t("punchList.settingsRequireAfterPhoto")} resolved={requireAfterPhoto} disabled={!canEdit || busy}
        onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.punchListRequireAfterPhoto, v, ctx, queryClient))}
        onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.punchListRequireAfterPhoto, SETTING_DEFINITIONS.punchListRequireAfterPhoto.defaultValue, ctx, queryClient))}
      />
    </>
  );
}

function CMPunchListPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [viewAll, setViewAll] = useState(true);
  const { data: singleItems, isLoading: singleLoading } = useCMTasks(!viewAll ? (projectId || undefined) : undefined);
  const { data: allItems, isLoading: allLoading } = useAllCMTasks(viewAll ? user?.id : undefined);
  const { data: singleDocs } = useCMPunchListDocuments(!viewAll ? (projectId || undefined) : undefined);
  const { data: allDocs } = useAllCMPunchListDocuments(viewAll ? user?.id : undefined);
  const items: (CMTask | CMTaskWithProject)[] | undefined = viewAll ? allItems : singleItems;
  const documents: (CMPunchListDocument | (CMPunchListDocument & { projectName: string }))[] | undefined = viewAll ? allDocs : singleDocs;
  const isLoading = viewAll ? allLoading : singleLoading;
  const canCreate = usePermission(projectId || undefined, user?.id, "punch_list", "create");
  const canApprove = usePermission(projectId || undefined, user?.id, "punch_list", "approve");
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_tasks", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["cm_punch_list_documents", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_punch_list_documents", user?.id] });
  };

  const pickerProjects = useMemo(() => [{ id: "all", name: t("photos.allProjects") }, ...projects], [projects, t]);
  const handlePickerChange = (id: string) => {
    if (id === "all") { setViewAll(true); return; }
    setViewAll(false);
    setProjectId(id);
  };

  // Group items into one row per Punch List Document (the sendable unit) —
  // items raised before documents existed (document_id null) fall back to
  // a plain per-day, per-project group with no Issue/Close actions.
  const rows = useMemo(() => {
    const byDoc = new Map<string, PunchGroupRow>();
    for (const doc of documents ?? []) {
      byDoc.set(doc.id, { key: doc.id, date: doc.doc_date, projectId: doc.project_id, doc, tasks: [] });
    }
    const legacy = new Map<string, PunchGroupRow>();
    for (const item of items ?? []) {
      if (item.document_id && byDoc.has(item.document_id)) {
        byDoc.get(item.document_id)!.tasks.push(item);
      } else if (!item.document_id) {
        const day = item.created_at.slice(0, 10);
        const key = `${item.project_id}|${day}`;
        if (!legacy.has(key)) legacy.set(key, { key, date: day, projectId: item.project_id, doc: null, tasks: [] });
        legacy.get(key)!.tasks.push(item);
      }
    }
    return [...byDoc.values(), ...legacy.values()];
  }, [documents, items]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (dateFilter) list = list.filter((r) => r.date === dateFilter);
    if (q) {
      list = list
        .map((r) => ({ ...r, tasks: r.tasks.filter((it) => [it.title, it.description].some((f) => f?.toLowerCase().includes(q))) }))
        .filter((r) => r.tasks.length > 0);
    }
    list = [...list].sort((a, b) => (sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    return list;
  }, [rows, search, sortAsc, dateFilter]);

  const activeRows = visibleRows.filter((r) => !isRowClosed(r));
  const closedRows = visibleRows.filter((r) => isRowClosed(r));

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-white font-bold bg-white/10 border border-white/15">{t("common.signInGoogle")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: "var(--page-wash)" }}>
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("punchList.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/punch-list/settings"
          quickSettings={projectId ? <PunchListQuickSettings projectId={projectId} userId={user.id} /> : undefined} />
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        {projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {(viewAll || projectId) && (
          <WeekCalendarStrip items={rows} dateOf={(r) => r.date} lang={lang}
            selected={dateFilter} onSelect={setDateFilter} />
        )}

        {dateFilter && (
          <button onClick={() => setDateFilter(null)} aria-label={t("common.clearFilter")}
            className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {dateFilter} <span className="text-[13px] leading-none">×</span>
          </button>
        )}

        {(viewAll || projectId) && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            <>
                {!isLoading && activeRows.length === 0 && closedRows.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                    <p className="text-white/40 text-sm">{t("punchList.nothingYet")}</p>
                  </div>
                )}
                {!isLoading && activeRows.length === 0 && closedRows.length > 0 && (
                  <p className="text-white/30 text-sm mb-3">{t("punchList.allDone")}</p>
                )}
                <div className="flex flex-col gap-2">
                  {activeRows.map((row) => (
                    <PunchListDocumentCard key={row.key} row={row} viewAll={viewAll} canCreate={canCreate} canApprove={canApprove} userId={user.id} onChanged={invalidate} />
                  ))}
                </div>

                {closedRows.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowCompleted((v) => !v)} className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/55 transition-colors">
                      {showCompleted ? t("punchList.hideCompleted") : t("punchList.showCompleted")} {closedRows.length} {t("punchList.completedSuffix")}
                    </button>
                    {showCompleted && (
                      <div className="flex flex-col gap-2 mt-3">
                        {closedRows.map((row) => (
                          <PunchListDocumentCard key={row.key} row={row} viewAll={viewAll} canCreate={canCreate} canApprove={canApprove} userId={user.id} onChanged={invalidate} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </>

            {canCreate && projectId && <FAB label={t("punchList.newBtn")} onClick={() => navigate({ to: "/cm/punch-list/new" })} />}
          </>
        )}
      </main>

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
    </div>
  );
}
