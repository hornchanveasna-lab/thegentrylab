import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  BackButton, Card, EmptyState, FieldSelect, ProjectPicker, useSelectedProject,
  inputCls, ConfirmationDialog,
} from "@/components/cm/shared";
import {
  useCMWBSNodes, createCMWBSNode, updateCMWBSNode, deleteCMWBSNode, wbsBreadcrumb, wbsFlatten, wbsIsLeaf,
  useActiveCMBOQItems, useCMScheduleItems, createCMBOQItem, createCMScheduleItem, useCMAiCredits,
  type CMWBSNode,
} from "@/lib/cm-data";
import { parseWorkbookRows, parsePdfRows, type BoqSheet } from "@/lib/cm-boq-import";

export const Route = createFileRoute("/cm/wbs")({
  head: () => ({ meta: [{ title: "Work Breakdown Structure — Construction Management App" }] }),
  component: CMWBSPage,
});

const LEVEL_SUGGESTIONS = ["Zone", "Building", "Floor", "Area", "Discipline", "Work Category", "Item"];
const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";

interface ProposedNode {
  tempId: string;
  parentTempId: string | null;
  name: string;
  level: string;
}
interface ProposedItem {
  nodeTempId: string;
  description: string;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  confidence: number;
}
interface ProposedActivity {
  nodeTempId: string;
  title: string;
  plan_start: string;
  plan_finish: string;
  weight: number;
}
type ScheduleSource = "file" | "inferred" | "mixed";
interface WBSProposal {
  nodes: ProposedNode[];
  items: ProposedItem[];
  activities: ProposedActivity[];
  scheduleSource: ScheduleSource;
  anomalies: { message: string }[];
  creditsCharged?: number;
  creditsRemaining?: number;
}

/** Walks a proposed node's parentTempId chain up to its root — used as the
 *  Schedule module's group_label so AI-proposed activities land in the same
 *  "phase" bucket a person would have typed by hand. */
function rootProposedNodeName(tempId: string, nodes: ProposedNode[]): string {
  let current = nodes.find((n) => n.tempId === tempId);
  if (!current) return "General";
  while (current.parentTempId) {
    const parent = nodes.find((n) => n.tempId === current!.parentTempId);
    if (!parent) break;
    current = parent;
  }
  return current.name;
}

