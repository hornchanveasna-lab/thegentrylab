import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import { FieldSelect, SegmentedField, Card, Avatar, Sheet, PROJECT_STATUS_OPTIONS, ConfirmationDialog } from "@/components/cm/shared";
import {
  updateCMProject,
  uploadCMLogo,
  monotonePreviewUrl,
  CM_PROJECT_SECTORS,
  useCMCompanies,
  createCMCompany,
  updateCMCompany,
  uploadCMCompanyMasterLogo,
  uploadCMCompanyStamp,
  CM_COMPANY_TYPES,
  DISCIPLINES,
  setCMProjectDisciplineEnabled,
  ACTIVE_MODULE_KEYS,
  setCMProjectModuleEnabled,
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
  updateCMMemberJobRole,
  updateCMMemberPosition,
  updateCMMemberCompany,
  removeCMProjectMember,
  CM_JOB_ROLES,
  useCMCustomJobRoles,
  jobRoleLabel,
  orderedJobRoles,
  distinctCMCompanyNames,
  useCMProjectInvites,
  createCMProjectInvite,
  revokeCMProjectInvite,
  useCMProjectLocations,
  createCMProjectLocation,
  updateCMProjectLocation,
  deleteCMProjectLocation,
  locationBreadcrumb,
  type CMProject,
  type CMProjectConsultant,
  type CMProjectSubcontractor,
  type CMProjectMember,
  type CMMemberRole,
  type CMJobRole,
  type CMProjectLocation,
  type CMLocationLevel,
  type ProjectStatus,
  type ProjectSector,
  type CMCompany,
  type CompanyType,
  type CompanyStatus,
  type Discipline,
  useCMWorkPackages,
  createCMWorkPackage,
  updateCMWorkPackage,
  deleteCMWorkPackage,
  type CMWorkPackage,
  useCMWorkflowSteps,
  createCMWorkflowStep,
  updateCMWorkflowStep,
  deleteCMWorkflowStep,
  type CMWorkflowStep,
  type WorkflowApproverType,
  useCMChecklistTemplates,
  useCMChecklistTemplateItems,
  createCMChecklistTemplate,
  deleteCMChecklistTemplate,
  addCMChecklistTemplateItem,
  deleteCMChecklistTemplateItem,
  type CMChecklistTemplate,
  useCMNotificationRules,
  createCMNotificationRule,
  deleteCMNotificationRule,
  NOTIFICATION_EVENTS,
  type NotificationEvent,
  type NotificationRecipientType,
  useCMTasks,
  useCMInspections,
  useCMSubmittals,
  logCMActivity,
} from "@/lib/cm-data";
import { useAuthCM } from "@/lib/auth-cm";

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";
const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";

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
function InfoSection({ project, canEdit, onChanged }: { project: CMProject; canEdit: boolean; onChanged: () => void }) {
  const { t } = useCMLang();

  if (!canEdit) {
    const rows: [string, string | null][] = [
      [t("projectSettings.name"), project.name],
      [t("projectSettings.code"), project.project_code],
      [t("projectSettings.client"), project.client],
      [t("projectSettings.address"), project.address],
      [t("projectSettings.location"), project.location],
      [t("projectSettings.status"), t(`status.${project.status}`)],
      [t("projectSettings.sector"), project.sector ? t(`sector.${project.sector}`) : null],
      [t("projectSettings.contractValue"), project.contract_value != null ? `${project.currency ? `${project.currency} ` : ""}${project.contract_value.toLocaleString()}` : null],
      [t("projectSettings.start"), project.start_date],
      [t("projectSettings.finish"), project.target_end_date],
      [t("projectSettings.description"), project.description],
    ];
    return (
      <Card title={t("projectSettings.information")}>
        <div className="flex flex-col gap-2">
          {rows.filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className={labelCls}>{label}</span>
              <span className="text-[12px] text-white/70">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const [name, setName] = useState(project.name);
  const [projectCode, setProjectCode] = useState(project.project_code ?? "");
  const [client, setClient] = useState(project.client ?? "");
  const [address, setAddress] = useState(project.address ?? "");
  const [location, setLocation] = useState(project.location ?? "");
  const [locationMapUrl, setLocationMapUrl] = useState(project.location_map_url ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [sector, setSector] = useState<ProjectSector | "">(project.sector ?? "");
  const [contractValue, setContractValue] = useState(project.contract_value != null ? String(project.contract_value) : "");
  const [currency, setCurrency] = useState(project.currency ?? "");
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
        sector: sector || null,
        contract_value: contractValue.trim() ? Number(contractValue) : null,
        currency: currency.trim() || null,
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
            <FieldSelect value={status} onChange={setStatus} options={PROJECT_STATUS_OPTIONS.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
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
          <span className={labelCls}>{t("projectSettings.sector")}</span>
          <FieldSelect value={sector} onChange={setSector} placeholder={t("projects.sectorPlaceholder")}
            options={[{ value: "", label: t("projects.sectorPlaceholder") }, ...CM_PROJECT_SECTORS.map((s) => ({ value: s, label: t(`sector.${s}`) }))]} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projectSettings.contractValue")}</span>
            <input type="number" min="0" step="any" className={inputCls} value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="0" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("projects.currency")}</span>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
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
function LogoSection({ project, ownerId, canEdit, onChanged, previewMonotone, onTogglePreview }: {
  project: CMProject; ownerId: string; canEdit: boolean; onChanged: () => void; previewMonotone: boolean; onTogglePreview: (v: boolean) => void;
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

  const preview = (
    <div className="h-16 max-w-[220px] rounded-2xl overflow-hidden flex items-center justify-center"
      style={previewSrc ? { backgroundColor: "#111318" } : undefined}>
      {project.client_logo_url ? (
        <img src={previewSrc ?? project.client_logo_url} alt="" className={`h-full w-auto object-contain ${previewSrc ? "px-3" : ""}`} style={{ opacity: uploading ? 0.4 : 1 }} />
      ) : (
        <span className="text-white/20 text-[10px] font-mono uppercase bg-white/5 rounded-2xl px-4 py-5">{t("projectSettings.none")}</span>
      )}
    </div>
  );

  return (
    <Card title={t("projectSettings.clientLogo")} action={<MonotonePreviewToggle enabled={previewMonotone} onChange={onTogglePreview} />}>
      {canEdit ? (
        <label className="inline-block cursor-pointer">
          {preview}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </label>
      ) : preview}
    </Card>
  );
}

function ConsultantRow({ c, canEdit, canDelete, editing, editValue, onEditValueChange, onStartEdit, onCommitEdit, onCancelEdit, uploading, onUploadLogo, onDelete, previewMonotone }: {
  c: CMProjectConsultant;
  canEdit: boolean;
  canDelete: boolean;
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
  const logoPreview = c.logo_url ? (
    <img src={previewSrc ?? c.logo_url} alt="" className={`h-full w-auto object-contain ${previewSrc ? "px-2" : ""}`} style={{ opacity: uploading ? 0.4 : 1 }} />
  ) : (
    <span className="text-white/20 text-[8px] font-mono uppercase bg-white/5 rounded-lg px-2 py-3">{uploading ? "…" : t("projectSettings.none")}</span>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5">
      {editing && canEdit ? (
        <input
          className="flex-1 min-w-0 bg-transparent text-[12px] text-white/80 focus:outline-none border-b border-[#ff5100]/60"
          value={editValue}
          autoFocus
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") onCancelEdit(); }}
        />
      ) : (
        <p onClick={canEdit ? onStartEdit : undefined} className={`text-[12px] text-white/80 flex-1 truncate ${canEdit ? "cursor-text" : ""}`}>{c.name}</p>
      )}
      {canEdit ? (
        <label className="h-10 max-w-[110px] rounded-lg overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
          style={previewSrc ? { backgroundColor: "#111318" } : undefined}>
          {logoPreview}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadLogo(f); }} />
        </label>
      ) : (
        <div className="h-10 max-w-[110px] rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={previewSrc ? { backgroundColor: "#111318" } : undefined}>
          {logoPreview}
        </div>
      )}
      {canDelete && <button onClick={onDelete} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>}
    </div>
  );
}

/* ── Consultants (structural, MEP, etc. — a project can have several) ── */
function ConsultantsSection({ ownerId, projectId, previewMonotone, canCreate, canEdit, canDelete }: {
  ownerId: string; projectId: string; previewMonotone: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
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
          <ConsultantRow
            key={c.id}
            c={c}
            canEdit={canEdit}
            canDelete={canDelete}
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
        ))}
        {(consultants?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("projectSettings.noConsultants")}</p>}
        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder={t("projectSettings.consultantName")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("projectSettings.addConsultant")}</button>
        ))}
      </div>
    </Card>
  );
}

