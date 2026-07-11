import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { AppTile } from "@/components/cm/AppTile";
import { ProjectSettingsView } from "@/components/cm/ProjectSettingsView";
import {
  useCMProject,
  useCMDailyLogs,
  useCMTasks,
  useCMInspections,
  useCMSafetyRecords,
  useCMSubmittals,
  createCMDailyLog,
  updateCMDailyLog,
  deleteCMDailyLog,
  createCMTask,
  updateCMTask,
  deleteCMTask,
  createCMInspection,
  updateCMInspection,
  deleteCMInspection,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  deleteCMSafetyRecord,
  createCMSubmittal,
  updateCMSubmittal,
  deleteCMSubmittal,
  uploadCMPhoto,
  type CMDailyLog,
  type CMTask,
  type CMInspection,
  type CMSafetyRecord,
  type CMSubmittal,
  type ProjectStatus,
  type TaskStatus,
  type TaskPriority,
  type InspectionStatus,
  type SafetyRecordType,
  type SafetySeverity,
  type SubmittalStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/$projectId")({
  component: CMProjectPage,
});

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  Planning: "#94a3b8", Active: "#ff5100", "On Hold": "#fbbf24", Completed: "#34d399",
};
const PUNCH_STATUS_COLOR: Record<TaskStatus, string> = {
  "To Do": "#94a3b8", "In Progress": "#ff5100", Blocked: "#f43f5e", Done: "#34d399",
};
const PUNCH_PRIORITY_COLOR: Record<TaskPriority, string> = {
  Low: "#94a3b8", Medium: "#fbbf24", High: "#f43f5e",
};
const INSPECTION_STATUS_COLOR: Record<InspectionStatus, string> = {
  Scheduled: "#94a3b8", Passed: "#34d399", Failed: "#f43f5e", "Not Applicable": "#fbbf24",
};
const SAFETY_SEVERITY_COLOR: Record<SafetySeverity, string> = {
  Low: "#94a3b8", Medium: "#fbbf24", High: "#f97316", Critical: "#f43f5e",
};
const SUBMITTAL_STATUS_COLOR: Record<SubmittalStatus, string> = {
  Draft: "#94a3b8", Submitted: "#fbbf24", "Under Review": "#38bdf8", Approved: "#34d399",
  "Approved as Noted": "#34d399", "Revise & Resubmit": "#f97316", Rejected: "#f43f5e",
};
const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain", "Storm"];
const PUNCH_STATUS_OPTIONS: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];
const PUNCH_PRIORITY_OPTIONS: TaskPriority[] = ["Low", "Medium", "High"];
const INSPECTION_STATUS_OPTIONS: InspectionStatus[] = ["Scheduled", "Passed", "Failed", "Not Applicable"];
const SAFETY_TYPE_OPTIONS: SafetyRecordType[] = ["Incident", "Toolbox Talk", "Hazard Observation"];
const SAFETY_SEVERITY_OPTIONS: SafetySeverity[] = ["Low", "Medium", "High", "Critical"];
const SUBMITTAL_STATUS_OPTIONS: SubmittalStatus[] = ["Draft", "Submitted", "Under Review", "Approved", "Approved as Noted", "Revise & Resubmit", "Rejected"];

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

function BackButton({ onClick, to }: { onClick?: () => void; to?: string }) {
  const content = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
  const cls = "w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0";
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <button onClick={onClick} className={cls}>{content}</button>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-[#0d0d0e] rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-6 pt-4 pb-2 sticky top-0 bg-[#0d0d0e] z-10">
          <h2 className="font-extrabold text-base tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-7 right-6 w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_8px_24px_rgba(255,81,0,0.4)] active:scale-95 transition-transform z-30"
      style={{ backgroundColor: "#ff5100" }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    </button>
  );
}

function PhotoPicker({ photos, setPhotos, disabled }: { photos: File[]; setPhotos: (fn: (p: File[]) => File[]) => void; disabled: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>Photos</span>
      <input type="file" accept="image/*" multiple disabled={disabled}
        onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])])}
        className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((f, i) => (
            <div key={i} className="relative w-16 h-16">
              <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover" />
              <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
    </label>
  );
}

