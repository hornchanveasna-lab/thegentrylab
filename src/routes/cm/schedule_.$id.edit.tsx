import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMScheduleItems, useActiveCMBOQItems } from "@/lib/cm-data";
import { NewActivitySheet } from "./schedule";

export const Route = createFileRoute("/cm/schedule_/$id/edit")({
  component: EditScheduleActivityPage,
});

function EditScheduleActivityPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMScheduleItems(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const existing = items?.find((i) => i.id === id);

  const groupOptions = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.group_label))), [items]);
  const boqCategoryOptions = useMemo(
    () => Array.from(new Set((boqItems ?? []).map((b) => b.category).filter((c): c is string => !!c))),
    [boqItems],
  );

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !existing) return null;

  return (
    <NewActivitySheet
      ownerId={user.id} projectId={projectId} existing={existing}
      groupOptions={groupOptions} boqCategoryOptions={boqCategoryOptions} backTo="/cm/schedule"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_schedule_items", projectId] });
        navigate({ to: "/cm/schedule" });
      }}
    />
  );
}
