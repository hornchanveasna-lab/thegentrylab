import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { usePermission } from "@/lib/cm-permissions";
import {
  BackButton, Card, EmptyState, SegmentedField, FieldSelect, ProjectPicker, useSelectedProject,
  inputCls, ConfirmationDialog,
} from "@/components/cm/shared";
import {
  useCMWBSNodes, createCMWBSNode, updateCMWBSNode, deleteCMWBSNode, wbsBreadcrumb,
  useActiveCMBOQItems, useCMScheduleItems, updateCMBOQItem, updateCMScheduleItem,
  type CMWBSNode, type CMWBSLevel,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/wbs")({
  head: () => ({ meta: [{ title: "Work Breakdown Structure — Construction Management App" }] }),
  component: CMWBSPage,
});

const WBS_LEVELS: CMWBSLevel[] = ["phase", "package", "activity"];
const smallBtn = "px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all";

function wbsDepth(node: CMWBSNode, all: CMWBSNode[]): number {
  let depth = 0;
  let current = node;
  while (current.parent_id) {
    const parent = all.find((n) => n.id === current.parent_id);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

interface ProposedNode {
  tempId: string;
  parentTempId: string | null;
  name: string;
  level: CMWBSLevel;
  code: string | null;
}
interface ProposedAssignment {
  itemType: "boq" | "schedule";
  itemId: string;
  nodeTempId: string;
  confidence: number;
}
interface ProposedAnomaly {
  itemType: "boq" | "schedule";
  itemId: string;
  message: string;
}
interface WBSProposal {
  nodes: ProposedNode[];
  assignments: ProposedAssignment[];
  anomalies: ProposedAnomaly[];
}

function AISuggestPanel({ ownerId, projectId, accessToken, onClose, onApplied }: {
  ownerId: string; projectId: string; accessToken: string | undefined; onClose: () => void; onApplied: () => void;
}) {
  const { t } = useCMLang();
  const { data: boqItems } = useActiveCMBOQItems(projectId);
  const { data: scheduleItems } = useCMScheduleItems(projectId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<WBSProposal | null>(null);
  const [applying, setApplying] = useState(false);

  const boqById = useMemo(() => new Map((boqItems ?? []).map((b) => [b.id, b])), [boqItems]);
  const scheduleById = useMemo(() => new Map((scheduleItems ?? []).map((s) => [s.id, s])), [scheduleItems]);

  const runSuggest = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cm-wbs-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          boqItems: (boqItems ?? []).map((b) => ({ id: b.id, description: b.description, category: b.category, unit: b.unit, quantity: b.quantity, unit_cost: b.unit_cost })),
          scheduleItems: (scheduleItems ?? []).map((s) => ({ id: s.id, title: s.title, group_label: s.group_label, boq_category: s.boq_category })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setProposal(json as WBSProposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI suggestion");
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      const tempToRealId = new Map<string, string>();
      // Roots first, then deeper levels, so parent_id always resolves to an already-created node.
      const byDepth = [...proposal.nodes].sort((a, b) => (a.parentTempId ? 1 : 0) - (b.parentTempId ? 1 : 0));
      const remaining = [...byDepth];
      let guard = 0;
      while (remaining.length > 0 && guard < 20) {
        guard += 1;
        for (let i = remaining.length - 1; i >= 0; i -= 1) {
          const n = remaining[i];
          if (n.parentTempId && !tempToRealId.has(n.parentTempId)) continue;
          const created = await createCMWBSNode(ownerId, projectId, {
            name: n.name, level: n.level, code: n.code || undefined,
            parent_id: n.parentTempId ? tempToRealId.get(n.parentTempId)! : null,
          });
          tempToRealId.set(n.tempId, created.id);
          remaining.splice(i, 1);
        }
      }
      for (const a of proposal.assignments) {
        const nodeId = tempToRealId.get(a.nodeTempId);
        if (!nodeId) continue;
        if (a.itemType === "boq") await updateCMBOQItem(a.itemId, { wbs_node_id: nodeId });
        else await updateCMScheduleItem(a.itemId, { wbs_node_id: nodeId });
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
        <p className="text-[14px] font-bold text-white/85">{t("wbs.aiSuggest")}</p>
        {!proposal && (
          <>
            <p className="text-[12px] text-white/45">{t("wbs.aiSuggestHint")}</p>
            {error && <p className="text-[12px] text-red-400">{error}</p>}
            <button onClick={runSuggest} disabled={loading}
              className="w-full py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {loading ? t("wbs.aiSuggesting") : t("wbs.aiSuggestRun")}
            </button>
            <button onClick={onClose} className="w-full py-2.5 rounded-2xl text-[12px] uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
          </>
        )}
        {proposal && (
          <>
            <div className="flex flex-col gap-2">
              {proposal.nodes.map((n) => (
                <div key={n.tempId} className="rounded-xl bg-white/3 px-3 py-2" style={{ marginLeft: (n.parentTempId ? 1 : 0) * 16 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{t(`wbsLevel.${n.level}`)}</span>
                    <p className="text-[12px] text-white/80 truncate">{n.name}</p>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {proposal.assignments.filter((a) => a.nodeTempId === n.tempId).map((a, i) => {
                      const label = a.itemType === "boq" ? boqById.get(a.itemId)?.description : scheduleById.get(a.itemId)?.title;
                      return (
                        <p key={i} className="text-[10px] text-white/35 truncate pl-2">
                          · {label ?? a.itemId} <span className="text-white/20">({Math.round(a.confidence * 100)}%)</span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}
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
              <button onClick={onClose} className="px-5 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-white/40">{t("common.cancel")}</button>
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
  const canCreate = usePermission(projectId || undefined, user?.id, "settings", "create");
  const canEdit = usePermission(projectId || undefined, user?.id, "settings", "edit");
  const canDelete = usePermission(projectId || undefined, user?.id, "settings", "delete");

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [level, setLevel] = useState<CMWBSLevel>("phase");
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cm_wbs_nodes", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_boq_items", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_active_boq_items", projectId] });
    qc.invalidateQueries({ queryKey: ["cm_schedule_items", projectId] });
  };

  const handleAdd = async () => {
    if (!name.trim() || !projectId || !activeProject) return;
    await createCMWBSNode(activeProject.owner_id, projectId, {
      name: name.trim(), level, code: code.trim() || undefined, parent_id: parentId || undefined,
    });
    setName(""); setCode(""); setParentId(""); setAdding(false);
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
            <button onClick={() => setAiOpen(true)} className={smallBtn} style={{ color: "#ff5100" }}>{t("wbs.aiSuggest")}</button>
          )}
        </div>
        <p className="text-[12px] text-white/35 mb-5">{t("wbs.subtitle")}</p>
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        {projectId && (
          <Card title={t("wbs.tree")}>
            <div className="flex flex-col gap-2">
              {(nodes ?? []).map((n) => (
                <div key={n.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5" style={{ marginLeft: wbsDepth(n, nodes ?? []) * 16 }}>
                  {editingId === n.id && canEdit ? (
                    <input
                      className="flex-1 min-w-0 bg-transparent text-[12px] text-white/80 focus:outline-none border-b border-[#ff5100]/60"
                      value={editValue} autoFocus onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(n.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingId(null); }}
                    />
                  ) : (
                    <p onClick={canEdit ? () => startEditing(n) : undefined} className={`text-[12px] text-white/80 flex-1 truncate ${canEdit ? "cursor-text" : ""}`}>
                      {n.code ? `${n.code} — ` : ""}{n.name}
                    </p>
                  )}
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 shrink-0">{t(`wbsLevel.${n.level}`)}</span>
                  {canDelete && <button onClick={() => setDeletingId(n.id)} className="text-white/25 hover:text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 shrink-0">×</button>}
                </div>
              ))}
              {(nodes?.length ?? 0) === 0 && !adding && <EmptyState message={t("wbs.noneYet")} />}
              {canCreate && (adding ? (
                <div className="flex flex-col gap-2 mt-1">
                  <input className={inputCls} placeholder={t("wbs.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                  <input className={inputCls} placeholder={t("wbs.code")} value={code} onChange={(e) => setCode(e.target.value)} />
                  <SegmentedField value={level} onChange={setLevel} options={WBS_LEVELS.map((lv) => ({ value: lv, label: t(`wbsLevel.${lv}`) }))} />
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
        <AISuggestPanel
          ownerId={activeProject.owner_id} projectId={projectId} accessToken={session?.access_token}
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
