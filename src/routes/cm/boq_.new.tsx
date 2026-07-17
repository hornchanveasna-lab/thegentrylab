import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMBOQVersions, activeCMBOQVersion } from "@/lib/cm-data";
import { NewBoqItemSheet } from "./boq";

export const Route = createFileRoute("/cm/boq_/new")({
  component: NewBoqItemPage,
});

function NewBoqItemPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const { data: versions } = useCMBOQVersions(projectId || undefined);
  const defaultVersion = useMemo(() => activeCMBOQVersion(versions), [versions]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewBoqItemSheet
      ownerId={user.id} projectId={projectId} versionId={defaultVersion?.id ?? null}
      categoryOptions={activeProject?.boq_default_categories ?? []} backTo="/cm/boq"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_boq_items", projectId] });
        queryClient.invalidateQueries({ queryKey: ["cm_boq_versions", projectId] });
        navigate({ to: "/cm/boq" });
      }}
    />
  );
}
