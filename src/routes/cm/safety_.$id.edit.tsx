import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useAllCMSafetyRecords } from "@/lib/cm-data";
import { NewSafetySheet } from "./safety";

export const Route = createFileRoute("/cm/safety_/$id/edit")({
  component: EditSafetyEntryPage,
});

function EditSafetyEntryPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useAllCMSafetyRecords(user?.id);
  const existing = records?.find((r) => r.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewSafetySheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} backTo="/cm/safety"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_safety_records", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_safety_records", user.id] });
        navigate({ to: "/cm/safety" });
      }}
    />
  );
}
