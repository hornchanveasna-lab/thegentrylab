import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { NewPunchItemSheet } from "./punch-list";

export const Route = createFileRoute("/cm/punch-list_/new")({
  component: NewPunchItemPage,
});

function NewPunchItemPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const canApprove = usePermission(projectId || undefined, user?.id, "punch_list", "approve");

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewPunchItemSheet
      ownerId={user.id} projectId={projectId} canApprove={canApprove} backTo="/cm/punch-list"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_tasks", projectId] });
        navigate({ to: "/cm/punch-list" });
      }}
    />
  );
}
