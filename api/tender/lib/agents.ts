/**
 * The four commercial agents — Phase 5 of the rebuild plan.
 *
 * Risk Register, Gap Analysis, Clarifications and Compliance Matrix. Each is
 * the same shape every agent in this module has always been: a system prompt,
 * one strict output schema, and the tables it is allowed to write. None of
 * them is a running process.
 *
 * They are dramatically easier on the clause spine than they would have been
 * before it. A risk cites a clause reference the model was shown rather than
 * guessing a page; a clarification can point at the exact ambiguous
 * sub-clause. Each is registered as a job type in jobs.ts, so all four cost
 * zero additional Vercel functions.
 */
import { callClaude, SOURCE_OF_TRUTH_RULE, type ClaudeToolSchema } from "./ai.js";
import { DEFAULT_EXTRACTION_MODEL } from "./requirements.js";
import { sbGet, sbPost, type TenderEnv } from "./auth.js";

const RISK_CATEGORIES = [
  "contract", "commercial", "technical", "design", "construction", "schedule", "procurement",
  "client", "authority", "hse", "qaqc", "site", "financial", "currency", "supply_chain",
] as const;

const GAP_CATEGORIES = [
  "experience", "personnel", "equipment", "financial", "certification", "insurance",
  "bond", "technical", "commercial", "administrative",
] as const;

const COMPLIANCE_VALUES = [
  "comply", "partially_comply", "deviation", "not_applicable", "need_clarification", "missing",
] as const;

/* ── Risk Register ────────────────────────────────────────────────────── */

const RISK_TOOL: ClaudeToolSchema = {
  name: "register_risks",
  description: "Record the commercial and technical risks a bidder takes on by accepting these contract conditions.",
  input_schema: {
    type: "object",
    properties: {
      risks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: RISK_CATEGORIES },
            description: { type: "string", description: "The risk to the bidder, in one or two sentences — what could go wrong and why this clause causes it." },
            clause_ref: { type: ["string", "null"], description: "The clause reference this risk comes from, exactly as shown in the source." },
            probability: { type: "number", description: "1 (rare) to 5 (near certain)." },
            impact: { type: "number", description: "1 (negligible) to 5 (severe)." },
            financial_exposure: { type: ["number", "null"], description: "Estimated exposure in the contract currency, only when the clause states or clearly implies an amount. Null otherwise — never invent a figure." },
            recommendation: { type: ["string", "null"], description: "What the bidder should do: price it, qualify it, raise an RFI, or accept it." },
            quoted_text: { type: "string", description: "The exact sentence(s) this risk is drawn from." },
          },
          required: ["category", "description", "probability", "impact", "quoted_text"],
        },
      },
    },
    required: ["risks"],
  },
};

const RISK_SYSTEM = `You identify risks a construction bidder takes on by accepting the given contract conditions. ${SOURCE_OF_TRUTH_RULE} Focus on clauses that shift risk onto the contractor: liquidated damages, payment terms and retention, fluctuation and currency, variations and claims procedure, time bars, indemnities, insurance limits, defects liability, termination, and force majeure. Score probability and impact 1-5 from the clause wording, not from general industry experience. Do not state a financial exposure unless the clause gives or clearly implies an amount.`;

/* ── Gap Analysis ─────────────────────────────────────────────────────── */

const GAP_TOOL: ClaudeToolSchema = {
  name: "identify_gaps",
  description: "Compare the tender's mandatory requirements against the bidding company's recorded capability and list what is missing.",
  input_schema: {
    type: "object",
    properties: {
      gaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: GAP_CATEGORIES },
            description: { type: "string", description: "What the tender demands, what the company has, and the size of the shortfall." },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "critical = the bid is non-responsive without closing it." },
            requirement_code: { type: ["string", "null"], description: "The requirement code this gap relates to." },
          },
          required: ["category", "description", "severity"],
        },
      },
    },
    required: ["gaps"],
  },
};

