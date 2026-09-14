/**
 * Job dispatcher — Phase 3 of the rebuild plan.
 *
 * One serverless function for the whole queue (11 of Vercel Hobby's 12).
 * Every agent is a *job type* handled inside this file rather than its own
 * endpoint, so agents three through nine cost zero additional functions —
 * which is what stops the platform's cap from shaping the code forever.
 *
 * Driven by pg_cron + pg_net from Postgres, once a minute (see
 * docs/tender-rebuild-02-queue.sql). Vercel Hobby's own cron fires at most
 * daily, which cannot drain a queue.
 *
 * Two callers:
 *   POST {action:"drain"}   with x-tender-job-secret  — the cron
 *   POST {action:"enqueue"} with a user bearer token  — the app
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getTenderEnv, getAuthedUserId, authorizeTenderAccess, sbGet, sbPatch, sbPost,
  type TenderEnv,
} from "./lib/auth.js";
import { extractRequirementsFromClauseGroup, CATEGORY_TO_CHECKLIST_SECTION } from "./lib/requirements.js";
import { groupClauses, type ClauseNode } from "./lib/clauses.js";
import { runRiskRegister, runGapAnalysis, runClarifications, runComplianceMatrix } from "./lib/agents.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-tender-job-secret",
};

/** Stop claiming new work with enough headroom to finish the job in hand and
 *  write its result. Vercel Hobby kills the function at 60s; a job that dies
 *  mid-write is what requeue_stalled_tender_jobs() exists to recover. */
const TIME_BUDGET_MS = 40_000;
const CLAIM_BATCH = 2;

export type JobType =
  | "extract_requirements_group"
  | "risk_register"
  | "gap_analysis"
  | "clarifications"
  | "compliance_matrix";

/** Tender-wide agents, as opposed to the per-document extraction job.
 *  Each needs the owning org to read the company profile it measures the
 *  tender against, so the job payload carries it. */
const TENDER_AGENTS: JobType[] = ["risk_register", "gap_analysis", "clarifications", "compliance_matrix"];

