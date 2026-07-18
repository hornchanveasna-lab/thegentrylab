import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, PhotoLightbox, usePendingHighlight } from "@/components/cm/shared";
import { useAllCMSubmittals } from "@/lib/cm-data";
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
  const { data: submittals, isLoading } = useAllCMSubmittals(user?.id);
  const existing = submittals?.find((s) => s.id === id);
  const canEdit = usePermission(existing?.project_id, user?.id, "submittal", "edit");
  const canApprove = usePermission(existing?.project_id, user?.id, "submittal", "approve");
  const canDelete = usePermission(existing?.project_id, user?.id, "submittal", "delete");
  const { flash, matchedPhotoUrl } = usePendingHighlight("submittal", id);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <FormPage title={t("submittal.title")} backTo="/cm/submittal">
      <SubmittalDetail
        item={existing} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id}
        flash={flash} matchedPhotoUrl={matchedPhotoUrl}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["cm_submittals", existing.project_id] });
          queryClient.invalidateQueries({ queryKey: ["cm_all_submittals", user.id] });
        }}
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
