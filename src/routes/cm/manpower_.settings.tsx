import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, StringListEditor } from "@/components/cm/shared";
import { useCMProject, updateCMProject } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/manpower_/settings")({
  component: ManpowerSettingsPage,
});

function ManpowerSettingsPage() {
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
    <ModuleSettingsPage title={`${t("manpower.title")} — ${t("common.settings")}`} backTo="/cm/manpower">
      <Card title={t("manpower.settingsTrades")}>
        <StringListEditor label={t("manpower.settingsTrades")} hint={t("manpower.settingsTradesHint")}
          values={project.manpower_default_trades ?? []} canEdit={canEdit && !saving}
          onChange={async (next) => {
            setSaving(true);
            try {
              await updateCMProject(project.id, { manpower_default_trades: next });
              invalidate();
            } finally {
              setSaving(false);
            }
          }} />
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="manpower" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="manpower" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="manpower" />
    </ModuleSettingsPage>
  );
}