const GAP_SYSTEM = `You compare a construction tender's mandatory requirements against a bidding company's recorded capability, and list only the genuine shortfalls. ${SOURCE_OF_TRUTH_RULE} A gap exists when the tender demands something the company profile does not evidence — turnover thresholds, similar-project experience, certifications, key personnel qualifications, equipment, bonding or insurance capacity. Absence of evidence in the company profile is a gap worth flagging, but say so as "not evidenced in the company profile" rather than asserting the company lacks it. Mark a gap critical only when it would make the bid non-responsive.`;

/* ── Clarifications / RFIs ────────────────────────────────────────────── */

const CLARIFICATION_TOOL: ClaudeToolSchema = {
  name: "draft_clarifications",
  description: "Draft the clarification questions a bidder should raise before the RFI deadline.",
  input_schema: {
    type: "object",
    properties: {
      clarifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: ["string", "null"], description: "e.g. commercial, technical, programme, scope." },
            reference: { type: ["string", "null"], description: "Clause or drawing reference the question concerns." },
            question: { type: "string", description: "The question as it would be sent to the consultant — direct, specific, answerable yes/no or with a number." },
            reason: { type: ["string", "null"], description: "Why it is ambiguous: what two readings are possible." },
            potential_impact: { type: ["string", "null"], description: "What it changes commercially if answered one way rather than the other." },
            quoted_text: { type: "string", description: "The exact wording that is ambiguous or conflicting." },
          },
          required: ["question", "quoted_text"],
        },
      },
    },
    required: ["clarifications"],
  },
};

const CLARIFICATION_SYSTEM = `You draft clarification questions (RFIs) for a construction bidder. ${SOURCE_OF_TRUTH_RULE} Raise a question only where the tender is genuinely ambiguous, internally contradictory, or silent on something the bidder must price. Do not raise questions whose answer is already in the documents, and do not pad the list — a consultant who receives thirty questions answers them badly. Each question must be specific enough to be answered with a number, a yes/no, or a single clear statement.`;

/* ── Compliance Matrix ────────────────────────────────────────────────── */

const COMPLIANCE_TOOL: ClaudeToolSchema = {
  name: "draft_compliance",
  description: "Draft a compliance matrix line for each mandatory requirement.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement_code: { type: "string", description: "The requirement code this line answers." },
            reference: { type: ["string", "null"], description: "Clause reference from the tender." },
            contractor_response: { type: "string", description: "A one or two sentence draft response the bidder can edit — what they will provide and where it sits in the submission." },
            compliance: { type: "string", enum: COMPLIANCE_VALUES, description: "Default to need_clarification where the company profile gives no basis to claim compliance. Never claim comply on the company's behalf without evidence." },
            comment: { type: ["string", "null"] },
          },
          required: ["requirement_code", "contractor_response", "compliance"],
        },
      },
    },
    required: ["items"],
  },
};

const COMPLIANCE_SYSTEM = `You draft a compliance matrix for a construction bidder: one line per mandatory requirement, stating how the bidder responds. ${SOURCE_OF_TRUTH_RULE} These are drafts a quantity surveyor will edit and then sign, so never claim "comply" unless the company profile actually evidences it — use need_clarification where you have no basis, and deviation where the company's position genuinely differs. Overstating compliance here is how a bid gets accepted on terms the bidder cannot meet.`;

/* ── Shared input builders ────────────────────────────────────────────── */

interface RequirementRow {
  id: string; requirement_code: string; category: string; description: string; is_mandatory: boolean;
}
interface ClauseBodyRow { clause_ref: string; title: string | null; body: string; page_from: number | null }

/** Contract-bearing clauses, which is what a risk register is read from.
 *  Capped by character budget rather than clause count so one enormous
 *  clause cannot blow the request. */