interface JobRow {
  id: string;
  tender_id: string;
  job_type: JobType | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

interface DocRow { id: string; tender_id: string; file_name: string }
interface ClauseRow {
  clause_ref: string; parent_ref: string | null; title: string | null; body: string;
  page_from: number | null; page_to: number | null; depth: number; ordinal: number; content_hash: string;
}

/** PostgREST RPC. Not in auth.ts because this is the only caller. */
async function sbRpc<T>(env: TenderEnv, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/* ── Handlers ─────────────────────────────────────────────────────────── */

async function runExtractRequirementsGroup(env: TenderEnv, apiKey: string, job: JobRow): Promise<string> {
  const documentId = String(job.payload.documentId ?? "");
  const groupIndex = Number(job.payload.groupIndex ?? 0);
  if (!documentId) throw new Error("payload.documentId missing");

  const [doc] = await sbGet<DocRow>(env, `tender_documents?id=eq.${documentId}&select=id,tender_id,file_name`);
  if (!doc) throw new Error(`document ${documentId} not found`);

  const rows = await sbGet<ClauseRow>(
    env,
    `tender_clauses?document_id=eq.${documentId}&select=clause_ref,parent_ref,title,body,page_from,page_to,depth,ordinal,content_hash&order=ordinal.asc`,
  );
  const groups = groupClauses(rows.map((r): ClauseNode => ({
    clauseRef: r.clause_ref, parentRef: r.parent_ref, title: r.title, text: r.body,
    pageFrom: r.page_from, pageTo: r.page_to, depth: r.depth, ordinal: r.ordinal, contentHash: r.content_hash,
  })));
  const group = groups[groupIndex];
  if (!group) throw new Error(`group ${groupIndex} of ${groups.length} not found`);

  const result = await extractRequirementsFromClauseGroup({ apiKey, fileName: doc.file_name, group });

  let inserted = 0;
  for (const item of result.requirements) {
    try {
      const [reqRow] = await sbPost<{ id: string }[]>(env, "tender_requirements", {
        tender_id: doc.tender_id,
        requirement_code: String(item.requirement_code ?? `REQ-${inserted + 1}`).slice(0, 40),
        category: item.category,
        description: item.description,
        is_mandatory: !!item.is_mandatory,
        status: "open",
        ai_confidence: item.ai_confidence ?? "medium",
      });
      await sbPost(env, "requirement_sources", {
        requirement_id: reqRow.id, document_id: doc.id,
        page_number: item.page_number ?? null, section_label: item.section_label ?? null,
        quoted_text: item.quoted_text ?? null,
      });
      if (item.is_mandatory) {
        await sbPost(env, "tender_checklist_items", {
          tender_id: doc.tender_id, requirement_id: reqRow.id,
          section: CATEGORY_TO_CHECKLIST_SECTION[item.category] ?? "administrative",
          item_label: item.description, is_required: true, ai_generated: true, status: "not_started",
        }).catch(() => {});
      }
      inserted += 1;
    } catch { /* one bad item must not abort the group */ }
  }

  // Retire the document only once its final group has landed, so a partial
  // run cannot strand the remaining groups.
  if (groupIndex >= groups.length - 1) {
    await sbPatch(env, `tender_documents?id=eq.${doc.id}`, {
      requirements_extracted_at: new Date().toISOString(),
    }).catch(() => {});
  }

  return `${inserted} requirement(s) from group ${groupIndex + 1}/${groups.length}`;
}

const HANDLERS: Record<JobType, (env: TenderEnv, apiKey: string, job: JobRow) => Promise<string>> = {
  extract_requirements_group: runExtractRequirementsGroup,
  risk_register: async (env, apiKey, job) =>
    (await runRiskRegister(env, apiKey, job.tender_id)).note,
  clarifications: async (env, apiKey, job) =>
    (await runClarifications(env, apiKey, job.tender_id)).note,
  gap_analysis: async (env, apiKey, job) =>
    (await runGapAnalysis(env, apiKey, job.tender_id, String(job.payload.orgId ?? ""))).note,
  compliance_matrix: async (env, apiKey, job) =>
    (await runComplianceMatrix(env, apiKey, job.tender_id, String(job.payload.orgId ?? ""))).note,
};

/* ── Drain ────────────────────────────────────────────────────────────── */

async function drain(env: TenderEnv, apiKey: string) {
  const startedAt = Date.now();
  let ran = 0, succeeded = 0, failed = 0;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const jobs = await sbRpc<JobRow[]>(env, "claim_tender_jobs", { p_limit: CLAIM_BATCH });
    if (!jobs.length) break;

    for (const job of jobs) {
      ran += 1;
      const handler = job.job_type ? HANDLERS[job.job_type] : undefined;
      try {
        if (!handler) throw new Error(`unknown job_type "${job.job_type}"`);
        const note = await handler(env, apiKey, job);
        await sbPatch(env, `ai_jobs?id=eq.${job.id}`, {
          status: "succeeded", finished_at: new Date().toISOString(),
          output_summary: { note }, last_error: null,
        });
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const exhausted = job.attempts >= job.max_attempts;
        // Exponential backoff, so a transient rate limit does not burn the
        // remaining attempts in the same minute.
        const delaySec = Math.min(15 * 2 ** job.attempts, 900);
        await sbPatch(env, `ai_jobs?id=eq.${job.id}`, {
          status: exhausted ? "failed" : "queued",
          last_error: message,
          finished_at: exhausted ? new Date().toISOString() : null,
          next_attempt_at: new Date(Date.now() + delaySec * 1000).toISOString(),
        });
        failed += 1;
      }
      if (Date.now() - startedAt >= TIME_BUDGET_MS) break;
    }
  }
  return { ran, succeeded, failed, ms: Date.now() - startedAt };
}

/* ── Enqueue ──────────────────────────────────────────────────────────── */

/** Queues one job per clause group of every document still awaiting
 *  extraction. Replaces the client's document-by-document loop: the browser
 *  fires this once and can close the tab. */
async function enqueueTender(env: TenderEnv, tenderId: string, orgId: string) {
  const docs = await sbGet<DocRow>(
    env,
    `tender_documents?tender_id=eq.${tenderId}&status=eq.processed&requirements_extracted_at=is.null&select=id,tender_id,file_name`,
  );

  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const clauses = await sbGet<{ ordinal: number; body: string; clause_ref: string; parent_ref: string | null; title: string | null; page_from: number | null; page_to: number | null; depth: number; content_hash: string }>(
      env,
      `tender_clauses?document_id=eq.${doc.id}&select=clause_ref,parent_ref,title,body,page_from,page_to,depth,ordinal,content_hash&order=ordinal.asc`,
    ).catch(() => []);
    if (!clauses.length) continue; // no clause tree yet — legacy path still handles it
    const groups = groupClauses(clauses.map((r): ClauseNode => ({
      clauseRef: r.clause_ref, parentRef: r.parent_ref, title: r.title, text: r.body,
      pageFrom: r.page_from, pageTo: r.page_to, depth: r.depth, ordinal: r.ordinal, contentHash: r.content_hash,
    })));
    for (let g = 0; g < groups.length; g++) {
      rows.push({
        tender_id: tenderId, agent: "requirements_extractor", job_type: "extract_requirements_group",
        status: "queued", payload: { documentId: doc.id, groupIndex: g },
        input_summary: { file_name: doc.file_name, group_index: g },
      });
    }
  }

