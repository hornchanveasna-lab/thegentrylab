import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { useAllCMSubmittals, enabledDisciplines } from "@/lib/cm-data";
import { NewSubmittalSheet } from "./submittal";

export const Route = createFileRoute("/cm/submittal_/$id/edit")({
  component: EditSubmittalPage,
});

function EditSubmittalPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects } = useSelectedProject(user?.id);
  const { data: submittals, isLoading } = useAllCMSubmittals(user?.id);
  const existing = submittals?.find((s) => s.id === id);
  const activeProject = projects?.find((p) => p.id === existing?.project_id);
  const projectDisciplines = enabledDisciplines(activeProject);
  const canApprove = usePermission(existing?.project_id, user?.id, "submittal", "approve");

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewSubmittalSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} canApprove={canApprove} disciplines={projectDisciplines} backTo="/cm/submittal"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_submittals", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_submittals", user.id] });
        navigate({ to: "/cm/submittal" });
      }}
    />
  );
}
