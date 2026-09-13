/**
 * Requirements Extraction Agent — prompt, schema, and the pure extraction
 * call, with no database access.
 *
 * Split out of process-document.ts so the eval harness (evals/tender/) runs
 * against the *exact* prompt and schema production uses, rather than a copy
 * that silently drifts. process-document.ts keeps the Supabase read/write
 * around these; everything here is callable with nothing but an API key and
 * an array of chunks.
 *
 * Lives under lib/ so it does not consume one of Vercel's 12 Hobby-plan
 * serverless function slots — same reason ai.ts, auth.ts and extract.ts do.
 */
import { callClaude, SOURCE_OF_TRUTH_RULE, type ClaudeToolSchema } from "./ai.js";
import type { ClauseGroup } from "./clauses.js";

/** Default extraction model. Sonnet 5 replaces Sonnet 4.6: same tier, lower
 *  price ($2/$10 vs $3/$15 per MTok) and a 1M-token context window, which is
 *  what makes uncapped clause extraction possible at all. */
export const DEFAULT_EXTRACTION_MODEL = "claude-sonnet-5";

export const REQUIREMENT_CATEGORIES = [
  "administrative", "legal", "commercial", "technical", "financial", "planning", "design",
  "construction", "qaqc", "hse", "environmental", "procurement", "personnel", "equipment",
  "experience", "insurance", "bond", "warranty", "subcontracting", "pricing", "tender_forms",
] as const;

/** Maps a requirement's category to the checklist section it belongs
 *  under (CHECKLIST_SECTIONS in src/lib/tender-data.ts has fewer, broader
 *  buckets than the requirement categories do). */
