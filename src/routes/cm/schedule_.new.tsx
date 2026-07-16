import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import { useCMScheduleItems, useActiveCMBOQItems } from "@/lib/cm-data";
import { NewActivitySheet } from "./schedule";

export const Route = createFileRoute("/cm/schedule_/new")({
  component: NewScheduleActivityPage,
});

function NewScheduleActivityPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const { data: items } = useCMScheduleItems(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);

  const groupOptions = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.group_label))), [items]);
  const boqCategoryOptions = useMemo(
    () => Array.from(new Set((boqItems ?? []).map((b) => b.category).filter((c): c is string => !!c))),
    [boqItems],
  );

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewActivitySheet
      ownerId={user.id} projectId={projectId} groupOptions={groupOptions} boqCategoryOptions={boqCategoryOptions} backTo="/cm/schedule"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_schedule_items", projectId] });
        navigate({ to: "/cm/schedule" });
      }}
    />
  );
}
