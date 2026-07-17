import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, StringListEditor } from "@/components/cm/shared";
import { useCMProject, updateCMProject } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/equipment_/settings")({
  component: EquipmentSettingsPage,
});

function EquipmentSettingsPage() {
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

  return (
    <ModuleSettingsPage title={`${t("equipment.title")} — ${t("common.settings")}`} backTo="/cm/equipment">
      <Card title={t("equipment.settingsTypes")}>
        <StringListEditor label={t("equipment.settingsTypes")} hint={t("equipment.settingsTypesHint")}
          values={(project.module_defaults?.equipment?.types as string[] | undefined) ?? []} canEdit={canEdit && !saving}
          onChange={async (next) => {
            setSaving(true);
            try {
              await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), equipment: { ...(project.module_defaults?.equipment ?? {}), types: next } } });
              invalidate();
            } finally {
              setSaving(false);
            }
          }} />
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="equipment" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="equipment" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="equipment" />
    </ModuleSettingsPage>
  );
}
