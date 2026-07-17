import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMEquipment } from "@/lib/cm-data";
import { NewEquipmentSheet } from "./equipment";

export const Route = createFileRoute("/cm/equipment_/$id/edit")({
  component: EditEquipmentPage,
});

function EditEquipmentPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMEquipment(projectId || undefined);
  const existing = items?.find((eq) => eq.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !existing) return null;

  return (
    <NewEquipmentSheet
      ownerId={user.id} projectId={projectId} existing={existing} backTo="/cm/equipment"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_equipment", projectId] });
        navigate({ to: "/cm/equipment" });
      }}
    />
  );
}
