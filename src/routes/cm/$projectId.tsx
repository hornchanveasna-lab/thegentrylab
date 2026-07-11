import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { CMHeader } from "@/components/cm/CMHeader";
import {
  useMyTelegramUser,
  useProject,
  useReports,
  useReportDetails,
  useProjectPhotos,
  createReport,
  submitReport,
  deleteReport,
  createReportTask,
  createWorkforceRecord,
  createEquipmentRecord,
  uploadReportMedia,
  getMediaSignedUrl,
  WEATHER_OPTIONS,
  TASK_STATUS_OPTIONS,
  EQUIP_STATUS_OPTIONS,
  type Report,
  type ReportStatus,
  type WeatherCond,
  type TaskStatus,
  type EquipStatus,
  type ProjectStatus,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/$projectId")({
  component: CMProjectPage,
});

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  planning: "#94a3b8", active: "#ff5100", on_hold: "#fbbf24", completed: "#34d399", cancelled: "#f43f5e",
};
const REPORT_STATUS_COLOR: Record<ReportStatus, string> = {
  draft: "#94a3b8", submitted: "#fbbf24", approved: "#34d399", rejected: "#f43f5e",
};
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  not_started: "#94a3b8", ongoing: "#ff5100", completed: "#34d399", delayed: "#fbbf24", suspended: "#f43f5e",
};
const WEATHER_LABEL: Record<WeatherCond, string> = {
  sunny: "Sunny", partly_cloudy: "Partly Cloudy", cloudy: "Cloudy", light_rain: "Light Rain", heavy_rain: "Heavy Rain", storm: "Storm",
};

const inputCls = "w-full bg-[#0a0a0b] border border-white/10 px-3 py-2 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const smallBtn = "px-2.5 py-1 border border-white/10 text-white/40 hover:text-white hover:border-white/25 text-[10px] font-mono uppercase tracking-widest transition-all";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#0d0d0e] border border-white/10 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-[#0d0d0e] z-10">
          <h2 className="font-extrabold text-sm uppercase tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface WorkforceRow { trade: string; subcontractor: string; count: string }
interface EquipmentRow { equipment_name: string; quantity: string; status: EquipStatus }
interface TaskRow { description: string; trade: string; status: TaskStatus; progress_pct: string; qty_today: string; qty_unit: string; remarks: string }

