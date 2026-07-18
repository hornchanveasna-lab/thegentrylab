import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  BackButton, Sheet, FAB, ProjectPicker, SegmentedField, FieldSelect, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, moduleDetailRoute, MODULE_COLOR, MODULE_ICON, setPendingHighlight, useLongPress, sharePhotoFiles, WeekCalendarStrip,
  ConfirmationDialog, useClickOutside,
} from "@/components/cm/shared";
import {
  useAllCMPhotos,
  useCMAccountSettings,
  useCMProjectConsultants,
  stampPhoto,
  uploadCMPhotoWithThumb,
  deleteCMPhoto,
  findOrCreateCMDailyLog,
  updateCMDailyLog,
  createCMInspection,
  updateCMInspection,
  createCMTask,
  updateCMTask,
  createCMSafetyRecord,
  updateCMSafetyRecord,
  createCMSubmittal,
  updateCMSubmittal,
  useActiveCMBOQItems,
  createCMPhotoBoqTag,
  type CMPhotoModule,
  type CMPhotoWithContext,
  type CMProject,
} from "@/lib/cm-data";

interface CMPhotosSearch { new?: boolean }

export const Route = createFileRoute("/cm/photos")({
  head: () => ({ meta: [{ title: "Photos — Construction Management App" }] }),
  validateSearch: (search: Record<string, unknown>): CMPhotosSearch => ({
    new: search.new === true || search.new === "1" || search.new === "true" ? true : undefined,
  }),
  component: CMPhotosPage,
});

const MODULE_OPTIONS: CMPhotoModule[] = ["siteDiary", "inspection", "punchList", "safety", "submittal"];
type GroupBy = "date" | "project" | "type";
const GROUP_OPTIONS: GroupBy[] = ["date", "project", "type"];

