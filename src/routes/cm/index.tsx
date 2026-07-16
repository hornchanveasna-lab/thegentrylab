import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthCM } from "@/lib/auth-cm";
import { supabaseCM } from "@/lib/supabase-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { useCMAccountSettings } from "@/lib/cm-data";
import { AppTile } from "@/components/cm/AppTile";
import { NotificationBell } from "@/components/cm/shared";

export const Route = createFileRoute("/cm/")({
  head: () => ({
    meta: [
      { title: "Construction Management App — The Gentry Lab" },
      { name: "description", content: "Daily site diaries, punch lists, and photo logs for construction projects — by The Gentry Lab." },
    ],
  }),
  component: CMIndexPage,
});

function AvatarButton() {
  const { user, signInWithGoogle } = useAuthCM();
  if (!user) {
    return (
      <button onClick={() => signInWithGoogle()} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/5 hover:bg-white/10 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21a8 8 0 1 0-16 0" /><circle cx="12" cy="8" r="4" />
        </svg>
      </button>
    );
  }
  return (
    <a href="/cm/settings" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-white/5 hover:bg-white/10 transition-colors">
      {user.user_metadata?.avatar_url ? (
        <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[13px] font-bold text-white/70">{(user.user_metadata?.full_name ?? user.email ?? "U")[0]?.toUpperCase()}</span>
      )}
    </a>
  );
}

function CompanyMark({ userId }: { userId: string | undefined }) {
  const { data: account } = useCMAccountSettings(userId);
  if (!account?.company_logo_url && !account?.company_name) return <div />;
  return (
    <div className="flex items-center gap-3 min-w-0">
      {account.company_logo_url && (
        <img src={account.company_logo_url} alt="" className="h-12 max-w-[160px] w-auto object-contain shrink-0" />
      )}
      {account.company_name && <span className="text-[16px] font-bold text-white/85 truncate">{account.company_name}</span>}
    </div>
  );
}

export function CMIndexPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();

  if (!supabaseCM) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <p className="text-white/40 text-sm text-center">{t("home.notConfigured")}</p>
      </div>
    );
  }

  if (authLoading) {
    return <div className="min-h-screen bg-[#0a0a0b]" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">{t("home.title")}</h1>
          <p className="text-white/45 text-sm mb-8">{t("home.signedOutSubtitle")}</p>
          <button onClick={() => signInWithGoogle()}
            className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
            style={{ backgroundColor: "#ff5100" }}>
            {t("common.signInGoogle")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-8 pb-28">
        <div className="flex items-center justify-between mb-10 gap-3">
          <CompanyMark userId={user.id} />
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/cm/search" aria-label={t("search.title")}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
            </Link>
            <NotificationBell userId={user.id} />
            <AvatarButton />
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 border-t border-l border-white/7 rounded-2xl overflow-hidden">
          <AppTile
            label={t("tile.dashboard")}
            to="/cm/dashboard"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l2-7 4 14 2-7h6" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.report")}
            to="/cm/reports"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 17l2.5-3 2.5 2 3-4" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.photo")}
            to="/cm/photos"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13" r="3.4" /><circle cx="17.6" cy="10.4" r="0.6" fill="currentColor" stroke="none" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.projects")}
            to="/cm/projects"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 21V4" /><path d="M6 6h11l-3.2 3.2" /><path d="M13.8 9.2V13" /><path d="M3 21h18" /><path d="M9.5 21v-6.5h4V21" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.directory")}
            to="/cm/directory"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.2" r="2.1" />
                <path d="M3.3 20c0-3.3 2.5-5.6 5.7-5.6s5.7 2.3 5.7 5.6" /><path d="M14.8 14.9c2.5.4 4.4 2.5 4.4 5.1" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.siteDiary")}
            to="/cm/site-diary"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="13" height="16" rx="2" /><path d="M8 8.5h5M8 12.5h5" /><path d="M15.3 15.6l4-4 2 2-4 4h-2v-2z" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.punchList")}
            to="/cm/punch-list"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.inspection")}
            to="/cm/inspection"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10.2" cy="10.2" r="6.4" /><path d="M7.3 10.4l1.9 1.9 3.7-3.7" /><path d="M14.8 14.8L20 20" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.safety")}
            to="/cm/safety"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.3 15.2a7.7 7.7 0 0 1 15.4 0" /><rect x="2.8" y="15.2" width="18.4" height="2.8" rx="1.4" />
                <path d="M12 6.3V3.4" /><path d="M12 3.4h2.2" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.submittal")}
            to="/cm/submittal"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.schedule")}
            to="/cm/schedule"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" /><path d="M7 13h4M7 17h7" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.boq")}
            to="/cm/boq"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2h9l3 3v17H6z" /><path d="M9 7h6M9 11h6M9 15h4" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.manpower")}
            to="/cm/manpower"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a7 7 0 0 0-7 7v3h14v-3a7 7 0 0 0-7-7z" /><path d="M3 16h18" /><path d="M12 3v3" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.equipment")}
            to="/cm/equipment"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4z" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.contracts")}
            to="/cm/contracts"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3h8l3 3v15H5V6z" /><path d="M15 3v4h4" /><path d="M8 12h8M8 16h5" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.instructions")}
            to="/cm/instructions"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v13H8l-4 4z" /><path d="M8 9h8M8 12.5h5" />
              </svg>
            }
          />
        </div>
      </main>
    </div>
  );
}
