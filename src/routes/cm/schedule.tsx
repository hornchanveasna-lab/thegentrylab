import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  ModuleHeader, Sheet, FAB, Card, ProjectPicker, FieldSelect, useSelectedProject, inputCls, labelCls,
} from "@/components/cm/shared";
import {
  useCMScheduleItems,
  createCMScheduleItem,
  updateCMScheduleItem,
  deleteCMScheduleItem,
  scheduleItemPlanPercent,
  useCMBOQItems,
  type CMScheduleItem,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Construction Management App" }] }),
  component: CMSchedulePage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function varianceColor(actual: number, plan: number): string {
  if (actual >= plan - 3) return "#34d399";
  if (actual >= plan - 10) return "#fbbf24";
  return "#f43f5e";
}

function NewActivitySheet({ ownerId, projectId, groupOptions, boqCategoryOptions, onClose, onCreated }: {
  ownerId: string; projectId: string; groupOptions: string[]; boqCategoryOptions: string[];
  onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [groupLabel, setGroupLabel] = useState("");
  const [title, setTitle] = useState("");
  const [boqCategory, setBoqCategory] = useState("");
  const [planStart, setPlanStart] = useState(today());
  const [planFinish, setPlanFinish] = useState(today());
  const [weight, setWeight] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupLabel.trim() || !title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMScheduleItem(ownerId, projectId, {
        group_label: groupLabel.trim(), title: title.trim(),
        boq_category: boqCategory || null,
        plan_start: planStart, plan_finish: planFinish,
        weight: Number(weight) || 1,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add activity");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("schedule.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("schedule.groupLabel")}</span>
          <input className={inputCls} list="schedule-group-options" value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} required autoFocus disabled={saving} />
          <datalist id="schedule-group-options">
            {groupOptions.map((g) => <option key={g} value={g} />)}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("schedule.activityTitle")}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("schedule.boqCategory")}</span>
          <FieldSelect
            value={boqCategory}
            onChange={setBoqCategory}
            disabled={saving}
            placeholder={t("projectSettings.none")}
            options={[{ value: "", label: t("projectSettings.none") }, ...boqCategoryOptions.map((c) => ({ value: c, label: c }))]}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("schedule.planStart")}</span>
            <input type="date" className={inputCls} value={planStart} onChange={(e) => setPlanStart(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("schedule.planFinish")}</span>
            <input type="date" className={inputCls} value={planFinish} onChange={(e) => setPlanFinish(e.target.value)} disabled={saving} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("schedule.weight")}</span>
          <input type="number" min={0} step="0.1" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} disabled={saving} />
        </label>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !groupLabel.trim() || !title.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("schedule.adding") : t("schedule.addActivity")}
        </button>
      </form>
    </Sheet>
  );
}

function ActivityRow({ item, canEdit, canDelete, onChanged }: { item: CMScheduleItem; canEdit: boolean; canDelete: boolean; onChanged: () => void }) {
  const { t } = useCMLang();
  const [actual, setActual] = useState(String(item.actual_percent));
  const [busy, setBusy] = useState(false);
  const plan = scheduleItemPlanPercent(item, today());

  const commitActual = async () => {
    const value = Math.max(0, Math.min(100, Number(actual) || 0));
    if (value === item.actual_percent) return;
    setBusy(true);
    try { await updateCMScheduleItem(item.id, { actual_percent: value }); onChanged(); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(t("schedule.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMScheduleItem(item.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-white/80 truncate">{item.title}</p>
        <p className="font-mono text-[10px] text-white/30">{item.plan_start} → {item.plan_finish}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-[10px] text-white/35">{t("schedule.planPct")} {plan.toFixed(0)}%</p>
        <div className="flex items-center gap-1 mt-0.5">
          {canEdit ? (
            <input type="number" min={0} max={100} value={actual} disabled={busy}
              onChange={(e) => setActual(e.target.value)} onBlur={commitActual}
              className="w-14 text-right bg-white/5 rounded-lg border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white focus:outline-none focus:border-[#ff5100]/60" />
          ) : (
            <span className="font-mono text-[11px] text-white">{item.actual_percent}</span>
          )}
          <span className="font-mono text-[11px]" style={{ color: varianceColor(Number(actual) || 0, plan) }}>%</span>
        </div>
      </div>
      {canDelete && (
        <button onClick={handleDelete} disabled={busy} className="text-white/25 hover:text-red-400 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      )}
    </div>
  );
}

function GroupSection({ groupLabel, items, canEdit, canDelete, onChanged }: {
  groupLabel: string; items: CMScheduleItem[]; canEdit: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
  const groupPlan = items.reduce((s, i) => s + i.weight * scheduleItemPlanPercent(i, today()), 0) / totalWeight;
  const groupActual = items.reduce((s, i) => s + i.weight * i.actual_percent, 0) / totalWeight;

  return (
    <Card title={groupLabel} action={
      <span className="font-mono text-[10px]" style={{ color: varianceColor(groupActual, groupPlan) }}>
        {groupActual.toFixed(0)}% / {groupPlan.toFixed(0)}%
      </span>
    }>
      <div className="flex flex-col gap-2">
        {items.map((item) => <ActivityRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} onChanged={onChanged} />)}
      </div>
    </Card>
  );
}

function CMSchedulePage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMScheduleItems(projectId || undefined);
  const { data: boqItems } = useCMBOQItems(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "schedule", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "schedule", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "schedule", "delete");
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_schedule_items", projectId] }); setShowNew(false); };

  const groupOptions = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.group_label))), [items]);
  const boqCategoryOptions = useMemo(
    () => Array.from(new Set((boqItems ?? []).map((b) => b.category).filter((c): c is string => !!c))),
    [boqItems],
  );

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items ?? [];
    if (q) list = list.filter((i) => [i.title, i.group_label].some((f) => f.toLowerCase().includes(q)));
    if (!sortAsc) list = [...list].reverse();
    const map = new Map<string, CMScheduleItem[]>();
    for (const item of list) {
      if (!map.has(item.group_label)) map.set(item.group_label, []);
      map.get(item.group_label)!.push(item);
    }
    return Array.from(map.entries());
  }, [items, search, sortAsc]);

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
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("schedule.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <p className="text-[12px] text-white/35 mb-5">{t("schedule.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && groups.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("schedule.nothingYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {groups.map(([groupLabel, groupItems]) => (
                <GroupSection key={groupLabel} groupLabel={groupLabel} items={groupItems} canEdit={canEdit} canDelete={canDelete} onChanged={invalidate} />
              ))}
            </div>
            {canCreate && <FAB label={t("schedule.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && canCreate && (
        <NewActivitySheet ownerId={user.id} projectId={projectId} groupOptions={groupOptions} boqCategoryOptions={boqCategoryOptions}
          onClose={() => setShowNew(false)} onCreated={invalidate} />
      )}
    </div>
  );
}
