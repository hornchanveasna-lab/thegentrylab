import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, PhotoLightbox, usePendingHighlight } from "@/components/cm/shared";
import { useAllCMInspections } from "@/lib/cm-data";
import { InspectionDetail } from "./inspection";

export const Route = createFileRoute("/cm/inspection_/$id")({
  component: InspectionDetailPage,
});

type LightboxItem = { url: string; thumbUrl: string };

function InspectionDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: inspections, isLoading } = useAllCMInspections(user?.id);
  const existing = inspections?.find((i) => i.id === id);
  const canEdit = usePermission(existing?.project_id, user?.id, "inspection", "edit");
  const canApprove = usePermission(existing?.project_id, user?.id, "inspection", "approve");
  const canDelete = usePermission(existing?.project_id, user?.id, "inspection", "delete");
  const { flash, matchedPhotoUrl } = usePendingHighlight("inspection", id);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <FormPage title={t("inspection.title")} backTo="/cm/inspection">
      <InspectionDetail
        item={existing} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id}
        flash={flash} matchedPhotoUrl={matchedPhotoUrl}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["cm_inspections", existing.project_id] });
          queryClient.invalidateQueries({ queryKey: ["cm_all_inspections", user.id] });
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
