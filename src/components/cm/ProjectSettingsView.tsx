import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCMLang } from "@/lib/cm-i18n";
import { FieldSelect, Card, Avatar } from "@/components/cm/shared";
import {
  updateCMProject,
  uploadCMLogo,
  monotonePreviewUrl,
  useCMChecklistItems,
  createCMChecklistItem,
  updateCMChecklistItem,
  deleteCMChecklistItem,
  useCMDirectoryContacts,
  useCMProjectSubcontractors,
  addCMProjectSubcontractor,
  removeCMProjectSubcontractor,
  useCMProjectConsultants,
  createCMProjectConsultant,
  updateCMProjectConsultant,
  deleteCMProjectConsultant,
  useCMConsultantPeople,
  addCMConsultantPerson,
  removeCMConsultantPerson,
  useCMProjectMembers,
  updateCMMemberRole,
  updateCMMemberPosition,
  removeCMProjectMember,
  useCMProjectInvites,
  createCMProjectInvite,
  revokeCMProjectInvite,
  type CMProject,
  type CMProjectConsultant,
  type CMProjectSubcontractor,
  type CMMemberRole,
  type ProjectStatus,
} from "@/lib/cm-data";

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";
const STATUS_OPTIONS: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed"];

/** Swaps a logo's `src` for the exact same monotone tint the photo stamp
 *  would burn onto a photo, so the settings-page preview toggle shows real
 *  output instead of a rough CSS-filter approximation. */
