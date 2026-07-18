import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, FormPage, FAB, PhotoPicker, FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  WeekCalendarStrip,
  StatusBadge, EmptyState, ErrorState, ConfirmationDialog, DisciplineSelect, LocationSelect, RecordDetailExtras,
} from "@/components/cm/shared";
import {
  useCMInspections,
  createCMInspection,
  updateCMInspection,
  deleteCMInspection,
  stampAndUploadCMPhotos,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  useCMProjectLocations,
  locationBreadcrumb,
  INSPECTION_TYPES,
  type CMInspection,
  type InspectionStatus,
  type InspectionType,
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

export function NewInspectionSheet({ ownerId, projectId, existing, canApprove, disciplines, defaultType, backTo, onCreated }: {
  ownerId: string; projectId: string; existing?: CMInspection; canApprove: boolean; disciplines: Discipline[]; defaultType?: InspectionType | null; backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const statusOptions = STATUS_OPTIONS.filter((s) => canApprove || (s !== "Passed" && s !== "Failed") || s === existing?.status);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState<InspectionStatus>(existing?.status ?? "Scheduled");
  const [inspectionType, setInspectionType] = useState<InspectionType | null>(existing?.inspection_type ?? defaultType ?? null);
  const [discipline, setDiscipline] = useState<Discipline | null>(existing?.discipline ?? null);
  const [locationId, setLocationId] = useState<string | null>(existing?.location_id ?? null);
  const [inspector, setInspector] = useState(existing?.inspector ?? "");
  const [inspectionDate, setInspectionDate] = useState(() => existing?.inspection_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [drawingRef, setDrawingRef] = useState(existing?.drawing_ref ?? "");
  const [methodStatementRef, setMethodStatementRef] = useState(existing?.method_statement_ref ?? "");
  const [itpRef, setItpRef] = useState(existing?.itp_ref ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "references">("details");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {
        title: title.trim(), status, inspection_type: inspectionType, discipline, location_id: locationId, inspector: inspector.trim() || null,
        inspection_date: inspectionDate, notes: notes.trim() || null,
        drawing_ref: drawingRef.trim() || null, method_statement_ref: methodStatementRef.trim() || null, itp_ref: itpRef.trim() || null,
      };
      const inspection = existing ?? await createCMInspection(ownerId, projectId, patch);
      if (existing) await updateCMInspection(existing.id, patch);
      if (photos.length > 0 || files.length > 0) {
        const [uploadedPhotos, uploadedFiles] = await Promise.all([
          stampAndUploadCMPhotos(ownerId, projectId, photos),
          files.length > 0 ? Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f))) : Promise.resolve([]),
        ]);
        await updateCMInspection(inspection.id, {
          photos: [...inspection.photos, ...uploadedPhotos.map((u) => u.url)],
          photo_thumbs: [...inspection.photo_thumbs, ...uploadedPhotos.map((u) => u.thumbUrl)],
          files: [...inspection.files, ...uploadedFiles],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "create"} inspection`);
      setSaving(false);
    }
  };

  return (
    <FormPage title={t(existing ? "inspection.edit" : "inspection.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("inspection.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("inspection.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <SegmentedField value={tab} onChange={setTab} disabled={saving}
          options={[
            { value: "details" as const, label: t("inspection.detailsTab") },
            { value: "references" as const, label: t("inspection.referencesTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("inspection.status")}</span>
                <SegmentedField value={status} onChange={setStatus} disabled={saving} options={statusOptions.map((s) => ({ value: s, label: t(`inspectionStatus.${s}`) }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("inspection.date")}</span>
                <input type="date" className={inputCls} value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} disabled={saving} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("inspection.type")}</span>
              <FieldSelect value={inspectionType ?? ""} onChange={(v) => setInspectionType((v || null) as InspectionType | null)} disabled={saving}
                placeholder={t("inspection.typePlaceholder")}
                options={[{ value: "", label: t("inspection.typePlaceholder") }, ...INSPECTION_TYPES.map((it) => ({ value: it, label: t(`inspectionType.${it}`) }))]} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("common.discipline")}</span>
                <DisciplineSelect value={discipline} onChange={setDiscipline} disabled={saving} disciplines={disciplines} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("inspection.inspector")}</span>
                <input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} disabled={saving} />
              </label>
            </div>
          </div>
        )}

        {tab === "references" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("common.location")}</span>
              <LocationSelect projectId={projectId} value={locationId} onChange={setLocationId} disabled={saving} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("inspection.drawingRef")}</span>
                <input className={inputCls} value={drawingRef} onChange={(e) => setDrawingRef(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("inspection.methodStatementRef")}</span>
                <input className={inputCls} value={methodStatementRef} onChange={(e) => setMethodStatementRef(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("inspection.itpRef")}</span>
                <input className={inputCls} value={itpRef} onChange={(e) => setItpRef(e.target.value)} disabled={saving} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("inspection.notes")}</span>
              <textarea className={`${inputCls} resize-y min-h-[56px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
            </label>
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
          {saving ? t("inspection.saving") : t("inspection.save")}
        </button>
      </form>
    </FormPage>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function InspectionCard({ item }: { item: CMInspection }) {
  const { t } = useCMLang();
  const sc = STATUS_COLOR[item.status];
  return (
    <Link to="/cm/inspection/$id" params={{ id: item.id }}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#0d0d0e] hover:bg-white/3 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-mono text-[12px] text-white/70 shrink-0">{item.inspection_date}</span>
        {item.inspection_type && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`inspectionType.${item.inspection_type}`)}</span>}
        {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
        <span className="text-[12px] text-white/70 truncate">{item.title}</span>
      </div>
      <StatusBadge label={t(`inspectionStatus.${item.status}`)} color={sc} />
    </Link>
  );
}

export function InspectionDetail({ item, canEdit, canApprove, canDelete, userId, flash, matchedPhotoUrl, onChanged, onOpenPhoto }: {
  item: CMInspection; canEdit: boolean; canApprove: boolean; canDelete: boolean; userId: string;
  flash?: boolean; matchedPhotoUrl?: string | null;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);
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
    <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[12px] text-white/70">{item.inspection_date}</span>
        {item.inspection_type && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t(`inspectionType.${item.inspection_type}`)}</span>}
        {item.doc_number && <span className="font-mono text-[9px] text-white/25">{item.doc_number}</span>}
      </div>
      <p className="text-[14px] text-white/85">{item.title}</p>
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
      {item.drawing_ref && <p className="text-[12px] text-white/60">{t("inspection.drawingRef")}: {item.drawing_ref}</p>}
      {item.method_statement_ref && <p className="text-[12px] text-white/60">{t("inspection.methodStatementRef")}: {item.method_statement_ref}</p>}
      {item.itp_ref && <p className="text-[12px] text-white/60">{t("inspection.itpRef")}: {item.itp_ref}</p>}
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
      <FileAttachmentList files={item.files} />
      <div className="flex items-center gap-4">
        {canEdit && <Link to="/cm/inspection/$id/edit" params={{ id: item.id }} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">{t("inspection.edit")}</Link>}
        {canDelete && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("inspection.delete")}</button>}
      </div>
      <RecordDetailExtras projectId={item.project_id} entityType="inspection" module="inspection" entityId={item.id} userId={userId} locationId={item.location_id} discipline={item.discipline} />
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: inspections, isLoading, isError, refetch } = useCMInspections(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "inspection", "create");
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_inspections", projectId] }); };

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
        <ModuleHeader title={t("inspection.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/inspection/settings" />
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {projectId && (
          <WeekCalendarStrip items={inspections ?? []} dateOf={(i) => i.inspection_date} lang={lang}
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
                {!isLoading && visibleInspections.length === 0 && <EmptyState message={t("inspection.noneYet")} />}
                <div className="flex flex-col gap-3">
                  {visibleInspections.map((i) => <InspectionCard key={i.id} item={i} />)}
                </div>
              </>
            )}
            {canCreate && <FAB label={t("inspection.newBtn")} onClick={() => navigate({ to: "/cm/inspection/new" })} />}
          </>
        )}
      </main>

      {showQuickUpload && projectId && (
        <QuickUploadSheet
          sheetTitle={t("inspection.new")}
          titleLabel={t("inspection.titleField")}
          titlePlaceholder={t("inspection.titlePlaceholder")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const item = await createCMInspection(user.id, projectId, { title, inspection_date: new Date().toISOString().slice(0, 10) });
            if (files.length > 0) {
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(user.id, projectId, files);
              await updateCMInspection(item.id, { photos: images.map((i) => i.url), photo_thumbs: images.map((i) => i.thumbUrl), files: otherFiles });
            }
            invalidate();
          }}
        />
      )}
    </div>
  );
}