const GROUP_ICON: Record<GroupBy, React.ReactNode> = {
  date: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" />
    </svg>
  ),
  project: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" />
    </svg>
  ),
  type: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12.5L12.5 20 4 11.5V4h7.5L20 12.5z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function NewPhotoSheet({ ownerId, projects, projectId, setProjectId, companyLogoUrl, showCompanyLogo, showProjectInfo, showConsultantLogos, monotoneLogos, timestamp, onClose, onCreated }: {
  ownerId: string;
  projects: CMProject[];
  projectId: string;
  setProjectId: (id: string) => void;
  companyLogoUrl: string | null;
  showCompanyLogo: boolean;
  showProjectInfo: boolean;
  showConsultantLogos: boolean;
  monotoneLogos: boolean;
  timestamp: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useCMLang();
  const { data: consultants } = useCMProjectConsultants(projectId);
  const { data: boqItems } = useActiveCMBOQItems(projectId);
  const [files, setFiles] = useState<File[]>([]);
  const [boqTags, setBoqTags] = useState<Map<File, string>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(true);
  const [moduleSel, setModuleSel] = useState<CMPhotoModule>(MODULE_OPTIONS[0]);
  const [photoDate, setPhotoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setPickerOpen(false);
  };
  const removeFile = (f: File) => {
    setFiles((prev) => prev.filter((x) => x !== f));
    setBoqTags((prev) => { const next = new Map(prev); next.delete(f); return next; });
  };

  const canSave = files.length > 0 && !!projectId && !saving;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const project = projects.find((p) => p.id === projectId);
      const stampOpts = {
        showCompanyLogo, showProjectInfo, showConsultantLogos, monotoneLogos, timestamp,
        companyLogoUrl,
        clientLogoUrl: project?.client_logo_url ?? null,
        consultantLogoUrls: (consultants ?? []).map((c) => c.logo_url).filter((u): u is string => !!u),
        projectName: project?.name ?? null,
        projectCode: project?.project_code ?? null,
        location: project?.location ?? null,
      };
      const stamped = await Promise.all(files.map((f) => stampPhoto(f, stampOpts)));
      const uploaded = await Promise.all(stamped.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
      const urls = uploaded.map((u) => u.url);
      const thumbs = uploaded.map((u) => u.thumbUrl);
      const title = caption.trim() || `${t(`tile.${moduleSel}`)} — ${photoDate}`;

      if (moduleSel === "siteDiary") {
        const log = await findOrCreateCMDailyLog(ownerId, projectId, photoDate, { notes: caption.trim() || null });
        await updateCMDailyLog(log.id, {
          photos: [...log.photos, ...urls],
          photo_thumbs: [...log.photo_thumbs, ...thumbs],
        });
      } else if (moduleSel === "inspection") {
        const item = await createCMInspection(ownerId, projectId, { title, status: "Scheduled", inspection_date: photoDate });
        await updateCMInspection(item.id, { photos: urls, photo_thumbs: thumbs });
      } else if (moduleSel === "punchList") {
        const item = await createCMTask(ownerId, projectId, { title, status: "To Do", priority: "Medium", due_date: photoDate });
        await updateCMTask(item.id, { photos: urls, photo_thumbs: thumbs });
      } else if (moduleSel === "safety") {
        const item = await createCMSafetyRecord(ownerId, projectId, { title, record_type: "Safety Observation", severity: "Low", record_date: photoDate });
        await updateCMSafetyRecord(item.id, { photos: urls, photo_thumbs: thumbs });
      } else if (moduleSel === "submittal") {
        const item = await createCMSubmittal(ownerId, projectId, { title, status: "Draft", submitted_date: photoDate });
        await updateCMSubmittal(item.id, { photos: urls, photo_thumbs: thumbs });
      }
      const tagged = files.map((f, i) => ({ url: urls[i], boqItemId: boqTags.get(f) })).filter((t): t is { url: string; boqItemId: string } => !!t.boqItemId);
      if (tagged.length > 0) {
        await Promise.all(tagged.map((t) => createCMPhotoBoqTag(ownerId, projectId, t.boqItemId, t.url)));
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save photo");
      setSaving(false);
    }
  };

  if (files.length === 0 || pickerOpen) {
    return (
      <Sheet title={t("photos.capture")} onClose={onClose}>
        <div className="px-6 pb-8 pt-4 flex flex-col gap-3">
          {files.length > 0 && (
            <button type="button" onClick={() => setPickerOpen(false)}
              className="self-start font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors mb-1">
              ← {t("photos.backToReview", { count: String(files.length) })}
            </button>
          )}
          <label className="relative flex flex-col items-center justify-center gap-3 py-10 rounded-3xl text-black cursor-pointer text-center transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "#ff5100" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </svg>
            <span className="text-[13px] font-bold uppercase tracking-widest">{t("photos.takePhoto")}</span>
            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="relative flex flex-col items-center justify-center gap-3 py-10 rounded-3xl text-white/70 bg-white/5 hover:bg-white/10 cursor-pointer text-center transition-colors">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L4 20" />
            </svg>
            <span className="text-[13px] font-bold uppercase tracking-widest">{t("photos.chooseLibrary")}</span>
            <input type="file" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t("photos.capture")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          {files.map((f, i) => (
            <div key={i} className="flex flex-col gap-1 w-20">
              <div className="relative w-20 h-20">
                <img src={URL.createObjectURL(f)} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <button type="button" onClick={() => removeFile(f)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
              </div>
              {!!projectId && (boqItems ?? []).length > 0 && (
                <FieldSelect
                  value={boqTags.get(f) ?? ""}
                  onChange={(id) => setBoqTags((prev) => { const next = new Map(prev); if (id) next.set(f, id); else next.delete(f); return next; })}
                  placeholder={t("photos.tagBoq")}
                  searchable
                  searchPlaceholder={t("photos.searchBoq")}
                  disabled={saving}
                  triggerClassName="w-20 flex items-center justify-between gap-1 bg-white/5 rounded-lg border border-white/10 px-1.5 py-1 text-[9px] text-white/60 disabled:opacity-40"
                  menuClassName="left-0 w-56"
                  options={[{ value: "", label: t("photos.tagBoq") }, ...(boqItems ?? []).map((b) => ({ value: b.id, label: b.description }))]}
                />
              )}
            </div>
          ))}
          <button type="button" disabled={saving} onClick={() => setPickerOpen(true)}
            className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-white/40 hover:border-white/40 hover:text-white/60 transition-colors disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("photos.forWhat")}</span>
          <SegmentedField
            options={MODULE_OPTIONS.map((m) => ({ value: m, label: t(`tile.${m}`) }))}
            value={moduleSel}
            onChange={setModuleSel}
            disabled={saving}
          />
        </div>

        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.date")}</span>
          <input type="date" className={inputCls} value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} disabled={saving} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("photos.note")}</span>
          <input className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("photos.notePlaceholder")} disabled={saving} />
        </label>

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={!canSave}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("photos.savingPhoto") : t("photos.savePhoto", { count: String(files.length) })}
        </button>
      </div>
    </Sheet>
  );
}

function dateLabel(date: string, t: (k: string) => string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return t("photos.today");
  if (date === yesterday) return t("photos.yesterday");
  return date;
}

function CMPhotosPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t, lang } = useCMLang();
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: photos, isLoading } = useAllCMPhotos(user?.id);
  const { data: account } = useCMAccountSettings(user?.id);
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | CMPhotoModule>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const groupMenuRef = useClickOutside<HTMLDivElement>(groupMenuOpen, () => setGroupMenuOpen(false));
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: CMPhotoWithContext[]; index: number } | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (routeSearch.new && projectId) {
      setShowNew(true);
      navigate({ to: "/cm/photos", search: {}, replace: true });
    }
  }, [routeSearch.new, projectId, navigate]);

  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const selectMode = selectedUrls.size > 0;
  const bindLongPress = useLongPress();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_all_photos", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] });
    setShowNew(false);
  };

  const toggleSelected = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const handleShareSelected = async () => {
    const urls = filtered.filter((p) => selectedUrls.has(p.url)).map((p) => p.url);
    setSelectedUrls(new Set());
    const result = await sharePhotoFiles(urls);
    if (result === "failed") window.alert(t("photos.shareFailed"));
  };

  const handleDeleteSelected = async () => {
    setConfirmingBulkDelete(false);
    const targets = filtered.filter((p) => selectedUrls.has(p.url));
    setSelectedUrls(new Set());
    try {
      await Promise.all(targets.map((p) => deleteCMPhoto(p.module, p.recordId, p.url)));
    } finally {
      queryClient.invalidateQueries({ queryKey: ["cm_all_photos", user?.id] });
    }
  };

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    (photos ?? []).forEach((p) => map.set(p.projectId, p.projectName));
    return Array.from(map.entries());
  }, [photos]);

  const searchQuery = search.trim().toLowerCase();
  const filtered = (photos ?? []).filter((p) =>
    (projectFilter === "all" || p.projectId === projectFilter) &&
    (typeFilter === "all" || p.module === typeFilter) &&
    (!dateFilter || p.date === dateFilter) &&
    (!searchQuery || [p.caption, p.projectName].some((f) => f?.toLowerCase().includes(searchQuery))));

  const filterSubtitle = useMemo(() => {
    const parts: string[] = [];
    if (projectFilter !== "all") {
      const name = projectOptions.find(([id]) => id === projectFilter)?.[1];
      if (name) parts.push(name);
    }
    if (typeFilter !== "all") parts.push(t(`tile.${typeFilter}`));
    if (parts.length === 0) return t("photos.photoCount", { count: String(filtered.length) });
    return parts.join(" · ");
  }, [projectFilter, typeFilter, projectOptions, filtered.length, t]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: CMPhotoWithContext[] }>();
    for (const p of filtered) {
      const key = groupBy === "date" ? p.date : groupBy === "project" ? p.projectId : p.module;
      const label = groupBy === "date" ? dateLabel(p.date, t) : groupBy === "project" ? p.projectName : t(`tile.${p.module}`);
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values());
  }, [filtered, groupBy, t]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;

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

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <div className="sticky top-0 z-30 bg-[#0a0a0b] pt-6 pb-4 flex items-center gap-3">
          <BackButton to="/cm" />
          {showSearch ? (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="flex-1 min-w-0 bg-white/5 rounded-xl border border-white/10 px-3.5 py-2 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors"
            />
          ) : (
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-white truncate">{t("photos.title")}</h1>
              <p className="text-[11px] text-white/40 truncate">{filterSubtitle}</p>
            </div>
          )}
          <button type="button" aria-label={t("common.search")}
            onClick={() => setShowSearch((v) => { const next = !v; if (!next) setSearch(""); return next; })}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white shrink-0">
            {showSearch ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            )}
          </button>
          <Link to="/cm/photos/settings" aria-label={t("photos.settingsTitle")}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {projectOptions.length > 1 && (
            <FieldSelect
              className="flex-1 min-w-[120px]"
              triggerClassName="w-full flex items-center justify-between gap-2 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white transition-colors"
              value={projectFilter}
              onChange={setProjectFilter}
              options={[{ value: "all", label: t("photos.allProjects") }, ...projectOptions.map(([id, name]) => ({ value: id, label: name }))]}
            />
          )}
          <FieldSelect
            className="flex-1 min-w-[120px]"
            triggerClassName="w-full flex items-center justify-between gap-2 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-[12px] text-white transition-colors"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as "all" | CMPhotoModule)}
            options={[{ value: "all", label: t("photos.allTypes") }, ...MODULE_OPTIONS.map((m) => ({ value: m, label: t(`tile.${m}`) }))]}
          />
        </div>

        <WeekCalendarStrip items={filtered} dateOf={(p) => p.date} lang={lang} selected={dateFilter} onSelect={setDateFilter} />

        {dateFilter && (
          <button onClick={() => setDateFilter(null)} aria-label={t("common.clearFilter")}
            className="self-start mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>
            {dateFilter} <span className="text-[13px] leading-none">×</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2 mb-5">
          <div ref={groupMenuRef} className="relative inline-block">
            <button onClick={() => setGroupMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white/75 hover:text-white transition-colors">
              {GROUP_ICON[groupBy]}
              <span className="text-[12px] font-medium">{t(`photos.group${groupBy === "date" ? "Date" : groupBy === "project" ? "Project" : "Type"}`)}</span>
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="transition-transform" style={{ transform: groupMenuOpen ? "rotate(180deg)" : "none" }}>
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {groupMenuOpen && (
              <div className="absolute left-0 top-11 z-20 w-48 rounded-2xl bg-[#0d0d0e] border border-white/10 overflow-hidden shadow-xl">
                {GROUP_OPTIONS.map((g) => (
                  <button key={g} onClick={() => { setGroupBy(g); setGroupMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/6 last:border-b-0">
                    <span className="text-white/50 shrink-0">{GROUP_ICON[g]}</span>
                    <span className="flex-1 text-[13px] text-white/85">{t(`photos.group${g === "date" ? "Date" : g === "project" ? "Project" : "Type"}`)}</span>
                    {groupBy === g && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M4 12.5l5 5L20 6" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
        {!isLoading && filtered.length === 0 && <p className="text-white/30 text-sm">{t("photos.noneYet")}</p>}

        <div className="flex flex-col gap-6">
            {groups.map((group, gi) => (
              <div key={gi}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-2.5">{group.label}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-0.5 rounded-t-2xl overflow-hidden">
                  {group.items.map((p, i) => {
                    const checked = selectedUrls.has(p.url);
                    return (
                      <button key={`${p.url}-${i}`} {...bindLongPress(`${p.url}-${i}`, () => toggleSelected(p.url))}
                        onClick={() => selectMode ? toggleSelected(p.url) : setLightbox({ items: filtered, index: filtered.indexOf(p) })}
                        className="relative aspect-square group">
                        <img src={p.thumbUrl} alt="" className={`w-full h-full object-cover transition-opacity ${checked ? "opacity-60" : ""}`} />
                        {selectMode ? (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2"
                            style={{ backgroundColor: checked ? "#ff5100" : "rgba(0,0,0,0.4)", borderColor: checked ? "#ff5100" : "rgba(255,255,255,0.7)" }}>
                            {checked && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12.5l5 5L20 6" />
                              </svg>
                            )}
                          </span>
                        ) : (
                          <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-black/60" style={{ color: MODULE_COLOR[p.module] }}>
                            {MODULE_ICON[p.module]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        {!selectMode && <FAB label={t("photos.newBtn")} onClick={() => setShowNew(true)} />}
      </main>

      {showNew && (
        <NewPhotoSheet
          ownerId={user.id}
          projects={projects}
          projectId={projectId}
          setProjectId={setProjectId}
          companyLogoUrl={account?.company_logo_url ?? null}
          showCompanyLogo={account?.photo_show_company_logo ?? true}
          showProjectInfo={account?.photo_show_project_info ?? true}
          showConsultantLogos={account?.photo_show_consultant_logos ?? true}
          monotoneLogos={account?.photo_monotone_logos ?? false}
          timestamp={account?.photo_timestamp ?? true}
          onClose={() => setShowNew(false)}
          onCreated={invalidate}
        />
      )}

      {lightbox && (
        <PhotoLightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((lb) => lb && { ...lb, index })}
          onClose={() => setLightbox(null)}
          onShowInReport={(item) => {
            if (!item.module || !item.recordId || !item.projectId) return;
            setPendingHighlight(item.module, item.recordId, item.projectId, item.url);
            setLightbox(null);
            navigate(moduleDetailRoute(item.module, item.recordId));
          }}
          onDelete={async (item) => {
            if (!item.module || !item.recordId) return;
            try {
              await deleteCMPhoto(item.module, item.recordId, item.url);
              queryClient.invalidateQueries({ queryKey: ["cm_all_photos", user?.id] });
              setLightbox(null);
            } catch {
              window.alert(t("photos.deleteFailed"));
            }
          }}
        />
      )}

      {selectMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[#0d0d0e] border-t border-white/10">
          <button onClick={() => setSelectedUrls(new Set())} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
          <span className="text-[12px] text-white/60 flex-1 text-center">{t("photos.selectedCount", { count: String(selectedUrls.size) })}</span>
          <button onClick={handleShareSelected} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/85 hover:text-white transition-colors shrink-0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" />
            </svg>
          </button>
          <button onClick={() => setConfirmingBulkDelete(true)} className="w-9 h-9 rounded-full flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors shrink-0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
            </svg>
          </button>
        </div>
      )}
      {confirmingBulkDelete && (
        <ConfirmationDialog message={t("photos.deleteConfirm")} confirmLabel={t("common.delete")}
          onConfirm={handleDeleteSelected} onCancel={() => setConfirmingBulkDelete(false)} />
      )}
    </div>
  );
}
