import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, FormPage, FAB, ProjectPicker, FieldSelect, useSelectedProject, inputCls, labelCls,
  FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet,
  EQUIPMENT_STATUS_OPTIONS, EQUIPMENT_STATUS_COLOR, EmptyState, ErrorState, StatusBadge, ConfirmationDialog,
} from "@/components/cm/shared";
import {
  useCMEquipment,
  useAllCMEquipment,
  createCMEquipment,
  updateCMEquipment,
  deleteCMEquipment,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  type CMEquipment,
  type CMEquipmentWithProject,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/equipment")({
  head: () => ({ meta: [{ title: "Equipment Record — Construction Management App" }] }),
  component: CMEquipmentPage,
});

export function NewEquipmentSheet({ ownerId, projectId, existing, typeOptions, backTo, onCreated }: {
  ownerId: string; projectId: string; existing?: CMEquipment; typeOptions?: string[]; backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState(existing?.type ?? "");
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : "1");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      if (existing) {
        const uploaded = files.length > 0 ? await Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f))) : [];
        await updateCMEquipment(existing.id, {
          name: name.trim(), type: type.trim() || null, quantity: Number(quantity) || 1,
          files: uploaded.length > 0 ? [...existing.files, ...uploaded] : existing.files,
        });
      } else {
        const item = await createCMEquipment(ownerId, projectId, { name: name.trim(), type: type.trim() || null, quantity: Number(quantity) || 1 });
        if (files.length > 0) {
          const uploaded = await Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f)));
          await updateCMEquipment(item.id, { files: uploaded });
        }
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add equipment");
      setSaving(false);
    }
  };

  return (
    <FormPage title={t(existing ? "equipment.edit" : "equipment.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("equipment.name")}</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("equipment.type")}</span>
            <input className={inputCls} list="equipment-type-options" value={type} onChange={(e) => setType(e.target.value)} disabled={saving} />
            <datalist id="equipment-type-options">
              {(typeOptions ?? []).map((v) => <option key={v} value={v} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("equipment.qty")}</span>
            <input type="number" min={1} className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={saving} />
          </label>
        </div>
        <FilePicker files={files} setFiles={setFiles} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !name.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("equipment.adding") : t("equipment.addItem")}
        </button>
      </form>
    </FormPage>
  );
}

function EquipmentRow({ eq, userId, projectName, onChanged }: { eq: CMEquipment; userId: string; projectName?: string; onChanged: () => void }) {
  const { t } = useCMLang();
  const canEdit = usePermission(eq.project_id, userId, "equipment", "edit");
  const canDelete = usePermission(eq.project_id, userId, "equipment", "delete");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMEquipment(eq.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/3 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {projectName && <span className="text-[11px] text-white/40 truncate shrink-0">{projectName}</span>}
            <p className="text-[12px] text-white/80 truncate">{eq.name}{eq.type ? ` — ${eq.type}` : ""}</p>
          </div>
          <p className="font-mono text-[10px] text-white/30">{t("equipment.qty")} {eq.quantity}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit ? (
            <FieldSelect
              value={eq.status}
              onChange={(v) => updateCMEquipment(eq.id, { status: v }).then(onChanged)}
              disabled={busy}
              options={EQUIPMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: t(`equipmentStatus.${s}`) }))}
              triggerClassName="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-white/5"
              triggerStyle={{ color: EQUIPMENT_STATUS_COLOR[eq.status] }}
            />
          ) : (
            <StatusBadge label={t(`equipmentStatus.${eq.status}`)} color={EQUIPMENT_STATUS_COLOR[eq.status]} />
          )}
          {canEdit && (
            <Link to="/cm/equipment/$id/edit" params={{ id: eq.id }}
              className="text-white/25 hover:text-white/70 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </Link>
          )}
          {canDelete && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>}
        </div>
      </div>
      <FileAttachmentList files={eq.files} />
      {confirmingDelete && (
        <ConfirmationDialog message={t("equipment.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CMEquipmentPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [viewAll, setViewAll] = useState(true);
  const { data: singleItems, isLoading: singleLoading, isError: singleIsError, refetch: singleRefetch } = useCMEquipment(!viewAll ? (projectId || undefined) : undefined);
  const { data: allItems, isLoading: allLoading, isError: allIsError, refetch: allRefetch } = useAllCMEquipment(viewAll ? user?.id : undefined);
  const items: (CMEquipment | CMEquipmentWithProject)[] | undefined = viewAll ? allItems : singleItems;
  const isLoading = viewAll ? allLoading : singleLoading;
  const isError = viewAll ? allIsError : singleIsError;
  const refetch = viewAll ? allRefetch : singleRefetch;
  const canCreate = usePermission(projectId || undefined, user?.id, "equipment", "create");
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_equipment", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_equipment", user?.id] });
  };

  const pickerProjects = useMemo(() => [{ id: "all", name: t("photos.allProjects") }, ...projects], [projects, t]);
  const handlePickerChange = (id: string) => {
    if (id === "all") { setViewAll(true); return; }
    setViewAll(false);
    setProjectId(id);
  };

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items ?? [];
    if (q) list = list.filter((eq) => [eq.name, eq.type].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [items, search, sortAsc]);

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
        <ModuleHeader title={t("equipment.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/equipment/settings" />
        <p className="text-[12px] text-white/35 mb-5">{t("equipment.subtitle")}</p>
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        {!viewAll && projectId && canCreate && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {(viewAll || projectId) && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {isError && <ErrorState message={t("common.error")} onRetry={() => refetch()} />}
            {!isError && (
              <>
                {!isLoading && visibleItems.length === 0 && <EmptyState message={t("equipment.nothingYet")} />}
                <div className="flex flex-col gap-2">
                  {visibleItems.map((eq) => (
                    <EquipmentRow key={eq.id} eq={eq} userId={user.id}
                      projectName={viewAll ? (eq as CMEquipmentWithProject).projectName : undefined}
                      onChanged={invalidate} />
                  ))}
                </div>
              </>
            )}
            {!viewAll && canCreate && <FAB label={t("equipment.newBtn")} onClick={() => navigate({ to: "/cm/equipment/new" })} />}
          </>
        )}
      </main>

      {showQuickUpload && projectId && (
        <QuickUploadSheet
          sheetTitle={t("equipment.new")}
          titleLabel={t("equipment.name")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const item = await createCMEquipment(user.id, projectId, { name: title });
            if (files.length > 0) {
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(user.id, projectId, files);
              await updateCMEquipment(item.id, { files: [...images.map(({ thumbUrl, ...f }) => f), ...otherFiles] });
            }
            invalidate();
          }}
        />
      )}
    </div>
  );
}
