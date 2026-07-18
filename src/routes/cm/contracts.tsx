import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, FormPage, FAB, ProjectPicker, FieldSelect, SegmentedField, SelectRow, CompanySelect, useSelectedProject, inputCls, labelCls,
  EmptyState, ErrorState, StatusBadge, ConfirmationDialog, WeekCalendarStrip,
  FilePicker, FileAttachmentList, QuickUploadButton, QuickUploadSheet,
} from "@/components/cm/shared";
import {
  useCMContracts,
  useAllCMContracts,
  createCMContract,
  updateCMContract,
  deleteCMContract,
  useCMCompanies,
  uploadCMFile,
  uploadCMQuickCaptureFiles,
  useCMProject,
  updateCMProject,
  CONTRACT_TYPES,
  CONTRACT_STATUSES,
  type CMContract,
  type CMContractWithProject,
  type ContractType,
  type ContractStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/contracts")({
  head: () => ({ meta: [{ title: "Contracts — Construction Management App" }] }),
  component: CMContractsPage,
});

const STATUS_COLOR: Record<ContractStatus, string> = {
  Active: "#34d399", Completed: "#94a3b8", Terminated: "#f43f5e", Closed: "#94a3b8",
};

export function NewContractSheet({ ownerId, projectId, existing, defaultContractType, defaultCurrency, backTo, onCreated }: {
  ownerId: string; projectId: string; existing?: CMContract; defaultContractType?: ContractType; defaultCurrency?: string; backTo: string; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [contractNumber, setContractNumber] = useState(existing?.contract_number ?? "");
  const [contractType, setContractType] = useState<ContractType>(existing?.contract_type ?? defaultContractType ?? "Main Contract");
  const [counterpartyId, setCounterpartyId] = useState<string | null>(existing?.counterparty_company_id ?? null);
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency ?? "");
  const [contractValue, setContractValue] = useState(existing?.contract_value != null ? String(existing.contract_value) : "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [completionDate, setCompletionDate] = useState(existing?.completion_date ?? "");
  const [status, setStatus] = useState<ContractStatus>(existing?.status ?? "Active");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"details" | "commercial">("details");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const patch = {
        title: title.trim(), contract_number: contractNumber.trim() || null, contract_type: contractType,
        counterparty_company_id: counterpartyId, currency: currency.trim() || null,
        contract_value: contractValue.trim() ? Number(contractValue) : null,
        start_date: startDate || null, completion_date: completionDate || null, status, notes: notes.trim() || null,
      };
      const item = existing ?? await createCMContract(ownerId, projectId, patch);
      if (existing) await updateCMContract(existing.id, patch);
      if (files.length > 0) {
        const uploaded = await Promise.all(files.map((f) => uploadCMFile(ownerId, projectId, f)));
        await updateCMContract(item.id, { files: [...item.files, ...uploaded] });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${existing ? "update" : "create"} contract`);
      setSaving(false);
    }
  };

  return (
    <FormPage title={t(existing ? "contracts.edit" : "contracts.new")} backTo={backTo}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("contracts.titleField")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("contracts.titlePlaceholder")} required autoFocus disabled={saving} />
        </label>
        <SegmentedField value={tab} onChange={setTab} disabled={saving}
          options={[
            { value: "details" as const, label: t("contracts.detailsTab") },
            { value: "commercial" as const, label: t("contracts.commercialTab") },
          ]} />

        {tab === "details" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("contracts.contractNumber")}</span>
                <input className={inputCls} value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("contracts.contractType")}</span>
                <SegmentedField value={contractType} onChange={setContractType} disabled={saving}
                  options={CONTRACT_TYPES.map((ct) => ({ value: ct, label: t(`contractType.${ct}`) }))} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("contracts.counterparty")}</span>
              <CompanySelect ownerId={ownerId} value={counterpartyId} onChange={(id) => setCounterpartyId(id)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("contracts.status")}</span>
              <SegmentedField value={status} onChange={setStatus} disabled={saving}
                options={CONTRACT_STATUSES.map((s) => ({ value: s, label: t(`contractStatus.${s}`) }))} />
            </label>
          </div>
        )}

        {tab === "commercial" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("contracts.currency")}</span>
                <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("contracts.contractValue")}</span>
                <input type="number" step="0.01" className={inputCls} value={contractValue} onChange={(e) => setContractValue(e.target.value)} disabled={saving} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("contracts.startDate")}</span>
                <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>{t("contracts.completionDate")}</span>
                <input type="date" className={inputCls} value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} disabled={saving} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("contracts.notes")}</span>
              <textarea className={`${inputCls} resize-y min-h-[56px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
            </label>
          </div>
        )}

        <FilePicker files={files} setFiles={setFiles} disabled={saving} />
        {existing && existing.files.length > 0 && <FileAttachmentList files={existing.files} />}
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {existing ? (saving ? t("contracts.saving") : t("contracts.save")) : (saving ? t("contracts.creating") : t("contracts.create"))}
        </button>
      </form>
    </FormPage>
  );
}