function AIImportPanel({ ownerId, projectId, projectStartDate, projectEndDate, accessToken, onClose, onApplied }: {
  ownerId: string; projectId: string; projectStartDate: string | null; projectEndDate: string | null;
  accessToken: string | undefined; onClose: () => void; onApplied: () => void;
}) {
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { data: aiCredits } = useCMAiCredits(projectId);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<BoqSheet[] | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [insufficientBalance, setInsufficientBalance] = useState<number | null>(null);
  const [proposal, setProposal] = useState<WBSProposal | null>(null);
  const [applying, setApplying] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    setParseError("");
    setSheets(null);
    try {
      const parsed = /\.pdf$/i.test(f.name) ? await parsePdfRows(f) : await parseWorkbookRows(f);
      const nonEmpty = parsed.filter((s) => s.rows.length > 0);
      setSheets(nonEmpty.length > 0 ? nonEmpty : parsed);
      // Default to the sheet with the most rows — usually the real BOQ, not a cover/notes tab.
      const best = nonEmpty.reduce((a, b, i) => (b.rows.length > (nonEmpty[a]?.rows.length ?? 0) ? i : a), 0);
      setSheetIndex(best);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read this file");
    }
  };

  const runAnalyze = async () => {
    if (!accessToken || !sheets) return;
    const sheet = sheets[sheetIndex];
    setLoading(true);
    setError("");
    setInsufficientBalance(null);
    try {
      const res = await fetch("/api/cm-wbs-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          rows: sheet.rows, sheetName: sheet.sheetName, projectId, ownerId,
          projectStartDate, projectEndDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 402) { setInsufficientBalance(json.balance ?? 0); return; }
        throw new Error(json.error ?? "Request failed");
      }
      // The AI call itself streams internally (to stay under the edge
      // runtime's timeout on large sheets), so a failure there still comes
      // back as HTTP 200 with an `error` field rather than a 4xx/5xx status.
      if (json.error) throw new Error(json.error);
      setProposal(json as WBSProposal);
      qc.invalidateQueries({ queryKey: ["cm_ai_credits", projectId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze file");
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      const tempToRealId = new Map<string, string>();
      const remaining = [...proposal.nodes];
      let guard = 0;
      while (remaining.length > 0 && guard < 30) {
        guard += 1;
        for (let i = remaining.length - 1; i >= 0; i -= 1) {
          const n = remaining[i];
          if (n.parentTempId && !tempToRealId.has(n.parentTempId)) continue;
          const created = await createCMWBSNode(ownerId, projectId, {
            name: n.name, level: n.level || "Group",
            parent_id: n.parentTempId ? tempToRealId.get(n.parentTempId)! : null,
          });
          tempToRealId.set(n.tempId, created.id);
          remaining.splice(i, 1);
        }
      }
      for (const item of proposal.items) {
        const nodeId = tempToRealId.get(item.nodeTempId);
        if (!nodeId) continue;
        await createCMBOQItem(ownerId, projectId, {
          description: item.description, unit: item.unit, quantity: item.quantity, unit_cost: item.unit_cost,
          wbs_node_id: nodeId,
        });
      }
      for (const activity of proposal.activities) {
        const nodeId = tempToRealId.get(activity.nodeTempId);
        if (!nodeId) continue;
        await createCMScheduleItem(ownerId, projectId, {
          group_label: rootProposedNodeName(activity.nodeTempId, proposal.nodes),
          title: activity.title, plan_start: activity.plan_start, plan_finish: activity.plan_finish,
          weight: activity.weight, wbs_node_id: nodeId,
        });
      }
      onApplied();
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-6" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-[#141415] rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14px] font-bold text-white/85">{t("wbs.aiImport")}</p>

        {!proposal && (
          <>
            <p className="text-[12px] text-white/45">{t("wbs.aiImportHint")}</p>
            {aiCredits && <p className="text-[10px] text-white/30">{t("wbs.creditsBalance").replace("{n}", String(aiCredits.balance))}</p>}
            <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="text-[12px] text-white/60 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:text-black"
              style={{ colorScheme: "dark" }} />
            {parseError && <p className="text-[12px] text-red-400">{parseError}</p>}
            {sheets && sheets.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/35">{t("wbs.sheet")}</span>
                <FieldSelect value={String(sheetIndex)} onChange={(v) => setSheetIndex(Number(v))}
                  options={sheets.map((s, i) => ({ value: String(i), label: `${s.sheetName} (${s.rows.length})` }))} />
              </label>
            )}
            {sheets && <p className="text-[11px] text-white/30">{t("wbs.rowsFound").replace("{n}", String(sheets[sheetIndex]?.rows.length ?? 0))}</p>}
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            {insufficientBalance != null && (
              <p className="text-[12px] text-red-400">{t("wbs.insufficientCredits").replace("{n}", String(insufficientBalance))}</p>
            )}
            <button onClick={runAnalyze} disabled={loading || !sheets}
              className="w-full py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {loading ? t("wbs.aiSuggesting") : t("wbs.aiSuggestRun")}
            </button>
            <button onClick={onClose} className="w-full py-2.5 rounded-2xl text-[12px] uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
          </>
        )}

        {proposal && (
          <>
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-[11px] text-white/60">
                {proposal.scheduleSource === "file" ? t("wbs.scheduleFromFile")
                  : proposal.scheduleSource === "mixed" ? t("wbs.scheduleMixed")
                  : t("wbs.scheduleInferred")}
              </p>
              {proposal.creditsCharged != null && (
                <p className="text-[10px] text-white/30 mt-1">
                  {t("wbs.creditsUsed").replace("{used}", String(proposal.creditsCharged)).replace("{n}", String(proposal.creditsRemaining ?? 0))}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {proposal.nodes.map((n) => {
                const isLeafProposal = !proposal.nodes.some((o) => o.parentTempId === n.tempId);
                const depth = (() => {
                  let d = 0; let cur: ProposedNode | undefined = n;
                  while (cur?.parentTempId) { d += 1; cur = proposal.nodes.find((o) => o.tempId === cur!.parentTempId); }
                  return d;
                })();
                const nodeActivities = proposal.activities.filter((a) => a.nodeTempId === n.tempId);
                return (
                  <div key={n.tempId} className="rounded-xl bg-white/3 px-3 py-2" style={{ marginLeft: depth * 16 }}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{n.level}</span>
                      <p className="text-[12px] text-white/80 truncate">{n.name}</p>
                    </div>
                    {isLeafProposal && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {proposal.items.filter((it) => it.nodeTempId === n.tempId).map((it, i) => (
                          <p key={i} className="text-[10px] text-white/35 truncate pl-2">
                            · {it.description} — {it.quantity} {it.unit ?? ""} @ {it.unit_cost} <span className="text-white/20">({Math.round(it.confidence * 100)}%)</span>
                          </p>
                        ))}
                      </div>
                    )}
                    {nodeActivities.length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {nodeActivities.map((a, i) => (
                          <p key={i} className="text-[10px] pl-2" style={{ color: "#ff9d66" }}>
                            ▸ {a.title} — {a.plan_start} → {a.plan_finish}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {proposal.anomalies.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 px-3 py-2.5 flex flex-col gap-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70">{t("wbs.anomalies")}</p>
                {proposal.anomalies.map((a, i) => <p key={i} className="text-[11px] text-amber-300/80">{a.message}</p>)}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={applyProposal} disabled={applying}
                className="flex-1 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold disabled:opacity-40"
                style={{ backgroundColor: "#ff5100" }}>
                {applying ? t("wbs.aiApplying") : t("wbs.aiApply")}
              </button>
              <button onClick={() => { setProposal(null); setFile(null); setSheets(null); }} className="px-5 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CMWBSPage() {
  const { user, session, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const qc = useQueryClient();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const { data: nodes } = useCMWBSNodes(projectId || undefined);
  const { data: boqItems } = useActiveCMBOQItems(projectId || undefined);
  const { data: scheduleItems } = useCMScheduleItems(projectId || undefined);
  const canCreate = usePermission(projectId || undefined, user?.id, "settings", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "settings", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "settings", "delete");

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const flat = useMemo(() => wbsFlatten(nodes ?? []), [nodes]);
  const boqByNode = useMemo(() => {
    const m = new Map<string, typeof boqItems>();
    for (const b of boqItems ?? []) {
      if (!b.wbs_node_id) continue;
      if (!m.has(b.wbs_node_id)) m.set(b.wbs_node_id, []);
      m.get(b.wbs_node_id)!.push(b);
    }
    return m;
  }, [boqItems]);
  const scheduleByNode = useMemo(() => {
    const m = new Map<string, typeof scheduleItems>();
    for (const s of scheduleItems ?? []) {
      if (!s.wbs_node_id) continue;
      if (!m.has(s.wbs_node_id)) m.set(s.wbs_node_id, []);
      m.get(s.wbs_node_id)!.push(s);
    }
    return m;
  }, [scheduleItems]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cm_wbs_nodes", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_wbs_nodes", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_active_boq_items", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_wbs_nodes", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_ai_credits", projectId] });
  };

  const handleAdd = async () => {
    if (!name.trim() || !projectId || !activeProject) return;
    await createCMWBSNode(activeProject.owner_id, projectId, {
      name: name.trim(), level: level.trim() || undefined, parent_id: parentId || undefined,
    });
    setName(""); setLevel(""); setParentId(""); setAdding(false);
    invalidate();
  };

  const startEditing = (n: CMWBSNode) => { setEditingId(n.id); setEditValue(n.name); };
  const commitEdit = async (id: string) => {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (trimmed) { await updateCMWBSNode(id, { name: trimmed }); invalidate(); }
  };
  const handleDelete = async (id: string) => {
    setDeletingId(null);
    await deleteCMWBSNode(id);
    invalidate();
  };

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
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{t("wbs.title")}</h1>
          {projectId && canCreate && (
            <button onClick={() => setAiOpen(true)} className={smallBtn} style={{ color: "#ff5100" }}>{t("wbs.aiImport")}</button>
          )}
        </div>
        <p className="text-[12px] text-white/35 mb-5">{t("wbs.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <Card title={t("wbs.tree")}>
            <div className="flex flex-col gap-2">
              {flat.map(({ node: n, depth }) => {
                const isLeaf = wbsIsLeaf(n, nodes ?? []);
                const nodeBoq = boqByNode.get(n.id) ?? [];
                const nodeSchedule = scheduleByNode.get(n.id) ?? [];
                return (
                  <div key={n.id} className="rounded-xl bg-white/3 px-3 py-2.5" style={{ marginLeft: depth * 16 }}>
                    <div className="flex items-center gap-3">
                      {editingId === n.id && canEdit ? (
                        <input
                          className="flex-1 min-w-0 bg-transparent text-[12px] text-white/80 focus:outline-none border-b border-[#ff5100]/60"
                          value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(n.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingId(null); }}
                        />
                      ) : (
                        <p onClick={canEdit ? () => startEditing(n) : undefined} className={`text-[12px] text-white/80 flex-1 truncate ${canEdit ? "cursor-text" : ""}`}>
                          {n.name}
                        </p>
                      )}
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{n.level}</span>
                      {isLeaf && <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#ff510022", color: "#ff5100" }}>{t("wbs.leaf")}</span>}
                      {canDelete && <button onClick={() => setDeletingId(n.id)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>}
                    </div>
                    {(nodeBoq.length > 0 || nodeSchedule.length > 0) && (
                      <div className="flex flex-col gap-0.5 mt-1.5 pl-1">
                        {nodeBoq.map((b) => (
                          <p key={b.id} className="text-[10px] text-white/35 truncate">· {b.description} — {b.quantity} {b.unit ?? ""} @ {b.unit_cost}</p>
                        ))}
                        {nodeSchedule.map((s) => (
                          <p key={s.id} className="text-[10px] text-white/30 truncate">▸ {s.title}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {(nodes?.length ?? 0) === 0 && !adding && <EmptyState message={t("wbs.noneYet")} />}
              {canCreate && (adding ? (
                <div className="flex flex-col gap-2 mt-1">
                  <input className={inputCls} placeholder={t("wbs.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                  <input className={inputCls} placeholder={t("wbs.levelPlaceholder")} list="wbs-level-suggestions" value={level} onChange={(e) => setLevel(e.target.value)} />
                  <datalist id="wbs-level-suggestions">
                    {LEVEL_SUGGESTIONS.map((lv) => <option key={lv} value={lv} />)}
                  </datalist>
                  <FieldSelect
                    value={parentId} onChange={setParentId} placeholder={t("wbs.parent")}
                    options={[{ value: "", label: t("wbs.parent") }, ...(nodes ?? []).map((n) => ({ value: n.id, label: wbsBreadcrumb(n, nodes ?? []) }))]}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAdd} className={smallBtn} style={{ backgroundColor: "#ff5100", color: "#000" }}>{t("common.add")}</button>
                    <button onClick={() => setAdding(false)} className={`${smallBtn} text-white/40`}>{t("common.cancel")}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className={`${smallBtn} self-start mt-1`} style={{ color: "#ff5100" }}>{t("wbs.add")}</button>
              ))}
            </div>
          </Card>
        )}
      </main>

      {aiOpen && projectId && activeProject && (
        <AIImportPanel
          ownerId={activeProject.owner_id} projectId={projectId}
          projectStartDate={activeProject.start_date} projectEndDate={activeProject.target_end_date}
          accessToken={session?.access_token}
          onClose={() => setAiOpen(false)} onApplied={invalidate}
        />
      )}
      {deletingId && (
        <ConfirmationDialog message={t("wbs.confirmDelete")} confirmLabel={t("common.delete")}
          onConfirm={() => handleDelete(deletingId)} onCancel={() => setDeletingId(null)} />
      )}
    </div>
  );
}
