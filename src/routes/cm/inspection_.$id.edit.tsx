import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { useAllCMInspections, enabledDisciplines } from "@/lib/cm-data";
import { NewInspectionSheet } from "./inspection";

export const Route = createFileRoute("/cm/inspection_/$id/edit")({
  component: EditInspectionEntryPage,
});

function EditInspectionEntryPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects } = useSelectedProject(user?.id);
  const { data: inspections, isLoading } = useAllCMInspections(user?.id);
  const existing = inspections?.find((i) => i.id === id);
  const activeProject = projects?.find((p) => p.id === existing?.project_id);
  const canApprove = usePermission(existing?.project_id, user?.id, "inspection", "approve");

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewInspectionSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} canApprove={canApprove} disciplines={enabledDisciplines(activeProject)} backTo="/cm/inspection"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_inspections", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_inspections", user.id] });
        navigate({ to: "/cm/inspection" });
      }}
    />
  );
}
