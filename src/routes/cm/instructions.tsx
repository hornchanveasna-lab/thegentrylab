import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, FormPage, FAB, PhotoPicker, FilePicker, FileAttachmentList, ProjectPicker, SegmentedField, FieldSelect, CompanySelect, SettingControlRow,
  useSelectedProject, inputCls, labelCls, EmptyState, ErrorState, StatusBadge, PriorityBadge, ConfirmationDialog, PhotoLightbox,
  WeekCalendarStrip, QuickUploadButton, QuickUploadSheet,
} from "@/components/cm/shared";
import { resolveSetting, writeSettingAndSync, SETTING_DEFINITIONS } from "@/lib/cm-settings";
import {
  useCMInstructions,
  useAllCMInstructions,
  createCMInstruction,
  updateCMInstruction,
  acknowledgeCMInstruction,
  deleteCMInstruction,
  useCMContracts,
  useCMCompanies,
  stampAndUploadCMPhotos,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  useCMProject,
  INSTRUCTION_SOURCE_TYPES,
  INSTRUCTION_STATUSES,
  INSTRUCTION_PRIORITIES,
  ACK_RESPONSES,
  IMPACT_TYPES,
  type CMInstruction,
  type CMInstructionWithProject,
  type InstructionSourceType,
  type InstructionStatus,
  type InstructionPriority,
  type AckResponse,
  type ImpactType,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/instructions")({
  head: () => ({ meta: [{ title: "Instructions — Construction Management App" }] }),
  component: CMInstructionsPage,
});

const STATUS_COLOR: Record<InstructionStatus, string> = {
  Issued: "#fbbf24", Acknowledged: "#38bdf8", "Impact Assessment": "#a78bfa",
  Executing: "#ff5100", Completed: "#34d399", Closed: "#94a3b8",
};
const PRIORITY_COLOR: Record<InstructionPriority, string> = {
  Low: "#94a3b8", Medium: "#fbbf24", High: "#f97316", Critical: "#f43f5e",
};

