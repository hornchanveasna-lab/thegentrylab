import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMBOQItems } from "@/lib/cm-data";
import { NewBoqItemSheet } from "./boq";

export const Route = createFileRoute("/cm/boq_/$id/edit")({
  component: EditBoqItemPage,
});

function EditBoqItemPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMBOQItems(projectId || undefined);
  const existing = items?.find((i) => i.id === id);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !existing) return null;

  return (
    <NewBoqItemSheet
      ownerId={user.id} projectId={projectId} versionId={existing.version_id} existing={existing} backTo="/cm/boq"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_boq_items", projectId] });
        queryClient.invalidateQueries({ queryKey: ["cm_boq_versions", projectId] });
        navigate({ to: "/cm/boq" });
      }}
    />
  );
}