function useMonotonePreview(url: string | null | undefined, enabled: boolean): string | null {
  const [tinted, setTinted] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !url) {
      setTinted(null);
      return;
    }
    let cancelled = false;
    monotonePreviewUrl(url).then((dataUrl) => {
      if (!cancelled) setTinted(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);
  return enabled ? tinted : null;
}

function MonotonePreviewToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  const { t } = useCMLang();
  return (
    <button type="button" onClick={() => onChange(!enabled)}
      className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${enabled ? "" : "text-white/35"}`}
      style={enabled ? { color: "#ff5100" } : undefined}>
      <span className={`w-7 h-4 rounded-full relative shrink-0 transition-colors ${enabled ? "" : "bg-white/15"}`}
        style={enabled ? { backgroundColor: "#ff5100" } : undefined}>
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: enabled ? "translateX(13px)" : "translateX(2px)" }} />
      </span>
      {t("projectSettings.previewMonotone")}
    </button>
  );
}

/* ── Project info ─────────────────────────────────────── */
function InfoSection({ project, onChanged }: { project: CMProject; onChanged: () => void }) {
  const { t } = useCMLang();
  const [name, setName] = useState(project.name);
  const [projectCode, setProjectCode] = useState(project.project_code ?? "");
  const [client, setClient] = useState(project.client ?? "");
  const [address, setAddress] = useState(project.address ?? "");
  const [location, setLocation] = useState(project.location ?? "");
  const [locationMapUrl, setLocationMapUrl] = useState(project.location_map_url ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [targetEndDate, setTargetEndDate] = useState(project.target_end_date ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError(t("projectSettings.locateUnsupported"));
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setLocationMapUrl(`https://www.google.com/maps?q=${latitude},${longitude}`);
        try {
          const key = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
          if (!key) { setLocation(fallback); return; }
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`);
          const json = await res.json();
          setLocation(json?.results?.[0]?.formatted_address || fallback);
        } catch {
          setLocation(fallback);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocateError(t("projectSettings.locateFailed"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleOpenMap = () => {
    if (locationMapUrl.trim()) {
      window.open(locationMapUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const query = address.trim() || location.trim() || [name.trim(), client.trim()].filter(Boolean).join(", ");
    const url = query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : "https://www.google.com/maps";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateCMProject(project.id, {
        name: name.trim(),
        project_code: projectCode.trim() || null,
        client: client.trim() || null,
        address: address.trim() || null,
        location: location.trim() || null,
        location_map_url: locationMapUrl.trim() || null,
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
    <Card title={t("projectSettings.information")}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.name")}</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.code")}</span>
            <input className={inputCls} value={projectCode} onChange={(e) => setProjectCode(e.target.value)} placeholder={t("projectSettings.codePlaceholder")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.client")}</span>
            <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.address")}</span>
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("projectSettings.addressPlaceholder")} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={labelCls}>{t("projectSettings.location")}</span>
              <button type="button" onClick={handleUseCurrentLocation} disabled={locating}
                title={t("projectSettings.useCurrentLocation")}
                className="text-white/40 hover:text-[#ff5100] disabled:opacity-40 transition-colors">
                {locating ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-9-9" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" />
                  </svg>
                )}
              </button>
            </div>
            <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
            {locateError && <p className="text-[11px] text-red-400">{locateError}</p>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.mapLink")}</span>
            <div className="flex gap-1.5">
              <input className={`${inputCls} flex-1`} value={locationMapUrl} onChange={(e) => setLocationMapUrl(e.target.value)}
                placeholder={t("projectSettings.mapLinkPlaceholder")} />
              <button type="button" onClick={handleOpenMap} title={t("projectSettings.openMap")}
                className="shrink-0 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-[#ff5100] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" />
                </svg>
              </button>
            </div>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.status")}</span>
            <FieldSelect value={status} onChange={setStatus} options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.start")}</span>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.finish")}</span>
            <input type="date" className={inputCls} value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("projectSettings.description")}</span>
          <textarea className={`${inputCls} resize-y min-h-[64px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="self-start px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("projectSettings.saving") : t("projectSettings.saveChanges")}
        </button>
      </div>
    </Card>
  );
}

/* ── Client logo ──────────────────────────────────────── */
function LogoSection({ project, ownerId, onChanged, previewMonotone, onTogglePreview }: {
  project: CMProject; ownerId: string; onChanged: () => void; previewMonotone: boolean; onTogglePreview: (v: boolean) => void;
}) {
  const { t } = useCMLang();
  const [uploading, setUploading] = useState(false);
  const previewSrc = useMonotonePreview(project.client_logo_url, previewMonotone);

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
    <Card title={t("projectSettings.clientLogo")} action={<MonotonePreviewToggle enabled={previewMonotone} onChange={onTogglePreview} />}>
      <label className="inline-block cursor-pointer">
        <div className="h-16 max-w-[220px] rounded-2xl overflow-hidden flex items-center justify-center"
          style={previewSrc ? { backgroundColor: "#111318" } : undefined}>
          {project.client_logo_url ? (
            <img src={previewSrc ?? project.client_logo_url} alt="" className={`h-full w-auto object-contain ${previewSrc ? "px-3" : ""}`} style={{ opacity: uploading ? 0.4 : 1 }} />
          ) : (
            <span className="text-white/20 text-[10px] font-mono uppercase bg-white/5 rounded-2xl px-4 py-5">{t("projectSettings.none")}</span>
          )}
        </div>
        <input type="file" accept="image/*" className="hidden" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </label>
    </Card>
  );
}

function ConsultantRow({ c, editing, editValue, onEditValueChange, onStartEdit, onCommitEdit, onCancelEdit, uploading, onUploadLogo, onDelete, previewMonotone }: {
  c: CMProjectConsultant;
  editing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  uploading: boolean;
  onUploadLogo: (file: File) => void;
  onDelete: () => void;
  previewMonotone: boolean;
}) {
  const { t } = useCMLang();
  const previewSrc = useMonotonePreview(c.logo_url, previewMonotone);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
      {editing ? (
        <input
          className="flex-1 min-w-0 bg-transparent text-[12px] text-white/80 focus:outline-none border-b border-[#ff5100]/60"
          value={editValue}
          autoFocus
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") onCancelEdit(); }}
        />
      ) : (
        <p onClick={onStartEdit} className="text-[12px] text-white/80 flex-1 truncate cursor-text">{c.name}</p>
      )}
      <label className="h-10 max-w-[110px] rounded-lg overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
        style={previewSrc ? { backgroundColor: "#111318" } : undefined}>
        {c.logo_url ? (
          <img src={previewSrc ?? c.logo_url} alt="" className={`h-full w-auto object-contain ${previewSrc ? "px-2" : ""}`} style={{ opacity: uploading ? 0.4 : 1 }} />
        ) : (
          <span className="text-white/20 text-[8px] font-mono uppercase bg-white/5 rounded-lg px-2 py-3">{uploading ? "…" : t("projectSettings.none")}</span>
        )}
        <input type="file" accept="image/*" className="hidden" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadLogo(f); }} />
      </label>
      <button onClick={onDelete} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
    </div>
  );
}

