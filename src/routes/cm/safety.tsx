import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, FormPage, FAB, PhotoPicker, FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet, ProjectPicker, FieldSelect, SegmentedField, SettingControlRow, useSelectedProject, inputCls, labelCls,
  WeekCalendarStrip,
  StatusBadge, EmptyState, ErrorState, ConfirmationDialog, RecordDetailExtras,
} from "@/components/cm/shared";
import {
  useCMSafetyRecords,
  useAllCMSafetyRecords,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  deleteCMSafetyRecord,
  stampAndUploadCMPhotos,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  useCMProject,
  type CMSafetyRecord,
  type CMSafetyRecordWithProject,
  type SafetyRecordType,
  type SafetySeverity,
  SAFETY_RECORD_TYPES,
} from "@/lib/cm-data";
import { resolveSetting, writeSettingAndSync, SETTING_DEFINITIONS } from "@/lib/cm-settings";

export const Route = createFileRoute("/cm/safety")({
  head: () => ({ meta: [{ title: "Safety — Construction Management App" }] }),
  component: CMSafetyPage,
});

const SEVERITY_COLOR: Record<SafetySeverity, string> = { Low: "#94a3b8", Medium: "#fbbf24", High: "#f97316", Critical: "#f43f5e" };
const TYPE_OPTIONS: SafetyRecordType[] = [...SAFETY_RECORD_TYPES];
const SEVERITY_OPTIONS: SafetySeverity[] = ["Low", "Medium", "High", "Critical"];

export function NewSafetySheet({ ownerId, projectId, existing, defaultRecordType, defaultSeverity, backTo, onCreated }: {
  ownerId: string; projectId: string; existing?: CMSafetyRecord; defaultRecordType?: SafetyRecordType; defaultSeverity?: SafetySeverity; backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [recordType, setRecordType] = useState<SafetyRecordType>(existing?.record_type ?? defaultRecordType ?? "Toolbox Talk");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [severity, setSeverity] = useState<SafetySeverity>(existing?.severity ?? defaultSeverity ?? "Low");
  const [recordDate, setRecordDate] = useState(() => existing?.record_date ?? new Date().toISOString().slice(0, 10));
  const [involved, setInvolved] = useState(existing?.involved ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "record">("details");

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
    <FormPage title={t(existing ? "safety.edit" : "safety.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("safety.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("safety.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>

        <SegmentedField value={tab} onChange={setTab} disabled={saving}
          options={[
            { value: "details" as const, label: t("safety.detailsTab") },
            { value: "record" as const, label: t("safety.recordTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("safety.type")}</span>
                <FieldSelect value={recordType} onChange={setRecordType} disabled={saving} options={TYPE_OPTIONS.map((rt) => ({ value: rt, label: t(`safetyType.${rt}`) }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("safety.severity")}</span>
                <SegmentedField value={severity} onChange={setSeverity} disabled={saving} options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: t(`safetySeverity.${s}`) }))} />
              </label>
            </div>
          </div>
        )}

        {tab === "record" && (
          <div className="flex flex-col gap-4">
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
          {saving ? t("safety.saving") : t("safety.save")}
        </button>
      </form>
    </FormPage>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function SafetyCard({ item, projectName }: { item: CMSafetyRecord; projectName?: string }) {
  const { t } = useCMLang();
  const sc = SEVERITY_COLOR[item.severity];
  return (
    <Link to="/cm/safety/$id" params={{ id: item.id }}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#0d0d0e] hover:bg-white/3 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-mono text-[12px] text-white/70 shrink-0">{item.record_date}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`safetyType.${item.record_type}`)}</span>
        {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
        {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
        <span className="text-[12px] text-white/70 truncate">{item.title}</span>
      </div>
      <StatusBadge label={t(`safetySeverity.${item.severity}`)} color={sc} />
    </Link>
  );
}

export function SafetyDetail({ item, canEdit, canApprove, canDelete, userId, flash, matchedPhotoUrl, onChanged, onOpenPhoto }: {
  item: CMSafetyRecord; canEdit: boolean; canApprove: boolean; canDelete: boolean; userId: string;
  flash?: boolean; matchedPhotoUrl?: string | null;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);
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
    <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[12px] text-white/70">{item.record_date}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t(`safetyType.${item.record_type}`)}</span>
        {item.doc_number && <span className="font-mono text-[9px] text-white/25">{item.doc_number}</span>}
      </div>
      <p className="text-[14px] text-white/85">{item.title}</p>
      <StatusBadge label={t(`safetySeverity.${item.severity}`)} color={sc} />
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
          <Link to="/cm/safety/$id/edit" params={{ id: item.id }} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">{t("safety.edit")}</Link>
        )}
        {canDelete && (
          <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("safety.delete")}</button>
        )}
      </div>
      <RecordDetailExtras projectId={item.project_id} entityType="safety" module="safety" entityId={item.id} userId={userId} />
      {confirmingDelete && (
        <ConfirmationDialog message={t("safety.confirmDelete")} confirmLabel={t("safety.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function SafetyQuickSettings({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: project } = useCMProject(projectId);
  const canEdit = usePermission(projectId, userId, "settings", "edit");
  const [busy, setBusy] = useState(false);
  if (!project) return null;
  const ctx = { ownerId: project.owner_id, project, actorId: userId };
  const recordType = resolveSetting(SETTING_DEFINITIONS.safetyRecordType, { project });
  const severity = resolveSetting(SETTING_DEFINITIONS.safetySeverity, { project });

  const run = async (p: Promise<void>) => {
    setBusy(true);
    try { await p; } finally { setBusy(false); }
  };

  return (
    <>
      <SettingControlRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>}
        label={t("safety.settingsDefaultRecordType")} resolved={recordType} disabled={!canEdit || busy}
        options={SAFETY_RECORD_TYPES.map((rt) => ({ value: rt, label: t(`safetyType.${rt}`) }))}
        onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.safetyRecordType, v, ctx, queryClient))}
        onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.safetyRecordType, SETTING_DEFINITIONS.safetyRecordType.defaultValue, ctx, queryClient))}
      />
      <SettingControlRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>}
        label={t("safety.settingsDefaultSeverity")} resolved={severity} disabled={!canEdit || busy}
        options={(["Low", "Medium", "High", "Critical"] as SafetySeverity[]).map((s) => ({ value: s, label: t(`safetySeverity.${s}`) }))}
        onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.safetySeverity, v, ctx, queryClient))}
        onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.safetySeverity, SETTING_DEFINITIONS.safetySeverity.defaultValue, ctx, queryClient))}
      />
    </>
  );
}

function CMSafetyPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [viewAll, setViewAll] = useState(true);
  const { data: singleRecords, isLoading: singleLoading, isError: singleIsError, refetch: singleRefetch } = useCMSafetyRecords(!viewAll ? (projectId || undefined) : undefined);
  const { data: allRecords, isLoading: allLoading, isError: allIsError, refetch: allRefetch } = useAllCMSafetyRecords(viewAll ? user?.id : undefined);
  const records: (CMSafetyRecord | CMSafetyRecordWithProject)[] | undefined = viewAll ? allRecords : singleRecords;
  const isLoading = viewAll ? allLoading : singleLoading;
  const isError = viewAll ? allIsError : singleIsError;
  const refetch = viewAll ? allRefetch : singleRefetch;
  const canCreate = usePermission(projectId || undefined, user?.id, "safety", "create");
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_safety_records", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_safety_records", user?.id] });
  };

  const pickerProjects = useMemo(() => [{ id: "all", name: t("photos.allProjects") }, ...projects], [projects, t]);
  const handlePickerChange = (id: string) => {
    if (id === "all") { setViewAll(true); return; }
    setViewAll(false);
    setProjectId(id);
  };

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
        <ModuleHeader title={t("safety.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/safety/settings"
          quickSettings={!viewAll && projectId ? <SafetyQuickSettings projectId={projectId} userId={user.id} /> : undefined} />
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        {!viewAll && projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {(viewAll || projectId) && (
          <WeekCalendarStrip items={records ?? []} dateOf={(r) => r.record_date} lang={lang}
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
            {isError && <ErrorState message={t("common.error")} onRetry={() => refetch()} />}
            {!isError && (
              <>
                {!isLoading && visibleRecords.length === 0 && <EmptyState message={t("safety.noneYet")} />}
                <div className="flex flex-col gap-3">
                  {visibleRecords.map((s) => <SafetyCard key={s.id} item={s} projectName={viewAll ? (s as CMSafetyRecordWithProject).projectName : undefined} />)}
                </div>
              </>
            )}
            {!viewAll && canCreate && <FAB label={t("safety.newBtn")} onClick={() => navigate({ to: "/cm/safety/new" })} />}
          </>
        )}
      </main>

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
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(user.id, projectId, files);
              await updateCMSafetyRecord(record.id, { photos: images.map((i) => i.url), photo_thumbs: images.map((i) => i.thumbUrl), files: otherFiles });
            }
            invalidate();
          }}
        />
      )}
    </div>
  );
}
