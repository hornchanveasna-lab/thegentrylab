import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, SegmentedField } from "@/components/cm/shared";
import { useCMProject, updateCMProject, INSTRUCTION_SOURCE_TYPES, INSTRUCTION_PRIORITIES, type InstructionSourceType, type InstructionPriority } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/instructions_/settings")({
  component: InstructionsSettingsPage,
});

function InstructionsSettingsPage() {
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
  const defaults = (project.module_defaults?.instructions ?? {}) as { sourceType?: InstructionSourceType; priority?: InstructionPriority };
  const sourceType = defaults.sourceType ?? "Consultant";
  const priority = defaults.priority ?? "Medium";

  const save = async (patch: Partial<typeof defaults>) => {
    setSaving(true);
    try {
      await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), instructions: { ...defaults, ...patch } } });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("instructions.title")} — ${t("common.settings")}`} backTo="/cm/instructions">
      <Card title={t("instructions.settingsDefaults")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("instructions.settingsDefaultSourceType")}</span>
            <SegmentedField value={sourceType} onChange={(v) => save({ sourceType: v })} disabled={!canEdit || saving}
              options={INSTRUCTION_SOURCE_TYPES.map((s) => ({ value: s, label: t(`instructionSource.${s}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("instructions.settingsDefaultPriority")}</span>
            <SegmentedField value={priority} onChange={(v) => save({ priority: v })} disabled={!canEdit || saving}
              options={INSTRUCTION_PRIORITIES.map((p) => ({ value: p, label: t(`instructionPriority.${p}`) }))} />
          </label>
        </div>
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="instructions" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="instructions" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="instructions" />
    </ModuleSettingsPage>
  );
}
