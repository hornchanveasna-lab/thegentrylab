import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PMHeader } from "@/components/pm/PMHeader";
import {
  usePMProject,
  usePMDailyLogs,
  usePMTasks,
  createPMDailyLog,
  deletePMDailyLog,
  createPMTask,
  updatePMTask,
  deletePMTask,
  updatePMProject,
  uploadPMPhoto,
  type PMDailyLog,
  type PMTask,
  type TaskStatus,
  type TaskPriority,
  type ProjectStatus,
} from "@/lib/pm";

export const Route = createFileRoute("/pm/$projectId")({
  component: PMProjectPage,
});

const STATUS_COLOR: Record<ProjectStatus, string> = {
  Planning: "#94a3b8",
  Active: "#ff5100",
  "On Hold": "#fbbf24",
  Completed: "#34d399",
};
const TASK_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  "To Do": "#94a3b8",
  "In Progress": "#ff5100",
  Blocked: "#f43f5e",
  Done: "#34d399",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  Low: "#94a3b8",
  Medium: "#fbbf24",
  High: "#f43f5e",
};
const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rain", "Storm", "Fog", "Other"];

const inputCls = "w-full bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#0d0d0e] border border-white/10 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#0d0d0e]">
          <h2 className="font-extrabold text-sm uppercase tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════ New Daily Log dialog ═══════════════ */