  if (rows.length) await sbPost(env, "ai_jobs", rows);
  return { queued: rows.length, documents: docs.length };
}

/* ── Handler ──────────────────────────────────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const env = getTenderEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!env || !apiKey) return res.status(500).json({ error: "TenderAI backend not configured" });

  const action = req.body?.action;

  if (action === "drain") {
    // Machine caller. A shared secret rather than a user token, because the
    // caller is Postgres and there is no user in the loop.
    const secret = process.env.TENDER_JOB_SECRET;
    if (!secret) return res.status(500).json({ error: "TENDER_JOB_SECRET not configured" });
    if (req.headers["x-tender-job-secret"] !== secret) return res.status(401).json({ error: "Bad job secret" });
    try {
      return res.status(200).json({ ok: true, ...(await drain(env, apiKey)) });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  const userId = await getAuthedUserId(env, req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const tenderId = typeof req.body?.tenderId === "string" ? req.body.tenderId : "";
  if (!tenderId) return res.status(400).json({ error: "Missing tenderId" });
  const orgId = await authorizeTenderAccess(env, tenderId, userId).catch(() => null);
  if (!orgId) return res.status(403).json({ error: "Not authorized for this tender" });

  if (action === "enqueue") {
    try {
      return res.status(200).json({ ok: true, ...(await enqueueTender(env, tenderId, orgId)) });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (action === "enqueue_agents") {
    // Risks, gaps, clarifications and compliance all read the extracted
    // requirements or the parsed clauses, so they are queued once the
    // extraction jobs have drained rather than alongside them.
    const requested: JobType[] = Array.isArray(req.body?.agents)
      ? (req.body.agents as JobType[]).filter((a) => TENDER_AGENTS.includes(a))
      : TENDER_AGENTS;
    if (!requested.length) return res.status(400).json({ error: "No valid agents requested" });
    await sbPost(env, "ai_jobs", requested.map((job_type) => ({
      tender_id: tenderId, agent: job_type, job_type, status: "queued",
      payload: { orgId }, input_summary: { agent: job_type },
    })));
    return res.status(200).json({ ok: true, queued: requested.length, agents: requested });
  }

  if (action === "status") {
    // Drives the progress UI: the client polls this instead of driving the
    // work itself, so a closed tab no longer stops processing.
    const jobs = await sbGet<{ status: string }>(env, `ai_jobs?tender_id=eq.${tenderId}&select=status`);
    const count = (s: string) => jobs.filter((j) => j.status === s).length;
    return res.status(200).json({
      ok: true,
      queued: count("queued"), running: count("running"),
      succeeded: count("succeeded"), failed: count("failed"),
      total: jobs.length,
    });
  }

  return res.status(400).json({ error: `Unknown action "${String(action)}"` });
}
