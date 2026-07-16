import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useAllCMDailyLogs } from "@/lib/cm-data";
import { NewLogSheet } from "./site-diary";

export const Route = createFileRoute("/cm/site-diary_/$id/edit")({
  component: EditSiteDiaryEntryPage,
});

function EditSiteDiaryEntryPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: logs, isLoading } = useAllCMDailyLogs(user?.id);
  const existing = logs?.find((l) => l.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewLogSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} backTo="/cm/site-diary"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_daily_logs", user.id] });
        navigate({ to: "/cm/site-diary" });
      }}
    />
  );
}
