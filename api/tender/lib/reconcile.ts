/**
 * Clause reconciliation — Phase 4 of the rebuild plan.
 *
 * Re-parsing a document used to append clauses and requirements blindly, so
 * processing Addendum 3 duplicated everything. This diffs the newly parsed
 * clause tree against what is already stored and decides, per clause:
 *
 *   unchanged  →  skip entirely, no API call
 *   changed    →  re-extract; supersede the old requirements, never delete
 *   new        →  extract
 *   removed    →  withdraw its requirements
 *
 * The unchanged case is the point. An addendum that rewrites four clauses out
 * of four hundred re-extracts four, which turns re-processing from something
 * you avoid on cost into something you do every time an addendum lands.
 */
import { sbGet, sbPatch, sbPost, type TenderEnv } from "./auth.js";
import type { ClauseNode } from "./clauses.js";

export interface StoredClause {
  id: string;
  clause_ref: string;
  ordinal: number;
  content_hash: string;
  body: string;
}

export interface ReconcileResult {
  unchanged: string[];
  changed: string[];
  added: string[];
  removed: string[];
  /** Clause refs needing extraction — changed plus added. */
  toExtract: string[];
  requirementsSuperseded: number;
  requirementsWithdrawn: number;
}

/** Key on ref+ordinal, matching the unique constraint. A document can
 *  legitimately repeat a clause reference across Parts or Appendices, so ref
 *  alone is not unique. */
const key = (ref: string, ordinal: number) => `${ref}#${ordinal}`;

export async function reconcileClauses(
  env: TenderEnv,
  documentId: string,
  tenderId: string,
  parsed: ClauseNode[],
): Promise<ReconcileResult> {
  const stored = await sbGet<StoredClause>(
    env,
    `tender_clauses?document_id=eq.${documentId}&select=id,clause_ref,ordinal,content_hash,body&order=ordinal.asc`,
  ).catch(() => [] as StoredClause[]);

  const storedByKey = new Map(stored.map((c) => [key(c.clause_ref, c.ordinal), c]));
  const parsedByKey = new Map(parsed.map((c) => [key(c.clauseRef, c.ordinal), c]));

  const result: ReconcileResult = {
    unchanged: [], changed: [], added: [], removed: [], toExtract: [],
    requirementsSuperseded: 0, requirementsWithdrawn: 0,
  };

  // First pass: everything in the new parse.
  for (const [k, node] of parsedByKey) {
    const existing = storedByKey.get(k);
    if (!existing) {
      result.added.push(node.clauseRef);
      result.toExtract.push(node.clauseRef);
      await sbPost(env, "tender_clauses", {
        document_id: documentId, tender_id: tenderId,
        clause_ref: node.clauseRef, parent_ref: node.parentRef, title: node.title,
        body: node.text, page_from: node.pageFrom, page_to: node.pageTo,
        depth: node.depth, ordinal: node.ordinal, content_hash: node.contentHash,
      }).catch(() => {});
      continue;
    }
    if (existing.content_hash === node.contentHash) {
      result.unchanged.push(node.clauseRef);
      continue;
    }
    result.changed.push(node.clauseRef);
    result.toExtract.push(node.clauseRef);

    await sbPost(env, "tender_clause_revisions", {
      clause_id: existing.id, document_id: documentId, tender_id: tenderId,
      clause_ref: node.clauseRef,
      previous_hash: existing.content_hash, new_hash: node.contentHash,
      previous_body: existing.body, new_body: node.text,
      change_kind: "changed",
    }).catch(() => {});

    await sbPatch(env, `tender_clauses?id=eq.${existing.id}`, {
      body: node.text, title: node.title, parent_ref: node.parentRef,
      page_from: node.pageFrom, page_to: node.pageTo, depth: node.depth,
      content_hash: node.contentHash,
    }).catch(() => {});

    // Supersede rather than delete: the old wording is the evidence for what
    // was priced before the addendum landed.
    result.requirementsSuperseded += await markRequirements(
      env, existing.id, { superseded_at: new Date().toISOString() },
    );
  }

  // Second pass: anything that used to be there and is not any more.
  for (const [k, existing] of storedByKey) {
    if (parsedByKey.has(k)) continue;
    result.removed.push(existing.clause_ref);
    await sbPost(env, "tender_clause_revisions", {
      clause_id: existing.id, document_id: documentId, tender_id: tenderId,
      clause_ref: existing.clause_ref,
      previous_hash: existing.content_hash, new_hash: existing.content_hash,
      previous_body: existing.body, new_body: null,
      change_kind: "removed",
    }).catch(() => {});
    result.requirementsWithdrawn += await markRequirements(
      env, existing.id, { withdrawn_at: new Date().toISOString() },
    );
  }

  return result;
}

/** Flags a clause's still-current requirements. Returns how many were
 *  affected so the caller can report "Addendum 3 superseded 7 requirements",
 *  which is the question a QS actually asks. */
async function markRequirements(
  env: TenderEnv, clauseId: string, patch: Record<string, unknown>,
): Promise<number> {
  const rows = await sbGet<{ id: string }>(
    env,
    `tender_requirements?clause_id=eq.${clauseId}&superseded_at=is.null&withdrawn_at=is.null&select=id`,
  ).catch(() => [] as { id: string }[]);
  if (rows.length === 0) return 0;
  await sbPatch(
    env,
    `tender_requirements?clause_id=eq.${clauseId}&superseded_at=is.null&withdrawn_at=is.null`,
    patch,
  ).catch(() => {});
  return rows.length;
}
