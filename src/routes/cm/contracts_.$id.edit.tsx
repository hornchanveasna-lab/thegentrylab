import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMContracts } from "@/lib/cm-data";
import { NewContractSheet } from "./contracts";

export const Route = createFileRoute("/cm/contracts_/$id/edit")({
  component: EditContractPage,
});

function EditContractPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMContracts(projectId || undefined);
  const existing = items?.find((c) => c.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewContractSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} backTo="/cm/contracts"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_contracts", existing.project_id] });
        navigate({ to: "/cm/contracts" });
      }}
    />
  );
}
