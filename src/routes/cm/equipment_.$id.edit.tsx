import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useAllCMEquipment } from "@/lib/cm-data";
import { NewEquipmentSheet } from "./equipment";

export const Route = createFileRoute("/cm/equipment_/$id/edit")({
  component: EditEquipmentPage,
});

function EditEquipmentPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useAllCMEquipment(user?.id);
  const existing = items?.find((eq) => eq.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <NewEquipmentSheet
      ownerId={existing.owner_id} projectId={existing.project_id} existing={existing} backTo="/cm/equipment"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_equipment", existing.project_id] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_equipment", user.id] });
        navigate({ to: "/cm/equipment" });
      }}
    />
  );
}
