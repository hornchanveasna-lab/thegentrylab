import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";
import { SegmentedField } from "@/components/cm/shared";
import {
  useCMAccountSettings,
  upsertCMAccountSettings,
  uploadCMCompanyLogo,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/settings")({
  component: CMSettingsPage,
});

function getStoredTheme(): "dark" | "light" {
  try { return (localStorage.getItem("tgl_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("tgl_theme", t); } catch { /* */ }
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[#0d0d0e] first:rounded-t-2xl last:rounded-b-2xl border-b border-white/6 last:border-b-0 text-left"
    >
      {children}
    </Comp>
  );
}

const LANG_OPTIONS: CMLang[] = ["en", "km", "zh"];

function CMSettingsPage() {
  const { user, signOut } = useAuthCM();
  const { lang, setLang, t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: account } = useCMAccountSettings(user?.id);
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  const [companyName, setCompanyName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const syncedLangOnce = useRef(false);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    if (account?.company_name != null) setCompanyName(account.company_name);
  }, [account?.company_name]);

  // Pull the server-saved language once per load so it follows the user across devices.
  useEffect(() => {
    if (!syncedLangOnce.current && account?.language && account.language !== lang) {
      syncedLangOnce.current = true;
      setLang(account.language);
    }
  }, [account?.language, lang, setLang]);

  const invalidateAccount = () => queryClient.invalidateQueries({ queryKey: ["cm_account_settings", user?.id] });

  const handleSaveName = async () => {
    if (!user) return;
    setSavingName(true);
    try {
      await upsertCMAccountSettings(user.id, { company_name: companyName.trim() || null });
      invalidateAccount();
    } finally {
      setSavingName(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!user) return;
    setUploadingLogo(true);
    try {
      const url = await uploadCMCompanyLogo(user.id, file);
      await upsertCMAccountSettings(user.id, { company_logo_url: url });
      invalidateAccount();
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLangChange = async (l: CMLang) => {
    setLang(l);
    if (user) await upsertCMAccountSettings(user.id, { language: l }).then(invalidateAccount);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <div className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-10 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/cm" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </Link>
          <h1 className="text-xl font-extrabold uppercase tracking-tight">{t("settings.title")}</h1>
        </div>

        {user && (
          <div className="flex items-center gap-3 px-4 py-4 mb-5 rounded-2xl bg-[#0d0d0e]">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <span className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center text-sm font-bold text-black">
                {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-bold truncate">{user.user_metadata?.full_name ?? t("settings.signedIn")}</p>
              <p className="text-[11px] text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-[#0d0d0e] p-4 mb-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-3">{t("settings.companyBranding")}</p>
          <div className="flex items-center gap-4 mb-4">
            {account?.company_logo_url ? (
              <img src={account.company_logo_url} alt="" className="h-16 max-w-[180px] w-auto object-contain shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl border border-dashed border-white/10 flex items-center justify-center shrink-0">
                <span className="text-white/20 text-[9px] font-mono uppercase">{t("projectSettings.none")}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-white/50">{t("settings.companyLogo")}</span>
              <input type="file" accept="image/*" disabled={uploadingLogo}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); }}
                className="text-[11px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
            </div>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-4">{t("settings.companyLogoHint")}</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("settings.companyNamePlaceholder")}
              disabled={savingName}
            />
            <button onClick={handleSaveName} disabled={savingName}
              className="px-4 py-2 rounded-xl text-[11px] font-mono uppercase tracking-widest text-black font-bold disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {savingName ? "…" : t("common.save")}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#0d0d0e] p-4 mb-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-3">{t("settings.language")}</p>
          <SegmentedField
            options={LANG_OPTIONS.map((l) => ({ value: l, label: t(`settings.lang.${l}`) }))}
            value={lang}
            onChange={handleLangChange}
          />
        </div>

        <div className="rounded-2xl overflow-hidden mb-5">
          <Row>
            <Link to="/cm/role-permissions" className="text-[13px] text-white/85">
              {t("rolePermissions.title")}
            </Link>
            <span className="text-white/25">›</span>
          </Row>
        </div>

        <div className="rounded-2xl overflow-hidden mb-5">
          <Row onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="text-[13px] text-white/85">{t("settings.appearance")}</span>
            <span className="text-[12px] text-white/40 font-mono uppercase tracking-widest">{theme === "dark" ? t("settings.dark") : t("settings.light")}</span>
          </Row>
        </div>

        <div className="rounded-2xl overflow-hidden mb-5">
          <Row>
            <a href="https://thegentrylab.com" className="text-[13px] text-white/85">
              {t("settings.gentryLabHome")}
            </a>
            <span className="text-white/25">↗</span>
          </Row>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full px-5 py-3.5 rounded-2xl text-[13px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
        >
          {t("settings.signOut")}
        </button>
      </div>
    </div>
  );
}
