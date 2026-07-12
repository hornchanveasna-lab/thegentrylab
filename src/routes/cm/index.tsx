import { createFileRoute } from "@tanstack/react-router";
import { useAuthCM } from "@/lib/auth-cm";
import { supabaseCM } from "@/lib/supabase-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { useCMAccountSettings } from "@/lib/cm-data";
import { AppTile } from "@/components/cm/AppTile";

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
      <main className="max-w-md mx-auto w-full px-4 pt-8 pb-28">
        <div className="flex items-center justify-between mb-10">
          <CompanyMark userId={user.id} />
          <AvatarButton />
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-8">
          <AppTile
            label={t("tile.report")}
            to="/cm/reports"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 17l2.5-3 2.5 2 3-4" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.photo")}
            to="/cm/photos"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.projects")}
            to="/cm/projects"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.directory")}
            to="/cm/directory"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h13a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" /><path d="M8 9h8M8 13h5" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.siteDiary")}
            to="/cm/site-diary"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.punchList")}
            to="/cm/punch-list"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.inspection")}
            to="/cm/inspection"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8" /><path d="M8 15l2 2 4-4" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.safety")}
            to="/cm/safety"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" /><path d="M12 8v5" /><circle cx="12" cy="16" r="0.5" fill="currentColor" />
              </svg>
            }
          />
          <AppTile
            label={t("tile.submittal")}
            to="/cm/submittal"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            }
          />
        </div>
      </main>
    </div>
  );
}
