import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { supabase } from "@/lib/supabase";
import { STAGE_CONTENT } from "@/lib/stageContent";

export const Route = createFileRoute("/admin/stages")({
  beforeLoad: async () => {
    if (!supabase) throw redirect({ to: "/login" });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.email !== "horn.chanveasna@gmail.com") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminStages,
});

/* ─── colour tokens ───────────────────────────────────────── */
const ACCENT = "#ff5100";
const BG     = "#0a0a0b";
const CARD   = "#0d0d0e";
const BORDER = "rgba(255,255,255,0.08)";

const CATEGORIES = ["Permits & Approvals", "Cost Benchmarks", "Legal Documents", "Government Reports", "Field Research", "Technical Specifications", "Environmental", "Labour Compliance", "Other"];

type UploadStatus = "idle" | "uploading" | "success" | "error";

/* ─── Upload Document Panel ───────────────────────────────── */
function UploadPanel({ stageId }: { stageId: string }) {
  const [title, setTitle]     = useState("");
  const [desc, setDesc]       = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile]       = useState<File | null>(null);
  const [status, setStatus]   = useState<UploadStatus>("idle");
  const [msg, setMsg]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setTitle(""); setDesc(""); setCategory(CATEGORIES[0]); setFile(null); setStatus("idle"); setMsg(""); if (fileRef.current) fileRef.current.value = ""; };

  const upload = async () => {
    if (!supabase || !file || !title.trim()) return;
    setStatus("uploading"); setMsg("");
    try {
      const ext  = file.name.split(".").pop() ?? "bin";
      const slug = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const path = `${stageId}/${category.replace(/[^a-zA-Z0-9]/g, "_")}/${slug}`;

      const { error: storErr } = await supabase.storage.from("stage-documents").upload(path, file, { upsert: false });
      if (storErr) throw storErr;

      const { error: dbErr } = await supabase.from("stage_documents").insert({
        stage_id: stageId,
        title:    title.trim(),
        description: desc.trim() || null,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type || `application/${ext}`,
        category,
      });
      if (dbErr) throw dbErr;

      setStatus("success"); setMsg(`"${title}" uploaded successfully.`);
      setTimeout(reset, 2000);
    } catch (err: any) {
      setStatus("error"); setMsg(err?.message ?? "Upload failed");
    }
  };

  return (
    <div className="rounded p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>Upload Document</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">Title *</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. MIME Wastewater Class B Standard" className="w-full bg-black/40 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1" style={{ border: `1px solid ${BORDER}` }} onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = BORDER)} />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-black/40 rounded px-3 py-2 text-sm text-white/80 outline-none focus:ring-1" style={{ border: `1px solid ${BORDER}` }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">Description</span>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Brief description of document content..." className="w-full bg-black/40 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none resize-none" style={{ border: `1px solid ${BORDER}` }} />
      </label>

      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">File *</span>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.csv,.txt,.zip" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-white/50 file:bg-white/10 file:border-0 file:text-white/60 file:text-xs file:px-3 file:py-1.5 file:rounded file:mr-3 file:cursor-pointer hover:file:bg-white/15" />
        {file && <p className="font-mono text-[9px] text-white/30 mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={upload}
          disabled={!file || !title.trim() || status === "uploading"}
          className="px-5 py-2 rounded text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: ACCENT, color: "white" }}
        >
          {status === "uploading" ? "Uploading…" : "Upload Document"}
        </button>
        {status !== "idle" && (
          <span className="text-xs" style={{ color: status === "success" ? "#22c55e" : status === "error" ? "#ef4444" : "rgba(255,255,255,0.5)" }}>
            {msg || (status === "uploading" ? "Uploading to Supabase Storage…" : "")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Permit Cost Entry ───────────────────────────────────── */
function PermitCostPanel({ stageId }: { stageId: string }) {
  const empty = { permit_name: "", authority: "", cost_usd_min: "", cost_usd_max: "", duration_weeks_min: "", duration_weeks_max: "", notes: "", last_verified: new Date().toISOString().split("T")[0] };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [msg, setMsg] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!supabase || !form.permit_name.trim() || !form.authority.trim()) return;
    setStatus("uploading"); setMsg("");
    const { error } = await supabase.from("permit_costs").insert({
      stage_id:           stageId,
      permit_name:        form.permit_name.trim(),
      authority:          form.authority.trim(),
      cost_usd_min:       parseFloat(form.cost_usd_min) || 0,
      cost_usd_max:       parseFloat(form.cost_usd_max) || 0,
      duration_weeks_min: parseInt(form.duration_weeks_min) || 0,
      duration_weeks_max: parseInt(form.duration_weeks_max) || 0,
      notes:              form.notes.trim() || null,
      last_verified:      form.last_verified || null,
    });
    if (error) { setStatus("error"); setMsg(error.message); }
    else { setStatus("success"); setMsg("Permit cost saved."); setForm(empty); setTimeout(() => { setStatus("idle"); setMsg(""); }, 2000); }
  };

  return (
    <div className="rounded p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>Add Permit Cost</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Permit Name *" value={form.permit_name} onChange={v => set("permit_name", v)} placeholder="e.g. MoE Environmental Compliance Certificate" />
        <FormField label="Authority *" value={form.authority} onChange={v => set("authority", v)} placeholder="e.g. Ministry of Environment" />
        <FormField label="Cost Min (USD)" value={form.cost_usd_min} onChange={v => set("cost_usd_min", v)} type="number" placeholder="0" />
        <FormField label="Cost Max (USD)" value={form.cost_usd_max} onChange={v => set("cost_usd_max", v)} type="number" placeholder="0" />
        <FormField label="Timeline Min (weeks)" value={form.duration_weeks_min} onChange={v => set("duration_weeks_min", v)} type="number" placeholder="1" />
        <FormField label="Timeline Max (weeks)" value={form.duration_weeks_max} onChange={v => set("duration_weeks_max", v)} type="number" placeholder="4" />
        <FormField label="Last Verified (date)" value={form.last_verified} onChange={v => set("last_verified", v)} type="date" />
      </div>
      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">Notes</span>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full bg-black/40 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none resize-none" style={{ border: `1px solid ${BORDER}` }} />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!form.permit_name.trim() || !form.authority.trim() || status === "uploading"} className="px-5 py-2 rounded text-sm font-bold disabled:opacity-40" style={{ background: ACCENT, color: "white" }}>
          {status === "uploading" ? "Saving…" : "Save Permit Cost"}
        </button>
        {msg && <span className="text-xs" style={{ color: status === "success" ? "#22c55e" : "#ef4444" }}>{msg}</span>}
      </div>
    </div>
  );
}

/* ─── Timeline Milestone Entry ───────────────────────────── */
function TimelinePanel({ stageId }: { stageId: string }) {
  const empty = { project_ref: "", milestone: "", estimated_days: "", actual_days: "", notes: "" };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [msg, setMsg] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!supabase || !form.milestone.trim()) return;
    setStatus("uploading"); setMsg("");
    const { error } = await supabase.from("stage_timelines").insert({
      stage_id:       stageId,
      project_ref:    form.project_ref.trim() || null,
      milestone:      form.milestone.trim(),
      estimated_days: parseInt(form.estimated_days) || null,
      actual_days:    parseInt(form.actual_days) || null,
      notes:          form.notes.trim() || null,
    });
    if (error) { setStatus("error"); setMsg(error.message); }
    else { setStatus("success"); setMsg("Milestone saved."); setForm(empty); setTimeout(() => { setStatus("idle"); setMsg(""); }, 2000); }
  };

  return (
    <div className="rounded p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>Add Timeline Milestone</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Project Reference" value={form.project_ref} onChange={v => set("project_ref", v)} placeholder="e.g. KS-2025-03" />
        <FormField label="Milestone *" value={form.milestone} onChange={v => set("milestone", v)} placeholder="e.g. MoE ECC Approved" />
        <FormField label="Estimated Duration (days)" value={form.estimated_days} onChange={v => set("estimated_days", v)} type="number" placeholder="60" />
        <FormField label="Actual Duration (days)" value={form.actual_days} onChange={v => set("actual_days", v)} type="number" placeholder="75" />
      </div>
      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">Notes</span>
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full bg-black/40 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none resize-none" style={{ border: `1px solid ${BORDER}` }} />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!form.milestone.trim() || status === "uploading"} className="px-5 py-2 rounded text-sm font-bold disabled:opacity-40" style={{ background: ACCENT, color: "white" }}>
          {status === "uploading" ? "Saving…" : "Save Milestone"}
        </button>
        {msg && <span className="text-xs" style={{ color: status === "success" ? "#22c55e" : "#ef4444" }}>{msg}</span>}
      </div>
    </div>
  );
}

/* ─── Uploaded docs viewer ─────────────────────────────────── */
type Doc = { id: string; title: string; category: string; file_name: string; file_size: number; created_at: string };

function DocList({ stageId, refresh }: { stageId: string; refresh: number }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("stage_documents").select("id,title,category,file_name,file_size,created_at").eq("stage_id", stageId).order("created_at", { ascending: false }).then(({ data }) => { if (data) setDocs(data); });
  }, [stageId, refresh]);

  if (!docs.length) return <p className="text-xs text-white/30 font-mono py-2">No documents uploaded for this stage yet.</p>;

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {docs.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded text-xs" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
          <div className="min-w-0">
            <p className="text-white/70 font-semibold truncate">{d.title}</p>
            <p className="font-mono text-[9px] text-white/25 mt-0.5">{d.category} · {d.file_name} · {(d.file_size / 1024).toFixed(0)} KB</p>
          </div>
          <p className="font-mono text-[9px] text-white/25 shrink-0">{new Date(d.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Reusable form field ───────────────────────────────────── */
function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/35 block mb-1">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-black/40 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1" style={{ border: `1px solid ${BORDER}` }} onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = BORDER)} />
    </label>
  );
}

