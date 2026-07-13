import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight, MiniCalendar, ViewToggle, type ModuleView,
  StatusBadge, EmptyState, ErrorState, ConfirmationDialog, DisciplineSelect, LocationSelect,
} from "@/components/cm/shared";
import {
  useCMInspections,
  createCMInspection,
  updateCMInspection,
  deleteCMInspection,
  uploadCMPhotoWithThumb,
  useCMProjectLocations,
  locationBreadcrumb,
  type CMInspection,
  type InspectionStatus,
  type Discipline,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/inspection")({
  head: () => ({ meta: [{ title: "Inspection — Construction Management App" }] }),
  component: CMInspectionPage,
});

const STATUS_COLOR: Record<InspectionStatus, string> = {
  Scheduled: "#94a3b8", Passed: "#34d399", Failed: "#f43f5e", "Not Applicable": "#fbbf24",
};
const STATUS_OPTIONS: InspectionStatus[] = ["Scheduled", "Passed", "Failed", "Not Applicable"];

function NewInspectionSheet({ ownerId, projectId, existing, canApprove, onClose, onCreated }: {
  ownerId: string; projectId: string; existing?: CMInspection; canApprove: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || (s !== "Passed" && s !== "Failed") || s === existing?.status);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState<InspectionStatus>(existing?.status ?? "Scheduled");
  const [discipline, setDiscipline] = useState<Discipline | null>(existing?.discipline ?? null);
  const [locationId, setLocationId] = useState<string | null>(existing?.location_id ?? null);
  const [inspector, setInspector] = useState(existing?.inspector ?? "");
  const [inspectionDate, setInspectionDate] = useState(() => existing?.inspection_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(existing?.notes ?? "");
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
        title: title.trim(), status, discipline, location_id: locationId, inspector: inspector.trim() || null, inspection_date: inspectionDate, notes: notes.trim() || null,
      };
      const inspection = existing ?? await createCMInspection(ownerId, projectId, patch);
      if (existing) await updateCMInspection(existing.id, patch);
      if (photos.length > 0) {
        const uploaded = await Promise.all(photos.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
        await updateCMInspection(inspection.id, {
          photos: [...inspection.photos, ...uploaded.map((u) => u.url)],
          photo_thumbs: [...inspection.photo_thumbs, ...uploaded.map((u) => u.thumbUrl)],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "create"} inspection`);
      setSaving(false);
    }
  };

  return (
    <Sheet title={t(existing ? "inspection.edit" : "inspection.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("inspection.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("inspection.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("inspection.status")}</span>
            <FieldSelect value={status} onChange={setStatus} disabled={saving} options={statusOptions.map((s) => ({ value: s, label: t(`inspectionStatus.${s}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("inspection.date")}</span>
            <input type="date" className={inputCls} value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("common.discipline")}</span>
            <DisciplineSelect value={discipline} onChange={setDiscipline} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("inspection.inspector")}</span>
            <input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("common.location")}</span>
          <LocationSelect projectId={projectId} value={locationId} onChange={setLocationId} disabled={saving} />
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

function InspectionCard({ item, canEdit, canApprove, canDelete, onChanged, onOpenPhoto }: {
  item: CMInspection; canEdit: boolean; canApprove: boolean; canDelete: boolean;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("inspection", item.id, () => setOpen(true));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { data: locations } = useCMProjectLocations(item.project_id);
  const location = locations?.find((l) => l.id === item.location_id);
  const sc = STATUS_COLOR[item.status];
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || (s !== "Passed" && s !== "Failed") || s === item.status);

  const handleStatusChange = async (status: InspectionStatus) => {
    setBusy(true);
    try { await updateCMInspection(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    setConfirmingDelete(false);
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
        <StatusBadge label={t(`inspectionStatus.${item.status}`)} color={sc} />
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {canEdit ? (
            <SegmentedField
              options={statusOptions.map((s) => ({ value: s, label: t(`inspectionStatus.${s}`), color: STATUS_COLOR[s] }))}
              value={item.status} disabled={busy} onChange={handleStatusChange}
            />
          ) : (
            <StatusBadge label={t(`inspectionStatus.${item.status}`)} color={sc} />
          )}
          {item.discipline && <p className="text-[12px] text-white/60">{t("common.discipline")}: {t(`discipline.${item.discipline}`)}</p>}
          {location && <p className="text-[12px] text-white/60">{t("common.location")}: {locationBreadcrumb(location, locations ?? [])}</p>}
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
          <div className="flex items-center gap-4">
            {canEdit && <button onClick={() => setEditing(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">{t("inspection.edit")}</button>}
            {canDelete && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("inspection.delete")}</button>}
          </div>
        </div>
      )}
      {editing && (
        <NewInspectionSheet ownerId={item.owner_id} projectId={item.project_id} existing={item} canApprove={canApprove}
          onClose={() => setEditing(false)} onCreated={() => { onChanged(); setEditing(false); }} />
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("inspection.confirmDelete")} confirmLabel={t("inspection.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CMInspectionPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: inspections, isLoading, isError, refetch } = useCMInspections(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "inspection", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "inspection", "edit");
  const canApprove = usePermission(projectId || undefined, user?.id, "inspection", "approve");
  const canDelete = usePermission(projectId || undefined, user?.id, "inspection", "delete");
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [view, setView] = useState<ModuleView>("list");
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_inspections", projectId] }); setShowNew(false); };

  const visibleInspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = inspections ?? [];
    if (dateFilter) list = list.filter((i) => i.inspection_date === dateFilter);
    if (q) list = list.filter((i) => [i.title, i.notes, i.inspector].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [inspections, search, sortAsc, dateFilter]);

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
        <ModuleHeader title={t("inspection.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
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
            {isError && <ErrorState message={t("common.error")} onRetry={() => refetch()} />}
            {!isError && (view === "calendar" ? (
              <MiniCalendar items={inspections ?? []} dateOf={(i) => i.inspection_date} lang={lang}
                onOpenDay={(dayItems) => { setDateFilter(dayItems[0].inspection_date); setView("list"); }} />
            ) : (
              <>
                {!isLoading && visibleInspections.length === 0 && <EmptyState message={t("inspection.noneYet")} />}
                <div className="flex flex-col gap-3">
                  {visibleInspections.map((i) => <InspectionCard key={i.id} item={i} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
                </div>
              </>
            ))}
            {canCreate && <FAB label={t("inspection.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && <NewInspectionSheet ownerId={user.id} projectId={projectId} canApprove={canApprove} onClose={() => setShowNew(false)} onCreated={invalidate} />}

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
