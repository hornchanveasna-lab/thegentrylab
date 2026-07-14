import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import { ModuleHeader, Sheet, FAB, Card, ProjectPicker, FieldSelect, useSelectedProject, inputCls, labelCls, ConfirmationDialog } from "@/components/cm/shared";
import {
  useCMBOQItems,
  createCMBOQItem,
  updateCMBOQItem,
  deleteCMBOQItem,
  useCMScheduleItems,
  useCMDailyLogs,
  type CMBOQItem,
} from "@/lib/cm-data";
import {
  parseWorkbookRows,
  parsePdfRows,
  detectHeaderRow,
  rowsToBoqDraftItems,
  type BoqSheet,
  type BoqColumnMapping,
  type BoqField,
} from "@/lib/cm-boq-import";

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

function BoqItemRow({ item, delivered, canEdit, canDelete, onChanged }: {
  item: CMBOQItem; delivered: number | undefined; canEdit: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitCost, setUnitCost] = useState(String(item.unit_cost));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commit = async (patch: Partial<CMBOQItem>) => {
    setBusy(true);
    try { await updateCMBOQItem(item.id, patch); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white/3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-white/80 truncate">{item.description}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {canEdit ? (
            <>
              <input type="number" min={0} value={quantity} disabled={busy}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => { const v = Number(quantity) || 0; if (v !== item.quantity) commit({ quantity: v }); }}
                className="w-16 bg-white/5 rounded-lg border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70 focus:outline-none focus:border-[#ff5100]/60" />
              <span className="font-mono text-[10px] text-white/30">{item.unit ?? ""} ×</span>
              <input type="number" min={0} value={unitCost} disabled={busy}
                onChange={(e) => setUnitCost(e.target.value)}
                onBlur={() => { const v = Number(unitCost) || 0; if (v !== item.unit_cost) commit({ unit_cost: v }); }}
                className="w-20 bg-white/5 rounded-lg border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70 focus:outline-none focus:border-[#ff5100]/60" />
            </>
          ) : (
            <span className="font-mono text-[10px] text-white/50">
              {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit ?? ""} × {item.unit_cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {delivered != null && (
          <p className="font-mono text-[9px] text-white/30 mt-1">
            {t("boq.deliveredToDate")} {delivered.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit ?? ""}
            {item.quantity > 0 && ` (${((delivered / item.quantity) * 100).toFixed(0)}%)`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-[11px]" style={{ color: "#ff5100" }}>
          {(item.quantity * item.unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        {canDelete && (
          <button onClick={() => setConfirmingDelete(true)} disabled={busy}
            className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
        )}
      </div>
      {confirmingDelete && (
        <ConfirmationDialog message={t("boq.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={() => { setConfirmingDelete(false); deleteCMBOQItem(item.id).then(onChanged); }} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CategorySection({ category, items, grandTotal, linkedCount, linkedAvgActual, deliveredByBoqItem, canEdit, canDelete, onChanged }: {
  category: string; items: CMBOQItem[]; grandTotal: number; linkedCount: number; linkedAvgActual: number | null;
  deliveredByBoqItem: Map<string, number>; canEdit: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const { t } = useCMLang();
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const ratio = grandTotal > 0 ? (subtotal / grandTotal) * 100 : 0;

  return (
    <Card title={category} action={<span className="font-mono text-[10px]" style={{ color: "#ff5100" }}>{ratio.toFixed(1)}% {t("boq.ratioOfTotal")}</span>}>
      <div className="flex flex-col gap-2">
        {items.map((item) => <BoqItemRow key={item.id} item={item} delivered={deliveredByBoqItem.get(item.id)} canEdit={canEdit} canDelete={canDelete} onChanged={onChanged} />)}
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

const BOQ_IMPORT_FIELDS: BoqField[] = ["description", "quantity", "unit", "unitCost", "category"];

/** Upload → review/map → confirm. BOQs vary a lot between companies, so
 *  this never trusts automatic column detection blindly — it always shows
 *  the user the detected mapping (and a live preview) to confirm or correct
 *  before anything is imported. One mapping applies across every sheet in
 *  the workbook (matches the common "one sheet per building, same column
 *  layout" convention), but each sheet keeps its own detected header row. */
function ImportBoqSheet({ ownerId, projectId, onClose, onImported }: {
  ownerId: string; projectId: string; onClose: () => void; onImported: () => void;
}) {
  const { t } = useCMLang();
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [sheets, setSheets] = useState<BoqSheet[]>([]);
  const [headerBySheet, setHeaderBySheet] = useState<Map<string, number>>(new Map());
  const [mapping, setMapping] = useState<BoqColumnMapping>({ description: null, unit: null, quantity: null, unitCost: null, category: null });
  const [referenceSheetIdx, setReferenceSheetIdx] = useState(0);

  const handleFile = async (file: File) => {
    setError("");
    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const parsed = isPdf ? await parsePdfRows(file) : await parseWorkbookRows(file);
      const nonEmptySheets = parsed.filter((s) => s.rows.length > 0);
      if (nonEmptySheets.length === 0) { setError(t("boq.import.noRows")); return; }

      const headers = new Map<string, number>();
      let firstMapping: BoqColumnMapping | null = null;
      let firstIdx = 0;
      nonEmptySheets.forEach((s, i) => {
        const detected = detectHeaderRow(s.rows);
        if (!detected) return;
        headers.set(s.sheetName, detected.rowIndex);
        if (!firstMapping) { firstMapping = detected.mapping; firstIdx = i; }
      });
      if (!firstMapping) { setError(t("boq.import.noHeaderFound")); return; }

      setSheets(nonEmptySheets);
      setHeaderBySheet(headers);
      setMapping(firstMapping);
      setReferenceSheetIdx(firstIdx);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const referenceSheet = sheets[referenceSheetIdx] as BoqSheet | undefined;
  const referenceHeaderRow = referenceSheet ? headerBySheet.get(referenceSheet.sheetName) ?? 0 : 0;
  const referenceHeaderCells = referenceSheet?.rows[referenceHeaderRow] ?? [];
  // Some BOQs split their header across two rows (a field-group row plus a
  // Material/Labor/Total sub-header row) — fall back to the row below when
  // the detected header row's own cell is blank, so columns like "TOTAL"
  // still get a real label instead of a bare "Col N".
  const subHeaderCells = referenceSheet?.rows[referenceHeaderRow + 1] ?? [];
  const columnOptions = referenceHeaderCells.map((cell, i) => ({ value: String(i), label: String(cell || subHeaderCells[i] || `Col ${i + 1}`) }));

  const draftItemsBySheet = useMemo(
    () => sheets.filter((s) => headerBySheet.has(s.sheetName))
      .map((s) => ({ sheet: s, items: rowsToBoqDraftItems(s.rows, headerBySheet.get(s.sheetName)!, mapping, s.sheetName) })),
    [sheets, headerBySheet, mapping],
  );
  const allDraftItems = useMemo(() => draftItemsBySheet.flatMap((d) => d.items), [draftItemsBySheet]);
  const previewItems = draftItemsBySheet.find((d) => d.sheet === referenceSheet)?.items ?? [];
  const categoryCount = useMemo(() => new Set(allDraftItems.map((i) => i.category)).size, [allDraftItems]);
  const skippedCount = sheets.length - draftItemsBySheet.length;

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      const chunkSize = 20;
      for (let i = 0; i < allDraftItems.length; i += chunkSize) {
        const chunk = allDraftItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map((item) => createCMBOQItem(ownerId, projectId, item)));
      }
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import BOQ items");
      setImporting(false);
    }
  };

  return (
    <Sheet title={t("boq.import.title")} onClose={onClose}>
      <div className="px-6 pb-8 pt-2 flex flex-col gap-4">
        {step === "upload" && (
          <>
            <p className="text-[12px] text-white/40">{t("boq.import.uploadHint")}</p>
            <label className="flex flex-col items-center justify-center gap-3 py-10 rounded-3xl border border-dashed border-white/15 text-white/60 hover:border-white/30 cursor-pointer text-center transition-colors">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0-12l-4 4m4-4l4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              <span className="text-[13px] font-bold uppercase tracking-widest">{t("boq.import.chooseFile")}</span>
              <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </label>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
          </>
        )}

        {step === "review" && referenceSheet && (
          <>
            <p className="text-[12px] text-white/40">{t("boq.import.reviewHint")}</p>
            {BOQ_IMPORT_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1.5">
                <span className={labelCls}>{t(`boq.import.field.${field}`)}</span>
                <FieldSelect
                  value={mapping[field] != null ? String(mapping[field]) : ""}
                  onChange={(v) => setMapping((m) => ({ ...m, [field]: v === "" ? null : Number(v) }))}
                  placeholder={t("boq.import.notMapped")}
                  options={[{ value: "", label: t("boq.import.notMapped") }, ...columnOptions]}
                  disabled={importing}
                />
              </label>
            ))}

            <div className="rounded-xl bg-white/3 p-3 flex flex-col gap-1.5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{t("boq.import.preview")} — {referenceSheet.sheetName}</p>
              {previewItems.slice(0, 5).map((item, i) => (
                <p key={i} className="text-[11px] text-white/60 truncate">
                  {item.description} — {item.quantity} {item.unit ?? ""} × {item.unit_cost.toLocaleString()}
                </p>
              ))}
              {previewItems.length === 0 && <p className="text-[11px] text-white/30">{t("boq.import.noItemsDetected")}</p>}
            </div>

            <div className="rounded-xl bg-white/3 p-3 text-[12px] text-white/60">
              {t("boq.import.summary", { count: String(allDraftItems.length), categories: String(categoryCount) })}
              {skippedCount > 0 && <p className="text-white/30 mt-1">{t("boq.import.skipped", { count: String(skippedCount) })}</p>}
            </div>

            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <button type="button" onClick={handleImport} disabled={importing || allDraftItems.length === 0}
              className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {importing ? t("boq.import.importing") : t("boq.import.confirmImport")}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function CMBoqPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const { data: items, isLoading } = useCMBOQItems(projectId || undefined);
  const { data: scheduleItems } = useCMScheduleItems(projectId || undefined);
  const { data: dailyLogs } = useCMDailyLogs(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "boq", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "boq", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "boq", "delete");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_boq_items", projectId] });
    setShowNew(false);
    setShowImport(false);
  };

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

  const deliveredByBoqItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of dailyLogs ?? []) {
      for (const d of log.deliveries) {
        if (!d.boq_item_id) continue;
        map.set(d.boq_item_id, (map.get(d.boq_item_id) ?? 0) + (Number(d.quantity) || 0));
      }
    }
    return map;
  }, [dailyLogs]);

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
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pb-28">
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
                    linkedCount={linked?.count ?? 0} linkedAvgActual={linked?.avgActual ?? null}
                    deliveredByBoqItem={deliveredByBoqItem} canEdit={canEdit} canDelete={canDelete} onChanged={invalidate} />
                );
              })}
            </div>
            {canCreate && (
              <button type="button" onClick={() => setShowImport(true)} aria-label={t("boq.import.title")}
                className="fixed bottom-24 right-6 w-11 h-11 rounded-full flex items-center justify-center text-white/70 bg-white/10 hover:bg-white/15 active:scale-95 transition-all z-30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12m0-12l-4 4m4-4l4 4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </button>
            )}
            {canCreate && <FAB label={t("boq.newBtn")} onClick={() => setShowNew(true)} />}
          </>
        )}
      </main>

      {showNew && projectId && canCreate && <NewBoqItemSheet ownerId={user.id} projectId={projectId} onClose={() => setShowNew(false)} onCreated={invalidate} />}
      {showImport && projectId && canCreate && <ImportBoqSheet ownerId={user.id} projectId={projectId} onClose={() => setShowImport(false)} onImported={invalidate} />}
    </div>
  );
}
