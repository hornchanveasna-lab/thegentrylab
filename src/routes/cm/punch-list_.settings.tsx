import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, SegmentedField } from "@/components/cm/shared";
import { useCMProject, updateCMProject, type TaskPriority } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/punch-list_/settings")({
  component: PunchListSettingsPage,
});

const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

function PunchListSettingsPage() {
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
  const defaults = (project.module_defaults?.punch_list ?? {}) as { priority?: TaskPriority; requireAfterPhoto?: boolean };
  const priority = defaults.priority ?? "Medium";
  const requireAfterPhoto = defaults.requireAfterPhoto ?? true;

  const save = async (patch: Partial<typeof defaults>) => {
    setSaving(true);
    try {
      await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), punch_list: { ...defaults, ...patch } } });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("punchList.title")} — ${t("common.settings")}`} backTo="/cm/punch-list">
      <Card title={t("punchList.settingsDefaults")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("punchList.settingsDefaultPriority")}</span>
            <SegmentedField value={priority} onChange={(v) => save({ priority: v })} disabled={!canEdit || saving}
              options={PRIORITIES.map((p) => ({ value: p, label: t(`taskPriority.${p}`) }))} />
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={requireAfterPhoto} disabled={!canEdit || saving}
              onChange={(e) => save({ requireAfterPhoto: e.target.checked })}
              className="w-4 h-4 rounded accent-[#ff5100]" />
            <span className="text-[12px] text-white/70">{t("punchList.settingsRequireAfterPhoto")}</span>
          </label>
        </div>
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="punch_list" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="punch_list" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="punch_list" />
    </ModuleSettingsPage>
  );
}