async function contractClauses(env: TenderEnv, tenderId: string, budget = 60_000): Promise<string> {
  const docs = await sbGet<{ id: string }>(
    env,
    `tender_documents?tender_id=eq.${tenderId}&doc_category=in.(general_conditions,particular_conditions,tender_conditions,contract_form,employer_requirements,technical_specifications)&select=id`,
  ).catch(() => []);
  if (!docs.length) return "";

  const parts: string[] = [];
  let used = 0;
  for (const d of docs) {
    const rows = await sbGet<ClauseBodyRow>(
      env, `tender_clauses?document_id=eq.${d.id}&select=clause_ref,title,body,page_from&order=ordinal.asc`,
    ).catch(() => []);
    for (const r of rows) {
      if (!r.body.trim()) continue;
      const piece = `[Page ${r.page_from ?? "?"} — Clause ${r.clause_ref}${r.title ? `: ${r.title}` : ""}]\n${r.body}`;
      if (used + piece.length > budget) return parts.join("\n\n");
      parts.push(piece);
      used += piece.length + 2;
    }
  }
  return parts.join("\n\n");
}

async function mandatoryRequirements(env: TenderEnv, tenderId: string): Promise<RequirementRow[]> {
  return sbGet<RequirementRow>(
    env,
    `tender_requirements?tender_id=eq.${tenderId}&is_mandatory=eq.true&superseded_at=is.null&withdrawn_at=is.null&select=id,requirement_code,category,description,is_mandatory&order=requirement_code`,
  ).catch(() => []);
}

/** The bidding company's recorded capability — what a gap is measured
 *  against. Absent sections are left out rather than described as empty, so
 *  the model does not read "no personnel recorded" as "no personnel". */
async function companyProfile(env: TenderEnv, orgId: string): Promise<string> {
  const [profile, experience, personnel, equipment] = await Promise.all([
    sbGet<Record<string, unknown>>(env, `company_profiles?org_id=eq.${orgId}&select=*`).catch(() => []),
    sbGet<Record<string, unknown>>(env, `project_experience?org_id=eq.${orgId}&select=*`).catch(() => []),
    sbGet<Record<string, unknown>>(env, `personnel?org_id=eq.${orgId}&select=*`).catch(() => []),
    sbGet<Record<string, unknown>>(env, `tender_equipment?org_id=eq.${orgId}&select=*`).catch(() => []),
  ]);
  const section = (label: string, rows: unknown[]) =>
    rows.length ? `## ${label}\n${JSON.stringify(rows, null, 1)}` : "";
  return [
    section("Company profile", profile),
    section("Project experience", experience),
    section("Personnel", personnel),
    section("Equipment", equipment),
  ].filter(Boolean).join("\n\n");
}

/* ── Runners ──────────────────────────────────────────────────────────── */

export interface AgentOutcome { written: number; note: string }

const riskScore = (p: number, i: number) =>
  Math.max(1, Math.min(25, Math.round(p) * Math.round(i)));

export async function runRiskRegister(env: TenderEnv, apiKey: string, tenderId: string): Promise<AgentOutcome> {
  const text = await contractClauses(env, tenderId);
  if (!text.trim()) return { written: 0, note: "no contract or specification clauses parsed yet" };

  const { input } = await callClaude({
    apiKey, system: RISK_SYSTEM, userMessage: text, tool: RISK_TOOL,
    maxTokens: 8192, model: DEFAULT_EXTRACTION_MODEL,
  });
  const risks = Array.isArray(input.risks) ? input.risks as Record<string, unknown>[] : [];

  let written = 0;
  for (const r of risks) {
    const p = Number(r.probability ?? 3), i = Number(r.impact ?? 3);
    try {
      await sbPost(env, "tender_risks", {
        tender_id: tenderId, category: r.category, description: r.description,
        clause_ref: r.clause_ref ?? null, probability: Math.round(p), impact: Math.round(i),
        risk_score: riskScore(p, i), financial_exposure: r.financial_exposure ?? null,
        recommendation: r.recommendation ?? null, status: "open",
      });
      written += 1;
    } catch { /* one bad row must not abort the register */ }
  }
  return { written, note: `${written} risk(s)` };
}