/* ═══════════════ New Daily Log sheet ═══════════════ */
function NewLogSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(WEATHER_OPTIONS[0]);
  const [temperature, setTemperature] = useState("");
  const [workforceCount, setWorkforceCount] = useState("");
  const [progressPct, setProgressPct] = useState("");
  const [activities, setActivities] = useState("");
  const [materials, setMaterials] = useState("");
  const [equipment, setEquipment] = useState("");
  const [issues, setIssues] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const log = await createCMDailyLog(ownerId, projectId, {
        log_date: logDate,
        weather,
        temperature_c: temperature ? Number(temperature) : null,
        workforce_count: workforceCount ? Number(workforceCount) : null,
        progress_pct: progressPct ? Number(progressPct) : null,
        activities: activities.trim() || null,
        materials_used: materials.trim() || null,
        equipment_used: equipment.trim() || null,
        issues: issues.trim() || null,
        notes: notes.trim() || null,
      });

      if (photos.length > 0) {
        const urls = await Promise.all(photos.map((f) => uploadCMPhoto(ownerId, projectId, f)));
        await updateCMDailyLog(log.id, { photos: urls });
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diary entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="New Diary Entry" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input type="date" className={inputCls} value={logDate} onChange={(e) => setLogDate(e.target.value)} required disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Progress %</span>
            <input type="number" min={0} max={100} className={inputCls} value={progressPct} onChange={(e) => setProgressPct(e.target.value)} disabled={saving} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 col-span-1">
            <span className={labelCls}>Weather</span>
            <select className={inputCls} value={weather} onChange={(e) => setWeather(e.target.value)} disabled={saving}>
              {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Temp °C</span>
            <input type="number" className={inputCls} value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Workforce</span>
            <input type="number" min={0} className={inputCls} value={workforceCount} onChange={(e) => setWorkforceCount(e.target.value)} disabled={saving} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Activities</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="Work performed today..." disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Materials used</span>
            <textarea className={`${inputCls} resize-y min-h-[48px]`} value={materials} onChange={(e) => setMaterials(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Equipment used</span>
            <textarea className={`${inputCls} resize-y min-h-[48px]`} value={equipment} onChange={(e) => setEquipment(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Issues / delays</span>
          <textarea className={`${inputCls} resize-y min-h-[48px]`} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="Safety incidents, delays, blockers..." disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Notes</span>
          <textarea className={`${inputCls} resize-y min-h-[40px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>

        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? "Saving…" : "Save entry"}
        </button>
      </form>
    </Sheet>
  );
}

/* ═══════════════ New Punch Item sheet ═══════════════ */
function NewPunchItemSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("To Do");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMTask(ownerId, projectId, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        assignee: assignee.trim() || null,
        due_date: dueDate || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create punch item");
      setSaving(false);
    }
  };

  return (
    <Sheet title="New Punch Item" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Item ★</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Crack in west wall, unit 4" required autoFocus disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Description</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Status</span>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={saving}>
              {PUNCH_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Priority</span>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} disabled={saving}>
              {PUNCH_PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Assigned to</span>
            <input className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Due date</span>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} />
          </label>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? "Creating…" : "Create punch item"}
        </button>
      </form>
    </Sheet>
  );
}

/* ═══════════════ New Inspection sheet ═══════════════ */
function NewInspectionSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<InspectionStatus>("Scheduled");
  const [inspector, setInspector] = useState("");
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const inspection = await createCMInspection(ownerId, projectId, {
        title: title.trim(), status, inspector: inspector.trim() || null, inspection_date: inspectionDate, notes: notes.trim() || null,
      });
      if (photos.length > 0) {
        const urls = await Promise.all(photos.map((f) => uploadCMPhoto(ownerId, projectId, f)));
        await updateCMInspection(inspection.id, { photos: urls });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create inspection");
      setSaving(false);
    }
  };

  return (
    <Sheet title="New Inspection" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Title ★</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rebar inspection — footing F3" required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Status</span>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as InspectionStatus)} disabled={saving}>
              {INSPECTION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input type="date" className={inputCls} value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Inspector</span>
          <input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Notes</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? "Saving…" : "Save inspection"}
        </button>
      </form>
    </Sheet>
  );
}

/* ═══════════════ New Safety Record sheet ═══════════════ */
function NewSafetySheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const [recordType, setRecordType] = useState<SafetyRecordType>("Toolbox Talk");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SafetySeverity>("Low");
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [involved, setInvolved] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const record = await createCMSafetyRecord(ownerId, projectId, {
        title: title.trim(), record_type: recordType, description: description.trim() || null,
        severity, record_date: recordDate, involved: involved.trim() || null,
      });
      if (photos.length > 0) {
        const urls = await Promise.all(photos.map((f) => uploadCMPhoto(ownerId, projectId, f)));
        await updateCMSafetyRecord(record.id, { photos: urls });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create safety record");
      setSaving(false);
    }
  };

  return (
    <Sheet title="New Safety Record" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Type</span>
            <select className={inputCls} value={recordType} onChange={(e) => setRecordType(e.target.value as SafetyRecordType)} disabled={saving}>
              {SAFETY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Severity</span>
            <select className={inputCls} value={severity} onChange={(e) => setSeverity(e.target.value as SafetySeverity)} disabled={saving}>
              {SAFETY_SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Title ★</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fall protection toolbox talk" required autoFocus disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Description</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input type="date" className={inputCls} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Involved</span>
            <input className={inputCls} value={involved} onChange={(e) => setInvolved(e.target.value)} placeholder="Names / trades" disabled={saving} />
          </label>
        </div>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? "Saving…" : "Save record"}
        </button>
      </form>
    </Sheet>
  );
}

/* ═══════════════ New Submittal sheet ═══════════════ */
function NewSubmittalSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [specSection, setSpecSection] = useState("");
  const [status, setStatus] = useState<SubmittalStatus>("Draft");
  const [dueDate, setDueDate] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMSubmittal(ownerId, projectId, {
        title: title.trim(), spec_section: specSection.trim() || null, status,
        due_date: dueDate || null, reviewer: reviewer.trim() || null, notes: notes.trim() || null,
        submitted_date: status !== "Draft" ? new Date().toISOString().slice(0, 10) : null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create submittal");
      setSaving(false);
    }
  };

  return (
    <Sheet title="New Submittal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Title ★</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Structural steel shop drawings" required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Spec section</span>
            <input className={inputCls} value={specSection} onChange={(e) => setSpecSection(e.target.value)} placeholder="e.g. 05 12 00" disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Status</span>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SubmittalStatus)} disabled={saving}>
              {SUBMITTAL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Due date</span>
            <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Reviewer</span>
            <input className={inputCls} value={reviewer} onChange={(e) => setReviewer(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Notes</span>
          <textarea className={`${inputCls} resize-y min-h-[48px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? "Creating…" : "Create submittal"}
        </button>
      </form>
    </Sheet>
  );
}

/* ═══════════════ Daily log card ═══════════════ */
function LogCard({ log, onChanged, onOpenPhoto }: { log: CMDailyLog; onChanged: () => void; onOpenPhoto: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this diary entry? This cannot be undone.")) return;
    setBusy(true);
    try { await deleteCMDailyLog(log.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{log.log_date}</span>
          {log.weather && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{log.weather}</span>}
          {log.activities && <span className="text-[12px] text-white/45 truncate">{log.activities}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {log.progress_pct != null && <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{log.progress_pct}%</span>}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="transition-transform text-white/25" style={{ transform: open ? "rotate(180deg)" : "none" }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            {log.temperature_c != null && <Field label="Temperature" value={`${log.temperature_c}°C`} />}
            {log.workforce_count != null && <Field label="Workforce" value={String(log.workforce_count)} />}
          </div>
          {log.materials_used && <Field label="Materials used" value={log.materials_used} />}
          {log.equipment_used && <Field label="Equipment used" value={log.equipment_used} />}
          {log.issues && <Field label="Issues / delays" value={log.issues} accent="#f43f5e" />}
          {log.notes && <Field label="Notes" value={log.notes} />}
          {log.photos.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Photos</p>
              <div className="flex flex-wrap gap-2">
                {log.photos.map((url) => (
                  <button key={url} type="button" onClick={() => onOpenPhoto(url)}>
                    <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <button onClick={handleDelete} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
              Delete entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Punch item card ═══════════════ */
function PunchItemCard({ item, onChanged }: { item: CMTask; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const handleStatusChange = async (status: TaskStatus) => {
    setBusy(true);
    try { await updateCMTask(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this punch item?")) return;
    setBusy(true);
    try { await deleteCMTask(item.id); onChanged(); } finally { setBusy(false); }
  };

  const sc = PUNCH_STATUS_COLOR[item.status];
  const pc = PUNCH_PRIORITY_COLOR[item.priority];

  return (
    <div className="rounded-2xl bg-[#0d0d0e] px-5 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13px] font-bold text-white leading-tight">{item.title}</h3>
        <button onClick={handleDelete} disabled={busy} className="text-white/25 hover:text-red-400 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      </div>
      {item.description && <p className="text-[12px] text-white/45">{item.description}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <select value={item.status} disabled={busy} onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 border-0"
          style={{ color: sc }}>
          {PUNCH_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest" style={{ backgroundColor: `${pc}15`, color: pc }}>{item.priority}</span>
        {item.assignee && <span className="text-[11px] text-white/40">{item.assignee}</span>}
        {item.due_date && <span className="font-mono text-[10px] text-white/30">Due {item.due_date}</span>}
      </div>
    </div>
  );
}

/* ═══════════════ Inspection card ═══════════════ */
function InspectionCard({ item, onChanged, onOpenPhoto }: { item: CMInspection; onChanged: () => void; onOpenPhoto: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sc = INSPECTION_STATUS_COLOR[item.status];

  const handleStatusChange = async (status: InspectionStatus) => {
    setBusy(true);
    try { await updateCMInspection(item.id, { status }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this inspection?")) return;
    setBusy(true);
    try { await deleteCMInspection(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.inspection_date}</span>
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest shrink-0" style={{ backgroundColor: `${sc}15`, color: sc }}>{item.status}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          <select value={item.status} disabled={busy} onChange={(e) => handleStatusChange(e.target.value as InspectionStatus)}
            className="self-start px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 border-0" style={{ color: sc }}>
            {INSPECTION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {item.inspector && <Field label="Inspector" value={item.inspector} />}
          {item.notes && <Field label="Notes" value={item.notes} />}
          {item.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.photos.map((url) => (
                <button key={url} type="button" onClick={() => onOpenPhoto(url)}>
                  <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          )}
          <button onClick={handleDelete} disabled={busy} className="self-start font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">Delete inspection</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Safety card ═══════════════ */
function SafetyCard({ item, onChanged, onOpenPhoto }: { item: CMSafetyRecord; onChanged: () => void; onOpenPhoto: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sc = SAFETY_SEVERITY_COLOR[item.severity];

  const handleResolve = async () => {
    setBusy(true);
    try { await updateCMSafetyRecord(item.id, { status: item.status === "Open" ? "Resolved" : "Open" }); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this safety record?")) return;
    setBusy(true);
    try { await deleteCMSafetyRecord(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{item.record_date}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{item.record_type}</span>
          <span className="text-[12px] text-white/70 truncate">{item.title}</span>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest shrink-0" style={{ backgroundColor: `${sc}15`, color: sc }}>{item.severity}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {item.description && <Field label="Description" value={item.description} />}
          {item.involved && <Field label="Involved" value={item.involved} />}
          {item.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.photos.map((url) => (
                <button key={url} type="button" onClick={() => onOpenPhoto(url)}>
                  <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={handleResolve} disabled={busy} className="px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest"
              style={{ backgroundColor: item.status === "Open" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)", color: item.status === "Open" ? "#34d399" : "rgba(255,255,255,0.5)" }}>
              {item.status === "Open" ? "Mark resolved" : "Resolved"}
            </button>
            <button onClick={handleDelete} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Submittal card ═══════════════ */
function SubmittalCard({ item, onChanged }: { item: CMSubmittal; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const sc = SUBMITTAL_STATUS_COLOR[item.status];

  const handleStatusChange = async (status: SubmittalStatus) => {
    setBusy(true);
    try {
      const patch: Partial<CMSubmittal> = { status };
      if (status !== "Draft" && !item.submitted_date) patch.submitted_date = new Date().toISOString().slice(0, 10);
      await updateCMSubmittal(item.id, patch);
      onChanged();
    } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this submittal?")) return;
    setBusy(true);
    try { await deleteCMSubmittal(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] px-5 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-white leading-tight truncate">{item.title}</h3>
          {item.spec_section && <p className="font-mono text-[10px] text-white/30 mt-0.5">{item.spec_section} · Rev {item.revision}</p>}
        </div>
        <button onClick={handleDelete} disabled={busy} className="text-white/25 hover:text-red-400 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <select value={item.status} disabled={busy} onChange={(e) => handleStatusChange(e.target.value as SubmittalStatus)}
          className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/5 border-0" style={{ color: sc }}>
          {SUBMITTAL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {item.reviewer && <span className="text-[11px] text-white/40">{item.reviewer}</span>}
        {item.due_date && <span className="font-mono text-[10px] text-white/30">Due {item.due_date}</span>}
      </div>
    </div>
  );
}

/* ═══════════════ Main page ═══════════════ */
type View = "home" | "diary" | "punchlist" | "photos" | "inspection" | "safety" | "submittal" | "settings";

function CMProjectPage() {
  const { projectId } = Route.useParams();
  const { user, signInWithGoogle } = useAuthCM();
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = useCMProject(projectId);
  const { data: logs, isLoading: logsLoading } = useCMDailyLogs(projectId);
  const { data: punchItems, isLoading: punchLoading } = useCMTasks(projectId);
  const { data: inspections, isLoading: inspectionsLoading } = useCMInspections(projectId);
  const { data: safetyRecords, isLoading: safetyLoading } = useCMSafetyRecords(projectId);
  const { data: submittals, isLoading: submittalsLoading } = useCMSubmittals(projectId);

  const [view, setView] = useState<View>("home");
  const [showNewLog, setShowNewLog] = useState(false);
  const [showNewPunch, setShowNewPunch] = useState(false);
  const [showNewInspection, setShowNewInspection] = useState(false);
  const [showNewSafety, setShowNewSafety] = useState(false);
  const [showNewSubmittal, setShowNewSubmittal] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const allPhotos = (logs ?? []).flatMap((l) => l.photos.map((url) => ({ url, date: l.log_date })));

  const invalidateLogs = () => { queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] }); setShowNewLog(false); };
  const invalidatePunch = () => { queryClient.invalidateQueries({ queryKey: ["cm_tasks", projectId] }); setShowNewPunch(false); };
  const invalidateInspections = () => { queryClient.invalidateQueries({ queryKey: ["cm_inspections", projectId] }); setShowNewInspection(false); };
  const invalidateSafety = () => { queryClient.invalidateQueries({ queryKey: ["cm_safety_records", projectId] }); setShowNewSafety(false); };
  const invalidateSubmittals = () => { queryClient.invalidateQueries({ queryKey: ["cm_submittals", projectId] }); setShowNewSubmittal(false); };
  const invalidateProject = () => queryClient.invalidateQueries({ queryKey: ["cm_project", projectId] });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}>
          Sign in with Google
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
        <p className="text-white/40 text-sm">Project not found.</p>
        <Link to="/cm/projects" className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#ff5100" }}>← Back to projects</Link>
      </div>
    );
  }

  const sc = PROJECT_STATUS_COLOR[project.status];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md mx-auto w-full px-4 pt-6 pb-28">
        {view === "home" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton to="/cm/projects" />
              <div className="min-w-0 flex-1 flex items-center gap-3">
                {project.client_logo_url && <img src={project.client_logo_url} alt="" className="w-9 h-9 rounded-xl object-contain bg-white/5 shrink-0" />}
                <div className="min-w-0">
                  <h1 className="text-xl font-extrabold tracking-tight text-white truncate">{project.name}</h1>
                  {project.client && <p className="text-[12px] text-white/40 truncate">{project.client}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0d0d0e] p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${sc}15` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{project.status}</span>
                </span>
                {(project.start_date || project.target_end_date) && (
                  <span className="font-mono text-[10px] text-white/25 uppercase tracking-widest">
                    {project.start_date ?? "—"} → {project.target_end_date ?? "—"}
                  </span>
                )}
              </div>
              {project.location && <p className="text-[12px] text-white/45 mb-1">{project.location}</p>}
              {project.description && <p className="text-[12px] text-white/55 leading-relaxed mt-2 whitespace-pre-wrap">{project.description}</p>}
            </div>

            <div className="grid grid-cols-3 gap-x-4 gap-y-7">
              <AppTile label="Site Diary" count={logs?.length ?? 0} onClick={() => setView("diary")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></svg>} />
              <AppTile label="Punch List" count={(punchItems ?? []).filter((t) => t.status !== "Done").length} onClick={() => setView("punchlist")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>} />
              <AppTile label="Photos" count={allPhotos.length} onClick={() => setView("photos")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>} />
              <AppTile label="Inspection" count={(inspections ?? []).length} onClick={() => setView("inspection")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8" /><path d="M8 15l2 2 4-4" /></svg>} />
              <AppTile label="Safety" count={(safetyRecords ?? []).filter((s) => s.status === "Open").length} onClick={() => setView("safety")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" /><path d="M12 8v5" /><circle cx="12" cy="16" r="0.5" fill="currentColor" /></svg>} />
              <AppTile label="Submittal" count={(submittals ?? []).length} onClick={() => setView("submittal")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>} />
              <AppTile label="Settings" onClick={() => setView("settings")}
                icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>} />
            </div>
          </>
        )}

        {view === "diary" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton onClick={() => setView("home")} />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Site Diary</h1>
            </div>
            {logsLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!logsLoading && (logs?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">No diary entries yet. Log your first day on site.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(logs ?? []).map((l) => <LogCard key={l.id} log={l} onChanged={invalidateLogs} onOpenPhoto={setLightbox} />)}
            </div>
            <FAB label="New diary entry" onClick={() => setShowNewLog(true)} />
          </>
        )}

        {view === "punchlist" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton onClick={() => setView("home")} />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Punch List</h1>
            </div>
            {punchLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!punchLoading && (punchItems?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">No punch items yet.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(punchItems ?? []).map((t) => <PunchItemCard key={t.id} item={t} onChanged={invalidatePunch} />)}
            </div>
            <FAB label="New punch item" onClick={() => setShowNewPunch(true)} />
          </>
        )}

        {view === "photos" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton onClick={() => setView("home")} />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Photos</h1>
            </div>
            {allPhotos.length === 0 && <p className="text-white/30 text-sm">No photos logged yet — add some from a diary entry.</p>}
            <div className="grid grid-cols-3 gap-2.5">
              {allPhotos.map((p, i) => (
                <button key={`${p.url}-${i}`} onClick={() => setLightbox(p.url)} className="relative aspect-square group">
                  <img src={p.url} alt="" className="w-full h-full rounded-2xl object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 font-mono text-[8px] px-1.5 py-0.5 rounded-full bg-black/70 text-white/60">{p.date}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "inspection" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton onClick={() => setView("home")} />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Inspection</h1>
            </div>
            {inspectionsLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!inspectionsLoading && (inspections?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">No inspections logged yet.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(inspections ?? []).map((i) => <InspectionCard key={i.id} item={i} onChanged={invalidateInspections} onOpenPhoto={setLightbox} />)}
            </div>
            <FAB label="New inspection" onClick={() => setShowNewInspection(true)} />
          </>
        )}

        {view === "safety" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton onClick={() => setView("home")} />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Safety</h1>
            </div>
            {safetyLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!safetyLoading && (safetyRecords?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">No safety records yet.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(safetyRecords ?? []).map((s) => <SafetyCard key={s.id} item={s} onChanged={invalidateSafety} onOpenPhoto={setLightbox} />)}
            </div>
            <FAB label="New safety record" onClick={() => setShowNewSafety(true)} />
          </>
        )}

        {view === "submittal" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BackButton onClick={() => setView("home")} />
              <h1 className="text-xl font-extrabold tracking-tight text-white">Submittal</h1>
            </div>
            {submittalsLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!submittalsLoading && (submittals?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">No submittals yet.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(submittals ?? []).map((s) => <SubmittalCard key={s.id} item={s} onChanged={invalidateSubmittals} />)}
            </div>
            <FAB label="New submittal" onClick={() => setShowNewSubmittal(true)} />
          </>
        )}

        {view === "settings" && (
          <ProjectSettingsView project={project} ownerId={user.id} onBack={() => setView("home")} onProjectChanged={invalidateProject} />
        )}
      </main>

      {showNewLog && <NewLogSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNewLog(false)} onCreated={invalidateLogs} />}
      {showNewPunch && <NewPunchItemSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNewPunch(false)} onCreated={invalidatePunch} />}
      {showNewInspection && <NewInspectionSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNewInspection(false)} onCreated={invalidateInspections} />}
      {showNewSafety && <NewSafetySheet ownerId={user.id} projectId={projectId} onClose={() => setShowNewSafety(false)} onCreated={invalidateSafety} />}
      {showNewSubmittal && <NewSubmittalSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNewSubmittal(false)} onCreated={invalidateSubmittals} />}

      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-xl">×</button>
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
