import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, StringListEditor } from "@/components/cm/shared";
import { useCMProject, updateCMProject } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/boq_/settings")({
  component: BoqSettingsPage,
});

function BoqSettingsPage() {
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
    <ModuleSettingsPage title={`${t("boq.title")} — ${t("common.settings")}`} backTo="/cm/boq">
      <Card title={t("boq.settingsCategories")}>
        <StringListEditor label={t("boq.settingsCategories")} hint={t("boq.settingsCategoriesHint")}
          values={project.boq_default_categories ?? []} canEdit={canEdit && !saving}
          onChange={async (next) => {
            setSaving(true);
            try {
              await updateCMProject(project.id, { boq_default_categories: next });
              invalidate();
            } finally {
              setSaving(false);
            }
          }} />
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="boq" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="boq" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="boq" />
    </ModuleSettingsPage>
  );
}
