import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { NewSafetySheet } from "./safety";

export const Route = createFileRoute("/cm/safety_/new")({
  component: NewSafetyEntryPage,
});

function NewSafetyEntryPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewSafetySheet
      ownerId={user.id} projectId={projectId} backTo="/cm/safety"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_safety_records", projectId] });
        navigate({ to: "/cm/safety" });
      }}
    />
  );
}