function ContractCard({ item, userId, projectName, onChanged }: {
  item: CMContract; userId: string; projectName?: string; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { data: companies } = useCMCompanies(item.owner_id);
  const counterparty = companies?.find((c) => c.id === item.counterparty_company_id);
  const canEdit = usePermission(item.project_id, userId, "contracts", "edit");
  const canDelete = usePermission(item.project_id, userId, "contracts", "delete");
  const sc = STATUS_COLOR[item.status];

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMContract(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`contractType.${item.contract_type}`)}</span>
          {item.contract_number && <span className="font-mono text-[9px] text-white/25 shrink-0">{item.contract_number}</span>}
          {projectName && <span className="text-[11px] text-white/40 truncate">{projectName}</span>}
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <StatusBadge label={t(`contractStatus.${item.status}`)} color={sc} />
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {counterparty && <span className="text-[11px] text-white/40">{counterparty.name}</span>}
            {item.contract_value != null && (
              <span className="font-mono text-[10px] text-white/30">{item.currency ?? ""} {item.contract_value.toLocaleString()}</span>
            )}
            {item.start_date && <span className="font-mono text-[10px] text-white/30">{item.start_date} → {item.completion_date ?? "—"}</span>}
          </div>
          {item.notes && <p className="text-[12px] text-white/45 whitespace-pre-wrap">{item.notes}</p>}
          <FileAttachmentList files={item.files} />
          <div className="flex items-center gap-4">
            {canEdit && (
              <Link to="/cm/contracts/$id/edit" params={{ id: item.id }} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
                {t("contracts.edit")}
              </Link>
            )}
            {canDelete && <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">{t("common.delete")}</button>}
          </div>
        </div>
      )}
      {confirmingDelete && (
        <ConfirmationDialog message={t("contracts.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function ContractsQuickSettings({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: project } = useCMProject(projectId);
  const canEdit = usePermission(projectId, userId, "settings", "edit");
  const [busy, setBusy] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);
  if (!project) return null;
  const defaults = (project.module_defaults?.contracts ?? {}) as { contractType?: ContractType; currency?: string };
  const contractType = defaults.contractType ?? "Main Contract";
  const currency = currencyDraft ?? defaults.currency ?? "";

  const save = async (patch: Partial<typeof defaults>) => {
    const nextDefaults = { ...(project.module_defaults ?? {}), contracts: { ...defaults, ...patch } };
    queryClient.setQueryData(["cm_project", projectId], (old: typeof project | null | undefined) => (old ? { ...old, module_defaults: nextDefaults } : old));
    setBusy(true);
    try {
      await updateCMProject(project.id, { module_defaults: nextDefaults });
      queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SelectRow
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5" /><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /></svg>}
        label={t("contracts.settingsDefaultType")} value={contractType} disabled={!canEdit || busy}
        options={CONTRACT_TYPES.map((ct) => ({ value: ct, label: t(`contractType.${ct}`) }))}
        onChange={(v) => save({ contractType: v })}
      />
      <div className="w-full flex items-center gap-3.5 px-4 py-3">
        <span className="text-white/70 shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" /></svg>
        </span>
        <span className="min-w-0 flex-1 text-[14px] text-white/90">{t("contracts.settingsDefaultCurrency")}</span>
        <input
          value={currency}
          placeholder="USD"
          disabled={!canEdit || busy}
          onChange={(e) => setCurrencyDraft(e.target.value)}
          onBlur={() => { if (currencyDraft !== null) { save({ currency: currencyDraft.trim() || undefined }); setCurrencyDraft(null); } }}
          className="w-20 bg-white/8 rounded-full px-3 py-1.5 text-[11px] font-mono text-white/85 text-right focus:outline-none"
        />
      </div>
    </>
  );
}

function CMContractsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [viewAll, setViewAll] = useState(true);
  const activeProject = projects?.find((p) => p.id === projectId);
  const { data: singleItems, isLoading: singleLoading, isError: singleIsError, refetch: singleRefetch } = useCMContracts(!viewAll ? (projectId || undefined) : undefined);
  const { data: allItems, isLoading: allLoading, isError: allIsError, refetch: allRefetch } = useAllCMContracts(viewAll ? user?.id : undefined);
  const items: (CMContract | CMContractWithProject)[] | undefined = viewAll ? allItems : singleItems;
  const isLoading = viewAll ? allLoading : singleLoading;
  const isError = viewAll ? allIsError : singleIsError;
  const refetch = viewAll ? allRefetch : singleRefetch;
  const canCreate = usePermission(projectId || undefined, user?.id, "contracts", "create");
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [quickUploadFiles, setQuickUploadFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const dateOf = (c: CMContract) => c.start_date ?? c.created_at.slice(0, 10);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_contracts", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_all_contracts", user?.id] });
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
    if (dateFilter) list = list.filter((c) => dateOf(c) === dateFilter);
    if (q) list = list.filter((c) => [c.title, c.contract_number].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
  }, [items, search, sortAsc, dateFilter]);

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
        <ModuleHeader title={t("contracts.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} settingsTo="/cm/contracts/settings"
          quickSettings={!viewAll && projectId ? <ContractsQuickSettings projectId={projectId} userId={user.id} /> : undefined} />
        <ProjectPicker projects={pickerProjects} value={viewAll ? "all" : projectId} onChange={handlePickerChange} />

        {!viewAll && projectId && canCreate && (
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

        {(viewAll || projectId) && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {isError && <ErrorState message={t("common.error")} onRetry={() => refetch()} />}
            {!isError && (
              <>
                {!isLoading && visibleItems.length === 0 && <EmptyState message={t("contracts.noneYet")} />}
                <div className="flex flex-col gap-3">
                  {visibleItems.map((c) => (
                    <ContractCard key={c.id} item={c} userId={user.id} projectName={viewAll ? (c as CMContractWithProject).projectName : undefined} onChanged={invalidate} />
                  ))}
                </div>
              </>
            )}
            {!viewAll && canCreate && <FAB label={t("contracts.new")} onClick={() => navigate({ to: "/cm/contracts/new" })} />}
          </>
        )}
      </main>

      {showQuickUpload && projectId && (
        <QuickUploadSheet
          sheetTitle={t("contracts.new")}
          titleLabel={t("contracts.titleField")}
          titlePlaceholder={t("contracts.titlePlaceholder")}
          initialFiles={quickUploadFiles}
          onClose={() => setShowQuickUpload(false)}
          onSubmit={async (title, files) => {
            const item = await createCMContract(ownerId, projectId, { title });
            if (files.length > 0) {
              const { images, otherFiles } = await uploadCMQuickCaptureFiles(ownerId, projectId, files);
              await updateCMContract(item.id, { files: [...images.map(({ thumbUrl, ...f }) => f), ...otherFiles] });
            }
            invalidate();
          }}
        />
      )}
    </div>
  );
}
