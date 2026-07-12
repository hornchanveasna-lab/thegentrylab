import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  ModuleHeader, Sheet, FAB, PhotoPicker, ProjectPicker, FieldSelect, RepeatingRows, useSelectedProject, inputCls, labelCls,
  PhotoLightbox, usePendingHighlight,
} from "@/components/cm/shared";
import {
  useCMDailyLogs,
  createCMDailyLog,
  updateCMDailyLog,
  deleteCMDailyLog,
  uploadCMPhotoWithThumb,
  type CMDailyLog,
  type CMManpowerRow,
  type CMDeliveryRow,
  type CMVisitorRow,
  type CMVisitorKind,
  type CMDelayRow,
  type CMDelayCause,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/site-diary")({
  head: () => ({ meta: [{ title: "Site Diary — Construction Management App" }] }),
  component: CMSiteDiaryPage,
});

const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Heavy Rain", "Storm"];
const VISITOR_KIND_OPTIONS: CMVisitorKind[] = ["visitor", "instruction"];
const DELAY_CAUSE_OPTIONS: CMDelayCause[] = ["Weather", "Material", "Labor", "Other"];

const EMPTY_MANPOWER: CMManpowerRow = { trade: "", company: null, count: 0 };
const EMPTY_DELIVERY: CMDeliveryRow = { material: "", quantity: "", unit: null, supplier: null };
const EMPTY_VISITOR: CMVisitorRow = { name: "", organization: null, kind: "visitor", note: "" };
const EMPTY_DELAY: CMDelayRow = { cause: "Weather", description: "", hours_lost: 0 };

function totalManpower(rows: CMManpowerRow[]) {
  return rows.reduce((sum, r) => sum + (r.count || 0), 0);
}

function NewLogSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState(WEATHER_OPTIONS[0]);
  const [temperature, setTemperature] = useState("");
  const [progressPct, setProgressPct] = useState("");
  const [activities, setActivities] = useState("");
  const [materials, setMaterials] = useState("");
  const [equipment, setEquipment] = useState("");
  const [issues, setIssues] = useState("");
  const [notes, setNotes] = useState("");
  const [manpower, setManpower] = useState<CMManpowerRow[]>([]);
  const [deliveries, setDeliveries] = useState<CMDeliveryRow[]>([]);
  const [visitors, setVisitors] = useState<CMVisitorRow[]>([]);
  const [delays, setDelays] = useState<CMDelayRow[]>([]);
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
        progress_pct: progressPct ? Number(progressPct) : null,
        activities: activities.trim() || null,
        materials_used: materials.trim() || null,
        equipment_used: equipment.trim() || null,
        issues: issues.trim() || null,
        notes: notes.trim() || null,
        manpower: manpower.filter((r) => r.trade.trim()),
        deliveries: deliveries.filter((r) => r.material.trim()),
        visitors: visitors.filter((r) => r.name.trim()),
        delays: delays.filter((r) => r.description.trim()),
      });
      if (photos.length > 0) {
        const uploaded = await Promise.all(photos.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
        await updateCMDailyLog(log.id, { photos: uploaded.map((u) => u.url), photo_thumbs: uploaded.map((u) => u.thumbUrl) });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save diary entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("siteDiary.newEntry")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.date")}</span>
            <input type="date" className={inputCls} value={logDate} onChange={(e) => setLogDate(e.target.value)} required disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.progressPct")}</span>
            <input type="number" min={0} max={100} className={inputCls} value={progressPct} onChange={(e) => setProgressPct(e.target.value)} disabled={saving} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.weather")}</span>
            <FieldSelect value={weather} onChange={setWeather} disabled={saving} options={WEATHER_OPTIONS.map((w) => ({ value: w, label: t(`weather.${w}`) }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.tempC")}</span>
            <input type="number" className={inputCls} value={temperature} onChange={(e) => setTemperature(e.target.value)} disabled={saving} />
          </label>
        </div>

        <RepeatingRows
          label={`${t("siteDiary.manpower")} (${t("siteDiary.total")}: ${totalManpower(manpower)})`}
          addLabel={t("siteDiary.addManpower")}
          rows={manpower}
          onChange={setManpower}
          emptyRow={EMPTY_MANPOWER}
          renderRow={(row, update) => (
            <div className="grid grid-cols-3 gap-2">
              <input className={inputCls} placeholder={t("siteDiary.trade")} value={row.trade} onChange={(e) => update({ trade: e.target.value })} disabled={saving} />
              <input className={inputCls} placeholder={t("siteDiary.company")} value={row.company ?? ""} onChange={(e) => update({ company: e.target.value || null })} disabled={saving} />
              <input type="number" min={0} className={inputCls} placeholder={t("siteDiary.headcount")} value={row.count || ""} onChange={(e) => update({ count: Number(e.target.value) || 0 })} disabled={saving} />
            </div>
          )}
        />

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.activities")}</span>
          <textarea className={`${inputCls} resize-y min-h-[56px]`} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder={t("siteDiary.activitiesPlaceholder")} disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.materialsUsed")}</span>
            <textarea className={`${inputCls} resize-y min-h-[48px]`} value={materials} onChange={(e) => setMaterials(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("siteDiary.equipmentUsed")}</span>
            <textarea className={`${inputCls} resize-y min-h-[48px]`} value={equipment} onChange={(e) => setEquipment(e.target.value)} disabled={saving} />
          </label>
        </div>
        <RepeatingRows
          label={t("siteDiary.deliveries")}
          addLabel={t("siteDiary.addDelivery")}
          rows={deliveries}
          onChange={setDeliveries}
          emptyRow={EMPTY_DELIVERY}
          renderRow={(row, update) => (
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder={t("siteDiary.material")} value={row.material} onChange={(e) => update({ material: e.target.value })} disabled={saving} />
              <div className="flex gap-2">
                <input className={inputCls} placeholder={t("siteDiary.quantity")} value={row.quantity} onChange={(e) => update({ quantity: e.target.value })} disabled={saving} />
                <input className={inputCls} placeholder={t("siteDiary.unit")} value={row.unit ?? ""} onChange={(e) => update({ unit: e.target.value || null })} disabled={saving} />
              </div>
              <input className={`${inputCls} col-span-2`} placeholder={t("siteDiary.supplier")} value={row.supplier ?? ""} onChange={(e) => update({ supplier: e.target.value || null })} disabled={saving} />
            </div>
          )}
        />

        <RepeatingRows
          label={t("siteDiary.visitors")}
          addLabel={t("siteDiary.addVisitor")}
          rows={visitors}
          onChange={setVisitors}
          emptyRow={EMPTY_VISITOR}
          renderRow={(row, update) => (
            <div className="flex flex-col gap-2">
              <FieldSelect value={row.kind} onChange={(v) => update({ kind: v })} disabled={saving}
                options={VISITOR_KIND_OPTIONS.map((k) => ({ value: k, label: t(`siteDiary.visitorKind.${k}`) }))} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder={t("siteDiary.visitorName")} value={row.name} onChange={(e) => update({ name: e.target.value })} disabled={saving} />
                <input className={inputCls} placeholder={t("siteDiary.organization")} value={row.organization ?? ""} onChange={(e) => update({ organization: e.target.value || null })} disabled={saving} />
              </div>
              <textarea className={`${inputCls} resize-y min-h-[40px]`} placeholder={t("siteDiary.note")} value={row.note} onChange={(e) => update({ note: e.target.value })} disabled={saving} />
            </div>
          )}
        />

        <RepeatingRows
          label={t("siteDiary.delays")}
          addLabel={t("siteDiary.addDelay")}
          rows={delays}
          onChange={setDelays}
          emptyRow={EMPTY_DELAY}
          renderRow={(row, update) => (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <FieldSelect value={row.cause} onChange={(v) => update({ cause: v })} disabled={saving}
                  options={DELAY_CAUSE_OPTIONS.map((c) => ({ value: c, label: t(`siteDiary.delayCause.${c}`) }))} />
                <input type="number" min={0} step="0.5" className={inputCls} placeholder={t("siteDiary.hoursLost")} value={row.hours_lost || ""} onChange={(e) => update({ hours_lost: Number(e.target.value) || 0 })} disabled={saving} />
              </div>
              <textarea className={`${inputCls} resize-y min-h-[40px]`} placeholder={t("siteDiary.description")} value={row.description} onChange={(e) => update({ description: e.target.value })} disabled={saving} />
            </div>
          )}
        />

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.issues")}</span>
          <textarea className={`${inputCls} resize-y min-h-[48px]`} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder={t("siteDiary.issuesPlaceholder")} disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("siteDiary.notes")}</span>
          <textarea className={`${inputCls} resize-y min-h-[40px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
        </label>
        <PhotoPicker photos={photos} setPhotos={setPhotos} disabled={saving} />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("siteDiary.saving") : t("siteDiary.saveEntry")}
        </button>
      </form>
    </Sheet>
  );
}

type LightboxItem = { url: string; thumbUrl: string };

function LogCard({ log, onChanged, onOpenPhoto }: { log: CMDailyLog; onChanged: () => void; onOpenPhoto: (items: LightboxItem[], index: number) => void }) {
  const { t } = useCMLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ref, flash, matchedPhotoUrl } = usePendingHighlight("siteDiary", log.id, () => setOpen(true));

  const handleDelete = async () => {
    if (!confirm(t("siteDiary.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMDailyLog(log.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div ref={ref} className={`rounded-2xl bg-[#0d0d0e] overflow-hidden transition-shadow duration-500 ${flash ? "ring-2 ring-[#ff5100]" : ""}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-[12px] text-white/70 shrink-0">{log.log_date}</span>
          {log.weather && <span className="font-mono text-[10px] uppercase tracking-widest text-white/35 shrink-0">{t(`weather.${log.weather}`)}</span>}
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
            {log.temperature_c != null && <Field label={t("siteDiary.temperature")} value={`${log.temperature_c}°C`} />}
            {log.manpower.length > 0 && <Field label={t("siteDiary.workforceField")} value={String(totalManpower(log.manpower))} />}
          </div>
          {log.manpower.length > 0 && (
            <Field label={t("siteDiary.manpower")} value={log.manpower.map((m) => `${m.company ? `${m.company} — ` : ""}${m.trade}: ${m.count}`).join(", ")} />
          )}
          {log.materials_used && <Field label={t("siteDiary.materialsUsed")} value={log.materials_used} />}
          {log.equipment_used && <Field label={t("siteDiary.equipmentUsed")} value={log.equipment_used} />}
          {log.deliveries.length > 0 && (
            <Field label={t("siteDiary.deliveries")} value={log.deliveries.map((d) => `${d.material} (${d.quantity}${d.unit ? ` ${d.unit}` : ""})${d.supplier ? ` — ${d.supplier}` : ""}`).join("; ")} />
          )}
          {log.visitors.length > 0 && (
            <Field label={t("siteDiary.visitors")} value={log.visitors.map((v) => `[${t(`siteDiary.visitorKind.${v.kind}`)}] ${v.name}${v.organization ? ` (${v.organization})` : ""}${v.note ? `: ${v.note}` : ""}`).join("; ")} />
          )}
          {log.delays.length > 0 && (
            <Field label={t("siteDiary.delays")} value={log.delays.map((d) => `${t(`siteDiary.delayCause.${d.cause}`)} — ${d.description} (${d.hours_lost}h)`).join("; ")} accent="#f43f5e" />
          )}
          {log.issues && <Field label={t("siteDiary.issues")} value={log.issues} accent="#f43f5e" />}
          {log.notes && <Field label={t("siteDiary.notes")} value={log.notes} />}
          {log.photos.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">{t("common.photos")}</p>
              <div className="flex flex-wrap gap-2">
                {log.photos.map((url, i) => (
                  <button key={url} type="button" data-photo-url={url}
                    onClick={() => onOpenPhoto(log.photos.map((u, idx) => ({ url: u, thumbUrl: log.photo_thumbs[idx] || u })), i)}
                    className={`rounded-xl transition-shadow duration-500 ${matchedPhotoUrl === url && flash ? "ring-2 ring-[#ff5100]" : ""}`}>
                    <img src={log.photo_thumbs[i] || url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleDelete} disabled={busy} className="self-start font-mono text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors">
            {t("siteDiary.deleteEntry")}
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

function CMSiteDiaryPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: logs, isLoading } = useCMDailyLogs(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_daily_logs", projectId] }); setShowNew(false); };

  const visibleLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = logs ?? [];
    if (q) {
      list = list.filter((l) =>
        [l.activities, l.notes, l.materials_used, l.equipment_used, l.issues].some((f) => f?.toLowerCase().includes(q)));
    }
    return sortAsc ? [...list].reverse() : list;
  }, [logs, search, sortAsc]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>{t("common.signInGoogle")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("siteDiary.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && visibleLogs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("siteDiary.noneYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {visibleLogs.map((l) => <LogCard key={l.id} log={l} onChanged={invalidate} onOpenPhoto={(items, index) => setLightbox({ items, index })} />)}
            </div>
            <FAB label={t("siteDiary.newEntryBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewLogSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}

      {lightbox && (
        <PhotoLightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((lb) => lb && { ...lb, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
