import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  updateCMProject,
  uploadCMLogo,
  useCMEquipment,
  createCMEquipment,
  updateCMEquipment,
  deleteCMEquipment,
  useCMChecklistItems,
  createCMChecklistItem,
  updateCMChecklistItem,
  deleteCMChecklistItem,
  useCMDirectoryContacts,
  useCMProjectSubcontractors,
  addCMProjectSubcontractor,
  removeCMProjectSubcontractor,
  useCMBOQItems,
  createCMBOQItem,
  deleteCMBOQItem,
  type CMProject,
  type ProjectStatus,
  type EquipmentStatus,
} from "@/lib/cm-data";

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";
const EQUIPMENT_STATUS_OPTIONS: EquipmentStatus[] = ["Operational", "Maintenance", "Out of Service"];
const EQUIPMENT_STATUS_COLOR: Record<EquipmentStatus, string> = { Operational: "#34d399", Maintenance: "#fbbf24", "Out of Service": "#f43f5e" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#0d0d0e] p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-4">{title}</p>
      {children}
    </div>
  );
}

/* ── Project info ─────────────────────────────────────── */
function InfoSection({ project, onChanged }: { project: CMProject; onChanged: () => void }) {
  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client ?? "");
  const [location, setLocation] = useState(project.location ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [targetEndDate, setTargetEndDate] = useState(project.target_end_date ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateCMProject(project.id, {
        name: name.trim(),
        client: client.trim() || null,
        location: location.trim() || null,
        status,
        start_date: startDate || null,
        target_end_date: targetEndDate || null,
        description: description.trim() || null,
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Project information">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Name</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Client</span>
            <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Location</span>
            <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Status</span>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {(["Planning", "Active", "On Hold", "Completed"] as ProjectStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Start</span>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Finish</span>
            <input type="date" className={inputCls} value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Description</span>
          <textarea className={`${inputCls} resize-y min-h-[64px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="self-start px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Card>
  );
}

/* ── Client logo ──────────────────────────────────────── */
function LogoSection({ project, ownerId, onChanged }: { project: CMProject; ownerId: string; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadCMLogo(ownerId, project.id, file);
      await updateCMProject(project.id, { client_logo_url: url });
      onChanged();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card title="Client logo">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
          {project.client_logo_url ? (
            <img src={project.client_logo_url} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-white/20 text-[10px] font-mono uppercase">None</span>
          )}
        </div>
        <input type="file" accept="image/*" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
      </div>
    </Card>
  );
}

/* ── Equipment ────────────────────────────────────────── */
function EquipmentSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const qc = useQueryClient();
  const { data: items } = useCMEquipment(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState("1");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_equipment", projectId] });

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createCMEquipment(ownerId, projectId, { name: name.trim(), type: type.trim() || null, quantity: Number(quantity) || 1 });
    setName(""); setType(""); setQuantity("1"); setAdding(false);
    invalidate();
  };

  return (
    <Card title="Equipment">
      <div className="flex flex-col gap-2">
        {(items ?? []).map((eq) => (
          <div key={eq.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] text-white/80 truncate">{eq.name}{eq.type ? ` — ${eq.type}` : ""}</p>
              <p className="font-mono text-[10px] text-white/30">Qty {eq.quantity}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select value={eq.status} onChange={(e) => updateCMEquipment(eq.id, { status: e.target.value as EquipmentStatus }).then(invalidate)}
                className="px-2 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-white/5 border-0" style={{ color: EQUIPMENT_STATUS_COLOR[eq.status] }}>
                {EQUIPMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => deleteCMEquipment(eq.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
            </div>
          </div>
        ))}
        {(items?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">No equipment logged yet.</p>}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder="Equipment name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Type" value={type} onChange={(e) => setType(e.target.value)} />
              <input type="number" min={1} className={inputCls} placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>Add</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>+ Add equipment</button>
        )}
      </div>
    </Card>
  );
}

/* ── Checklist ────────────────────────────────────────── */
function ChecklistSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const qc = useQueryClient();
  const { data: items } = useCMChecklistItems(projectId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_checklist_items", projectId] });

  const handleAdd = async () => {
    if (!title.trim()) return;
    await createCMChecklistItem(ownerId, projectId, { title: title.trim(), category: category.trim() || null });
    setTitle(""); setCategory(""); setAdding(false);
    invalidate();
  };

  return (
    <Card title="Checklist">
      <div className="flex flex-col gap-2">
        {(items ?? []).map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <button onClick={() => updateCMChecklistItem(item.id, { is_done: !item.is_done }).then(invalidate)}
              className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
              style={{ borderColor: item.is_done ? "#34d399" : "rgba(255,255,255,0.2)", backgroundColor: item.is_done ? "#34d399" : "transparent" }}>
              {item.is_done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#000" strokeWidth="2"><path d="M2 6l3 3 5-6" /></svg>}
            </button>
            <p className={`text-[12px] flex-1 ${item.is_done ? "text-white/30 line-through" : "text-white/80"}`}>{item.title}</p>
            {item.category && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25 shrink-0">{item.category}</span>}
            <button onClick={() => deleteCMChecklistItem(item.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
          </div>
        ))}
        {(items?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">No checklist items yet.</p>}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder="Checklist item" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input className={inputCls} placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>Add</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>+ Add item</button>
        )}
      </div>
    </Card>
  );
}

/* ── Subcontractors ───────────────────────────────────── */
function SubcontractorsSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const qc = useQueryClient();
  const { data: contacts } = useCMDirectoryContacts(ownerId);
  const { data: assigned } = useCMProjectSubcontractors(projectId);
  const [adding, setAdding] = useState(false);
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_project_subcontractors", projectId] });

  const handleAdd = async () => {
    if (!contactId) return;
    await addCMProjectSubcontractor(ownerId, projectId, contactId, role.trim() || null);
    setContactId(""); setRole(""); setAdding(false);
    invalidate();
  };

  return (
    <Card title="Subcontractors">
      <div className="flex flex-col gap-2">
        {(assigned ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] text-white/80 truncate">{a.contact.name}{a.contact.trade ? ` — ${a.contact.trade}` : ""}</p>
              <p className="font-mono text-[10px] text-white/30 truncate">{a.role_on_project ?? a.contact.company ?? ""}</p>
            </div>
            <button onClick={() => removeCMProjectSubcontractor(a.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
          </div>
        ))}
        {(assigned?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">No subcontractors assigned yet.</p>}
        {(contacts?.length ?? 0) === 0 && (
          <p className="text-[11px] text-white/30">Add contacts in <a href="/cm/directory" className="underline" style={{ color: "#ff5100" }}>Directory</a> first.</p>
        )}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <select className={inputCls} value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Select a contact…</option>
              {(contacts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.trade ? ` (${c.trade})` : ""}</option>)}
            </select>
            <input className={inputCls} placeholder="Role on this project (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!contactId} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>Add</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>Cancel</button>
            </div>
          </div>
        ) : (
          (contacts?.length ?? 0) > 0 && <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>+ Assign subcontractor</button>
        )}
      </div>
    </Card>
  );
}

/* ── BOQ ──────────────────────────────────────────────── */
function BOQSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const qc = useQueryClient();
  const { data: items } = useCMBOQItems(projectId);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_boq_items", projectId] });

  const handleAdd = async () => {
    if (!description.trim()) return;
    await createCMBOQItem(ownerId, projectId, {
      description: description.trim(), unit: unit.trim() || null,
      quantity: quantity ? Number(quantity) : 0, unit_cost: unitCost ? Number(unitCost) : 0,
    });
    setDescription(""); setUnit(""); setQuantity(""); setUnitCost(""); setAdding(false);
    invalidate();
  };

  const total = (items ?? []).reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  return (
    <Card title="Bill of Quantities">
      <div className="flex flex-col gap-2">
        {(items ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] text-white/80 truncate">{item.description}</p>
              <p className="font-mono text-[10px] text-white/30">{item.quantity} {item.unit ?? ""} × {item.unit_cost.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[11px]" style={{ color: "#ff5100" }}>{(item.quantity * item.unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <button onClick={() => deleteCMBOQItem(item.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
            </div>
          </div>
        ))}
        {(items?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">No BOQ items yet.</p>}
        {(items?.length ?? 0) > 0 && (
          <div className="flex items-center justify-between px-3 pt-2 border-t border-white/6">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">Total</span>
            <span className="font-mono text-[13px] font-bold" style={{ color: "#ff5100" }}>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
            <div className="grid grid-cols-3 gap-2">
              <input className={inputCls} placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <input type="number" className={inputCls} placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <input type="number" className={inputCls} placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>Add</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>+ Add BOQ item</button>
        )}
      </div>
    </Card>
  );
}

/* ── Main settings view ──────────────────────────────── */
export function ProjectSettingsView({ project, ownerId, onBack, onProjectChanged }: {
  project: CMProject; ownerId: string; onBack: () => void; onProjectChanged: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Project Settings</h1>
      </div>
      <div className="flex flex-col gap-4">
        <InfoSection project={project} onChanged={onProjectChanged} />
        <LogoSection project={project} ownerId={ownerId} onChanged={onProjectChanged} />
        <EquipmentSection ownerId={ownerId} projectId={project.id} />
        <ChecklistSection ownerId={ownerId} projectId={project.id} />
        <SubcontractorsSection ownerId={ownerId} projectId={project.id} />
        <BOQSection ownerId={ownerId} projectId={project.id} />
      </div>
    </>
  );
}