/* ─── Main admin component ─────────────────────────────────── */
function AdminStages() {
  const [activeStage, setActiveStage] = useState("01");
  const [activeTab, setActiveTab]     = useState<"docs" | "permits" | "timeline">("docs");
  const [refresh, setRefresh]         = useState(0);

  const tabs = [
    { id: "docs" as const, label: "Documents" },
    { id: "permits" as const, label: "Permit Costs" },
    { id: "timeline" as const, label: "Timeline Milestones" },
  ];

  return (
    <div className="min-h-screen" style={{ background: BG, color: "rgba(255,255,255,0.8)" }}>
      <TopNav />

      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8">
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: ACCENT }}>Admin Panel</span>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-1">GIDF Data Entry</h1>
          <p className="text-sm text-white/40 mt-1">Upload documents, enter permit costs, and log project timelines for each of the 9 GIDF stages.</p>
        </div>

        {/* Stage selector */}
        <div className="mb-6">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-3">Select Stage</p>
          <div className="flex flex-wrap gap-2">
            {STAGE_CONTENT.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStage(s.id)}
                className="px-3 py-1.5 rounded text-xs font-bold transition-all"
                style={activeStage === s.id
                  ? { background: ACCENT, color: "white" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: `1px solid ${BORDER}` }
                }
              >
                {s.id} — {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Active stage header */}
        <div className="mb-6 p-4 rounded" style={{ background: "#111113", border: `1px solid ${ACCENT}30` }}>
          {(() => {
            const s = STAGE_CONTENT.find(s => s.id === activeStage)!;
            return (
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px]" style={{ color: ACCENT }}>Stage {s.id}</span>
                  <h2 className="font-black text-white text-lg">{s.title}</h2>
                  <p className="text-xs text-white/40">{s.subtitle}</p>
                </div>
                <a
                  href={`/framework/${activeStage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded transition-colors hover:bg-white/10"
                  style={{ border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.45)" }}
                >
                  View Live Page ↗
                </a>
              </div>
            );
          })()}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 p-1 rounded" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded text-xs font-bold transition-all"
              style={activeTab === tab.id
                ? { background: ACCENT, color: "white" }
                : { color: "rgba(255,255,255,0.4)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "docs" && (
          <div className="space-y-6">
            <UploadPanel stageId={activeStage} />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mb-3">Uploaded Documents — Stage {activeStage}</p>
              <DocList stageId={activeStage} refresh={refresh} />
            </div>
          </div>
        )}

        {activeTab === "permits" && (
          <div className="space-y-6">
            <PermitCostPanel stageId={activeStage} />
            <div className="p-4 rounded text-xs text-white/40" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <p>Permit costs entered here are stored in the <code className="text-white/60">permit_costs</code> table and can be queried to update the framework pages with real-world verified data.</p>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-6">
            <TimelinePanel stageId={activeStage} />
            <div className="p-4 rounded text-xs text-white/40" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
              <p>Timeline milestones are stored in the <code className="text-white/60">stage_timelines</code> table. As real project data accumulates, it will replace the estimated data shown in the framework page charts.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
