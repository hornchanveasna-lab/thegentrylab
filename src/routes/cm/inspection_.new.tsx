import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { enabledDisciplines, type InspectionType } from "@/lib/cm-data";
import { NewInspectionSheet } from "./inspection";

export const Route = createFileRoute("/cm/inspection_/new")({
  component: NewInspectionEntryPage,
});

function NewInspectionEntryPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const defaultType = (activeProject?.module_defaults?.inspection as { type?: InspectionType } | undefined)?.type;
  const canApprove = usePermission(projectId || undefined, user?.id, "inspection", "approve");

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewInspectionSheet
      ownerId={user.id} projectId={projectId} canApprove={canApprove} disciplines={enabledDisciplines(activeProject)} defaultType={defaultType} backTo="/cm/inspection"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_inspections", projectId] });
        navigate({ to: "/cm/inspection" });
      }}
    />
  );
}
