/**
 * Requirements Extraction Agent (docs/ai-agent-architecture.md). The
 * blocker every other tab (Requirements, Checklist, Compliance, Gaps,
 * Risks, Overview's Attention Required feed) was waiting on — none of
 * those had any real data to show, only the extraction/classification
 * pipeline (process-document.ts) existed.
 *
 * Runs per-document, over each document's already-stored chunks
 * (tender_document_chunks, from process-document.ts), asking Claude to
 * pull out discrete, citable requirements — each with the exact page and
 * quoted text it came from (SOURCE_OF_TRUTH_RULE). Mandatory requirements
 * become checklist items automatically. Idempotent per document via
 * tender_documents.requirements_extracted_at — calling this again only
 * processes documents that haven't been extracted yet.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callClaude, SOURCE_OF_TRUTH_RULE, type ClaudeToolSchema } from "./lib/ai.js";
import {
  getTenderEnv, getAuthedUserId, authorizeTenderAccess, sbGet, sbPatch, sbPost, type TenderEnv,
} from "./lib/auth.js";

const REQUIREMENT_CATEGORIES = [
  "administrative", "legal", "commercial", "technical", "financial", "planning", "design",
  "construction", "qaqc", "hse", "environmental", "procurement", "personnel", "equipment",
  "experience", "insurance", "bond", "warranty", "subcontracting", "pricing", "tender_forms",
] as const;

/** Maps a requirement's category to the checklist section it belongs
 *  under (CHECKLIST_SECTIONS in src/lib/tender-data.ts has fewer, broader
 *  buckets than the requirement categories do). */
const CATEGORY_TO_CHECKLIST_SECTION: Record<string, string> = {
  administrative: "administrative", legal: "administrative", tender_forms: "administrative",
  commercial: "commercial", financial: "commercial", procurement: "commercial",
  insurance: "commercial", bond: "commercial", subcontracting: "commercial", pricing: "commercial",
  technical: "technical", design: "technical", construction: "technical", warranty: "technical",
  planning: "planning",
  qaqc: "qaqc",
  hse: "hse", environmental: "hse",
  personnel: "personnel",
  equipment: "equipment",
  experience: "company_qualification",
};

interface TenderDocumentRow {
  id: string;
  tender_id: string;
  file_name: string;
}

interface ChunkRow {
  id: string;
  content: string;
  page_number: number | null;
  section_label: string | null;
}

const EXTRACT_TOOL: ClaudeToolSchema = {
  name: "extract_requirements",
  description: "Extract every discrete requirement the client is asking bidders to comply with or submit, from the given document excerpt.",
  input_schema: {
    type: "object",
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement_code: { type: "string", description: "A short reference, e.g. the clause number if visible in the text (\"ITT-4.2\"), otherwise a short slug you invent from the section heading." },
            category: { type: "string", enum: REQUIREMENT_CATEGORIES },
            description: { type: "string", description: "One or two sentences stating exactly what the bidder must do, provide, or comply with." },
            is_mandatory: { type: "boolean", description: "True only if the text uses mandatory language (must/shall/required) — false for optional/preferred items." },
            ai_confidence: { type: "string", enum: ["high", "medium", "low"] },
            page_number: { type: ["number", "null"] },
            section_label: { type: ["string", "null"] },
            quoted_text: { type: "string", description: "The exact sentence(s) from the source text this requirement is drawn from." },
          },
          required: ["requirement_code", "category", "description", "is_mandatory", "ai_confidence", "quoted_text"],
        },
      },
    },
    required: ["requirements"],
  },
};

const EXTRACT_SYSTEM = `You extract discrete, actionable requirements from a construction tender document for a bidder preparing their submission. ${SOURCE_OF_TRUTH_RULE} Only extract things the bidder must DO, PROVIDE, SUBMIT, or COMPLY WITH — skip narrative/background text, project descriptions, and anything that isn't an instruction to the bidder. Merge near-duplicate requirements from the same clause into one. If the excerpt has no extractable requirements, return an empty array.`;

