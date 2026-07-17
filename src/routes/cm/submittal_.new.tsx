import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { enabledDisciplines } from "@/lib/cm-data";
import { NewSubmittalSheet } from "./submittal";

export const Route = createFileRoute("/cm/submittal_/new")({
  component: NewSubmittalPage,
});

function NewSubmittalPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const projectDisciplines = enabledDisciplines(activeProject);
  const canApprove = usePermission(projectId || undefined, user?.id, "submittal", "approve");

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewSubmittalSheet
      ownerId={user.id} projectId={projectId} canApprove={canApprove} disciplines={projectDisciplines} backTo="/cm/submittal"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_submittals", projectId] });
        navigate({ to: "/cm/submittal" });
      }}
    />
  );
}