export async function runGapAnalysis(env: TenderEnv, apiKey: string, tenderId: string, orgId: string): Promise<AgentOutcome> {
  const reqs = await mandatoryRequirements(env, tenderId);
  if (!reqs.length) return { written: 0, note: "no mandatory requirements extracted yet" };
  const profile = await companyProfile(env, orgId);

  const { input } = await callClaude({
    apiKey, system: GAP_SYSTEM, tool: GAP_TOOL, maxTokens: 8192, model: DEFAULT_EXTRACTION_MODEL,
    userMessage: `## Mandatory requirements\n${reqs.map((r) => `${r.requirement_code} [${r.category}] ${r.description}`).join("\n")}\n\n${profile || "## Company profile\n(nothing recorded)"}`,
  });
  const gaps = Array.isArray(input.gaps) ? input.gaps as Record<string, unknown>[] : [];
  const byCode = new Map(reqs.map((r) => [r.requirement_code, r.id]));

  let written = 0;
  for (const g of gaps) {
    try {
      await sbPost(env, "tender_gap_items", {
        tender_id: tenderId, category: g.category, description: g.description,
        severity: g.severity ?? "medium",
        related_requirement_id: byCode.get(String(g.requirement_code ?? "")) ?? null,
        resolved: false,
      });
      written += 1;
    } catch { /* skip */ }
  }
  return { written, note: `${written} gap(s)` };
}

export async function runClarifications(env: TenderEnv, apiKey: string, tenderId: string): Promise<AgentOutcome> {
  const text = await contractClauses(env, tenderId);
  if (!text.trim()) return { written: 0, note: "no clauses parsed yet" };

  const { input } = await callClaude({
    apiKey, system: CLARIFICATION_SYSTEM, userMessage: text, tool: CLARIFICATION_TOOL,
    maxTokens: 8192, model: DEFAULT_EXTRACTION_MODEL,
  });
  const items = Array.isArray(input.clarifications) ? input.clarifications as Record<string, unknown>[] : [];

  const existing = await sbGet<{ rfi_number: string | null }>(
    env, `tender_clarifications?tender_id=eq.${tenderId}&select=rfi_number`,
  ).catch(() => []);
  let next = existing.length + 1;

  let written = 0;
  for (const c of items) {
    try {
      await sbPost(env, "tender_clarifications", {
        tender_id: tenderId,
        rfi_number: `RFI-${String(next).padStart(3, "0")}`,
        category: c.category ?? null, reference: c.reference ?? null,
        question: c.question, reason: c.reason ?? null,
        potential_impact: c.potential_impact ?? null, selected_for_export: false,
      });
      next += 1; written += 1;
    } catch { /* skip */ }
  }
  return { written, note: `${written} clarification(s)` };
}

export async function runComplianceMatrix(env: TenderEnv, apiKey: string, tenderId: string, orgId: string): Promise<AgentOutcome> {
  const reqs = await mandatoryRequirements(env, tenderId);
  if (!reqs.length) return { written: 0, note: "no mandatory requirements extracted yet" };
  const profile = await companyProfile(env, orgId);

  const { input } = await callClaude({
    apiKey, system: COMPLIANCE_SYSTEM, tool: COMPLIANCE_TOOL, maxTokens: 8192, model: DEFAULT_EXTRACTION_MODEL,
    userMessage: `## Mandatory requirements\n${reqs.map((r) => `${r.requirement_code} [${r.category}] ${r.description}`).join("\n")}\n\n${profile || "## Company profile\n(nothing recorded)"}`,
  });
  const items = Array.isArray(input.items) ? input.items as Record<string, unknown>[] : [];
  const byCode = new Map(reqs.map((r) => [r.requirement_code, r.id]));

  let written = 0;
  for (const it of items) {
    try {
      await sbPost(env, "compliance_matrix_items", {
        tender_id: tenderId,
        requirement_id: byCode.get(String(it.requirement_code ?? "")) ?? null,
        reference: it.reference ?? null,
        contractor_response: it.contractor_response ?? null,
        compliance: it.compliance ?? "need_clarification",
        comment: it.comment ?? null,
      });
      written += 1;
    } catch { /* skip */ }
  }
  return { written, note: `${written} compliance line(s)` };
}
