import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";
import { BackButton, SegmentedField, EmptyState } from "@/components/cm/shared";
import { useCMMyMemberships, jobRoleLabel, useCMAccountSettings, upsertCMAccountSettings } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/profile")({
  head: () => ({ meta: [{ title: "Profile — Construction Management App" }] }),
  component: CMProfilePage,
});

const LANG_OPTIONS: CMLang[] = ["en", "km", "zh"];

function CMProfilePage() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuthCM();
  const { lang, setLang, t } = useCMLang();
  const navigate = useNavigate();
  const { data: memberships } = useCMMyMemberships(user?.id);
  const { data: account } = useCMAccountSettings(user?.id);

  const handleLangChange = async (l: CMLang) => {
    setLang(l);
    if (user) await upsertCMAccountSettings(user.id, { language: l });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/cm" });
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{t("profile.title")}</h1>
          <Link to="/cm/settings" className="text-[11px] font-mono uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors shrink-0">
            {t("profile.accountSettings")}
          </Link>
        </div>

        <div className="flex items-center gap-3 px-4 py-4 mb-5 rounded-2xl bg-[#0d0d0e]">
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <span className="w-14 h-14 rounded-full bg-brand-accent flex items-center justify-center text-base font-bold text-black">
              {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[14px] font-bold truncate">{user.user_metadata?.full_name ?? t("profile.title")}</p>
            <p className="text-[11px] text-white/40 truncate">{user.email}</p>
            {account?.company_name && <p className="text-[11px] text-white/30 truncate mt-0.5">{account.company_name}</p>}
          </div>
        </div>

        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">{t("settings.language")}</p>
          <SegmentedField
            options={LANG_OPTIONS.map((l) => ({ value: l, label: t(`settings.lang.${l}`) }))}
            value={lang}
            onChange={handleLangChange}
          />
        </div>

        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2">{t("profile.myProjects")}</p>
          {(!memberships || memberships.length === 0) ? (
            <EmptyState message={t("profile.noProjects")} />
          ) : (
            <div className="flex flex-col gap-2">
              {memberships.map((m) => (
                <Link key={m.project_id} to="/cm/$projectId" params={{ projectId: m.project_id }}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#0d0d0e] hover:bg-[#111113] transition-colors px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-white/85 truncate">{m.project_name}</p>
                    {m.project_code && <p className="font-mono text-[9px] text-white/25 truncate">{m.project_code}</p>}
                  </div>
                  <span className="text-[11px] text-white/50 shrink-0">{m.job_role ? jobRoleLabel(m.job_role, t) : m.role}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={handleSignOut}
          className="w-full text-center rounded-2xl bg-[#0d0d0e] hover:bg-red-500/10 text-red-400 text-[13px] font-bold px-4 py-3.5 transition-colors">
          {t("settings.signOut")}
        </button>
      </main>
    </div>
  );
}