/* ═══════════════ New Report dialog ═══════════════ */
function NewReportDialog({ projectId, telegramUserId, onClose, onCreated }: {
  projectId: string; telegramUserId: string; onClose: () => void; onCreated: () => void;
}) {
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weatherAm, setWeatherAm] = useState<WeatherCond>("sunny");
  const [weatherPm, setWeatherPm] = useState<WeatherCond>("sunny");
  const [tempAm, setTempAm] = useState("");
  const [tempPm, setTempPm] = useState("");
  const [humidity, setHumidity] = useState("");
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [workforce, setWorkforce] = useState<WorkforceRow[]>([{ trade: "", subcontractor: "", count: "" }]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([{ equipment_name: "", quantity: "1", status: "working" }]);
  const [tasks, setTasks] = useState<TaskRow[]>([{ description: "", trade: "", status: "ongoing", progress_pct: "", qty_today: "", qty_unit: "", remarks: "" }]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const report = await createReport(projectId, telegramUserId, {
        report_date: reportDate,
        weather_am: weatherAm,
        weather_pm: weatherPm,
        temperature_am: tempAm ? Number(tempAm) : null,
        temperature_pm: tempPm ? Number(tempPm) : null,
        humidity_pct: humidity ? Number(humidity) : null,
        summary: summary.trim() || null,
        issues: issues.trim() || null,
      });

      await Promise.all([
        ...workforce.filter((w) => w.trade.trim() && w.count).map((w) =>
          createWorkforceRecord(report.id, { trade: w.trade.trim(), subcontractor: w.subcontractor.trim() || null, count: Number(w.count) })
        ),
        ...equipment.filter((eq) => eq.equipment_name.trim()).map((eq) =>
          createEquipmentRecord(report.id, { equipment_name: eq.equipment_name.trim(), quantity: Number(eq.quantity) || 1, status: eq.status, remarks: null })
        ),
        ...tasks.filter((t) => t.description.trim()).map((t) =>
          createReportTask(report.id, {
            boq_item_id: null,
            description: t.description.trim(),
            location: null,
            trade: t.trade.trim() || null,
            status: t.status,
            progress_pct: t.progress_pct ? Number(t.progress_pct) : null,
            qty_today: t.qty_today ? Number(t.qty_today) : null,
            qty_unit: t.qty_unit.trim() || null,
            qty_cumulative: null,
            remarks: t.remarks.trim() || null,
          })
        ),
        ...photos.map((f) => uploadReportMedia(report.id, f)),
      ]);

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Daily Report" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Date</span>
            <input type="date" className={inputCls} value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Humidity %</span>
            <input type="number" min={0} max={100} className={inputCls} value={humidity} onChange={(e) => setHumidity(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Weather AM</span>
            <div className="flex gap-2">
              <select className={inputCls} value={weatherAm} onChange={(e) => setWeatherAm(e.target.value as WeatherCond)}>
                {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{WEATHER_LABEL[w]}</option>)}
              </select>
              <input type="number" placeholder="°C" className={`${inputCls} w-20 shrink-0`} value={tempAm} onChange={(e) => setTempAm(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Weather PM</span>
            <div className="flex gap-2">
              <select className={inputCls} value={weatherPm} onChange={(e) => setWeatherPm(e.target.value as WeatherCond)}>
                {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{WEATHER_LABEL[w]}</option>)}
              </select>
              <input type="number" placeholder="°C" className={`${inputCls} w-20 shrink-0`} value={tempPm} onChange={(e) => setTempPm(e.target.value)} />
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Summary</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Overall progress today..." />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Issues / delays</span>
          <textarea className={`${inputCls} resize-y min-h-[48px]`} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="Safety incidents, delays, blockers..." />
        </label>

        {/* Workforce */}
        <div className="flex flex-col gap-2">
          <span className={labelCls}>Workforce</span>
          {workforce.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2">
              <input className={inputCls} placeholder="Trade (e.g. Mason)" value={w.trade}
                onChange={(e) => setWorkforce((rows) => rows.map((r, idx) => idx === i ? { ...r, trade: e.target.value } : r))} />
              <input className={inputCls} placeholder="Subcontractor" value={w.subcontractor}
                onChange={(e) => setWorkforce((rows) => rows.map((r, idx) => idx === i ? { ...r, subcontractor: e.target.value } : r))} />
              <input type="number" className={inputCls} placeholder="Count" value={w.count}
                onChange={(e) => setWorkforce((rows) => rows.map((r, idx) => idx === i ? { ...r, count: e.target.value } : r))} />
              <button type="button" onClick={() => setWorkforce((rows) => rows.filter((_, idx) => idx !== i))} className="text-white/25 hover:text-red-400 px-1">×</button>
            </div>
          ))}
          <button type="button" className={`${smallBtn} self-start`} onClick={() => setWorkforce((r) => [...r, { trade: "", subcontractor: "", count: "" }])}>+ Add trade</button>
        </div>

        {/* Equipment */}
        <div className="flex flex-col gap-2">
          <span className={labelCls}>Equipment</span>
          {equipment.map((eq, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_1fr_auto] gap-2">
              <input className={inputCls} placeholder="Equipment (e.g. Excavator)" value={eq.equipment_name}
                onChange={(e) => setEquipment((rows) => rows.map((r, idx) => idx === i ? { ...r, equipment_name: e.target.value } : r))} />
              <input type="number" className={inputCls} placeholder="Qty" value={eq.quantity}
                onChange={(e) => setEquipment((rows) => rows.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))} />
              <select className={inputCls} value={eq.status}
                onChange={(e) => setEquipment((rows) => rows.map((r, idx) => idx === i ? { ...r, status: e.target.value as EquipStatus } : r))}>
                {EQUIP_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" onClick={() => setEquipment((rows) => rows.filter((_, idx) => idx !== i))} className="text-white/25 hover:text-red-400 px-1">×</button>
            </div>
          ))}
          <button type="button" className={`${smallBtn} self-start`} onClick={() => setEquipment((r) => [...r, { equipment_name: "", quantity: "1", status: "working" }])}>+ Add equipment</button>
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-2">
          <span className={labelCls}>Activities / Tasks</span>
          {tasks.map((t, i) => (
            <div key={i} className="border border-white/8 p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Description" value={t.description}
                  onChange={(e) => setTasks((rows) => rows.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))} />
                <button type="button" onClick={() => setTasks((rows) => rows.filter((_, idx) => idx !== i))} className="text-white/25 hover:text-red-400 px-1 shrink-0">×</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input className={inputCls} placeholder="Trade" value={t.trade}
                  onChange={(e) => setTasks((rows) => rows.map((r, idx) => idx === i ? { ...r, trade: e.target.value } : r))} />
                <select className={inputCls} value={t.status}
                  onChange={(e) => setTasks((rows) => rows.map((r, idx) => idx === i ? { ...r, status: e.target.value as TaskStatus } : r))}>
                  {TASK_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <input type="number" min={0} max={100} className={inputCls} placeholder="Progress %" value={t.progress_pct}
                  onChange={(e) => setTasks((rows) => rows.map((r, idx) => idx === i ? { ...r, progress_pct: e.target.value } : r))} />
                <div className="flex gap-1">
                  <input type="number" className={inputCls} placeholder="Qty today" value={t.qty_today}
                    onChange={(e) => setTasks((rows) => rows.map((r, idx) => idx === i ? { ...r, qty_today: e.target.value } : r))} />
                  <input className={`${inputCls} w-16 shrink-0`} placeholder="Unit" value={t.qty_unit}
                    onChange={(e) => setTasks((rows) => rows.map((r, idx) => idx === i ? { ...r, qty_unit: e.target.value } : r))} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className={`${smallBtn} self-start`} onClick={() => setTasks((r) => [...r, { description: "", trade: "", status: "ongoing", progress_pct: "", qty_today: "", qty_unit: "", remarks: "" }])}>+ Add task</button>
        </div>

        {/* Photos */}
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Photos</span>
          <input type="file" accept="image/*" multiple onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])])}
            className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:border file:border-white/15 file:bg-transparent file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {photos.map((f, i) => (
                <div key={i} className="relative w-16 h-16">
                  <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 object-cover border border-white/10" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}
        </label>

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-[#0d0d0e] pb-1">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 text-white/50 hover:text-white text-[11px] font-mono uppercase tracking-widest transition-all">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#ff5100" }}>
            {saving ? "Saving…" : "Save report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════ Report card ═══════════════ */
function ReportCard({ report, onChanged, onOpenPhoto }: { report: Report; onChanged: () => void; onOpenPhoto: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: details, isLoading } = useReportDetails(open ? report.id : undefined);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!details?.media?.length) return;
    let cancelled = false;
    Promise.all(details.media.map(async (m) => [m.id, await getMediaSignedUrl(m.storage_path)] as const)).then((pairs) => {
      if (!cancelled) setSignedUrls(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [details?.media]);

  const sc = REPORT_STATUS_COLOR[report.status];

  const handleSubmitReport = async () => {
    setBusy(true);
    try { await submitReport(report.id); onChanged(); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    setBusy(true);
    try { await deleteReport(report.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="border border-white/8 bg-[#0d0d0e]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">#{report.report_number} · {report.report_date}</span>
          {report.weather_am && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{WEATHER_LABEL[report.weather_am]}</span>}
          {report.summary && <span className="text-[12px] text-white/45 truncate">{report.summary}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 px-2 py-0.5 border" style={{ borderColor: `${sc}40`, backgroundColor: `${sc}12` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: sc }}>{report.status}</span>
          </span>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="transition-transform text-white/25" style={{ transform: open ? "rotate(180deg)" : "none" }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/6 pt-4">
          {isLoading && <p className="text-white/30 text-sm">Loading…</p>}
          {report.issues && <Field label="Issues / delays" value={report.issues} accent="#f43f5e" />}

          {details && details.workforce.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Workforce</p>
              <div className="flex flex-wrap gap-2">
                {details.workforce.map((w) => (
                  <span key={w.id} className="px-2 py-1 border border-white/8 text-[11px] text-white/60">{w.trade}: <b className="text-white/85">{w.count}</b>{w.subcontractor ? ` (${w.subcontractor})` : ""}</span>
                ))}
              </div>
            </div>
          )}

          {details && details.equipment.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Equipment</p>
              <div className="flex flex-wrap gap-2">
                {details.equipment.map((eq) => (
                  <span key={eq.id} className="px-2 py-1 border border-white/8 text-[11px] text-white/60">{eq.equipment_name} × {eq.quantity} — {eq.status}</span>
                ))}
              </div>
            </div>
          )}

          {details && details.tasks.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Activities</p>
              <div className="flex flex-col gap-1.5">
                {details.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TASK_STATUS_COLOR[t.status] }} />
                    <span className="text-white/70">{t.description}</span>
                    {t.progress_pct != null && <span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{t.progress_pct}%</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {details && details.media.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Photos</p>
              <div className="flex flex-wrap gap-2">
                {details.media.map((m) => signedUrls[m.id] && (
                  <button key={m.id} type="button" onClick={() => onOpenPhoto(signedUrls[m.id])}>
                    <img src={signedUrls[m.id]} alt="" className="w-20 h-20 object-cover border border-white/10 hover:border-white/30 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-1">
            {report.status === "draft" && (
              <button onClick={handleSubmitReport} disabled={busy} className={smallBtn} style={{ borderColor: "rgba(52,211,153,0.3)", color: "#34d399" }}>
                {busy ? "Submitting…" : "Submit report"}
              </button>
            )}
            <button onClick={handleDelete} disabled={busy} className="font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
              Delete report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Main page ═══════════════ */
function CMProjectPage() {
  const { projectId } = Route.useParams();
  const { user, signInWithGoogle } = useAuthCM();
  const { data: tgUser } = useMyTelegramUser(user?.id);
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: reports, isLoading: reportsLoading } = useReports(projectId);
  const { data: photos } = useProjectPhotos(projectId);

  const [tab, setTab] = useState<"overview" | "reports" | "photos">("overview");
  const [showNewReport, setShowNewReport] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!photos?.length) return;
    let cancelled = false;
    Promise.all(photos.map(async (m) => [m.id, await getMediaSignedUrl(m.storage_path)] as const)).then((pairs) => {
      if (!cancelled) setPhotoSignedUrls(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [photos]);

  const invalidateReports = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_reports", projectId] });
    queryClient.invalidateQueries({ queryKey: ["cm_report_details"] });
    queryClient.invalidateQueries({ queryKey: ["cm_project_photos", projectId] });
    setShowNewReport(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <CMHeader />
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
        <CMHeader />
        <div className="flex-1 flex items-center justify-center"><p className="text-white/30 text-sm">Loading project…</p></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
        <CMHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-white/40 text-sm">Project not found.</p>
          <Link to="/cm" className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#ff5100" }}>← Back to projects</Link>
        </div>
      </div>
    );
  }

  const sc = PROJECT_STATUS_COLOR[project.status];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <CMHeader crumb={project.name} />

      <div className="border-b border-white/8">
        <div className="max-w-[1400px] mx-auto px-5 py-6">
          <Link to="/cm" className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors mb-3 inline-block">← All projects</Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white mb-1.5">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/40">
                {project.client_name && <span>Client: <span className="text-white/65">{project.client_name}</span></span>}
                {project.location && <span>{project.location}</span>}
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-2 border" style={{ borderColor: `${sc}50`, color: sc }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc }} />
              <span className="font-mono text-[10px] uppercase tracking-widest">{project.status.replace("_", " ")}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-white/8 sticky top-[57px] z-40 bg-[#0a0a0b]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-5 flex gap-1">
          {([
            { id: "overview", label: "Overview" },
            { id: "reports", label: `Daily Reports${reports?.length ? ` (${reports.length})` : ""}` },
            { id: "photos", label: `Photos${photos?.length ? ` (${photos.length})` : ""}` },
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Daily reports", value: reports?.length ?? 0 },
                { label: "Submitted / approved", value: (reports ?? []).filter((r) => r.status !== "draft").length },
                { label: "Photos logged", value: photos?.length ?? 0 },
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
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/35">Recent daily reports</p>
                <button onClick={() => setTab("reports")} className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>View all →</button>
              </div>
              {reportsLoading && <p className="text-white/30 text-sm">Loading…</p>}
              {!reportsLoading && (reports?.length ?? 0) === 0 && <p className="text-white/30 text-sm">No daily reports yet.</p>}
              <div className="flex flex-col gap-2">
                {(reports ?? []).slice(0, 3).map((r) => <ReportCard key={r.id} report={r} onChanged={invalidateReports} onOpenPhoto={setLightbox} />)}
              </div>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              {tgUser && (
                <button onClick={() => setShowNewReport(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all"
                  style={{ backgroundColor: "#ff5100" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  New report
                </button>
              )}
            </div>
            {reportsLoading && <p className="text-white/30 text-sm">Loading…</p>}
            {!reportsLoading && (reports?.length ?? 0) === 0 && (
              <div className="border border-dashed border-white/10 py-16 flex items-center justify-center">
                <p className="text-white/40 text-sm">No daily reports yet. Log your first day on site.</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {(reports ?? []).map((r) => <ReportCard key={r.id} report={r} onChanged={invalidateReports} onOpenPhoto={setLightbox} />)}
            </div>
          </div>
        )}

        {tab === "photos" && (
          <div>
            {(photos?.length ?? 0) === 0 && <p className="text-white/30 text-sm">No photos logged yet — add some from a daily report.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {(photos ?? []).map((p) => photoSignedUrls[p.id] && (
                <button key={p.id} onClick={() => setLightbox(photoSignedUrls[p.id])} className="relative aspect-square group">
                  <img src={photoSignedUrls[p.id]} alt="" className="w-full h-full object-cover border border-white/10 group-hover:border-white/30 transition-colors" />
                  <span className="absolute bottom-1 left-1 font-mono text-[8px] px-1 py-0.5 bg-black/70 text-white/60">{p.report_date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {showNewReport && tgUser && (
        <NewReportDialog projectId={projectId} telegramUserId={tgUser.id} onClose={() => setShowNewReport(false)} onCreated={invalidateReports} />
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute top-5 right-5 text-white/60 hover:text-white text-2xl">×</button>
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
