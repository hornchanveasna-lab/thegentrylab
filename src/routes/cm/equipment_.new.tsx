import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { NewEquipmentSheet } from "./equipment";

export const Route = createFileRoute("/cm/equipment_/new")({
  component: NewEquipmentPage,
});

function NewEquipmentPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewEquipmentSheet
      ownerId={user.id} projectId={projectId} backTo="/cm/equipment"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_equipment", projectId] });
        navigate({ to: "/cm/equipment" });
      }}
    />
  );
}
