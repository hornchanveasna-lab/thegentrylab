import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, FieldSelect } from "@/components/cm/shared";
import { useCMProject, updateCMProject, SUBMITTAL_TYPES, type SubmittalType } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";
import { SUBMITTAL_TYPE_KEY } from "./submittal";

export const Route = createFileRoute("/cm/submittal_/settings")({
  component: SubmittalSettingsPage,
});

function SubmittalSettingsPage() {
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
  const defaults = (project.module_defaults?.submittal ?? {}) as { type?: SubmittalType };
  const type = defaults.type ?? "";

  const save = async (patch: Partial<typeof defaults>) => {
    setSaving(true);
    try {
      await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), submittal: { ...defaults, ...patch } } });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("submittal.title")} — ${t("common.settings")}`} backTo="/cm/submittal">
      <Card title={t("submittal.settingsDefaults")}>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("submittal.settingsDefaultType")}</span>
          <FieldSelect value={type} onChange={(v) => save({ type: v || undefined })} disabled={!canEdit || saving}
            options={[{ value: "", label: t("submittal.typePlaceholder") }, ...SUBMITTAL_TYPES.map((s) => ({ value: s, label: t(`submittalType.${SUBMITTAL_TYPE_KEY[s]}`) }))]} />
        </label>
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="submittal"
        onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="submittal" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="submittal" />
    </ModuleSettingsPage>
  );
}