/** Named people attached to a consultant company, shown as face-thumbnail
 *  + role chips beneath its logo row — separate from the consultant's own
 *  name/logo, which stays untouched (still feeds photo-stamp branding). */
function ConsultantPeopleSection({ ownerId, consultantId }: { ownerId: string; consultantId: string }) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: contacts } = useCMDirectoryContacts(ownerId);
  const { data: people } = useCMConsultantPeople(consultantId);
  const [adding, setAdding] = useState(false);
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_consultant_people", consultantId] });

  const handleAdd = async () => {
    if (!contactId) return;
    await addCMConsultantPerson(consultantId, contactId, role.trim() || null);
    setContactId(""); setRole(""); setAdding(false);
    invalidate();
  };

  return (
    <div className="pl-3 flex flex-col gap-2">
      {(people?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-3">
          {(people ?? []).map((p) => (
            <div key={p.id} className="relative flex flex-col items-center gap-1" style={{ width: 56 }}>
              <Avatar name={p.contact.name} photoUrl={p.contact.photo_url} size={32} />
              <p className="text-[9px] text-white/40 text-center leading-tight line-clamp-2" title={p.contact.name}>
                {p.role || p.contact.trade || p.contact.name}
              </p>
              <button onClick={() => removeCMConsultantPerson(p.id).then(invalidate)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white/60 hover:text-red-400 text-[9px] flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex flex-col gap-2">
          <FieldSelect
            value={contactId}
            onChange={setContactId}
            placeholder={t("projectSettings.selectContact")}
            options={(contacts ?? []).map((c) => ({ value: c.id, label: `${c.name}${c.trade ? ` (${c.trade})` : ""}` }))}
          />
          <input className={inputCls} placeholder={t("projectSettings.personRole")} value={role} onChange={(e) => setRole(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!contactId} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
            <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        (contacts?.length ?? 0) > 0 && <button onClick={() => setAdding(true)} className={`${smallBtn} self-start`} style={{ color: "#ff5100" }}>{t("projectSettings.addPerson")}</button>
      )}
    </div>
  );
}

/* ── Consultants (structural, MEP, etc. — a project can have several) ── */
function ConsultantsSection({ ownerId, projectId, previewMonotone }: { ownerId: string; projectId: string; previewMonotone: boolean }) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: consultants } = useCMProjectConsultants(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_project_consultants", projectId] });

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createCMProjectConsultant(ownerId, projectId, name.trim());
    setName(""); setAdding(false);
    invalidate();
  };

  const handleUploadLogo = async (consultantId: string, file: File) => {
    setUploadingId(consultantId);
    try {
      const url = await uploadCMLogo(ownerId, projectId, file);
      await updateCMProjectConsultant(consultantId, { logo_url: url });
      invalidate();
    } finally {
      setUploadingId(null);
    }
  };

  const startEditing = (c: { id: string; name: string }) => {
    setEditingId(c.id);
    setEditValue(c.name);
  };

  const commitEdit = async (id: string) => {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (trimmed) {
      await updateCMProjectConsultant(id, { name: trimmed });
      invalidate();
    }
  };

  return (
    <Card title={t("projectSettings.consultants")}>
      <div className="flex flex-col gap-2">
        {(consultants ?? []).map((c) => (
          <div key={c.id} className="flex flex-col gap-2">
            <ConsultantRow
              c={c}
              editing={editingId === c.id}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEdit={() => startEditing(c)}
              onCommitEdit={() => commitEdit(c.id)}
              onCancelEdit={() => setEditingId(null)}
              uploading={uploadingId === c.id}
              onUploadLogo={(f) => handleUploadLogo(c.id, f)}
              onDelete={() => deleteCMProjectConsultant(c.id).then(invalidate)}
              previewMonotone={previewMonotone}
            />
            <ConsultantPeopleSection ownerId={ownerId} consultantId={c.id} />
          </div>
        ))}
        {(consultants?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("projectSettings.noConsultants")}</p>}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder={t("projectSettings.consultantName")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("projectSettings.addConsultant")}</button>
        )}
      </div>
    </Card>
  );
}

