import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, PhotoLightbox, usePendingHighlight, RecordActionsMenu, type RecordMenuItem } from "@/components/cm/shared";
import { useAllCMSafetyRecords } from "@/lib/cm-data";
import { SafetyDetail } from "./safety";

export const Route = createFileRoute("/cm/safety_/$id")({
  component: SafetyDetailPage,
});

type LightboxItem = { url: string; thumbUrl: string };

function SafetyDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: records, isLoading } = useAllCMSafetyRecords(user?.id);
  const existing = records?.find((r) => r.id === id);
  const canEdit = usePermission(existing?.project_id, user?.id, "safety", "edit");
  const canApprove = usePermission(existing?.project_id, user?.id, "safety", "approve");
  const canDelete = usePermission(existing?.project_id, user?.id, "safety", "delete");
  const { flash, matchedPhotoUrl } = usePendingHighlight("safety", id);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [menuItems, setMenuItems] = useState<RecordMenuItem[]>([]);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <FormPage title={t("safety.title")} backTo="/cm/safety" menu={<RecordActionsMenu items={menuItems} />}>
      <SafetyDetail
        item={existing} canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} userId={user.id}
        flash={flash} matchedPhotoUrl={matchedPhotoUrl}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["cm_safety_records", existing.project_id] });
          queryClient.invalidateQueries({ queryKey: ["cm_all_safety_records", user.id] });
        }}
        onOpenPhoto={(items, index) => setLightbox({ items, index })}
        onMenuItems={setMenuItems}
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
