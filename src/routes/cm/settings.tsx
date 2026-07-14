import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang, type CMLang } from "@/lib/cm-i18n";
import { SegmentedField, ProjectPicker, FieldSelect, useSelectedProject } from "@/components/cm/shared";
import { ProjectSettingsView, CompaniesSection } from "@/components/cm/ProjectSettingsView";
import {
  useCMAccountSettings,
  upsertCMAccountSettings,
  uploadCMCompanyLogo,
  useCMGlobalAuditLog,
  useCMAllProjectMembers,
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

type SettingsTab = "app" | "project";

/** App Settings categories with no backing feature yet — shown as an honest
 *  placeholder (matching the same convention Project Settings already uses
 *  for "integrations") rather than fabricated controls. "auditLog" is not
 *  in this list — it has a real, working section below, since the data
 *  (cm_audit_log) already exists per-project and just needed aggregating. */
const APP_PLACEHOLDER_KEYS = [
  "organizations", "masterData", "modules", "documentStandards",
  "templates", "notifications", "integrations", "storage", "security", "subscription",
] as const;

/** Cross-project audit trail (App Settings → Audit Log). RLS already scopes
 *  cm_audit_log to rows this user can see, so this is a real aggregate view
 *  over existing per-project audit data, not a new logging system. */
function GlobalAuditLogSection({ userId, projects, onBack }: {
  userId: string; projects: { id: string; name: string }[]; onBack: () => void;
}) {
  const { t } = useCMLang();
  const { data: entries, isLoading } = useCMGlobalAuditLog(userId);
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const { data: members } = useCMAllProjectMembers(projectIds);
  const [projectFilter, setProjectFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const actorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members ?? []) if (m.display_name || m.email) map.set(m.user_id, m.display_name || m.email!);
    return map;
  }, [members]);

  const entityTypes = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.entity_type))).sort(), [entries]);
  const actions = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.action))).sort(), [entries]);

  const filtered = useMemo(() => {
    let list = entries ?? [];
    if (projectFilter) list = list.filter((e) => e.project_id === projectFilter);
    if (entityFilter) list = list.filter((e) => e.entity_type === entityFilter);
    if (actionFilter) list = list.filter((e) => e.action === actionFilter);
    if (fromDate) list = list.filter((e) => e.created_at.slice(0, 10) >= fromDate);
    if (toDate) list = list.filter((e) => e.created_at.slice(0, 10) <= toDate);
    return list;
  }, [entries, projectFilter, entityFilter, actionFilter, fromDate, toDate]);

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors self-start">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        <span className="text-[12px] font-mono uppercase tracking-widest">{t("settings.appTab")}</span>
      </button>

      <div className="rounded-2xl bg-[#0d0d0e] p-4 flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("appSettingsNav.auditLog")}</p>
        <div className="grid grid-cols-2 gap-2">
          <FieldSelect value={projectFilter} onChange={setProjectFilter}
            placeholder={t("auditLog.allProjects")}
            options={[{ value: "", label: t("auditLog.allProjects") }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
          <FieldSelect value={entityFilter} onChange={setEntityFilter}
            placeholder={t("auditLog.allModules")}
            options={[{ value: "", label: t("auditLog.allModules") }, ...entityTypes.map((e) => ({ value: e, label: e }))]} />
          <FieldSelect value={actionFilter} onChange={setActionFilter}
            placeholder={t("auditLog.allActions")}
            options={[{ value: "", label: t("auditLog.allActions") }, ...actions.map((a) => ({ value: a, label: a }))]} />
          <div />
          <input type="date" className="bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff5100]/60"
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff5100]/60"
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 flex items-center justify-center text-center px-4">
            <p className="text-white/40 text-sm">{t("auditLog.nothingYet")}</p>
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="rounded-xl bg-[#0d0d0e] px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-white/80 truncate">{projectNameById.get(e.project_id) ?? e.project_id}</span>
              <span className="font-mono text-[9px] text-white/30 shrink-0">{e.created_at.slice(0, 16).replace("T", " ")}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-white/50">
              <span className="font-mono uppercase tracking-widest" style={{ color: "#ff5100" }}>{e.action}</span>
              <span>·</span>
              <span>{e.entity_type}</span>
              <span>·</span>
              <span>{e.actor_id ? (actorNameById.get(e.actor_id) ?? t("comments.unknownUser")) : t("comments.unknownUser")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CMSettingsPage() {
  const { user, signOut } = useAuthCM();
  const { lang, setLang, t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: account } = useCMAccountSettings(user?.id);
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  const [companyName, setCompanyName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const syncedLangOnce = useRef(false);
  const [tab, setTab] = useState<SettingsTab>("app");
  const [showAuditLog, setShowAuditLog] = useState(false);
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const activeProject = projects.find((p) => p.id === projectId);

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
  const invalidateProjects = () => queryClient.invalidateQueries({ queryKey: ["cm_projects", user?.id] });

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

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/cm" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <div className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24 flex-1">
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

        <div className="mb-5">
          <SegmentedField
            options={[
              { value: "app", label: t("settings.appTab") },
              { value: "project", label: t("settings.projectTab") },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        {tab === "app" && showAuditLog && user && (
          <GlobalAuditLogSection userId={user.id} projects={projects} onBack={() => setShowAuditLog(false)} />
        )}

        {tab === "app" && !showAuditLog && (
          <>
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

            {user && (
              <div className="mb-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2 px-1">{t("appSettingsNav.companies")}</p>
                <CompaniesSection ownerId={user.id} canCreate canEdit />
              </div>
            )}

            <div className="rounded-2xl overflow-hidden mb-5">
              <Row>
                <Link to="/cm/directory" className="min-w-0">
                  <p className="text-[13px] text-white/85">{t("appSettingsNav.users")}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{t("appSettingsNav.usersHint")}</p>
                </Link>
                <span className="text-white/25 shrink-0">›</span>
              </Row>
              <Row>
                <Link to="/cm/role-permissions" className="min-w-0">
                  <p className="text-[13px] text-white/85">{t("appSettingsNav.roles")}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{t("appSettingsNav.rolesHint")}</p>
                </Link>
                <span className="text-white/25 shrink-0">›</span>
              </Row>
              <Row onClick={() => setShowAuditLog(true)}>
                <div className="min-w-0">
                  <p className="text-[13px] text-white/85">{t("appSettingsNav.auditLog")}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{t("appSettingsNav.auditLogHint")}</p>
                </div>
                <span className="text-white/25 shrink-0">›</span>
              </Row>
            </div>

            <div className="rounded-2xl overflow-hidden mb-5">
              {APP_PLACEHOLDER_KEYS.map((k) => (
                <Row key={k}>
                  <div className="min-w-0">
                    <p className="text-[13px] text-white/85">{t(`appSettingsNav.${k}`)}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{t("settingsNav.notBuiltYet")}</p>
                  </div>
                </Row>
              ))}
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
          </>
        )}

        {tab === "project" && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2 px-1">{t("settings.currentProject")}</p>
            <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
            {activeProject && (
              <ProjectSettingsView project={activeProject} ownerId={activeProject.owner_id} onProjectChanged={invalidateProjects} />
            )}
          </>
        )}

        <button
          onClick={() => handleSignOut()}
          className="w-full mt-2 px-5 py-3.5 rounded-2xl text-[13px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
        >
          {t("settings.signOut")}
        </button>
      </div>
    </div>
  );
}
