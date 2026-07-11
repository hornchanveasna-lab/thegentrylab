import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { supabaseCM } from "@/lib/supabase-cm";
import { CMHeader } from "@/components/cm/CMHeader";
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
      { name: "description", content: "Daily site diaries, task tracking, and photo logs for construction projects — by The Gentry Lab." },
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

const inputCls = "w-full bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (p: CMProject) => void }) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0d0d0e] border border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="font-extrabold text-sm uppercase tracking-tight text-white">New Project</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Project name ★</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Warehouse Phase 2" required autoFocus disabled={saving} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Client</span>
              <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Location</span>
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site address" disabled={saving} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Status</span>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} disabled={saving}>
                {(["Planning", "Active", "On Hold", "Completed"] as ProjectStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Start date</span>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Target finish</span>
              <input type="date" className={inputCls} value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} disabled={saving} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Description</span>
            <textarea className={`${inputCls} resize-y min-h-[72px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, notes..." disabled={saving} />
          </label>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 text-white/50 hover:text-white text-[11px] font-mono uppercase tracking-widest transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {saving ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: CMProject }) {
  const sc = STATUS_COLOR[project.status];
  return (
    <Link to="/cm/$projectId" params={{ projectId: project.id }}
      className="block border border-white/8 bg-[#0d0d0e] hover:border-white/20 transition-all p-5 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-extrabold text-[15px] uppercase tracking-tight text-white leading-tight group-hover:text-[#ff5100] transition-colors">
          {project.name}
        </h3>
        <span className="shrink-0 flex items-center gap-1.5 px-2 py-1 border" style={{ borderColor: `${sc}40`, backgroundColor: `${sc}12` }}>
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
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <CMHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-white/40 text-sm">Construction Management App requires its Supabase project to be configured (VITE_CM_SUPABASE_URL / VITE_CM_SUPABASE_ANON_KEY).</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <CMHeader />
        <div className="flex-1 flex items-center justify-center"><p className="text-white/30 text-sm">Loading…</p></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <CMHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <h1 className="text-2xl font-extrabold uppercase tracking-tight mb-3">Construction Management App</h1>
            <p className="text-white/45 text-sm mb-6">Daily site diaries, task tracking, and photo logs for your construction projects. Sign in to get started.</p>
            <button onClick={() => signInWithGoogle()}
              className="px-6 py-2.5 text-[11px] font-mono uppercase tracking-widest text-black font-bold"
              style={{ backgroundColor: "#ff5100" }}>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <CMHeader />
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-white">Projects</h1>
            <p className="text-[12px] text-white/35 mt-1">Your construction site diaries, tasks, and photo logs.</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all"
            style={{ backgroundColor: "#ff5100" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            New project
          </button>
        </div>

        {isLoading && <p className="text-white/30 text-sm">Loading projects…</p>}
        {error && <p className="text-red-400 text-sm">Failed to load projects: {(error as Error).message}</p>}

        {!isLoading && !error && (projects?.length ?? 0) === 0 && (
          <div className="border border-dashed border-white/10 py-16 flex flex-col items-center justify-center text-center">
            <p className="text-white/40 text-sm mb-4">No projects yet.</p>
            <button onClick={() => setShowNew(true)}
              className="px-5 py-2 text-[11px] font-mono uppercase tracking-widest border transition-all"
              style={{ borderColor: "rgba(255,81,0,0.4)", color: "#ff5100" }}>
              Create your first project
            </button>
          </div>
        )}

        {!isLoading && (projects?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects!.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </main>

      {showNew && (
        <NewProjectDialog
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
