import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, MiniCalendar, ViewToggle, type ModuleView,
  PriorityBadge, ConfirmationDialog, LocationSelect,
} from "@/components/cm/shared";
import {
  useCMTasks,
  createCMTask,
  updateCMTask,
  deleteCMTask,
  uploadCMPhotoWithThumb,
  useCMProjectLocations,
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
  "To Do": "#94a3b8", "In Progress": "#ff5100", Blocked: "#f43f5e", Done: "#34d399",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = { Low: "#94a3b8", Medium: "#fbbf24", High: "#f43f5e" };
const STATUS_OPTIONS: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];
const PRIORITY_OPTIONS: TaskPriority[] = ["Low", "Medium", "High"];

function NewPunchItemSheet({ ownerId, projectId, existing, canApprove, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMTask; canApprove: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || s !== "Done" || s === existing?.status);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "To Do");
  const [priority, setPriority] = useState<TaskPriority>(existing?.priority ?? "Medium");
  const [locationId, setLocationId] = useState<string | null>(existing?.location_id ?? null);
  const [assignee, setAssignee] = useState(existing?.assignee ?? "");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      if (photos.length > 0) {
        const uploaded = await Promise.all(photos.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
        await updateCMTask(item.id, {
          photos: [...item.photos, ...uploaded.map((u) => u.url)],
          photo_thumbs: [...item.photo_thumbs, ...uploaded.map((u) => u.thumbUrl)],
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
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("punchList.details")}</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("punchList.status")}</span>
            <FieldSelect value={status} onChange={setStatus} disabled={saving} options={statusOptions.map((s) => ({ value: s, label: t(`taskStatus.${s}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("punchList.priority")}</span>
            <FieldSelect value={priority} onChange={setPriority} disabled={saving} options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: t(`taskPriority.${p}`) }))} />
          </label>
        </div>
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
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
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

function PunchItemCard({ item, canEdit, canApprove, canDelete, onChanged, onOpenPhoto }: {
  item: CMTask; canEdit: boolean; canApprove: boolean; canDelete: boolean;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("punchList", item.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { data: locations } = useCMProjectLocations(item.project_id);
  const location = locations?.find((l) => l.id === item.location_id);
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || s !== "Done" || s === item.status);
  const handleStatusChange = async (status: TaskStatus) => {
    setBusy(true);
    try { await updateCMTask(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMTask(item.id); onChanged(); } finally { setBusy(false); }
  };
  const sc = STATUS_COLOR[item.status];
  const pc = PRIORITY_COLOR[item.priority];

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] px-5 py-4 flex flex-col gap-2 transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className={`text-[13px] font-bold leading-tight ${item.status === "Done" ? "text-white/40 line-through" : "text-white"}`}>{item.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <button onClick={() => setEditing(true)} disabled={busy} className="text-white/25 hover:text-white/70 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
          )}
        </div>
      </div>
      {item.description && <p className="text-[12px] text-white/45">{item.description}</p>}
      {canEdit ? (
        <SegmentedField
          options={statusOptions.map((s) => ({ value: s, label: t(`taskStatus.${s}`), color: STATUS_COLOR[s] }))}
          value={item.status} disabled={busy} onChange={handleStatusChange}
        />
      ) : (
        <PriorityBadge size="sm" label={t(`taskStatus.${item.status}`)} color={STATUS_COLOR[item.status]} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge size="sm" label={t(`taskPriority.${item.priority}`)} color={pc} />
        {location && <span className="text-[11px] text-white/40">{locationBreadcrumb(location, locations ?? [])}</span>}
        {item.assignee && <span className="text-[11px] text-white/40">{item.assignee}</span>}
        {item.due_date && <span className="font-mono text-[10px] text-white/30">{item.due_date}</span>}
      </div>
      {item.photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {item.photos.map((url, i) => (
            <button key={url} type="button" data-photo-url={url}
              onClick={() => onOpenPhoto(item.photos.map((u, idx) => ({ url: u, thumbUrl: item.photo_thumbs[idx] || u })), i)}
              className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
              <img src={item.photo_thumbs[i] || url} alt="" className="w-16 h-16 rounded-xl object-cover" />
            </button>
          ))}
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
  const [showCompleted, setShowCompleted] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [view, setView] = useState<ModuleView>("list");
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
        <p className="text-[12px] text-white/35 mb-5">{t("punchList.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        <div className="flex justify-end mb-3">
          <ViewToggle view={view} onChange={setView} />
        </div>

        {dateFilter && (
          <button onClick={() => setDateFilter(null)} aria-label={t("common.clearFilter")}
            className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {dateFilter} <span className="text-[13px] leading-none">×</span>
          </button>
        )}

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {view === "calendar" ? (
              <MiniCalendar items={items ?? []} dateOf={(it) => it.created_at.slice(0, 10)} lang={lang}
                onOpenDay={(dayItems) => { setDateFilter(dayItems[0].created_at.slice(0, 10)); setView("list"); }} />
            ) : (
              <>
                {!isLoading && open.length === 0 && done.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                    <p className="text-white/40 text-sm">{t("punchList.nothingYet")}</p>
                  </div>
                )}
                {!isLoading && open.length === 0 && done.length > 0 && (
                  <p className="text-white/30 text-sm mb-3">{t("punchList.allDone")}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {open.map((t) => <PunchItemCard key={t.id} item={t} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
                </div>

                {done.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowCompleted((v) => !v)} className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/55 transition-colors">
                      {showCompleted ? t("punchList.hideCompleted") : t("punchList.showCompleted")} {done.length} {t("punchList.completedSuffix")}
                    </button>
                    {showCompleted && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {done.map((t) => <PunchItemCard key={t.id} item={t} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {canCreate && <FAB label={t("punchList.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && <NewPunchItemSheet ownerId={user.id} projectId={projectId} canApprove={canApprove} onClose={() => setShowNew(false)} onCreated={invalidate} />}

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
