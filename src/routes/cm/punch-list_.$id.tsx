import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, PhotoLightbox, usePendingHighlight, useSelectedProject } from "@/components/cm/shared";
import { useCMTasks } from "@/lib/cm-data";
import { PunchListDetail } from "./punch-list";

export const Route = createFileRoute("/cm/punch-list_/$id")({
  component: PunchListDetailPage,
});

type LightboxItem = { url: string; thumbUrl: string };

function PunchListDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const canEdit = usePermission(projectId || undefined, user?.id, "punch_list", "edit");
  const canApprove = usePermission(projectId || undefined, user?.id, "punch_list", "approve");
  const canDelete = usePermission(projectId || undefined, user?.id, "punch_list", "delete");
  const { data: items, isLoading } = useCMTasks(projectId || undefined);
  const existing = items?.find((i) => i.id === id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const requireAfterPhoto = (activeProject?.module_defaults?.punch_list as { requireAfterPhoto?: boolean } | undefined)?.requireAfterPhoto ?? true;
  const { flash, matchedPhotoUrl } = usePendingHighlight("punchList", id);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !existing) return null;

  return (
    <FormPage title={t("punchList.title")} backTo="/cm/punch-list">
      <PunchListDetail
        item={existing} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id} requireAfterPhoto={requireAfterPhoto}
        flash={flash} matchedPhotoUrl={matchedPhotoUrl}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["cm_tasks", projectId] })}
        onOpenPhoto={(items, index) => setLightbox({ items, index })}
      />
      {lightbox && (
        <PhotoLightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((lb) => lb && { ...lb, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </FormPage>
  );
}