const MAX_INPUT_CHARS = 40_000;

async function extractDocumentRequirements(env: TenderEnv, apiKey: string, doc: TenderDocumentRow): Promise<{ count: number; error?: string }> {
  const chunks = await sbGet<ChunkRow>(env, `tender_document_chunks?document_id=eq.${doc.id}&select=id,content,page_number,section_label&order=chunk_index.asc`);
  if (chunks.length === 0) return { count: 0 };

  const text = chunks
    .map((c) => `[Page ${c.page_number ?? "?"}${c.section_label ? ` — ${c.section_label}` : ""}]\n${c.content}`)
    .join("\n\n")
    .slice(0, MAX_INPUT_CHARS);

  let result;
  try {
    result = await callClaude({
      apiKey, system: EXTRACT_SYSTEM,
      userMessage: `Document: "${doc.file_name}"\n\n${text}`,
      tool: EXTRACT_TOOL, maxTokens: 8192,
    });
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : String(err) };
  }

  const items = Array.isArray(result.input.requirements) ? result.input.requirements as Record<string, unknown>[] : [];
  let inserted = 0;
  for (const item of items) {
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
        requirement_id: reqRow.id,
        document_id: doc.id,
        page_number: item.page_number ?? null,
        section_label: item.section_label ?? null,
        quoted_text: item.quoted_text ?? null,
      });
      if (item.is_mandatory) {
        const section = CATEGORY_TO_CHECKLIST_SECTION[item.category as string] ?? "administrative";
        await sbPost(env, "tender_checklist_items", {
          tender_id: doc.tender_id,
          requirement_id: reqRow.id,
          section,
          item_label: item.description,
          is_required: true,
          ai_generated: true,
          status: "not_started",
        }).catch(() => {}); // best-effort — a checklist item failing to insert shouldn't fail the whole requirement
      }
      inserted += 1;
    } catch {
      // one bad item shouldn't abort the rest of the document's requirements
    }
  }
  return { count: inserted };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const env = getTenderEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!env || !apiKey) return res.status(500).json({ error: "TenderAI backend not configured" });

  const userId = await getAuthedUserId(env, req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const tenderId = typeof req.body?.tenderId === "string" ? req.body.tenderId : "";
  if (!tenderId) return res.status(400).json({ error: "Missing tenderId" });

  const orgId = await authorizeTenderAccess(env, tenderId, userId).catch(() => null);
  if (!orgId) return res.status(403).json({ error: "Not authorized for this tender" });

  const startedAt = new Date().toISOString();
  const docs = await sbGet<TenderDocumentRow>(
    env,
    `tender_documents?tender_id=eq.${tenderId}&status=eq.processed&requirements_extracted_at=is.null&select=id,tender_id,file_name`,
  ).catch(() => []);

  if (docs.length === 0) {
    return res.status(200).json({ ok: true, documentsProcessed: 0, requirementsExtracted: 0 });
  }

  let totalRequirements = 0;
  const errors: string[] = [];
  for (const doc of docs) {
    const result = await extractDocumentRequirements(env, apiKey, doc);
    totalRequirements += result.count;
    if (result.error) errors.push(`${doc.file_name}: ${result.error}`);
    await sbPatch(env, `tender_documents?id=eq.${doc.id}`, { requirements_extracted_at: new Date().toISOString() }).catch(() => {});
  }

  await sbPost(env, "ai_jobs", {
    tender_id: tenderId, agent: "requirements_extractor", status: "succeeded",
    input_summary: { documentCount: docs.length }, output_summary: { requirementsExtracted: totalRequirements, errors },
    started_at: startedAt, finished_at: new Date().toISOString(),
  }).catch(() => {});

  return res.status(200).json({ ok: true, documentsProcessed: docs.length, requirementsExtracted: totalRequirements, errors });
}
