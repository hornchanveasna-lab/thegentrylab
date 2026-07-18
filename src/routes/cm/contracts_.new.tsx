import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import type { ContractType } from "@/lib/cm-data";
import { NewContractSheet } from "./contracts";

export const Route = createFileRoute("/cm/contracts_/new")({
  component: NewContractPage,
});

function NewContractPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const contractDefaults = activeProject?.module_defaults?.contracts as { contractType?: ContractType; currency?: string } | undefined;

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  const ownerId = activeProject?.owner_id ?? user.id;

  return (
    <NewContractSheet
      ownerId={ownerId} projectId={projectId} defaultContractType={contractDefaults?.contractType} defaultCurrency={contractDefaults?.currency} backTo="/cm/contracts"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_contracts", projectId] });
        navigate({ to: "/cm/contracts" });
      }}
    />
  );
}
