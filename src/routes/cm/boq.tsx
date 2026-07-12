import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleHeader, Sheet, FAB, Card, ProjectPicker, useSelectedProject, inputCls, labelCls } from "@/components/cm/shared";
import {
  useCMBOQItems,
  createCMBOQItem,
  updateCMBOQItem,
  deleteCMBOQItem,
  useCMScheduleItems,
  type CMBOQItem,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/boq")({
  head: () => ({ meta: [{ title: "BOQ — Construction Management App" }] }),
  component: CMBoqPage,
});

function NewBoqItemSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMBOQItem(ownerId, projectId, {
        description: description.trim(), unit: unit.trim() || null,
        quantity: quantity ? Number(quantity) : 0, unit_cost: unitCost ? Number(unitCost) : 0,
        category: category.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add BOQ item");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("boq.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("boq.description")}</span>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus disabled={saving} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("boq.category")}</span>
          <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("boq.unit")}</span>
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("boq.qty")}</span>
            <input type="number" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("boq.unitCost")}</span>
            <input type="number" className={inputCls} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} disabled={saving} />
          </label>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !description.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("boq.adding") : t("boq.addItem")}
        </button>
      </form>
    </Sheet>
  );
}

function BoqItemRow({ item, onChanged }: { item: CMBOQItem; onChanged: () => void }) {
  const { t } = useCMLang();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitCost, setUnitCost] = useState(String(item.unit_cost));
  const [busy, setBusy] = useState(false);

  const commit = async (patch: Partial<CMBOQItem>) => {
    setBusy(true);
    try { await updateCMBOQItem(item.id, patch); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-white/80 truncate">{item.description}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <input type="number" min={0} value={quantity} disabled={busy}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => { const v = Number(quantity) || 0; if (v !== item.quantity) commit({ quantity: v }); }}
            className="w-16 bg-white/5 rounded-lg border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70 focus:outline-none focus:border-[#ff5100]/60" />
          <span className="font-mono text-[10px] text-white/30">{item.unit ?? ""} ×</span>
          <input type="number" min={0} value={unitCost} disabled={busy}
            onChange={(e) => setUnitCost(e.target.value)}
            onBlur={() => { const v = Number(unitCost) || 0; if (v !== item.unit_cost) commit({ unit_cost: v }); }}
            className="w-20 bg-white/5 rounded-lg border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70 focus:outline-none focus:border-[#ff5100]/60" />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-[11px]" style={{ color: "#ff5100" }}>
          {(item.quantity * item.unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <button onClick={() => { if (confirm(t("boq.confirmDelete"))) deleteCMBOQItem(item.id).then(onChanged); }} disabled={busy}
          className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      </div>
    </div>
  );
}

function CategorySection({ category, items, grandTotal, linkedCount, linkedAvgActual, onChanged }: {
  category: string; items: CMBOQItem[]; grandTotal: number; linkedCount: number; linkedAvgActual: number | null; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const ratio = grandTotal > 0 ? (subtotal / grandTotal) * 100 : 0;

  return (
    <Card title={category} action={<span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{ratio.toFixed(1)}% {t("boq.ratioOfTotal")}</span>}>
      <div className="flex flex-col gap-2">
        {items.map((item) => <BoqItemRow key={item.id} item={item} onChanged={onChanged} />)}
        <div className="flex items-center justify-between px-3 pt-2 border-t border-white/6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("boq.total")}</span>
          <span className="font-mono text-[13px] font-bold" style={{ color: "#ff5100" }}>{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
        {linkedCount > 0 && (
          <p className="font-mono text-[10px] text-white/30">
            {linkedCount} {t("boq.linkedActivities")}{linkedAvgActual != null ? ` — ${linkedAvgActual.toFixed(0)}% ${t("boq.avgComplete")}` : ""}
          </p>
        )}
      </div>
    </Card>
  );
}

function CMBoqPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMBOQItems(projectId || undefined);
  const { data: scheduleItems } = useCMScheduleItems(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_boq_items", projectId] }); setShowNew(false); };

  const grandTotal = useMemo(() => (items ?? []).reduce((s, i) => s + i.quantity * i.unit_cost, 0), [items]);

  const categories = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items ?? [];
    if (q) list = list.filter((i) => [i.description, i.category].some((f) => f?.toLowerCase().includes(q)));
    if (!sortAsc) list = [...list].reverse();
    const map = new Map<string, CMBOQItem[]>();
    for (const item of list) {
      const key = item.category ?? t("boq.uncategorized");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [items, search, sortAsc, t]);

  const linkedByCategory = useMemo(() => {
    const map = new Map<string, { count: number; avgActual: number }>();
    for (const s of scheduleItems ?? []) {
      if (!s.boq_category) continue;
      const entry = map.get(s.boq_category) ?? { count: 0, avgActual: 0 };
      entry.avgActual = (entry.avgActual * entry.count + s.actual_percent) / (entry.count + 1);
      entry.count += 1;
      map.set(s.boq_category, entry);
    }
    return map;
  }, [scheduleItems]);

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
        <ModuleHeader title={t("boq.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <p className="text-[12px] text-white/35 mb-5">{t("boq.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && categories.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("boq.nothingYet")}</p>
              </div>
            )}
            {!isLoading && categories.length > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-[#0d0d0e] px-5 py-4 mb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("boq.grandTotal")}</span>
                <span className="font-mono text-[15px] font-bold" style={{ color: "#ff5100" }}>{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {categories.map(([category, categoryItems]) => {
                const linked = linkedByCategory.get(category);
                return (
                  <CategorySection key={category} category={category} items={categoryItems} grandTotal={grandTotal}
                    linkedCount={linked?.count ?? 0} linkedAvgActual={linked?.avgActual ?? null} onChanged={invalidate} />
                );
              })}
            </div>
            <FAB label={t("boq.newBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewBoqItemSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}
    </div>
  );
}
