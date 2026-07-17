import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { NewInstructionSheet } from "./instructions";

export const Route = createFileRoute("/cm/instructions_/new")({
  component: NewInstructionPage,
});

function NewInstructionPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  const ownerId = activeProject?.owner_id ?? user.id;

  return (
    <NewInstructionSheet
      ownerId={ownerId} projectId={projectId} backTo="/cm/instructions"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_instructions", projectId] });
        navigate({ to: "/cm/instructions" });
      }}
    />
  );
}
