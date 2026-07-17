import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { usePermission } from "@/lib/cm-permissions";
import { useCMLang } from "@/lib/cm-i18n";
import { FormPage, PhotoLightbox, usePendingHighlight } from "@/components/cm/shared";
import { useAllCMDailyLogs } from "@/lib/cm-data";
import { DayDetailContent } from "./site-diary";

export const Route = createFileRoute("/cm/site-diary_/$id")({
  component: SiteDiaryDetailPage,
});

type LightboxItem = { url: string; thumbUrl: string };

function SiteDiaryDetailPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: logs, isLoading } = useAllCMDailyLogs(user?.id);
  const existing = logs?.find((l) => l.id === id);
  const canEdit = usePermission(existing?.project_id, user?.id, "site_diary", "edit");
  const canDelete = usePermission(existing?.project_id, user?.id, "site_diary", "delete");
  const { flash, matchedPhotoUrl } = usePendingHighlight("siteDiary", id);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  if (authLoading || isLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !existing) return null;

  return (
    <FormPage title={t("siteDiary.title")} backTo="/cm/site-diary">
      <DayDetailContent
        log={existing} projectName={existing.projectName} canEdit={canEdit} canDelete={canDelete} userId={user.id}
        flashPhotoUrl={flash ? matchedPhotoUrl : null}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", existing.project_id] });
          queryClient.invalidateQueries({ queryKey: ["cm_all_daily_logs", user.id] });
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