export function NewInstructionSheet({ ownerId, projectId, contractId, existing, defaultSourceType, defaultPriority, backTo, onCreated }: {
  ownerId: string; projectId: string; contractId?: string; existing?: CMInstruction; defaultSourceType?: InstructionSourceType; defaultPriority?: InstructionPriority; backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const { data: contracts } = useCMContracts(projectId);
  const [selectedContractId, setSelectedContractId] = useState(existing?.contract_id ?? contractId ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [sourceType, setSourceType] = useState<InstructionSourceType>(existing?.source_type ?? defaultSourceType ?? "Consultant");
  const [sourceCompanyId, setSourceCompanyId] = useState<string | null>(existing?.source_company_id ?? null);
  const [recipientCompanyId, setRecipientCompanyId] = useState<string | null>(existing?.recipient_company_id ?? null);
  const [recipientNote, setRecipientNote] = useState(existing?.recipient_note ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [priority, setPriority] = useState<InstructionPriority>(existing?.priority ?? defaultPriority ?? "Medium");
  const [photos, setPhotos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "routing">("details");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedContractId || saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {
        title: title.trim(), contract_id: selectedContractId, source_type: sourceType, source_company_id: sourceCompanyId,
        recipient_company_id: recipientCompanyId, recipient_note: recipientNote.trim() || null,
        description: description.trim() || null, due_date: dueDate || null, priority,
      };
      const item = existing ?? await createCMInstruction(ownerId, projectId, patch);
      if (existing) await updateCMInstruction(existing.id, patch);
      if (photos.length > 0 || files.length > 0) {
        const [uploadedPhotos, uploadedFiles] = await Promise.all([
          stampAndUploadCMPhotos(ownerId, projectId, photos),
          files.length > 0 ? Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f))) : Promise.resolve([]),
        ]);
        await updateCMInstruction(item.id, {
          photos: [...item.photos, ...uploadedPhotos.map((u) => u.url)],
          photo_thumbs: [...item.photo_thumbs, ...uploadedPhotos.map((u) => u.thumbUrl)],
          files: [...item.files, ...uploadedFiles],
        });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "issue"} instruction`);
      setSaving(false);
    }
  };

  return (
    <FormPage title={t(existing ? "instructions.edit" : "instructions.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("instructions.contract")}</span>
          <FieldSelect value={selectedContractId} onChange={setSelectedContractId} disabled={saving}
            placeholder={t("instructions.selectContract")}
            options={(contracts ?? []).map((c) => ({ value: c.id, label: c.title }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("instructions.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("instructions.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <SegmentedField value={tab} onChange={setTab} disabled={saving}
          options={[
            { value: "details" as const, label: t("instructions.detailsTab") },
            { value: "routing" as const, label: t("instructions.routingTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("instructions.sourceType")}</span>
                <SegmentedField value={sourceType} onChange={setSourceType} disabled={saving}
                  options={INSTRUCTION_SOURCE_TYPES.map((s) => ({ value: s, label: t(`instructionSource.${s}`) }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("instructions.priority")}</span>
                <SegmentedField value={priority} onChange={setPriority} disabled={saving}
                  options={INSTRUCTION_PRIORITIES.map((p) => ({ value: p, label: t(`instructionPriority.${p}`) }))} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("instructions.description")}</span>
              <textarea className={`${inputCls} resize-y min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("instructions.dueDate")}</span>
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} />
            </label>
          </div>
        )}

        {tab === "routing" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("instructions.sourceCompany")}</span>
              <CompanySelect ownerId={ownerId} value={sourceCompanyId} onChange={(id) => setSourceCompanyId(id)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("instructions.recipientCompany")}</span>
              <CompanySelect ownerId={ownerId} value={recipientCompanyId} onChange={(id) => setRecipientCompanyId(id)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("instructions.recipientNote")}</span>
              <input className={inputCls} value={recipientNote} onChange={(e) => setRecipientNote(e.target.value)} disabled={saving} />
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
        <button type="submit" disabled={saving || !title.trim() || !selectedContractId}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {existing ? (saving ? t("instructions.saving") : t("instructions.save")) : (saving ? t("instructions.creating") : t("instructions.create"))}
        </button>
      </form>
    </FormPage>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function InstructionCard({ item, ownerId, userId, projectName, onChanged, onOpenPhoto }: {
  item: CMInstruction; ownerId: string; userId: string; projectName?: string;
  onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void;
}) {
  const { t } = useCMLang();
  const canEdit = usePermission(item.project_id, userId, "instructions", "edit");
  const canDelete = usePermission(item.project_id, userId, "instructions", "delete");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [ackComments, setAckComments] = useState("");
  const [impactType, setImpactType] = useState<ImpactType>(item.impact_type ?? "No Impact");
  const [impactNotes, setImpactNotes] = useState(item.impact_notes ?? "");
  const { data: companies } = useCMCompanies(ownerId);
  const sourceCompany = companies?.find((c) => c.id === item.source_company_id);
  const recipientCompany = companies?.find((c) => c.id === item.recipient_company_id);
  const sc = STATUS_COLOR[item.status];
  const pc = PRIORITY_COLOR[item.priority];

  const handleAck = async (response: AckResponse) => {
    setBusy(true);
    try { await acknowledgeCMInstruction(item.id, item.project_id, userId, response, ackComments); onChanged(); } finally { setBusy(false); }
  };
  const handleStatusChange = async (status: InstructionStatus) => {
    setBusy(true);
    try { await updateCMInstruction(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleSaveAssessment = async () => {
    setBusy(true);
    try {
      await updateCMInstruction(item.id, { impact_type: impactType, impact_notes: impactNotes.trim() || null, status: "Impact Assessment" });
      onChanged();
    } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMInstruction(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.created_at.slice(0, 10)}</span>
          {item.doc_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.doc_number}</span>}
          {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <StatusBadge label={t(`instructionStatus.${item.status}`)} color={sc} />
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {item.description && <p className="text-[12px] text-white/45 whitespace-pre-wrap">{item.description}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge size="sm" label={t(`instructionPriority.${item.priority}`)} color={pc} />
            <span className="text-[11px] text-white/40">{t(`instructionSource.${item.source_type}`)}{sourceCompany ? ` — ${sourceCompany.name}` : ""}</span>
            {(recipientCompany || item.recipient_note) && (
              <span className="text-[11px] text-white/40">→ {recipientCompany?.name ?? item.recipient_note}</span>
            )}
            {item.due_date && <span className="font-mono text-[10px] text-white/30">{item.due_date}</span>}
          </div>

          {canEdit && (
            <SegmentedField
              options={INSTRUCTION_STATUSES.map((s) => ({ value: s, label: t(`instructionStatus.${s}`), color: STATUS_COLOR[s] }))}
              value={item.status} disabled={busy} onChange={handleStatusChange}
            />
          )}

          {/* Acknowledgement gate — every issued instruction requires a recorded response. */}
          {item.status === "Issued" && canEdit && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/6">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">{t("instructions.acknowledge")}</span>
              <textarea className={`${inputCls} resize-y min-h-[44px]`} value={ackComments} onChange={(e) => setAckComments(e.target.value)}
                placeholder={t("instructions.ackCommentsPlaceholder")} disabled={busy} />
              <div className="flex flex-wrap gap-2">
                {ACK_RESPONSES.map((r) => (
                  <button key={r} type="button" onClick={() => handleAck(r)} disabled={busy}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold disabled:opacity-40"
                    style={{ backgroundColor: r === "Rejected" ? "#f43f5e22" : r === "Clarification Requested" ? "#fbbf2422" : "#34d39922", color: r === "Rejected" ? "#f43f5e" : r === "Clarification Requested" ? "#fbbf24" : "#34d399" }}>
                    {t(`ackResponse.${r}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {item.acknowledged_by && (
            <p className="font-mono text-[10px] text-white/30">
              {t("instructions.acknowledgedBy")} {item.acknowledged_at?.slice(0, 10)} — {item.ack_response ? t(`ackResponse.${item.ack_response}`) : ""}
              {item.ack_comments ? `: ${item.ack_comments}` : ""}
            </p>
          )}

          {/* Impact assessment — available once acknowledged. */}
          {item.status !== "Issued" && canEdit && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/6">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">{t("instructions.impactAssessment")}</span>
              <SegmentedField value={impactType} onChange={setImpactType} disabled={busy}
                options={IMPACT_TYPES.map((i) => ({ value: i, label: t(`impactType.${i}`) }))} />
              <textarea className={`${inputCls} resize-y min-h-[44px]`} value={impactNotes} onChange={(e) => setImpactNotes(e.target.value)}
                placeholder={t("instructions.impactNotes")} disabled={busy} />
              <button type="button" onClick={handleSaveAssessment} disabled={busy}
                className="self-start px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#a78bfa22", color: "#a78bfa" }}>
                {t("instructions.saveAssessment")}
              </button>
            </div>
          )}

          {item.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.photos.map((url, i) => (
                <button key={url} type="button" onClick={() => onOpenPhoto(item.photos.map((u, idx) => ({ url: u, thumbUrl: item.photo_thumbs[idx] || u })), i)}
                  className="rounded-xl">
                  <img src={item.photo_thumbs[i] || url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          )}
          <FileAttachmentList files={item.files} />

          <div className="flex items-center gap-4">
            {canEdit && (
              <Link to="/cm/instructions/$id/edit" params={{ id: item.id }} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
                {t("instructions.edit")}
              </Link>
            )}
            {canDelete && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("instructions.delete")}</button>}
          </div>
        </div>
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("instructions.confirmDelete")} confirmLabel={t("instructions.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function InstructionsQuickSettings({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: project } = useCMProject(projectId);
  const canEdit = usePermission(projectId, userId, "settings", "edit");
  const [busy, setBusy] = useState(false);
  if (!project) return null;
  const ctx = { ownerId: project.owner_id, project, actorId: userId };
  const sourceType = resolveSetting(SETTING_DEFINITIONS.instructionsSourceType, { project });
  const priority = resolveSetting(SETTING_DEFINITIONS.instructionsPriority, { project });

  const run = async (p: Promise<void>) => {
    setBusy(true);
    try { await p; } finally { setBusy(false); }
  };

  return (
    <>
      <SettingControlRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>}
        label={t("instructions.settingsDefaultSourceType")} resolved={sourceType} disabled={!canEdit || busy}
        options={INSTRUCTION_SOURCE_TYPES.map((s) => ({ value: s, label: t(`instructionSource.${s}`) }))}
        onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.instructionsSourceType, v, ctx, queryClient))}
        onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.instructionsSourceType, SETTING_DEFINITIONS.instructionsSourceType.defaultValue, ctx, queryClient))}
      />
      <SettingControlRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>}
        label={t("instructions.settingsDefaultPriority")} resolved={priority} disabled={!canEdit || busy}
        options={INSTRUCTION_PRIORITIES.map((p) => ({ value: p, label: t(`instructionPriority.${p}`) }))}
        onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.instructionsPriority, v, ctx, queryClient))}
        onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.instructionsPriority, SETTING_DEFINITIONS.instructionsPriority.defaultValue, ctx, queryClient))}
      />
    </>
  );
}

function CMInstructionsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [viewAll, setViewAll] = useState(true);
  const activeProject = projects?.find((p) => p.id === projectId);
  const { data: contracts } = useCMContracts(projectId || undefined);
  const { data: singleItems, isLoading: singleLoading, isError: singleIsError, refetch: singleRefetch } = useCMInstructions(!viewAll ? (projectId || undefined) : undefined);
  const { data: allItems, isLoading: allLoading, isError: allIsError, refetch: allRefetch } = useAllCMInstructions(viewAll ? user?.id : undefined);
  const items: (CMInstruction | CMInstructionWithProject)[] | undefined = viewAll ? allItems : singleItems;
  const isLoading = viewAll ? allLoading : singleLoading;
  const isError = viewAll ? allIsError : singleIsError;
  const refetch = viewAll ? allRefetch : singleRefetch;
  const canCreate = usePermission(projectId || undefined, user?.id, "instructions", "create");
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const dateOf = (i: CMInstruction | CMInstructionWithProject) => i.created_at.slice(0, 10);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_instructions", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_instructions", user?.id] });
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
    if (dateFilter) list = list.filter((i) => dateOf(i) === dateFilter);
    if (q) list = list.filter((i) => [i.title, i.description].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [items, search, sortAsc, dateFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const openCount = (items ?? []).filter((i) => i.status !== "Closed").length;
  const pendingAckCount = (items ?? []).filter((i) => i.status === "Issued").length;
  const overdueCount = (items ?? []).filter((i) => i.due_date && i.due_date < today && i.status !== "Completed" && i.status !== "Closed").length;

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>{t("common.signInGoogle")}</button>
      </div>
    );
  }

  const ownerId = activeProject?.owner_id ?? user.id;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("instructions.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/instructions/settings"
          quickSettings={!viewAll && projectId ? <InstructionsQuickSettings projectId={projectId} userId={user.id} /> : undefined} />
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        {!viewAll && projectId && canCreate && contracts && contracts.length > 0 && (
          <QuickUploadButton label={t("common.uploadFileBtn")} onFilesSelected={(f) => { setQuickUploadFiles(f); setShowQuickUpload(true); }} />
        )}

        {(viewAll || projectId) && (
          <WeekCalendarStrip items={items ?? []} dateOf={dateOf} lang={lang}
            selected={dateFilter} onSelect={setDateFilter} />
        )}

        {dateFilter && (
          <button onClick={() => setDateFilter(null)} aria-label={t("common.clearFilter")}
            className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {dateFilter} <span className="text-[13px] leading-none">×</span>
          </button>
        )}

        {(viewAll || projectId) && items && items.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-2xl bg-[#0d0d0e] py-3 text-center">
              <p className="text-[18px] font-bold text-white">{openCount}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">{t("instructions.openCount")}</p>
            </div>
            <div className="rounded-2xl bg-[#0d0d0e] py-3 text-center">
              <p className="text-[18px] font-bold" style={{ color: "#fbbf24" }}>{pendingAckCount}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">{t("instructions.pendingAckCount")}</p>
            </div>
            <div className="rounded-2xl bg-[#0d0d0e] py-3 text-center">
              <p className="text-[18px] font-bold" style={{ color: "#f43f5e" }}>{overdueCount}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">{t("instructions.overdueCount")}</p>
            </div>
          </div>
        )}

        {(viewAll || projectId) && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {isError && <ErrorState message={t("common.error")} onRetry={() => refetch()} />}
            {!isError && !viewAll && !isLoading && contracts && contracts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex flex-col items-center justify-center text-center px-4 gap-3">
                <p className="text-white/40 text-sm">{t("instructions.noContractsYet")}</p>
                <Link to="/cm/contracts" className="text-[12px] font-bold px-4 py-2 rounded-full" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
                  {t("instructions.createContractFirst")}
                </Link>
              </div>
            )}
            {!isError && (viewAll || (contracts && contracts.length > 0)) && (
              <>
                {!isLoading && visibleItems.length === 0 && <EmptyState message={t("instructions.noneYet")} />}
                <div className="flex flex-col gap-3">
                  {visibleItems.map((i) => (
                    <InstructionCard key={i.id} item={i} ownerId={ownerId} userId={user.id}
                      projectName={viewAll ? (i as CMInstructionWithProject).projectName : undefined}
                      onChanged={invalidate} onOpenPhoto={(its, index) => setLightbox({ items: its, index })} />
                  ))}
                </div>
                {!viewAll && canCreate && <FAB label={t("instructions.new")} onClick={() => navigate({ to: "/cm/instructions/new" })} />}
              </>
            )}
          </>
        )}
      </main>

      {showQuickUpload && projectId && contracts && contracts.length > 0 && (
        <QuickUploadSheet
          sheetTitle={t("instructions.new")}
          titleLabel={t("instructions.titleField")}
          titlePlaceholder={t("instructions.titlePlaceholder")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const item = await createCMInstruction(ownerId, projectId, { title, contract_id: contracts[0].id });
            if (files.length > 0) {
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(ownerId, projectId, files);
              await updateCMInstruction(item.id, { photos: images.map((i) => i.url), photo_thumbs: images.map((i) => i.thumbUrl), files: otherFiles });
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
