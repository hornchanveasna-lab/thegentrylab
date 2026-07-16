import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMDailyLogs } from "@/lib/cm-data";
import { NewLogSheet } from "./site-diary";

export const Route = createFileRoute("/cm/site-diary_/new")({
  component: NewSiteDiaryEntryPage,
});

function NewSiteDiaryEntryPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: logs } = useCMDailyLogs(projectId || undefined);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewLogSheet
      ownerId={user.id} projectId={projectId} logs={logs} backTo="/cm/site-diary"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_daily_logs", user.id] });
        navigate({ to: "/cm/site-diary" });
      }}
    />
  );
}
