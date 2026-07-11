import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { supabaseCM } from "@/lib/supabase-cm";
import {
  useCMProjects,
  createCMProject,
  type CMProject,
  type ProjectStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/")({
  head: () => ({
    meta: [
      { title: "Construction Management App — The Gentry Lab" },
      { name: "description", content: "Daily site diaries, punch lists, and photo logs for construction projects — by The Gentry Lab." },
    ],
  }),
  component: CMIndexPage,
});

const STATUS_COLOR: Record<ProjectStatus, string> = {
  Planning: "#94a3b8",
  Active: "#ff5100",
  "On Hold": "#fbbf24",
  Completed: "#34d399",
};

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

function AvatarButton() {
  const { user } = useAuthCM();
  return (
    <Link to="/cm/settings" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-white/5 hover:bg-white/10 transition-colors">
      {user?.user_metadata?.avatar_url ? (
        <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[13px] font-bold text-white/70">{(user?.user_metadata?.full_name ?? user?.email ?? "U")[0]?.toUpperCase()}</span>
      )}
    </Link>
  );
}

function NewProjectSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (p: CMProject) => void }) {
  const { user } = useAuthCM();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const project = await createCMProject(user.id, {
        name: name.trim(),
        client: client.trim() || null,
        location: location.trim() || null,
        status,
        start_date: startDate || null,
        target_end_date: targetEndDate || null,
        description: description.trim() || null,
      });
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-[#0d0d0e] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h2 className="font-extrabold text-base tracking-tight text-white">New Project</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Project name ★</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Warehouse Phase 2" required autoFocus disabled={saving} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Client</span>
              <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Location</span>
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site address" disabled={saving} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Status</span>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} disabled={saving}>
                {(["Planning", "Active", "On Hold", "Completed"] as ProjectStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Start</span>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Finish</span>
              <input type="date" className={inputCls} value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} disabled={saving} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Description</span>
            <textarea className={`${inputCls} resize-y min-h-[72px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, notes..." disabled={saving} />
          </label>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#ff5100" }}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: CMProject }) {
  const sc = STATUS_COLOR[project.status];
  return (
    <Link to="/cm/$projectId" params={{ projectId: project.id }}
      className="block rounded-2xl bg-[#0d0d0e] active:scale-[0.98] hover:bg-[#111113] transition-all p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-extrabold text-[15px] tracking-tight text-white leading-tight">
          {project.name}
        </h3>
        <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${sc}15` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{project.status}</span>
        </span>
      </div>
      {project.client && <p className="text-[12px] text-white/45 mb-1">Client: <span className="text-white/70">{project.client}</span></p>}
      {project.location && (
        <p className="text-[12px] text-white/45 flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {project.location}
        </p>
      )}
      {(project.start_date || project.target_end_date) && (
        <p className="font-mono text-[10px] text-white/25 mt-3 uppercase tracking-widest">
          {project.start_date ?? "—"} → {project.target_end_date ?? "—"}
        </p>
      )}
    </Link>
  );
}

export function CMIndexPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects, isLoading, error } = useCMProjects(user?.id);
  const [showNew, setShowNew] = useState(false);

  if (!supabaseCM) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <p className="text-white/40 text-sm text-center">Construction Management App requires its Supabase project to be configured.</p>
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
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">Construction Management</h1>
          <p className="text-white/45 text-sm mb-8">Daily site diaries, punch lists, and photo logs for your construction projects.</p>
          <button onClick={() => signInWithGoogle()}
            className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
            style={{ backgroundColor: "#ff5100" }}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md mx-auto w-full px-4 pt-8 pb-28">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Projects</h1>
            <p className="text-[12px] text-white/35 mt-1">Site diaries, punch lists, photos.</p>
          </div>
          <AvatarButton />
        </div>

        {isLoading && <p className="text-white/30 text-sm">Loading projects…</p>}
        {error && <p className="text-red-400 text-sm">Failed to load projects: {(error as Error).message}</p>}

        {!isLoading && !error && (projects?.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 flex flex-col items-center justify-center text-center px-4">
            <p className="text-white/40 text-sm mb-4">No projects yet.</p>
            <button onClick={() => setShowNew(true)}
              className="px-5 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest"
              style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100" }}>
              Create your first project
            </button>
          </div>
        )}

        {!isLoading && (projects?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-3">
            {projects!.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </main>

      <button
        onClick={() => setShowNew(true)}
        aria-label="New project"
        className="fixed bottom-7 right-6 w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_8px_24px_rgba(255,81,0,0.4)] active:scale-95 transition-transform"
        style={{ backgroundColor: "#ff5100" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>

      {showNew && (
        <NewProjectSheet
          onClose={() => setShowNew(false)}
          onCreated={(p) => {
            setShowNew(false);
            queryClient.invalidateQueries({ queryKey: ["cm_projects"] });
            navigate({ to: "/cm/$projectId", params: { projectId: p.id } });
          }}
        />
      )}
    </div>
  );
}
