import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, SegmentedField, inputCls, labelCls } from "@/components/cm/shared";
import { useCMProject, updateCMProject, CONTRACT_TYPES, type ContractType } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/contracts_/settings")({
  component: ContractsSettingsPage,
});

function ContractsSettingsPage() {
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: project } = useCMProject(projectId || undefined);
  const canEdit = usePermission(projectId || undefined, user?.id, "settings", "edit");
  const canCreate = usePermission(projectId || undefined, user?.id, "settings", "create");
  const canDelete = usePermission(projectId || undefined, user?.id, "settings", "delete");
  const [saving, setSaving] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !project) return null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });
  const defaults = (project.module_defaults?.contracts ?? {}) as { contractType?: ContractType; currency?: string };
  const contractType = defaults.contractType ?? "Main Contract";
  const currency = currencyDraft ?? defaults.currency ?? "";

  const save = async (patch: Partial<typeof defaults>) => {
    setSaving(true);
    try {
      await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), contracts: { ...defaults, ...patch } } });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("contracts.title")} — ${t("common.settings")}`} backTo="/cm/contracts">
      <Card title={t("contracts.settingsDefaults")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("contracts.settingsDefaultType")}</span>
            <SegmentedField value={contractType} onChange={(v) => save({ contractType: v })} disabled={!canEdit || saving}
              options={CONTRACT_TYPES.map((ct) => ({ value: ct, label: t(`contractType.${ct}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("contracts.settingsDefaultCurrency")}</span>
            <input className={inputCls} value={currency} placeholder="USD" disabled={!canEdit || saving}
              onChange={(e) => setCurrencyDraft(e.target.value)}
              onBlur={() => { if (currencyDraft !== null) { save({ currency: currencyDraft.trim() || undefined }); setCurrencyDraft(null); } }} />
          </label>
        </div>
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="contracts" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="contracts" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="contracts" />
    </ModuleSettingsPage>
  );
}
