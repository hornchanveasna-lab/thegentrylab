import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, useSelectedProject, Card, inputCls, labelCls } from "@/components/cm/shared";
import { useCMProject, updateCMProject } from "@/lib/cm-data";
import { DocumentControlSection, WorkflowsSection, TemplatesSection } from "@/components/cm/ProjectSettingsView";

export const Route = createFileRoute("/cm/schedule_/settings")({
  component: ScheduleSettingsPage,
});

function ScheduleSettingsPage() {
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: project } = useCMProject(projectId || undefined);
  const canEdit = usePermission(projectId || undefined, user?.id, "settings", "edit");
  const canCreate = usePermission(projectId || undefined, user?.id, "settings", "create");
  const canDelete = usePermission(projectId || undefined, user?.id, "settings", "delete");
  const [threshold, setThreshold] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !project) return null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });
  const thresholdValue = threshold ?? String(project.schedule_delay_threshold_pct);

  const handleSave = async () => {
    const n = Number(thresholdValue);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try {
      await updateCMProject(project.id, { schedule_delay_threshold_pct: n });
      invalidate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleSettingsPage title={`${t("schedule.title")} — ${t("common.settings")}`} backTo="/cm/schedule">
      <Card title={t("schedule.settingsThreshold")}>
        <p className="text-[12px] text-white/45 mb-3">{t("schedule.settingsThresholdHint")}</p>
        <label className="flex flex-col gap-1.5 mb-3">
          <span className={labelCls}>{t("schedule.settingsThreshold")}</span>
          <input type="number" min={0} step="1" className={inputCls} disabled={!canEdit || saving}
            value={thresholdValue} onChange={(e) => setThreshold(e.target.value)} />
        </label>
        {canEdit && (
          <button onClick={handleSave} disabled={saving}
            className="self-start px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#ff5100" }}>
            {saving ? t("projectSettings.saving") : t("projectSettings.saveChanges")}
          </button>
        )}
      </Card>
      <DocumentControlSection project={project} canEdit={canEdit} onlyModule="schedule" onChanged={invalidate} />
      <WorkflowsSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canDelete={canDelete} lockModule="schedule" />
      <TemplatesSection ownerId={user.id} projectId={projectId} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} lockModule="schedule" />
    </ModuleSettingsPage>
  );
}
