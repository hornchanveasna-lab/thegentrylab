import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, PhotoLightbox, usePendingHighlight, useSelectedProject } from "@/components/cm/shared";
import { useCMSubmittals } from "@/lib/cm-data";
import { SubmittalDetail } from "./submittal";

export const Route = createFileRoute("/cm/submittal_/$id")({
  component: SubmittalDetailPage,
});

type LightboxItem = { url: string; thumbUrl: string };

function SubmittalDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projectId } = useSelectedProject(user?.id);
  const canEdit = usePermission(projectId || undefined, user?.id, "submittal", "edit");
  const canApprove = usePermission(projectId || undefined, user?.id, "submittal", "approve");
  const canDelete = usePermission(projectId || undefined, user?.id, "submittal", "delete");
  const { data: submittals, isLoading } = useCMSubmittals(projectId || undefined);
  const existing = submittals?.find((s) => s.id === id);
  const { flash, matchedPhotoUrl } = usePendingHighlight("submittal", id);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId || !existing) return null;

  return (
    <FormPage title={t("submittal.title")} backTo="/cm/submittal">
      <SubmittalDetail
        item={existing} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id}
        flash={flash} matchedPhotoUrl={matchedPhotoUrl}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["cm_submittals", projectId] })}
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
