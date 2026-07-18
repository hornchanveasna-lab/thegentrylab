import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useAllCMTasks } from "@/lib/cm-data";
import { NewPunchItemSheet } from "./punch-list";

export const Route = createFileRoute("/cm/punch-list_/$id/edit")({
  component: EditPunchItemPage,
});

function EditPunchItemPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useAllCMTasks(user?.id);
  const existing = items?.find((i) => i.id === id);
  const canApprove = usePermission(existing?.project_id, user?.id, "punch_list", "approve");

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewPunchItemSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} canApprove={canApprove} backTo="/cm/punch-list"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_tasks", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_tasks", user.id] });
        navigate({ to: "/cm/punch-list" });
      }}
    />
  );
}
