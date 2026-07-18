import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, FieldSelect } from "@/components/cm/shared";
import { useCMProject, updateCMProject, INSPECTION_TYPES, type InspectionType } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/inspection_/settings")({
  component: InspectionSettingsPage,
});

function InspectionSettingsPage() {
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: project } = useCMProject(projectId || undefined);
  const canEdit = usePermission(projectId || undefined, user?.id, "settings", "edit");
  const canCreate = usePermission(projectId || undefined, user?.id, "settings", "create");
  const canDelete = usePermission(projectId || undefined, user?.id, "settings", "delete");
  const [saving, setSaving] = useState(false);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !project) return null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });
  const defaults = (project.module_defaults?.inspection ?? {}) as { type?: InspectionType };
  const type = defaults.type ?? "";

  const save = async (patch: Partial<typeof defaults>) => {
    setSaving(true);
    try {
      await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), inspection: { ...defaults, ...patch } } });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("inspection.title")} — ${t("common.settings")}`} backTo="/cm/inspection">
      <Card title={t("inspection.settingsDefaults")}>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("inspection.settingsDefaultType")}</span>
          <FieldSelect value={type} onChange={(v) => save({ type: v || undefined })} disabled={!canEdit || saving}
            options={[{ value: "", label: t("inspection.typePlaceholder") }, ...INSPECTION_TYPES.map((it) => ({ value: it, label: t(`inspectionType.${it}`) }))]} />
        </label>
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="inspection"
        onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="inspection" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="inspection" />
    </ModuleSettingsPage>
  );
}
