import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { useCMNotifications, type CMPhotoModule } from "@/lib/cm-data";
import { Sheet, ProjectPicker, useSelectedProject, setLastProject, MODULE_COLOR, MODULE_ICON } from "@/components/cm/shared";

const HOME_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11.5L12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
  </svg>
);
const PROJECTS_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 21V4" /><path d="M6 6h11l-3.2 3.2" /><path d="M13.8 9.2V13" /><path d="M3 21h18" /><path d="M9.5 21v-6.5h4V21" />
  </svg>
);
const BELL_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const PROFILE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
  </svg>
);

function NavLink({ to, icon, label, active, badge }: { to: string; icon: React.ReactNode; label: string; active: boolean; badge?: number }) {
  return (
    <Link to={to} className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 min-w-0">
      <span className="relative" style={{ color: active ? "#ff5100" : "rgba(255,255,255,0.4)" }}>
        {icon}
        {!!badge && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#ff5100] text-[8px] leading-[14px] font-bold text-black text-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[9px] font-mono uppercase tracking-wide truncate" style={{ color: active ? "#ff5100" : "rgba(255,255,255,0.4)" }}>{label}</span>
    </Link>
  );
}

const QUICK_CREATE_ITEMS: { module: CMPhotoModule; to: string }[] = [
  { module: "siteDiary", to: "/cm/site-diary" },
  { module: "punchList", to: "/cm/punch-list" },
  { module: "inspection", to: "/cm/inspection" },
  { module: "safety", to: "/cm/safety" },
  { module: "submittal", to: "/cm/submittal" },
];

/** Lets the user jump straight to a module with the right project already
 *  selected — the actual record-creation form still lives on each module's
 *  own page (its "+" FAB), since building a second, auto-opening creation
 *  path per module here would duplicate that UI rather than simplify it. */
function QuickCreateSheet({ onClose, userId }: { onClose: () => void; userId: string | undefined }) {
  const { t } = useCMLang();
  const navigate = useNavigate();
  const { projects, projectId, setProjectId } = useSelectedProject(userId);

  const go = (to: string) => {
    if (projectId) setLastProject(projectId);
    onClose();
    navigate({ to });
  };

  return (
    <Sheet title={t("quickCreate.title")} onClose={onClose}>
      <div className="px-6 pb-6">
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
        <div className="flex flex-col gap-2">
          {QUICK_CREATE_ITEMS.map((item) => (
            <button key={item.module} type="button" onClick={() => go(item.to)}
              className="flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-4 py-3 text-left w-full">
              <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: MODULE_COLOR[item.module], backgroundColor: `${MODULE_COLOR[item.module]}22` }}>
                {MODULE_ICON[item.module]}
              </span>
              <span className="text-[13px] text-white/85 flex-1">{t(`quickCreate.${item.module}`)}</span>
              <span className="text-white/25 shrink-0">›</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** Excluded from pre-auth flows (Google OAuth callback, invite-accept intake)
 *  where there's no signed-in project context yet to navigate around. */
const HIDDEN_PREFIXES = ["/cm/auth", "/cm/join"];

const STATIC_TOP_LEVEL_SLUGS = new Set([
  "site-diary", "punch-list", "inspection", "safety", "submittal", "dashboard", "schedule",
  "boq", "manpower", "equipment", "photos", "reports", "directory", "notifications", "settings",
  "search", "role-permissions", "profile", "projects",
]);

export function BottomNav() {
  const { user } = useAuthCM();
  const { t } = useCMLang();
  const location = useLocation();
  const { data: notifications } = useCMNotifications(user?.id);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const [showCreate, setShowCreate] = useState(false);

  if (!user || HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;

  const path = location.pathname;
  const isHome = path === "/cm" || path === "/cm/";
  // Every top-level module/utility page is a known static slug; anything else
  // in that position is a /cm/$projectId (Project Insight) detail page.
  const topSegment = path.replace(/^\/cm\/?/, "").split("/")[0];
  const isProjectDetail = !!topSegment && !STATIC_TOP_LEVEL_SLUGS.has(topSegment);
  const isProjects = path.startsWith("/cm/projects") || isProjectDetail;

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0b]/95 backdrop-blur-sm border-t border-white/8" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full flex items-stretch justify-around px-1">
          <NavLink to="/cm" icon={HOME_ICON} label={t("nav.home")} active={isHome} />
          <NavLink to="/cm/projects" icon={PROJECTS_ICON} label={t("nav.projects")} active={isProjects && !isHome} />
          <button type="button" onClick={() => setShowCreate(true)} className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 min-w-0" aria-label={t("nav.create")}>
            <span className="w-10 h-10 -mt-5 rounded-full flex items-center justify-center text-black shadow-[0_6px_18px_rgba(255,81,0,0.45)]" style={{ backgroundColor: "#ff5100" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wide text-white/40 truncate">{t("nav.create")}</span>
          </button>
          <NavLink to="/cm/notifications" icon={BELL_ICON} label={t("nav.notifications")} active={path.startsWith("/cm/notifications")} badge={unread} />
          <NavLink to="/cm/profile" icon={PROFILE_ICON} label={t("nav.profile")} active={path.startsWith("/cm/profile")} />
        </div>
      </nav>
      {showCreate && <QuickCreateSheet onClose={() => setShowCreate(false)} userId={user.id} />}
    </>
  );
}
