import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { ProjectSettingsView } from "@/components/cm/ProjectSettingsView";
import { useCMProject, type ProjectStatus } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/$projectId")({
  component: CMProjectPage,
});

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  Planning: "#94a3b8", Active: "#ff5100", "On Hold": "#fbbf24", Completed: "#34d399",
};

function CMProjectPage() {
  const { projectId } = Route.useParams();
  const { user, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = useCMProject(projectId);

  const invalidateProject = () => queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  if (projectLoading) {
    return <div className="min-h-screen bg-[#0a0a0b]" />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center gap-3 font-sans">
        <p className="text-white/40 text-sm">{t("projects.notFound")}</p>
        <Link to="/cm/projects" className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#ff5100" }}>← {t("projects.title")}</Link>
      </div>
    );
  }

  const sc = PROJECT_STATUS_COLOR[project.status];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md mx-auto w-full px-4 pt-6 pb-16">
        <div className="rounded-2xl bg-[#0d0d0e] p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex items-center gap-3">
              {project.client_logo_url && <img src={project.client_logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-white/5 shrink-0" />}
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold tracking-tight text-white truncate">{project.name}</h1>
                {project.client && <p className="text-[12px] text-white/40 truncate">{project.client}</p>}
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: `${sc}15` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{t(`status.${project.status}`)}</span>
            </span>
          </div>
          {(project.start_date || project.target_end_date) && (
            <p className="font-mono text-[10px] text-white/25 uppercase tracking-widest mb-1">
              {project.start_date ?? "—"} → {project.target_end_date ?? "—"}
            </p>
          )}
          {project.location && <p className="text-[12px] text-white/45">{project.location}</p>}
        </div>

        <ProjectSettingsView project={project} ownerId={user.id} onBack={() => navigate({ to: "/cm/projects" })} onProjectChanged={invalidateProject} />
      </main>
    </div>
  );
}