/* ── Checklist ────────────────────────────────────────── */
function ChecklistSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const { t } = useCMLang();
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
    <Card title={t("projectSettings.checklist")}>
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
        {(items?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("projectSettings.noChecklist")}</p>}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder={t("projectSettings.itemTitle")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <input className={inputCls} placeholder={t("projectSettings.category")} value={category} onChange={(e) => setCategory(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("projectSettings.addItem")}</button>
        )}
      </div>
    </Card>
  );
}

/* ── Subcontractors ───────────────────────────────────── */
function SubcontractorsSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const { t } = useCMLang();
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

  // Grouped by company so several people from the same subcontractor show
  // together as one row of face thumbnails with a "×N" count, instead of
  // one flat list entry per person.
  const grouped = useMemo(() => {
    const map = new Map<string, CMProjectSubcontractor[]>();
    for (const a of assigned ?? []) {
      const key = a.contact.company || t("projectSettings.independent");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [assigned, t]);

  return (
    <Card title={t("projectSettings.subcontractors")}>
      <div className="flex flex-col gap-3">
        {grouped.map(([company, group]) => (
          <div key={company} className="rounded-xl bg-white/[0.03] px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-white/80 font-medium truncate">{company}</p>
              <span className="font-mono text-[10px] text-white/30 shrink-0">×{group.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {group.map((a) => (
                <div key={a.id} className="relative flex flex-col items-center gap-1" style={{ width: 56 }}>
                  <Avatar name={a.contact.name} photoUrl={a.contact.photo_url} size={36} />
                  <p className="text-[9px] text-white/40 text-center leading-tight line-clamp-2" title={a.contact.name}>
                    {a.role_on_project || a.contact.trade || a.contact.name}
                  </p>
                  <button onClick={() => removeCMProjectSubcontractor(a.id).then(invalidate)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white/60 hover:text-red-400 text-[9px] flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {(assigned?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("projectSettings.noSubcontractors")}</p>}
        {(contacts?.length ?? 0) === 0 && (
          <p className="text-[11px] text-white/30">
            {t("projectSettings.addContactsFirst")} <a href="/cm/directory" className="underline" style={{ color: "#ff5100" }}>{t("projectSettings.directoryLink")}</a> {t("projectSettings.addContactsFirstSuffix")}
          </p>
        )}
        {adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <FieldSelect
              value={contactId}
              onChange={setContactId}
              placeholder={t("projectSettings.selectContact")}
              options={(contacts ?? []).map((c) => ({ value: c.id, label: `${c.name}${c.trade ? ` (${c.trade})` : ""}` }))}
            />
            <input className={inputCls} placeholder={t("projectSettings.roleOnProject")} value={role} onChange={(e) => setRole(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={!contactId} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          (contacts?.length ?? 0) > 0 && <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("projectSettings.assign")}</button>
        )}
      </div>
    </Card>
  );
}

/* ── Team (Phase 1: schema + invite-link mechanics only — members can
 *  accept an invite and show up here, but every other project-scoped
 *  table still gates strictly on owner_id, so they can't see project
 *  content yet; that RLS rewrite is a separate follow-up) ──────── */
const MEMBER_ROLE_OPTIONS: CMMemberRole[] = ["admin", "member", "visitor"];
const positionInputCls = "w-full bg-transparent text-[10px] text-white/40 placeholder-white/20 focus:outline-none focus:text-white/70 transition-colors";

function TeamSection({ ownerId, projectId }: { ownerId: string; projectId: string }) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: members } = useCMProjectMembers(projectId);
  const { data: invites } = useCMProjectInvites(projectId);
  const [inviteRole, setInviteRole] = useState<CMMemberRole>("member");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invalidateMembers = () => qc.invalidateQueries({ queryKey: ["cm_project_members", projectId] });
  const invalidateInvites = () => qc.invalidateQueries({ queryKey: ["cm_project_invites", projectId] });

  const copyInviteLink = async (token: string, id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/cm/join/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
  };

  const handleCreateInvite = async () => {
    setCreating(true);
    try {
      const invite = await createCMProjectInvite(ownerId, projectId, inviteRole);
      invalidateInvites();
      await copyInviteLink(invite.token, invite.id);
    } finally {
      setCreating(false);
    }
  };

  const activeInvites = (invites ?? []).filter((i) => !i.revoked_at);

  return (
    <Card title={t("team.title")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className={labelCls}>{t("team.members")}</span>
          {(members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="min-w-0 flex items-center gap-2.5">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[11px] text-white/50">
                    {(m.display_name || m.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[12px] text-white/80 truncate">{m.display_name || m.email || t("team.unknownMember")}</p>
                  <input className={positionInputCls} placeholder={t("team.positionPlaceholder")} defaultValue={m.position ?? ""}
                    onBlur={(e) => { if (e.target.value !== (m.position ?? "")) updateCMMemberPosition(m.id, e.target.value.trim() || null).then(invalidateMembers); }} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <FieldSelect value={m.role} onChange={(role) => updateCMMemberRole(m.id, role).then(invalidateMembers)}
                  options={MEMBER_ROLE_OPTIONS.map((r) => ({ value: r, label: t(`team.role.${r}`) }))} />
                <button onClick={() => removeCMProjectMember(m.id).then(invalidateMembers)}
                  className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
              </div>
            </div>
          ))}
          {(members?.length ?? 0) === 0 && <p className="text-white/30 text-[12px]">{t("team.noMembers")}</p>}
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
          <span className={labelCls}>{t("team.inviteLink")}</span>
          <div className="flex gap-2">
            <FieldSelect value={inviteRole} onChange={setInviteRole}
              options={MEMBER_ROLE_OPTIONS.map((r) => ({ value: r, label: t(`team.role.${r}`) }))} />
            <button onClick={handleCreateInvite} disabled={creating} className={`${smallBtn} shrink-0 disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>
              {t("team.generateLink")}
            </button>
          </div>
          {activeInvites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
              <span className="font-mono text-[10px] text-white/50 truncate">{t(`team.role.${inv.role}`)} — {inv.token.slice(0, 8)}…</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => copyInviteLink(inv.token, inv.id)} className={smallBtn} style={{ color: "#ff5100" }}>
                  {copiedId === inv.id ? t("team.copied") : t("team.copyLink")}
                </button>
                <button onClick={() => revokeCMProjectInvite(inv.id).then(invalidateInvites)}
                  className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── Main settings view ──────────────────────────────── */
export function ProjectSettingsView({ project, ownerId, onBack, onProjectChanged }: {
  project: CMProject; ownerId: string; onBack: () => void; onProjectChanged: () => void;
}) {
  const { t } = useCMLang();
  const [previewMonotone, setPreviewMonotone] = useState(false);
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        <h1 className="text-xl font-extrabold tracking-tight text-white">{t("projectSettings.title")}</h1>
      </div>
      <div className="flex flex-col gap-4">
        <InfoSection project={project} onChanged={onProjectChanged} />
        <LogoSection project={project} ownerId={ownerId} onChanged={onProjectChanged} previewMonotone={previewMonotone} onTogglePreview={setPreviewMonotone} />
        <ConsultantsSection ownerId={ownerId} projectId={project.id} previewMonotone={previewMonotone} />
        <ChecklistSection ownerId={ownerId} projectId={project.id} />
        <SubcontractorsSection ownerId={ownerId} projectId={project.id} />
        <TeamSection ownerId={ownerId} projectId={project.id} />
      </div>
    </>
  );
}
