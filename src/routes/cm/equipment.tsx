import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import {
  ModuleHeader, Sheet, FAB, ProjectPicker, FieldSelect, useSelectedProject, inputCls, labelCls,
  EQUIPMENT_STATUS_OPTIONS, EQUIPMENT_STATUS_COLOR,
} from "@/components/cm/shared";
import {
  useCMEquipment,
  createCMEquipment,
  updateCMEquipment,
  deleteCMEquipment,
  type CMEquipment,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/equipment")({
  head: () => ({ meta: [{ title: "Equipment Record — Construction Management App" }] }),
  component: CMEquipmentPage,
});

function NewEquipmentSheet({ ownerId, projectId, onClose, onCreated }: {
  ownerId: string; projectId: string; onClose: () => void; onCreated: () => void;
}) {
  const { t } = useCMLang();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMEquipment(ownerId, projectId, { name: name.trim(), type: type.trim() || null, quantity: Number(quantity) || 1 });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add equipment");
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("equipment.new")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{t("equipment.name")}</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("equipment.type")}</span>
            <input className={inputCls} value={type} onChange={(e) => setType(e.target.value)} disabled={saving} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("equipment.qty")}</span>
            <input type="number" min={1} className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={saving} />
          </label>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !name.trim()}
          className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#ff5100" }}>
          {saving ? t("equipment.adding") : t("equipment.addItem")}
        </button>
      </form>
    </Sheet>
  );
}

function EquipmentRow({ eq, onChanged }: { eq: CMEquipment; onChanged: () => void }) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t("equipment.confirmDelete"))) return;
    setBusy(true);
    try { await deleteCMEquipment(eq.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[12px] text-white/80 truncate">{eq.name}{eq.type ? ` — ${eq.type}` : ""}</p>
        <p className="font-mono text-[10px] text-white/30">{t("equipment.qty")} {eq.quantity}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <FieldSelect
          value={eq.status}
          onChange={(v) => updateCMEquipment(eq.id, { status: v }).then(onChanged)}
          disabled={busy}
          options={EQUIPMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: t(`equipmentStatus.${s}`) }))}
          triggerClassName="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-white/5"
          triggerStyle={{ color: EQUIPMENT_STATUS_COLOR[eq.status] }}
        />
        <button onClick={handleDelete} disabled={busy} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      </div>
    </div>
  );
}

function CMEquipmentPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMEquipment(projectId || undefined);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ["cm_equipment", projectId] }); setShowNew(false); };

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items ?? [];
    if (q) list = list.filter((eq) => [eq.name, eq.type].some((f) => f?.toLowerCase().includes(q)));
    return sortAsc ? [...list].reverse() : list;
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
      <main className="max-w-md mx-auto w-full px-4 pb-28">
        <ModuleHeader title={t("equipment.title")} search={search} onSearchChange={setSearch} sortAsc={sortAsc} onToggleSort={setSortAsc} />
        <p className="text-[12px] text-white/35 mb-5">{t("equipment.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <>
            {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
            {!isLoading && visibleItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 flex items-center justify-center text-center px-4">
                <p className="text-white/40 text-sm">{t("equipment.nothingYet")}</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {visibleItems.map((eq) => <EquipmentRow key={eq.id} eq={eq} onChanged={invalidate} />)}
            </div>
            <FAB label={t("equipment.newBtn")} onClick={() => setShowNew(true)} />
          </>
        )}
      </main>

      {showNew && projectId && <NewEquipmentSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}
    </div>
  );
}
