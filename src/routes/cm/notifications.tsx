import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { BackButton, EmptyState } from "@/components/cm/shared";
import { useCMNotifications, markCMNotificationRead, markAllCMNotificationsRead, type CMNotification } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Construction Management App" }] }),
  component: CMNotificationsPage,
});

const ENTITY_TYPE_TO_ROUTE: Record<string, string> = {
  site_diary: "/cm/site-diary",
  punch_list: "/cm/punch-list",
  inspection: "/cm/inspection",
  safety: "/cm/safety",
  submittal: "/cm/submittal",
};

function CMNotificationsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: notifications } = useCMNotifications(user?.id);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cm_notifications", user?.id] });

  const handleOpen = (n: CMNotification) => {
    if (!n.read_at) markCMNotificationRead(n.id).then(invalidate);
    const to = n.entity_type ? ENTITY_TYPE_TO_ROUTE[n.entity_type] : undefined;
    if (to) navigate({ to });
  };

  if (authLoading) return <div className="min-h-screen bg-background" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-background text-text-primary flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-text-primary flex-1 truncate">{t("notifications.bell.title")}</h1>
          {unread > 0 && (
            <button type="button" onClick={() => markAllCMNotificationsRead(user.id).then(invalidate)}
              className="text-[11px] font-mono uppercase tracking-widest text-[#ff5100] hover:text-[#ff5100]/80 transition-colors shrink-0">
              {t("notifications.bell.markAllRead")}
            </button>
          )}
        </div>

        {(!notifications || notifications.length === 0) && <EmptyState message={t("notifications.bell.none")} />}

        {notifications && notifications.length > 0 && (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <button key={n.id} type="button" onClick={() => handleOpen(n)}
                className="flex items-start gap-3 rounded-xl bg-surface-1 hover:bg-surface-3 transition-colors px-4 py-3 text-left w-full">
                <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: n.read_at ? "transparent" : "#ff5100" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-primary truncate">{n.title}</p>
                  {n.body && <p className="text-[12px] text-text-muted mt-0.5">{n.body}</p>}
                  <p className="font-mono text-[9px] text-text-subtle mt-1">{n.created_at.slice(0, 16).replace("T", " ")}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
