import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMInspections, enabledDisciplines } from "@/lib/cm-data";
import { NewInspectionSheet } from "./inspection";

export const Route = createFileRoute("/cm/inspection_/$id/edit")({
  component: EditInspectionEntryPage,
});

function EditInspectionEntryPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const canApprove = usePermission(projectId || undefined, user?.id, "inspection", "approve");
  const { data: inspections, isLoading } = useCMInspections(projectId || undefined);
  const existing = inspections?.find((i) => i.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !existing) return null;

  return (
    <NewInspectionSheet
      ownerId={existing.owner_id} projectId={projectId} existing={existing} canApprove={canApprove} disciplines={enabledDisciplines(activeProject)} backTo="/cm/inspection"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_inspections", projectId] });
        navigate({ to: "/cm/inspection" });
      }}
    />
  );
}