/* ── Locations (Building → Floor → Zone → Area, per project) ── */
const LOCATION_LEVELS: CMLocationLevel[] = ["building", "floor", "zone", "area"];

function locationDepth(location: CMProjectLocation, all: CMProjectLocation[]): number {
  let depth = 0;
  let current = location;
  while (current.parent_id) {
    const parent = all.find((l) => l.id === current.parent_id);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

function LocationsSection({ projectId, canCreate, canEdit, canDelete }: {
  projectId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: locations } = useCMProjectLocations(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<CMLocationLevel>("building");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_project_locations", projectId] });

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createCMProjectLocation(projectId, parentId || null, name.trim(), level);
    setName(""); setParentId(""); setAdding(false);
    invalidate();
  };

  const startEditing = (l: CMProjectLocation) => {
    setEditingId(l.id);
    setEditValue(l.name);
  };

  const commitEdit = async (id: string) => {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (trimmed) {
      await updateCMProjectLocation(id, { name: trimmed });
      invalidate();
    }
  };

  return (
    <Card title={t("locations.title")}>
      <div className="flex flex-col gap-2">
        {(locations ?? []).map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5" style={{ marginLeft: locationDepth(l, locations ?? []) * 16 }}>
            {editingId === l.id && canEdit ? (
              <input
                className="flex-1 min-w-0 bg-transparent text-[12px] text-white/80 focus:outline-none border-b border-[#ff5100]/60"
                value={editValue}
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(l.id)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingId(null); }}
              />
            ) : (
              <p onClick={canEdit ? () => startEditing(l) : undefined} className={`text-[12px] text-white/80 flex-1 truncate ${canEdit ? "cursor-text" : ""}`}>{l.name}</p>
            )}
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{t(`locationLevel.${l.level}`)}</span>
            {canDelete && <button onClick={() => deleteCMProjectLocation(l.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>}
          </div>
        ))}
        {(locations?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("locations.noneYet")}</p>}
        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder={t("locations.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <SegmentedField value={level} onChange={setLevel} options={LOCATION_LEVELS.map((lv) => ({ value: lv, label: t(`locationLevel.${lv}`) }))} />
              <FieldSelect
                value={parentId}
                onChange={setParentId}
                placeholder={t("locations.parent")}
                options={[{ value: "", label: t("locations.parent") }, ...(locations ?? []).map((l) => ({ value: l.id, label: locationBreadcrumb(l, locations ?? []) }))]}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("locations.add")}</button>
        ))}
      </div>
    </Card>
  );
}

/* ── Checklist ────────────────────────────────────────── */
function ChecklistSection({ ownerId, projectId, canCreate, canEdit, canDelete }: {
  ownerId: string; projectId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
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
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5">
            <button onClick={canEdit ? () => updateCMChecklistItem(item.id, { is_done: !item.is_done }).then(invalidate) : undefined}
              className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
              style={{ borderColor: item.is_done ? "#34d399" : "rgba(255,255,255,0.2)", backgroundColor: item.is_done ? "#34d399" : "transparent" }}>
              {item.is_done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#000" strokeWidth="2"><path d="M2 6l3 3 5-6" /></svg>}
            </button>
            <p className={`text-[12px] flex-1 ${item.is_done ? "text-white/30 line-through" : "text-white/80"}`}>{item.title}</p>
            {item.category && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25 shrink-0">{item.category}</span>}
            {canDelete && <button onClick={() => deleteCMChecklistItem(item.id).then(invalidate)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>}
          </div>
        ))}
        {(items?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("projectSettings.noChecklist")}</p>}
        {canCreate && (adding ? (
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
        ))}
      </div>
    </Card>
  );
}

/* ── Companies: a shared master database (one record per company, reused
 *  across every project) instead of the free-text company names typed on
 *  Directory contacts — kept as its own settings category since merging it
 *  into Consultants (a separate, lightweight per-project branding entity)
 *  would be a bigger migration than this round covers. ── */