export const CATEGORY_TO_CHECKLIST_SECTION: Record<string, string> = {
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

/** One stored chunk, as read back from tender_document_chunks. The eval
 *  supplies the same shape from a fixture file. */
export interface RequirementChunk {
  content: string;
  page_number: number | null;
  section_label: string | null;
}

export interface ExtractedRequirement {
  requirement_code: string;
  category: string;
  description: string;
  is_mandatory: boolean;
  ai_confidence: "high" | "medium" | "low";
  page_number?: number | null;
  section_label?: string | null;
  quoted_text: string;
}

export const EXTRACT_REQUIREMENTS_TOOL: ClaudeToolSchema = {
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

export const EXTRACT_REQUIREMENTS_SYSTEM = `You extract discrete, actionable requirements from a construction tender document for a bidder preparing their submission. ${SOURCE_OF_TRUTH_RULE} Only extract things the bidder must DO, PROVIDE, SUBMIT, or COMPLY WITH — skip narrative/background text, project descriptions, and anything that isn't an instruction to the bidder. Merge near-duplicate requirements from the same clause into one. If the excerpt has no extractable requirements, return an empty array.`;

/** The cap that Phase 2 of the rebuild plan removes. ~10k tokens against a
 *  model with a 1M-token window — everything past it is dropped with no
 *  error raised, which is precisely what the eval is built to measure. */
export const MAX_REQUIREMENTS_INPUT_CHARS = 40_000;

export interface RequirementsInput {
  /** What is actually sent to the model, after the cap is applied. */
  text: string;
  /** True when the assembled text exceeded the cap and lost its tail. */
  truncated: boolean;
  /** Assembled length before the cap — the gap between this and the cap is
   *  the material the model never sees. */
  fullLength: number;
  /** Highest page number whose content starts inside the cap. Anything on a
   *  later page was not read. Null when nothing was truncated, or when the
   *  source carried no page numbers (e.g. a spreadsheet). */
  cutoffPage: number | null;
  /** First character offset at which each page's content begins, so a caller
   *  can bucket a known requirement as inside or beyond the cap. */
  pageStart: Map<number, number>;
}

/** Assembles stored chunks into the single string the extractor sends, with
 *  the `[Page N — Section]` anchors the model relies on to cite accurately —
 *  then applies the cap. Kept separate from the API call so the eval can
 *  measure truncation without spending anything. */
export function buildRequirementsInput(
  chunks: RequirementChunk[],
  /** Override the cap. Production always uses the default; the eval lowers
   *  it to reproduce truncation behaviour on a short fixture, and Phase 2
   *  raises it to prove the effect of removing the limit. */
  maxChars: number = MAX_REQUIREMENTS_INPUT_CHARS,
): RequirementsInput {
  const pageStart = new Map<number, number>();
  const parts: string[] = [];
  let offset = 0;

  for (const c of chunks) {
    const header = `[Page ${c.page_number ?? "?"}${c.section_label ? ` — ${c.section_label}` : ""}]`;
    const piece = `${header}\n${c.content}`;
    if (c.page_number != null && !pageStart.has(c.page_number)) pageStart.set(c.page_number, offset);
    parts.push(piece);
    offset += piece.length + 2; // the "\n\n" the join adds
  }

  const full = parts.join("\n\n");
  const truncated = full.length > maxChars;
  const text = truncated ? full.slice(0, maxChars) : full;

  let cutoffPage: number | null = null;
  if (truncated) {
    for (const [page, start] of pageStart) {
      if (start < maxChars) {
        cutoffPage = cutoffPage === null ? page : Math.max(cutoffPage, page);
      }
    }
  }

  return { text, truncated, fullLength: full.length, cutoffPage, pageStart };
}

export interface ExtractionResult {
  requirements: ExtractedRequirement[];
  inputTokens: number;
  outputTokens: number;
  input: RequirementsInput;
}

/** One extraction call over one document's chunks. Throws on API failure —
 *  callers decide whether that is retryable. */
export async function extractRequirementsFromChunks(opts: {
  apiKey: string;
  fileName: string;
  chunks: RequirementChunk[];
  model?: string;
  maxChars?: number;
}): Promise<ExtractionResult> {
  const input = buildRequirementsInput(opts.chunks, opts.maxChars);
  if (!input.text.trim()) {
    return { requirements: [], inputTokens: 0, outputTokens: 0, input };
  }

  const result = await callClaude({
    apiKey: opts.apiKey,
    system: EXTRACT_REQUIREMENTS_SYSTEM,
    userMessage: `Document: "${opts.fileName}"\n\n${input.text}`,
    tool: EXTRACT_REQUIREMENTS_TOOL,
    maxTokens: 8192,
    model: opts.model,
  });

  const requirements = Array.isArray(result.input.requirements)
    ? (result.input.requirements as ExtractedRequirement[])
    : [];

  return { requirements, inputTokens: result.inputTokens, outputTokens: result.outputTokens, input };
}

/* ── Clause-based extraction (Phase 2) ────────────────────────────────────
 * The path above assembles chunks and cuts them at MAX_REQUIREMENTS_INPUT_CHARS.
 * This one takes a group of whole clauses and sends all of it. There is no
 * cap, because groupClauses() already sized the unit to finish inside
 * Vercel Hobby's 60-second limit — the constraint is satisfied by making the
 * unit small rather than by throwing away the tail of a large one.
 *
 * The rendered group text already carries `[Page N — Clause 4.3: Title]`
 * anchors, so the model cites clause references it can see rather than
 * inferring them, and `quoted_text` can be checked against a specific
 * clause body rather than a 40,000-character haystack.
 */
export async function extractRequirementsFromClauseGroup(opts: {
  apiKey: string;
  fileName: string;
  group: ClauseGroup;
  model?: string;
}): Promise<Omit<ExtractionResult, "input"> & { chars: number }> {
  if (!opts.group.text.trim()) {
    return { requirements: [], inputTokens: 0, outputTokens: 0, chars: 0 };
  }

  const result = await callClaude({
    apiKey: opts.apiKey,
    system: EXTRACT_REQUIREMENTS_SYSTEM,
    userMessage: `Document: "${opts.fileName}"\n\n${opts.group.text}`,
    tool: EXTRACT_REQUIREMENTS_TOOL,
    maxTokens: 8192,
    model: opts.model ?? DEFAULT_EXTRACTION_MODEL,
  });

  const requirements = Array.isArray(result.input.requirements)
    ? (result.input.requirements as ExtractedRequirement[])
    : [];

  return {
    requirements,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    chars: opts.group.chars,
  };
}
