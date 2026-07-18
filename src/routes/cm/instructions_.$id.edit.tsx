import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useAllCMInstructions } from "@/lib/cm-data";
import { NewInstructionSheet } from "./instructions";

export const Route = createFileRoute("/cm/instructions_/$id/edit")({
  component: EditInstructionPage,
});

function EditInstructionPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useAllCMInstructions(user?.id);
  const existing = items?.find((i) => i.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewInstructionSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} backTo="/cm/instructions"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_instructions", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_instructions", user.id] });
        navigate({ to: "/cm/instructions" });
      }}
    />
  );
}
