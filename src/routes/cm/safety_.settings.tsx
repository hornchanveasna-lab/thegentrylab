import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, FieldSelect, SegmentedField } from "@/components/cm/shared";
import { useCMProject, updateCMProject, SAFETY_RECORD_TYPES, type SafetyRecordType, type SafetySeverity } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/safety_/settings")({
  component: SafetySettingsPage,
});

const SEVERITIES: SafetySeverity[] = ["Low", "Medium", "High", "Critical"];

function SafetySettingsPage() {
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
  const defaults = (project.module_defaults?.safety ?? {}) as { recordType?: SafetyRecordType; severity?: SafetySeverity };
  const recordType = defaults.recordType ?? "Toolbox Talk";
  const severity = defaults.severity ?? "Low";

  const save = async (patch: Partial<typeof defaults>) => {
    setSaving(true);
    try {
      await updateCMProject(project.id, { module_defaults: { ...(project.module_defaults ?? {}), safety: { ...defaults, ...patch } } });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("safety.title")} — ${t("common.settings")}`} backTo="/cm/safety">
      <Card title={t("safety.settingsDefaults")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("safety.settingsDefaultRecordType")}</span>
            <FieldSelect value={recordType} onChange={(v) => save({ recordType: v })} disabled={!canEdit || saving}
              options={SAFETY_RECORD_TYPES.map((rt) => ({ value: rt, label: t(`safetyType.${rt}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("safety.settingsDefaultSeverity")}</span>
            <SegmentedField value={severity} onChange={(v) => save({ severity: v })} disabled={!canEdit || saving}
              options={SEVERITIES.map((s) => ({ value: s, label: t(`safetySeverity.${s}`) }))} />
          </label>
        </div>
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="safety"
        onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="safety" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="safety" />
    </ModuleSettingsPage>
  );
}