function NewLogDialog({ projectId, ownerId, onClose, onCreated }: {
  projectId: string; ownerId: string; onClose: () => void; onCreated: () => void;
}) {
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState("Sunny");
  const [temperature, setTemperature] = useState("");
  const [workforce, setWorkforce] = useState("");
  const [progress, setProgress] = useState("");
  const [activities, setActivities] = useState("");
  const [materials, setMaterials] = useState("");
  const [equipment, setEquipment] = useState("");
  const [issues, setIssues] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadPMPhoto(ownerId, projectId, f)));
      setPhotos((p) => [...p, ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createPMDailyLog(ownerId, projectId, {
        log_date: logDate,
        weather,
        temperature_c: temperature ? Number(temperature) : null,
        workforce_count: workforce ? Number(workforce) : null,
        progress_pct: progress ? Number(progress) : null,
        activities: activities.trim() || null,
        materials_used: materials.trim() || null,
        equipment_used: equipment.trim() || null,
        issues: issues.trim() || null,
        notes: notes.trim() || null,
        photos,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Diary Entry" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input type="date" className={inputCls} value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Weather</span>
            <select className={inputCls} value={weather} onChange={(e) => setWeather(e.target.value)}>
              {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Temp (°C)</span>
            <input type="number" className={inputCls} value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Workforce on site</span>
            <input type="number" min={0} className={inputCls} value={workforce} onChange={(e) => setWorkforce(e.target.value)} placeholder="Number of workers" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Overall progress %</span>
            <input type="number" min={0} max={100} className={inputCls} value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="0–100" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Activities performed</span>
          <textarea className={`${inputCls} resize-y min-h-[64px]`} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="What was done today..." />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Materials used</span>
            <textarea className={`${inputCls} resize-y min-h-[56px]`} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Equipment used</span>
            <textarea className={`${inputCls} resize-y min-h-[56px]`} value={equipment} onChange={(e) => setEquipment(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Issues / delays</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="Safety incidents, delays, blockers..." />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Notes</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Photos</span>
          <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)}
            className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:border file:border-white/15 file:bg-transparent file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
          {uploading && <span className="font-mono text-[10px] text-white/30">Uploading…</span>}
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {photos.map((url, i) => (
                <div key={url} className="relative w-16 h-16">
                  <img src={url} alt="" className="w-16 h-16 object-cover border border-white/10" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}
        </label>

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 text-white/50 hover:text-white text-[11px] font-mono uppercase tracking-widest transition-all">Cancel</button>
          <button type="submit" disabled={saving || uploading}
            className="px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#ff5100" }}>
            {saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════ New Task dialog ═══════════════ */
function NewTaskDialog({ projectId, ownerId, onClose, onCreated }: {
  projectId: string; ownerId: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createPMTask(ownerId, projectId, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee: assignee.trim() || null,
        due_date: dueDate || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Title ★</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Description</span>
          <textarea className={`${inputCls} resize-y min-h-[64px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Priority</span>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {(["Low", "Medium", "High"] as TaskPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Assignee</span>
            <input className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Name" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Due date</span>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 text-white/50 hover:text-white text-[11px] font-mono uppercase tracking-widest transition-all">Cancel</button>
          <button type="submit" disabled={saving || !title.trim()}
            className="px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#ff5100" }}>
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════ Diary entry card ═══════════════ */
function LogCard({ log, onDeleted, onOpenPhoto }: { log: PMDailyLog; onDeleted: () => void; onOpenPhoto: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this diary entry? This cannot be undone.")) return;
    setDeleting(true);
    try { await deletePMDailyLog(log.id); onDeleted(); } finally { setDeleting(false); }
  };

  return (
    <div className="border border-white/8 bg-[#0d0d0e]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{log.log_date}</span>
          {log.weather && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{log.weather}{log.temperature_c != null ? ` · ${log.temperature_c}°C` : ""}</span>}
          {log.workforce_count != null && <span className="font-mono text-[10px] text-white/35 shrink-0">{log.workforce_count} workers</span>}
          {log.activities && <span className="text-[12px] text-white/45 truncate">{log.activities}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {log.progress_pct != null && (
            <span className="font-mono text-[11px] font-bold" style={{ color: "#ff5100" }}>{log.progress_pct}%</span>
          )}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="transition-transform text-white/25" style={{ transform: open ? "rotate(180deg)" : "none" }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-white/6 pt-4">
          {log.activities && <Field label="Activities" value={log.activities} />}
          {log.materials_used && <Field label="Materials used" value={log.materials_used} />}
          {log.equipment_used && <Field label="Equipment used" value={log.equipment_used} />}
          {log.issues && <Field label="Issues / delays" value={log.issues} accent="#f43f5e" />}
          {log.notes && <Field label="Notes" value={log.notes} />}
          {log.photos?.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Photos</p>
              <div className="flex flex-wrap gap-2">
                {log.photos.map((url) => (
                  <button key={url} type="button" onClick={() => onOpenPhoto(url)}>
                    <img src={url} alt="" className="w-20 h-20 object-cover border border-white/10 hover:border-white/30 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="self-start mt-1 font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
            {deleting ? "Deleting…" : "Delete entry"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: accent ?? "rgba(255,255,255,0.25)" }}>{label}</p>
      <p className="text-[12px] text-white/65 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

/* ═══════════════ Task card ═══════════════ */
function TaskCard({ task, onChanged }: { task: PMTask; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const handleStatus = async (status: TaskStatus) => {
    setBusy(true);
    try { await updatePMTask(task.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    try { await deletePMTask(task.id); onChanged(); } finally { setBusy(false); }
  };
  return (
    <div className="border border-white/8 bg-[#0a0a0b] p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium text-white/85 leading-snug">{task.title}</p>
        <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-widest px-1.5 py-0.5 border"
          style={{ borderColor: `${PRIORITY_COLOR[task.priority]}40`, color: PRIORITY_COLOR[task.priority] }}>
          {task.priority}
        </span>
      </div>
      {task.description && <p className="text-[11px] text-white/35 leading-relaxed">{task.description}</p>}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="font-mono text-[10px] text-white/30 truncate">
          {task.assignee ?? "Unassigned"}{task.due_date ? ` · Due ${task.due_date}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <select value={task.status} disabled={busy} onChange={(e) => handleStatus(e.target.value as TaskStatus)}
          className="flex-1 bg-[#0d0d0e] border border-white/10 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-white/60 focus:outline-none">
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={handleDelete} disabled={busy} className="text-white/25 hover:text-red-400 text-[13px] px-1 transition-colors">×</button>
      </div>
    </div>
  );
}

/* ═══════════════ Main page ═══════════════ */
function PMProjectPage() {
  const { projectId } = Route.useParams();
  const { user, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = usePMProject(projectId);
  const { data: logs, isLoading: logsLoading } = usePMDailyLogs(projectId);
  const { data: tasks, isLoading: tasksLoading } = usePMTasks(projectId);

  const [tab, setTab] = useState<"overview" | "diary" | "tasks" | "photos">("overview");
  const [showNewLog, setShowNewLog] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const invalidateLogs = () => { queryClient.invalidateQueries({ queryKey: ["pm_daily_logs", projectId] }); setShowNewLog(false); };
  const invalidateTasks = () => { queryClient.invalidateQueries({ queryKey: ["pm_tasks", projectId] }); setShowNewTask(false); };

  const latestProgress = logs?.find((l) => l.progress_pct != null)?.progress_pct ?? null;
  const allPhotos = useMemo(() => (logs ?? []).flatMap((l) => l.photos.map((url) => ({ url, date: l.log_date }))), [logs]);
  const taskCounts = useMemo(() => {
    const c: Record<TaskStatus, number> = { "To Do": 0, "In Progress": 0, Blocked: 0, Done: 0 };
    (tasks ?? []).forEach((t) => { c[t.status]++; });
    return c;
  }, [tasks]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <PMHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <button onClick={() => signInWithGoogle()}
            className="px-6 py-2.5 text-[11px] font-mono uppercase tracking-widest text-black font-bold"
            style={{ backgroundColor: "#ff5100" }}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <PMHeader />
        <div className="flex-1 flex items-center justify-center"><p className="text-white/30 text-sm">Loading project…</p></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <PMHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-white/40 text-sm">Project not found.</p>
          <Link to="/pm" className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#ff5100" }}>← Back to projects</Link>
        </div>
      </div>
    );
  }

  const sc = STATUS_COLOR[project.status];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <PMHeader crumb={project.name} />

      {/* ── Project header ── */}
      <div className="border-b border-white/8">
        <div className="max-w-[1400px] mx-auto px-5 py-6">
          <Link to="/pm" className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors mb-3 inline-block">← All projects</Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white mb-1.5">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/40">
                {project.client && <span>Client: <span className="text-white/65">{project.client}</span></span>}
                {project.location && <span>{project.location}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {latestProgress != null && (
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold leading-none" style={{ color: "#ff5100" }}>{latestProgress}%</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mt-1">Complete</p>
                </div>
              )}
              <select
                value={project.status}
                onChange={async (e) => { await updatePMProject(project.id, { status: e.target.value as ProjectStatus }); queryClient.invalidateQueries({ queryKey: ["pm_project", projectId] }); queryClient.invalidateQueries({ queryKey: ["pm_projects"] }); }}
                className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest border bg-transparent"
                style={{ borderColor: `${sc}50`, color: sc }}
              >
                {(["Planning", "Active", "On Hold", "Completed"] as ProjectStatus[]).map((s) => <option key={s} value={s} className="bg-[#0d0d0e] text-white">{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-white/8 sticky top-[57px] z-40 bg-[#0a0a0b]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-5 flex gap-1">
          {([
            { id: "overview", label: "Overview" },
            { id: "diary", label: `Daily Diary${logs?.length ? ` (${logs.length})` : ""}` },
            { id: "tasks", label: `Tasks${tasks?.length ? ` (${tasks.length})` : ""}` },
            { id: "photos", label: `Photos${allPhotos.length ? ` (${allPhotos.length})` : ""}` },
          ] as const).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-3 text-[11px] font-mono uppercase tracking-widest transition-colors border-b-2"
              style={{ borderColor: tab === t.id ? "#ff5100" : "transparent", color: tab === t.id ? "#ffffff" : "rgba(255,255,255,0.35)" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-5 py-8">

        {tab === "overview" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Diary entries", value: logs?.length ?? 0 },
                { label: "Open tasks", value: (taskCounts["To Do"] + taskCounts["In Progress"] + taskCounts.Blocked) },
                { label: "Tasks done", value: taskCounts.Done },
                { label: "Photos logged", value: allPhotos.length },
              ].map((s) => (
                <div key={s.label} className="border border-white/8 bg-[#0d0d0e] px-4 py-4">
                  <p className="text-2xl font-extrabold tracking-tighter text-white">{s.value}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/28 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {project.description && (
              <div className="border border-white/8 bg-[#0d0d0e] px-5 py-4">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-2">Description</p>
                <p className="text-[13px] text-white/65 leading-relaxed whitespace-pre-wrap">{project.description}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Recent diary entries</p>
                <button onClick={() => setTab("diary")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>View all →</button>
              </div>
              {logsLoading && <p className="text-white/30 text-sm">Loading…</p>}
              {!logsLoading && (logs?.length ?? 0) === 0 && <p className="text-white/30 text-sm">No diary entries yet.</p>}
              <div className="flex flex-col gap-2">
                {(logs ?? []).slice(0, 3).map((log) => (
                  <LogCard key={log.id} log={log} onDeleted={invalidateLogs} onOpenPhoto={setLightbox} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "diary" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button onClick={() => setShowNewLog(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all"
                style={{ backgroundColor: "#ff5100" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                New entry
              </button>
            </div>
            {logsLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!logsLoading && (logs?.length ?? 0) === 0 && (
              <div className="border border-dashed border-white/10 py-16 flex items-center justify-center">
                <p className="text-white/40 text-sm">No diary entries yet. Log your first day on site.</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {(logs ?? []).map((log) => (
                <LogCard key={log.id} log={log} onDeleted={invalidateLogs} onOpenPhoto={setLightbox} />
              ))}
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button onClick={() => setShowNewTask(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all"
                style={{ backgroundColor: "#ff5100" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                New task
              </button>
            </div>
            {tasksLoading && <p className="text-white/30 text-sm">Loading…</p>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {TASK_STATUSES.map((status) => (
                <div key={status} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[status] }} />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">{status} ({taskCounts[status]})</p>
                  </div>
                  <div className="flex flex-col gap-2 min-h-[40px]">
                    {(tasks ?? []).filter((t) => t.status === status).map((t) => (
                      <TaskCard key={t.id} task={t} onChanged={invalidateTasks} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "photos" && (
          <div>
            {allPhotos.length === 0 && <p className="text-white/30 text-sm">No photos logged yet — add some from a diary entry.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {allPhotos.map((p, i) => (
                <button key={`${p.url}-${i}`} onClick={() => setLightbox(p.url)} className="relative aspect-square group">
                  <img src={p.url} alt="" className="w-full h-full object-cover border border-white/10 group-hover:border-white/30 transition-colors" />
                  <span className="absolute bottom-1 left-1 font-mono text-[8px] px-1 py-0.5 bg-black/70 text-white/60">{p.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {showNewLog && <NewLogDialog projectId={projectId} ownerId={user.id} onClose={() => setShowNewLog(false)} onCreated={invalidateLogs} />}
      {showNewTask && <NewTaskDialog projectId={projectId} ownerId={user.id} onClose={() => setShowNewTask(false)} onCreated={invalidateTasks} />}

      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute top-5 right-5 text-white/60 hover:text-white text-2xl">×</button>
        </div>
      )}
    </div>
  );
}
