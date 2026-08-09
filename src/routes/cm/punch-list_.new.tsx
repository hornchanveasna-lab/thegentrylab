import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMPunchListDocument, type TaskPriority } from "@/lib/cm-data";
import { NewPunchItemSheet } from "./punch-list";

interface NewPunchItemSearch { document?: string }

export const Route = createFileRoute("/cm/punch-list_/new")({
  validateSearch: (search: Record<string, unknown>): NewPunchItemSearch => ({
    document: typeof search.document === "string" ? search.document : undefined,
  }),
  component: NewPunchItemPage,
});

function NewPunchItemPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const { projects, projectId: selectedProjectId } = useSelectedProject(user?.id);
  const { data: targetDoc } = useCMPunchListDocument(search.document);
  const projectId = search.document ? targetDoc?.project_id : selectedProjectId;
  const activeProject = projects?.find((p) => p.id === projectId);
  const defaultPriority = (activeProject?.module_defaults?.punch_list as { priority?: TaskPriority } | undefined)?.priority;
  const canApprove = usePermission(projectId || undefined, user?.id, "punch_list", "approve");

  if (authLoading || (search.document && !targetDoc)) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewPunchItemSheet
      ownerId={user.id} projectId={projectId} canApprove={canApprove} defaultPriority={defaultPriority}
      documentId={search.document} backTo="/cm/punch-list"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_tasks", projectId] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_tasks", user.id] });
        queryClient.invalidateQueries({ queryKey: ["cm_punch_list_documents", projectId] });
        queryClient.invalidateQueries({ queryKey: ["cm_all_punch_list_documents", user.id] });
        navigate({ to: "/cm/punch-list" });
      }}
    />
  );
}