function CompanySheet({ ownerId, company, onClose, onSaved }: {
  ownerId: string; company: CMCompany | null; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useCMLang();
  const [name, setName] = useState(company?.name ?? "");
  const [shortName, setShortName] = useState(company?.short_name ?? "");
  const [companyType, setCompanyType] = useState<CompanyType | "">(company?.company_type ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(company?.registration_number ?? "");
  const [taxNumber, setTaxNumber] = useState(company?.tax_number ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [country, setCountry] = useState(company?.country ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [primaryContact, setPrimaryContact] = useState(company?.primary_contact ?? "");
  const [status, setStatus] = useState<CompanyStatus>(company?.status ?? "Active");
  const [notes, setNotes] = useState(company?.notes ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logo_url ?? null);
  const [stampUrl, setStampUrl] = useState(company?.stamp_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUploadLogo = async (file: File) => {
    if (!company) return;
    setUploadingLogo(true);
    try {
      const url = await uploadCMCompanyMasterLogo(ownerId, company.id, file);
      await updateCMCompany(company.id, { logo_url: url });
      setLogoUrl(url);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadStamp = async (file: File) => {
    if (!company) return;
    setUploadingStamp(true);
    try {
      const url = await uploadCMCompanyStamp(ownerId, company.id, file);
      await updateCMCompany(company.id, { stamp_url: url });
      setStampUrl(url);
    } finally {
      setUploadingStamp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const patch = {
        short_name: shortName.trim() || null,
        company_type: (companyType || null) as CompanyType | null,
        registration_number: registrationNumber.trim() || null,
        tax_number: taxNumber.trim() || null,
        address: address.trim() || null,
        country: country.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        primary_contact: primaryContact.trim() || null,
        status,
        notes: notes.trim() || null,
      };
      if (company) await updateCMCompany(company.id, { name: name.trim(), ...patch });
      else await createCMCompany(ownerId, name.trim(), patch);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={company ? company.name : t("companies.add")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        {company && (
          <div className="flex items-center gap-3">
            <label className="h-14 w-24 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-white/5 cursor-pointer">
              {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain" style={{ opacity: uploadingLogo ? 0.4 : 1 }} /> : <span className="text-white/20 text-[9px] font-mono uppercase">{t("projectSettings.none")}</span>}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); }} />
            </label>
            <label className="h-14 w-24 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-white/5 cursor-pointer">
              {stampUrl ? <img src={stampUrl} alt="" className="h-full w-full object-contain" style={{ opacity: uploadingStamp ? 0.4 : 1 }} /> : <span className="text-white/20 text-[9px] font-mono uppercase">{t("companies.stamp")}</span>}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingStamp} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadStamp(f); }} />
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.name")}</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.shortName")}</span>
            <input className={inputCls} value={shortName} onChange={(e) => setShortName(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.type")}</span>
            <FieldSelect value={companyType} onChange={setCompanyType} disabled={saving} placeholder={t("companies.typePlaceholder")}
              options={[{ value: "", label: t("companies.typePlaceholder") }, ...CM_COMPANY_TYPES.map((ty) => ({ value: ty, label: t(`companyType.${ty}`) }))]} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.status")}</span>
            <SegmentedField value={status} onChange={setStatus} disabled={saving}
              options={[{ value: "Active" as CompanyStatus, label: t("companies.active") }, { value: "Inactive" as CompanyStatus, label: t("companies.inactive") }]} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.registrationNumber")}</span>
            <input className={inputCls} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.taxNumber")}</span>
            <input className={inputCls} value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("companies.address")}</span>
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.country")}</span>
            <input className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.phone")}</span>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.email")}</span>
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("companies.website")}</span>
            <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("companies.primaryContact")}</span>
          <input className={inputCls} value={primaryContact} onChange={(e) => setPrimaryContact(e.target.value)} disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("companies.notes")}</span>
          <textarea className={`${inputCls} resize-y min-h-[64px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <button type="submit" disabled={saving || !name.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("projectSettings.saving") : t("common.save")}
        </button>
      </form>
    </Sheet>
  );
}

export function CompaniesSection({ ownerId, canCreate, canEdit }: { ownerId: string; canCreate: boolean; canEdit: boolean }) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: companies } = useCMCompanies(ownerId);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CMCompany | null | "new">(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_companies", ownerId] });

  const q = search.trim().toLowerCase();
  const filtered = (companies ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.short_name ?? "").toLowerCase().includes(q));

  return (
    <Card title={t("companies.title")}>
      <div className="flex flex-col gap-3">
        <input className={inputCls} placeholder={t("companies.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        {filtered.length === 0 && <p className="text-white/30 text-[12px]">{t("companies.none")}</p>}
        {filtered.map((c) => (
          <button key={c.id} onClick={() => canEdit && setEditing(c)} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
            <Avatar name={c.name} photoUrl={c.logo_url} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white/80 font-medium truncate">{c.name}</p>
              <p className="text-[10px] text-white/35 truncate">{c.company_type ? t(`companyType.${c.company_type}`) : t("companies.typePlaceholder")}</p>
            </div>
            {c.status === "Inactive" && <span className="font-mono text-[9px] uppercase tracking-widest text-white/25 shrink-0">{t("companies.inactive")}</span>}
          </button>
        ))}
        {canCreate && (
          <button onClick={() => setEditing("new")} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("companies.add")}</button>
        )}
      </div>
      {editing && (
        <CompanySheet
          ownerId={ownerId}
          company={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}
    </Card>
  );
}

/* ── Disciplines: enable/disable which of the fixed global trade list this
 *  project actually uses, so Inspection/Submittal discipline pickers aren't
 *  forced to show all 15 on a project that only touches a handful. ── */
function DisciplinesSection({ project, canEdit, onChanged }: { project: CMProject; canEdit: boolean; onChanged: () => void }) {
  const { t } = useCMLang();
  const disabled = new Set(project.disabled_disciplines);

  const toggle = async (d: Discipline) => {
    if (!canEdit) return;
    await setCMProjectDisciplineEnabled(project, d, disabled.has(d));
    onChanged();
  };

  return (
    <Card title={t("disciplines.title")}>
      <p className="text-[12px] text-white/45 mb-3">{t("disciplines.hint")}</p>
      <div className="flex flex-col gap-1">
        {DISCIPLINES.map((d) => {
          const enabled = !disabled.has(d);
          return (
            <button key={d} type="button" onClick={() => toggle(d)} disabled={!canEdit}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors disabled:opacity-60">
              <span className="text-[12px] text-white/70">{t(`discipline.${d}`)}</span>
              <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${enabled ? "" : "bg-white/15"}`}
                style={enabled ? { backgroundColor: "#ff5100" } : undefined}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }} />
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const MODULE_TITLE_KEY: Record<string, string> = {
  site_diary: "siteDiary.title", punch_list: "punchList.title", inspection: "inspection.title",
  safety: "safety.title", submittal: "submittal.title", equipment: "equipment.title",
  boq: "boq.title", schedule: "schedule.title", manpower: "manpower.title",
  contracts: "contracts.title", instructions: "instructions.title",
};

function ActiveModulesSection({ project, canEdit, onChanged }: { project: CMProject; canEdit: boolean; onChanged: () => void }) {
  const { t } = useCMLang();
  const disabled = new Set(project.disabled_modules);

  const toggle = async (m: (typeof ACTIVE_MODULE_KEYS)[number]) => {
    if (!canEdit) return;
    await setCMProjectModuleEnabled(project, m, disabled.has(m));
    onChanged();
  };

  return (
    <Card title={t("settingsNav.activeModules")}>
      <p className="text-[12px] text-white/45 mb-3">{t("settingsNav.activeModulesHint")}</p>
      <div className="flex flex-col gap-1">
        {ACTIVE_MODULE_KEYS.map((m) => {
          const enabled = !disabled.has(m);
          return (
            <button key={m} type="button" onClick={() => toggle(m)} disabled={!canEdit}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors disabled:opacity-60">
              <span className="text-[12px] text-white/70">{t(MODULE_TITLE_KEY[m])}</span>
              <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${enabled ? "" : "bg-white/15"}`}
                style={enabled ? { backgroundColor: "#ff5100" } : undefined}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }} />
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PlaceholderSection({ title, description }: { title: string; description: string }) {
  const { t } = useCMLang();
  return (
    <Card title={title}>
      <p className="text-[12px] text-white/40 mb-2">{description}</p>
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{t("settingsNav.notBuiltYet")}</p>
    </Card>
  );
}

/* ── Work Packages ──────────────────────────────────────── */
function WorkPackagesSection({ ownerId, projectId, canCreate, canEdit, canDelete }: {
  ownerId: string; projectId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const qc = useQueryClient();
  const { data: workPackages } = useCMWorkPackages(projectId);
  const { data: companies } = useCMCompanies(ownerId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [discipline, setDiscipline] = useState<Discipline | "">("");
  const [description, setDescription] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_work_packages", projectId] });

  const handleAdd = async () => {
    if (!name.trim()) return;
    const wp = await createCMWorkPackage(ownerId, projectId, {
      name: name.trim(), company_id: companyId || null, discipline: discipline || null, description: description.trim() || null,
    });
    if (user) logCMActivity(projectId, user.id, "created", "work_package", wp.id, { name: wp.name });
    setName(""); setCompanyId(""); setDiscipline(""); setDescription(""); setAdding(false);
    invalidate();
  };

  const companyName = (id: string | null) => companies?.find((c) => c.id === id)?.name ?? null;

  return (
    <Card title={t("workPackages.title")}>
      <div className="flex flex-col gap-2">
        {(workPackages ?? []).map((wp) => (
          <div key={wp.id} className="rounded-xl bg-white/3 px-3 py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white/80 font-medium truncate">{wp.name}</p>
              <p className="text-[10px] text-white/35 truncate">
                {wp.discipline && t(`discipline.${wp.discipline}`)}
                {wp.discipline && companyName(wp.company_id) && " · "}
                {companyName(wp.company_id)}
              </p>
            </div>
            {canDelete && (
              <button onClick={() => deleteCMWorkPackage(wp.id).then(() => {
                if (user) logCMActivity(projectId, user.id, "deleted", "work_package", wp.id, { name: wp.name });
                invalidate();
              })} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
            )}
          </div>
        ))}
        {(workPackages?.length ?? 0) === 0 && !adding && <p className="text-white/30 text-[12px]">{t("workPackages.none")}</p>}
        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder={t("workPackages.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect value={companyId} onChange={setCompanyId} placeholder={t("companies.typePlaceholder")}
                options={[{ value: "", label: t("workPackages.noCompany") }, ...(companies ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
              <FieldSelect value={discipline} onChange={setDiscipline} placeholder={t("common.selectDiscipline")}
                options={[{ value: "", label: t("common.none") }, ...DISCIPLINES.map((d) => ({ value: d, label: t(`discipline.${d}`) }))]} />
            </div>
            <textarea className={`${inputCls} resize-y min-h-[56px]`} placeholder={t("workPackages.description")} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("workPackages.add")}</button>
        ))}
      </div>
    </Card>
  );
}

/* ── Document Control ──────────────────────────────────── */
const DOC_MODULES = ["site_diary", "instructions", "contracts", "submittal", "punch_list", "inspection", "safety", "manpower", "schedule", "boq", "equipment"] as const;

/** Shared i18n-prefix mapping for module keys — only two modules have an
 *  irregular title-key casing (`site_diary`→`siteDiary`, `punch_list`→
 *  `punchList`); every other module key already matches its `<key>.title`
 *  i18n prefix verbatim. */
export const moduleTitleKey = (m: string) => (m === "site_diary" ? "siteDiary" : m === "punch_list" ? "punchList" : m);

export function DocumentControlSection({ project, canEdit, onChanged, onlyModule }: { project: CMProject; canEdit: boolean; onChanged: () => void; onlyModule?: string }) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const [codes, setCodes] = useState<Record<string, string>>(project.doc_module_codes ?? {});
  const [revisionFormat, setRevisionFormat] = useState(project.revision_format ?? "Rev {n}");
  const [footer, setFooter] = useState(project.doc_footer ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch = onlyModule
        ? { doc_module_codes: { ...(project.doc_module_codes ?? {}), [onlyModule]: codes[onlyModule] ?? "" } }
        : { doc_module_codes: codes, revision_format: revisionFormat, doc_footer: footer.trim() || null };
      await updateCMProject(project.id, patch);
      if (user) logCMActivity(project.id, user.id, "updated", "document_control");
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const previewCode = onlyModule ? (codes[onlyModule] || "DOC") : (codes.site_diary || "SD");
  const preview = `${project.project_code ?? "PRJ"}-${previewCode}-${new Date().getFullYear()}-0001`;

  return (
    <Card title={t("documentControl.title")}>
      <p className="text-[12px] text-white/45 mb-3">{t("documentControl.hint")}</p>
      <div className="flex flex-col gap-3 mb-3">
        <span className={labelCls}>{t("documentControl.moduleCodes")}</span>
        <div className="grid grid-cols-2 gap-3">
          {(onlyModule ? [onlyModule] : DOC_MODULES).map((m) => (
            <label key={m} className="flex flex-col gap-1.5">
              <span className="text-[10px] text-white/40">{t(`${moduleTitleKey(m)}.title`)}</span>
              <input className={inputCls} disabled={!canEdit} value={codes[m] ?? ""} maxLength={6}
                onChange={(e) => setCodes((prev) => ({ ...prev, [m]: e.target.value.toUpperCase() }))} />
            </label>
          ))}
        </div>
      </div>
      {!onlyModule && (
        <>
          <label className="flex flex-col gap-1.5 mb-3">
            <span className={labelCls}>{t("documentControl.revisionFormat")}</span>
            <input className={inputCls} disabled={!canEdit} value={revisionFormat} onChange={(e) => setRevisionFormat(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 mb-3">
            <span className={labelCls}>{t("documentControl.footer")}</span>
            <textarea className={`${inputCls} resize-y min-h-[56px]`} disabled={!canEdit} value={footer} onChange={(e) => setFooter(e.target.value)} />
          </label>
        </>
      )}
      <div className="rounded-xl bg-white/3 px-3 py-2.5 mb-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1">{t("documentControl.preview")}</p>
        <p className="font-mono text-[12px] text-white/70">{preview}</p>
      </div>
      {canEdit && (
        <button onClick={handleSave} disabled={saving}
          className="self-start px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("projectSettings.saving") : t("projectSettings.saveChanges")}
        </button>
      )}
    </Card>
  );
}

/* ── Workflows ──────────────────────────────────────────── */
const WORKFLOW_MODULES = ["site_diary", "instructions", "contracts", "submittal", "punch_list", "inspection", "safety", "manpower", "schedule", "boq", "equipment"] as const;
const APPROVER_TYPES: WorkflowApproverType[] = ["role", "company", "user"];

export function WorkflowsSection({ ownerId, projectId, canCreate, canDelete, lockModule }: { ownerId: string; projectId: string; canCreate: boolean; canDelete: boolean; lockModule?: typeof WORKFLOW_MODULES[number] }) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const qc = useQueryClient();
  const { data: steps } = useCMWorkflowSteps(projectId);
  const [module, setModule] = useState<typeof WORKFLOW_MODULES[number]>(lockModule ?? "site_diary");
  const [approverType, setApproverType] = useState<WorkflowApproverType>("role");
  const [approverValue, setApproverValue] = useState("");
  const [requiredComment, setRequiredComment] = useState(false);
  const [requiredSignature, setRequiredSignature] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_workflow_steps", projectId] });

  const moduleSteps = (steps ?? []).filter((s) => s.module_key === module);

  const handleAdd = async () => {
    if (!approverValue.trim()) return;
    const step = await createCMWorkflowStep(ownerId, projectId, {
      module_key: module, approver_type: approverType, approver_value: approverValue.trim(),
      step_order: moduleSteps.length, required_comment: requiredComment, required_signature: requiredSignature,
    });
    if (user) logCMActivity(projectId, user.id, "created", "workflow_step", step.id, { module_key: module, approver_value: step.approver_value });
    setApproverValue(""); setRequiredComment(false); setRequiredSignature(false);
    invalidate();
  };

  const handleDelete = (id: string) => {
    deleteCMWorkflowStep(id).then(() => {
      if (user) logCMActivity(projectId, user.id, "deleted", "workflow_step", id);
      invalidate();
    });
  };

  return (
    <Card title={t("workflows.title")}>
      <p className="text-[12px] text-white/45 mb-3">{t("workflows.hint")}</p>
      {!lockModule && (
        <div className="mb-3">
          <SegmentedField value={module} onChange={setModule}
            options={WORKFLOW_MODULES.map((m) => ({ value: m, label: t(`${moduleTitleKey(m)}.title`) }))} />
        </div>
      )}
      <div className="flex flex-col gap-2 mb-3">
        {moduleSteps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5">
            <span className="font-mono text-[10px] text-white/30 shrink-0">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white/80 truncate">{s.approver_value}</p>
              <p className="text-[10px] text-white/35">
                {t(`workflows.approverType.${s.approver_type}`)}
                {s.required_comment && ` · ${t("workflows.requiresComment")}`}
                {s.required_signature && ` · ${t("workflows.requiresSignature")}`}
              </p>
            </div>
            {canDelete && (
              <button onClick={() => handleDelete(s.id)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
            )}
          </div>
        ))}
        {moduleSteps.length === 0 && <p className="text-white/30 text-[12px]">{t("workflows.none")}</p>}
      </div>
      {canCreate && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <SegmentedField value={approverType} onChange={setApproverType} options={APPROVER_TYPES.map((a) => ({ value: a, label: t(`workflows.approverType.${a}`) }))} />
            <input className={inputCls} placeholder={t("workflows.approverValuePlaceholder")} value={approverValue} onChange={(e) => setApproverValue(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requiredComment} onChange={(e) => setRequiredComment(e.target.checked)} className="w-4 h-4 rounded accent-[#ff5100]" />
              <span className="text-[12px] text-white/60">{t("workflows.requiresComment")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requiredSignature} onChange={(e) => setRequiredSignature(e.target.checked)} className="w-4 h-4 rounded accent-[#ff5100]" />
              <span className="text-[12px] text-white/60">{t("workflows.requiresSignature")}</span>
            </label>
          </div>
          <button onClick={handleAdd} disabled={!approverValue.trim()} className={`${smallBtn} self-start disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("workflows.addStep")}</button>
        </div>
      )}
    </Card>
  );
}

/* ── Forms and Templates ───────────────────────────────── */
const TEMPLATE_MODULES = ["site_diary", "instructions", "contracts", "submittal", "punch_list", "inspection", "safety", "manpower", "schedule", "boq", "equipment"] as const;

function ChecklistTemplateRow({ template, canEdit, canDelete, onDeleted }: {
  template: CMChecklistTemplate; canEdit: boolean; canDelete: boolean; onDeleted: () => void;
}) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const qc = useQueryClient();
  const { data: items } = useCMChecklistTemplateItems(template.id);
  const [expanded, setExpanded] = useState(false);
  const [itemTitle, setItemTitle] = useState("");
  const invalidateItems = () => qc.invalidateQueries({ queryKey: ["cm_checklist_template_items", template.id] });

  const handleAddItem = async () => {
    if (!itemTitle.trim()) return;
    await addCMChecklistTemplateItem(template.id, itemTitle.trim(), items?.length ?? 0);
    if (user) logCMActivity(template.project_id, user.id, "added", "checklist_template_item", template.id, { title: itemTitle.trim() });
    setItemTitle("");
    invalidateItems();
  };

  return (
    <div className="rounded-xl bg-white/3 px-3 py-2.5">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/80 font-medium truncate">{template.name}</p>
          <p className="text-[10px] text-white/35">{t(`${template.module_key === "site_diary" ? "siteDiary" : template.module_key === "punch_list" ? "punchList" : template.module_key}.title`)} · {(items?.length ?? 0)} {t("templates.items")}</p>
        </div>
        {canDelete && (
          <button onClick={(e) => {
            e.stopPropagation();
            deleteCMChecklistTemplate(template.id).then(() => {
              if (user) logCMActivity(template.project_id, user.id, "deleted", "checklist_template", template.id, { name: template.name });
              onDeleted();
            });
          }} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-2 mt-2.5 pt-2.5 border-t border-white/6">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-[12px] text-white/70 flex-1 truncate">{item.title}</span>
              {canDelete && (
                <button onClick={() => deleteCMChecklistTemplateItem(item.id).then(invalidateItems)} className="text-white/25 hover:text-red-400 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="flex gap-2">
              <input className={`${inputCls} flex-1`} placeholder={t("templates.itemPlaceholder")} value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} />
              <button onClick={handleAddItem} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TemplatesSection({ ownerId, projectId, canCreate, canEdit, canDelete, lockModule }: {
  ownerId: string; projectId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean; lockModule?: typeof TEMPLATE_MODULES[number];
}) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const qc = useQueryClient();
  const { data: templates } = useCMChecklistTemplates(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [module, setModule] = useState<typeof TEMPLATE_MODULES[number]>(lockModule ?? "inspection");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_checklist_templates", projectId] });
  const visibleTemplates = lockModule ? (templates ?? []).filter((tpl) => tpl.module_key === lockModule) : (templates ?? []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const tpl = await createCMChecklistTemplate(ownerId, projectId, module, name.trim());
    if (user) logCMActivity(projectId, user.id, "created", "checklist_template", tpl.id, { name: tpl.name });
    setName(""); setAdding(false);
    invalidate();
  };

  return (
    <Card title={t("templates.title")}>
      <p className="text-[12px] text-white/45 mb-3">{t("templates.hint")}</p>
      <div className="flex flex-col gap-2">
        {visibleTemplates.map((tpl) => (
          <ChecklistTemplateRow key={tpl.id} template={tpl} canEdit={canEdit} canDelete={canDelete} onDeleted={invalidate} />
        ))}
        {visibleTemplates.length === 0 && !adding && <p className="text-white/30 text-[12px]">{t("templates.none")}</p>}
        {canCreate && (adding ? (
          <div className="flex flex-col gap-2 mt-1">
            <input className={inputCls} placeholder={t("templates.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            {!lockModule && (
              <SegmentedField value={module} onChange={setModule}
                options={TEMPLATE_MODULES.map((m) => ({ value: m, label: t(`${moduleTitleKey(m)}.title`) }))} />
            )}
            <div className="flex gap-2">
              <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
              <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("templates.add")}</button>
        ))}
      </div>
    </Card>
  );
}

/* ── Notifications ──────────────────────────────────────── */
function NotificationsSection({ ownerId, projectId, canCreate, canDelete }: { ownerId: string; projectId: string; canCreate: boolean; canDelete: boolean }) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const qc = useQueryClient();
  const { data: rules } = useCMNotificationRules(projectId);
  const [event, setEvent] = useState<NotificationEvent>("approval_required");
  const [recipientType, setRecipientType] = useState<NotificationRecipientType>("role");
  const [recipientValue, setRecipientValue] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm_notification_rules", projectId] });

  const handleAdd = async () => {
    if (!recipientValue.trim()) return;
    const rule = await createCMNotificationRule(ownerId, projectId, event, recipientType, recipientValue.trim());
    if (user) logCMActivity(projectId, user.id, "created", "notification_rule", rule.id, { event_key: event, recipient_value: rule.recipient_value });
    setRecipientValue("");
    invalidate();
  };

  const handleDelete = (id: string) => {
    deleteCMNotificationRule(id).then(() => {
      if (user) logCMActivity(projectId, user.id, "deleted", "notification_rule", id);
      invalidate();
    });
  };

  return (
    <Card title={t("notifications.title")}>
      <p className="text-[12px] text-white/45 mb-3">{t("notifications.hint")}</p>
      <div className="flex flex-col gap-2 mb-3">
        {(rules ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white/80 truncate">{t(`notifications.event.${r.event_key}`)}</p>
              <p className="text-[10px] text-white/35 truncate">{t(`notifications.recipientType.${r.recipient_type}`)}: {r.recipient_value}</p>
            </div>
            {canDelete && (
              <button onClick={() => handleDelete(r.id)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
            )}
          </div>
        ))}
        {(rules?.length ?? 0) === 0 && <p className="text-white/30 text-[12px]">{t("notifications.none")}</p>}
      </div>
      {canCreate && (
        <div className="flex flex-col gap-2">
          <FieldSelect value={event} onChange={setEvent} options={NOTIFICATION_EVENTS.map((e) => ({ value: e, label: t(`notifications.event.${e}`) }))} />
          <div className="grid grid-cols-2 gap-3">
            <SegmentedField value={recipientType} onChange={setRecipientType}
              options={(["role", "company", "user", "module"] as NotificationRecipientType[]).map((rt) => ({ value: rt, label: t(`notifications.recipientType.${rt}`) }))} />
            <input className={inputCls} placeholder={t("notifications.recipientPlaceholder")} value={recipientValue} onChange={(e) => setRecipientValue(e.target.value)} />
          </div>
          <button onClick={handleAdd} disabled={!recipientValue.trim()} className={`${smallBtn} self-start disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("notifications.addRule")}</button>
        </div>
      )}
    </Card>
  );
}

/* ── Data and Archive: real closeout checklist + Archive action ────────── */
function DataArchiveSection({ project, canEdit, onProjectChanged }: { project: CMProject; canEdit: boolean; onProjectChanged: () => void }) {
  const { t } = useCMLang();
  const { user } = useAuthCM();
  const { data: tasks } = useCMTasks(project.id);
  const { data: inspections } = useCMInspections(project.id);
  const { data: submittals } = useCMSubmittals(project.id);
  const [confirming, setConfirming] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const openPunch = (tasks ?? []).filter((x) => x.status !== "Done").length;
  const pendingInspections = (inspections ?? []).filter((x) => x.status === "Scheduled").length;
  const pendingSubmittals = (submittals ?? []).filter((x) => x.status === "Submitted" || x.status === "Under Review").length;
  const outstanding = openPunch + pendingInspections + pendingSubmittals;
  const isArchived = project.status === "Archived";

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await updateCMProject(project.id, { status: "Archived" });
      if (user) logCMActivity(project.id, user.id, "archived", "project", project.id, { outstanding });
      onProjectChanged();
    } finally {
      setArchiving(false);
      setConfirming(false);
    }
  };

  const handleRestore = async () => {
    await updateCMProject(project.id, { status: "Active" });
    if (user) logCMActivity(project.id, user.id, "restored", "project", project.id);
    onProjectChanged();
  };

  return (
    <Card title={t("settingsNav.dataArchive")}>
      <p className="text-[12px] text-white/45 mb-3">{t("archive.closeoutHint")}</p>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between rounded-xl bg-white/3 px-3 py-2.5">
          <span className="text-[12px] text-white/70">{t("archive.openPunch")}</span>
          <span className={`font-mono text-[12px] font-bold ${openPunch > 0 ? "text-red-400" : "text-emerald-400"}`}>{openPunch}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/3 px-3 py-2.5">
          <span className="text-[12px] text-white/70">{t("archive.pendingInspections")}</span>
          <span className={`font-mono text-[12px] font-bold ${pendingInspections > 0 ? "text-red-400" : "text-emerald-400"}`}>{pendingInspections}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/3 px-3 py-2.5">
          <span className="text-[12px] text-white/70">{t("archive.pendingSubmittals")}</span>
          <span className={`font-mono text-[12px] font-bold ${pendingSubmittals > 0 ? "text-red-400" : "text-emerald-400"}`}>{pendingSubmittals}</span>
        </div>
      </div>
      {isArchived ? (
        <>
          <p className="text-[12px] text-emerald-400 mb-3">{t("archive.isArchived")}</p>
          {canEdit && (
            <button onClick={handleRestore} className={`${smallBtn}`} style={{ color: "#ff5100" }}>{t("archive.restore")}</button>
          )}
        </>
      ) : canEdit && (
        confirming ? (
          <ConfirmationDialog
            message={outstanding > 0 ? t("archive.confirmWithOutstanding", { count: String(outstanding) }) : t("archive.confirm")}
            confirmLabel={t("archive.archiveProject")}
            onConfirm={handleArchive}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <button onClick={() => setConfirming(true)} disabled={archiving}
            className="px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors disabled:opacity-40">
            {t("archive.archiveProject")}
          </button>
        )
      )}
    </Card>
  );
}

/* ── People: unified Team + Subcontractor + Consultant-people view, grouped
 *  by company, so there's one place to see and reassign everyone regardless
 *  of how they joined (invited login vs. a Directory-only contact with no
 *  login). RLS is project-role-aware (see cm-data.ts), so an invited member
 *  can actually use the project per their role, not just show up here. ── */
const MEMBER_ROLE_OPTIONS: CMMemberRole[] = ["admin", "member", "visitor"];
const positionInputCls = "w-full bg-transparent text-[10px] text-white/40 placeholder-white/20 focus:outline-none focus:text-white/70 transition-colors";

/** Always-visible row for one joined project member — shown up front in its
 *  own "Members" list (not buried inside the company-grouped avatar chips,
 *  which mix in subcontractor Directory contacts that never logged in and
 *  looked visually identical). Role/job-role/company are editable inline,
 *  no tap-to-expand needed. */
function MemberRow({ member, companyOptions, allJobRoles, canEdit, canDelete, onChanged, onRemove }: {
  member: CMProjectMember; companyOptions: string[]; allJobRoles: string[]; canEdit: boolean; canDelete: boolean; onChanged: () => void; onRemove: () => void;
}) {
  const { t } = useCMLang();

  return (
    <div className="rounded-xl bg-white/4 px-3 py-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <Avatar name={member.display_name || member.email || "?"} photoUrl={member.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/85 font-medium truncate">{member.display_name || member.email || t("team.unknownMember")}</p>
          {member.email && <p className="text-[10px] text-white/35 truncate">{member.email}</p>}
        </div>
        {canDelete && (
          <button onClick={onRemove} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>
        )}
      </div>
      {canEdit ? (
        <>
          <input className={positionInputCls} placeholder={t("team.positionPlaceholder")} defaultValue={member.position ?? ""}
            onBlur={(e) => { if (e.target.value !== (member.position ?? "")) updateCMMemberPosition(member.id, e.target.value.trim() || null).then(onChanged); }} />
          <div className="grid grid-cols-2 gap-2">
            <FieldSelect
              value={member.company ?? ""}
              onChange={(v) => updateCMMemberCompany(member.id, v.trim() || null).then(onChanged)}
              onCreateCustom={(v) => updateCMMemberCompany(member.id, v || null).then(onChanged)}
              placeholder={t("people.companyPlaceholder")}
              searchable
              allowCustom
              options={companyOptions.map((c) => ({ value: c, label: c }))}
            />
            <SegmentedField value={member.role} onChange={(role) => updateCMMemberRole(member.id, role).then(onChanged)}
              options={MEMBER_ROLE_OPTIONS.map((r) => ({ value: r, label: t(`team.role.${r}`) }))} />
          </div>
          <FieldSelect
            value={member.job_role ?? ""}
            onChange={(v) => updateCMMemberJobRole(member.id, (v || null) as CMProjectMember["job_role"]).then(onChanged)}
            placeholder={t("team.jobRolePlaceholder")}
            searchable
            allowCustom
            options={[{ value: "", label: t("team.jobRolePlaceholder") }, ...allJobRoles.map((r) => ({ value: r, label: jobRoleLabel(r, t) }))]}
          />
        </>
      ) : (
        <p className="text-[11px] text-white/60">
          {member.position && `${member.position} · `}{member.company && `${member.company} · `}{t(`team.role.${member.role}`)}
          {member.job_role && ` · ${jobRoleLabel(member.job_role, t)}`}
        </p>
      )}
    </div>
  );
}

/** Named people attached to a consultant company, shown as its own
 *  company-style group card — separate from the consultant's own
 *  name/logo (rendered by ConsultantRow above), which stays untouched
 *  (still feeds photo-stamp branding). */
function ConsultantPeopleGroup({ ownerId, consultantId, consultantName, canCreate, canDelete }: {
  ownerId: string; consultantId: string; consultantName: string; canCreate: boolean; canDelete: boolean;
}) {
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
    <div className="rounded-xl bg-white/3 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-white/80 font-medium truncate">{consultantName}</p>
        {(people?.length ?? 0) > 0 && <span className="font-mono text-[10px] text-white/30 shrink-0">×{people!.length}</span>}
      </div>
      {(people?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-3">
          {(people ?? []).map((p) => (
            <div key={p.id} className="relative flex flex-col items-center gap-1" style={{ width: 56 }}>
              <Avatar name={p.contact.name} photoUrl={p.contact.photo_url} size={36} />
              <p className="text-[9px] text-white/40 text-center leading-tight line-clamp-2" title={p.contact.name}>
                {p.role || p.contact.trade || p.contact.name}
              </p>
              {canDelete && (
                <button onClick={() => removeCMConsultantPerson(p.id).then(invalidate)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white/60 hover:text-red-400 text-[9px] flex items-center justify-center">×</button>
              )}
            </div>
          ))}
        </div>
      )}
      {canCreate && (adding ? (
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
      ))}
    </div>
  );
}

export function PeopleSection({ ownerId, projectId, canCreate, canEdit, canDelete }: {
  ownerId: string; projectId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: members } = useCMProjectMembers(projectId);
  const { data: invites } = useCMProjectInvites(projectId);
  const { data: subcontractors } = useCMProjectSubcontractors(projectId);
  const { data: consultants } = useCMProjectConsultants(projectId);
  const { data: contacts } = useCMDirectoryContacts(ownerId);
  const { data: customJobRoles } = useCMCustomJobRoles(ownerId);
  const allJobRoles = orderedJobRoles(customJobRoles ?? []);

  const [inviteRole, setInviteRole] = useState<CMMemberRole>("member");
  const [inviteJobRole, setInviteJobRole] = useState<CMJobRole | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("");

  const invalidateMembers = () => qc.invalidateQueries({ queryKey: ["cm_project_members", projectId] });
  const invalidateInvites = () => qc.invalidateQueries({ queryKey: ["cm_project_invites", projectId] });
  const invalidateSubs = () => qc.invalidateQueries({ queryKey: ["cm_project_subcontractors", projectId] });

  const companyOptions = useMemo(
    () => distinctCMCompanyNames(members ?? [], subcontractors ?? [], consultants ?? []),
    [members, subcontractors, consultants],
  );

  // Subcontractors (Directory contacts with no login) grouped by company —
  // kept separate from actual joined Members (below), which used to be
  // merged into these same company chips and were visually indistinguishable
  // from a subcontractor contact.
  const subsGrouped = useMemo(() => {
    const map = new Map<string, CMProjectSubcontractor[]>();
    const keyOf = (name: string | null) => name || t("projectSettings.independent");
    for (const s of subcontractors ?? []) {
      const k = keyOf(s.contact.company);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries());
  }, [subcontractors, t]);

  const copyInviteLink = async (token: string, id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/cm/join/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const invite = await createCMProjectInvite(ownerId, projectId, inviteRole, inviteJobRole);
      invalidateInvites();
      await copyInviteLink(invite.token, invite.id);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactId) return;
    await addCMProjectSubcontractor(ownerId, projectId, contactId, role.trim() || null);
    setContactId(""); setRole(""); setAddingContact(false);
    invalidateSubs();
  };

  const activeInvites = (invites ?? []).filter((i) => !i.revoked_at);

  return (
    <Card title={t("people.title")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <span className={labelCls}>{t("people.members")}</span>
          {(members ?? []).map((m) => (
            <MemberRow key={m.id} member={m} companyOptions={companyOptions} allJobRoles={allJobRoles} canEdit={canEdit} canDelete={canDelete}
              onChanged={invalidateMembers} onRemove={() => removeCMProjectMember(m.id).then(invalidateMembers)} />
          ))}
          {(members?.length ?? 0) === 0 && <p className="text-white/30 text-[12px]">{t("people.noMembers")}</p>}
        </div>

        <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
          <span className={labelCls}>{t("people.subcontractors")}</span>
          {subsGrouped.map(([company, subs]) => (
            <div key={company} className="rounded-xl bg-white/3 px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-white/80 font-medium truncate">{company}</p>
                <span className="font-mono text-[10px] text-white/30 shrink-0">×{subs.length}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {subs.map((s) => (
                  <div key={s.id} className="relative flex flex-col items-center gap-1" style={{ width: 56 }}>
                    <Avatar name={s.contact.name} photoUrl={s.contact.photo_url} size={36} />
                    <p className="text-[9px] text-white/40 text-center leading-tight line-clamp-2" title={s.contact.name}>
                      {s.role_on_project || s.contact.trade || s.contact.name}
                    </p>
                    {canDelete && (
                      <button onClick={() => removeCMProjectSubcontractor(s.id).then(invalidateSubs)}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 text-white/60 hover:text-red-400 text-[9px] flex items-center justify-center">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(consultants ?? []).map((c) => (
            <ConsultantPeopleGroup key={c.id} ownerId={ownerId} consultantId={c.id} consultantName={c.name} canCreate={canCreate} canDelete={canDelete} />
          ))}
          {(subcontractors?.length ?? 0) === 0 && <p className="text-white/30 text-[12px]">{t("people.noSubcontractors")}</p>}
          {(contacts?.length ?? 0) === 0 && (
            <p className="text-[11px] text-white/30">
              {t("projectSettings.addContactsFirst")} <a href="/cm/directory" className="underline" style={{ color: "#ff5100" }}>{t("projectSettings.directoryLink")}</a> {t("projectSettings.addContactsFirstSuffix")}
            </p>
          )}
          {canCreate && (addingContact ? (
            <div className="flex flex-col gap-2 mt-1">
              <FieldSelect
                value={contactId}
                onChange={setContactId}
                placeholder={t("projectSettings.selectContact")}
                options={(contacts ?? []).map((c) => ({ value: c.id, label: `${c.name}${c.trade ? ` (${c.trade})` : ""}` }))}
              />
              <input className={inputCls} placeholder={t("projectSettings.roleOnProject")} value={role} onChange={(e) => setRole(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={handleAddContact} disabled={!contactId} className={`${smallBtn} disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
                <button onClick={() => setAddingContact(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
              </div>
            </div>
          ) : (
            (contacts?.length ?? 0) > 0 && <button onClick={() => setAddingContact(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("projectSettings.assign")}</button>
          ))}
        </div>

        {canCreate && (
          <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
            <span className={labelCls}>{t("team.inviteLink")}</span>
            <div className="flex gap-2">
              <SegmentedField value={inviteRole} onChange={setInviteRole}
                options={MEMBER_ROLE_OPTIONS.map((r) => ({ value: r, label: t(`team.role.${r}`) }))} />
              <FieldSelect
                value={inviteJobRole ?? ""}
                onChange={(v) => setInviteJobRole((v || null) as CMJobRole | null)}
                placeholder={t("team.jobRolePlaceholder")}
                searchable
                allowCustom
                options={[{ value: "", label: t("team.jobRolePlaceholder") }, ...allJobRoles.map((r) => ({ value: r, label: jobRoleLabel(r, t) }))]}
              />
              <button onClick={handleCreateInvite} disabled={creatingInvite} className={`${smallBtn} shrink-0 disabled:opacity-40`} style={{ backgroundColor: "#ff5100", color: "#000" }}>
                {t("team.generateLink")}
              </button>
            </div>
            {activeInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/3 px-3 py-2">
                <span className="font-mono text-[10px] text-white/50 truncate">{t(`team.role.${inv.role}`)} — {inv.token.slice(0, 8)}…</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => copyInviteLink(inv.token, inv.id)} className={smallBtn} style={{ color: "#ff5100" }}>
                    {copiedId === inv.id ? t("team.copied") : t("team.copyLink")}
                  </button>
                  {canDelete && (
                    <button onClick={() => revokeCMProjectInvite(inv.id).then(invalidateInvites)}
                      className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Main settings view ──────────────────────────────── */
/** Rendered as the "Settings" tab of the Project Insight page — team/people
 *  management now lives in its own Insight "Team" tab (still the same
 *  PeopleSection component, just no longer duplicated here), so this is
 *  project configuration only: info, branding, consultants, locations,
 *  checklist. No header of its own since the Insight page already has one. */
type SettingsCategory =
  | "general" | "branding" | "peopleRoles" | "permissions"
  | "locations" | "disciplines" | "activeModules" | "consultants" | "checklist"
  | "workPackages" | "documentControl" | "workflows" | "formsTemplates"
  | "notifications" | "integrations" | "dataArchive";

/** Categories with no backing feature yet — shown as an honest placeholder
 *  rather than fabricated controls. Each is its own future project. */
const PLACEHOLDER_CATEGORIES: SettingsCategory[] = ["integrations"];

/** "companies" was removed from this project-level list — CompaniesSection
 *  is owner-scoped data (no projectId), so it lives only on the Global App
 *  Settings tab now, not duplicated here too. */
const CATEGORY_ORDER: SettingsCategory[] = [
  "general", "branding", "peopleRoles", "permissions",
  "locations", "disciplines", "activeModules", "consultants", "checklist",
  "workPackages", "documentControl", "workflows", "formsTemplates",
  "notifications", "integrations", "dataArchive",
];

function SettingsCategoryRow({ label, subtitle, onClick }: { label: string; subtitle?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[#0d0d0e] first:rounded-t-2xl last:rounded-b-2xl border-b border-white/6 last:border-b-0 text-left hover:bg-white/5 transition-colors">
      <div className="min-w-0">
        <p className="text-[13px] text-white/85">{label}</p>
        {subtitle && <p className="text-[10px] text-white/30 mt-0.5">{subtitle}</p>}
      </div>
      <span className="text-white/25 shrink-0">›</span>
    </button>
  );
}

export function ProjectSettingsView({ project, ownerId, currentUserId, onProjectChanged }: {
  project: CMProject; ownerId: string;
  /** The actually signed-in user viewing this screen — distinct from
   *  `ownerId` (the project's owner, used for data-scoping uploads/queries).
   *  Permission checks must resolve against whoever is really logged in,
   *  not the project owner, or a non-owner member would incorrectly get
   *  every permission via hasPermission's "tierRole === owner" shortcut. */
  currentUserId: string; onProjectChanged: () => void;
}) {
  const { t } = useCMLang();
  const [previewMonotone, setPreviewMonotone] = useState(false);
  const [category, setCategory] = useState<SettingsCategory | null>(null);
  const settingsCanCreate = usePermission(project.id, currentUserId, "settings", "create");
  const settingsCanEdit = usePermission(project.id, currentUserId, "settings", "edit");
  const settingsCanDelete = usePermission(project.id, currentUserId, "settings", "delete");

  if (category === null) {
    return (
      <div className="rounded-2xl overflow-hidden">
        {CATEGORY_ORDER.map((c) => (
          <SettingsCategoryRow key={c} label={t(`settingsNav.${c}`)}
            subtitle={PLACEHOLDER_CATEGORIES.includes(c) ? t("settingsNav.notBuiltYet") : undefined}
            onClick={() => setCategory(c)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => setCategory(null)} className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors self-start">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        <span className="text-[12px] font-mono uppercase tracking-widest">{t("projectSettings.title")}</span>
      </button>

      {category === "general" && <InfoSection project={project} canEdit={settingsCanEdit} onChanged={onProjectChanged} />}
      {category === "branding" && (
        <LogoSection project={project} ownerId={ownerId} canEdit={settingsCanEdit} onChanged={onProjectChanged} previewMonotone={previewMonotone} onTogglePreview={setPreviewMonotone} />
      )}
      {category === "peopleRoles" && (
        <Card title={t("settingsNav.peopleRoles")}>
          <p className="text-[12px] text-white/45">{t("settingsNav.peopleRolesHint")}</p>
        </Card>
      )}
      {category === "permissions" && (
        <Card title={t("settingsNav.permissions")}>
          <p className="text-[12px] text-white/45 mb-3">{t("settingsNav.permissionsHint")}</p>
          <Link to="/cm/role-permissions" className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>{t("rolePermissions.title")} →</Link>
        </Card>
      )}
      {category === "locations" && <LocationsSection projectId={project.id} canCreate={settingsCanCreate} canEdit={settingsCanEdit} canDelete={settingsCanDelete} />}
      {category === "disciplines" && <DisciplinesSection project={project} canEdit={settingsCanEdit} onChanged={onProjectChanged} />}
      {category === "activeModules" && <ActiveModulesSection project={project} canEdit={settingsCanEdit} onChanged={onProjectChanged} />}
      {category === "consultants" && (
        <ConsultantsSection ownerId={ownerId} projectId={project.id} previewMonotone={previewMonotone}
          canCreate={settingsCanCreate} canEdit={settingsCanEdit} canDelete={settingsCanDelete} />
      )}
      {category === "checklist" && <ChecklistSection ownerId={ownerId} projectId={project.id} canCreate={settingsCanCreate} canEdit={settingsCanEdit} canDelete={settingsCanDelete} />}
      {category === "workPackages" && (
        <WorkPackagesSection ownerId={ownerId} projectId={project.id} canCreate={settingsCanCreate} canEdit={settingsCanEdit} canDelete={settingsCanDelete} />
      )}
      {category === "documentControl" && <DocumentControlSection project={project} canEdit={settingsCanEdit} onChanged={onProjectChanged} />}
      {category === "workflows" && <WorkflowsSection ownerId={ownerId} projectId={project.id} canCreate={settingsCanCreate} canDelete={settingsCanDelete} />}
      {category === "formsTemplates" && (
        <TemplatesSection ownerId={ownerId} projectId={project.id} canCreate={settingsCanCreate} canEdit={settingsCanEdit} canDelete={settingsCanDelete} />
      )}
      {category === "notifications" && <NotificationsSection ownerId={ownerId} projectId={project.id} canCreate={settingsCanCreate} canDelete={settingsCanDelete} />}
      {category === "integrations" && <PlaceholderSection title={t("settingsNav.integrations")} description={t("settingsNav.integrationsHint")} />}
      {category === "dataArchive" && <DataArchiveSection project={project} canEdit={settingsCanEdit} onProjectChanged={onProjectChanged} />}
    </div>
  );
}
