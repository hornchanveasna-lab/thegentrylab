# TenderAI — AI Agent Architecture

## Provider

Direct Anthropic Claude calls via `api/tender/lib/ai.ts`'s `callClaude()`
wrapper (model + system prompt + user content in, parsed JSON or markdown
out). `ANTHROPIC_API_KEY` is already configured in this Vercel project (used
today by `/api/chat.ts` and `/api/advisor.ts`). The wrapper's call signature
(`callClaude({ system, messages, maxTokens, jsonSchema? })`) doesn't leak
Anthropic-specific request shape into callers, so adding a second provider
later means implementing one more function with the same signature — not a
rewrite of every agent.

## Orchestration model (Phase 1)

The spec calls for 16 named agents behind a full orchestrator. Phase 1
implements this as **one Claude call per pipeline stage**, each with a single,
narrow responsibility and a strict output schema — the "agent" is the prompt +
schema + the specific table(s) it writes, not a separate running process.
A lightweight orchestrator function decides which stage to run next based on
`tenders.status` and each stage's completion state; there's no message-passing
runtime because nothing here needs one yet.

| Stage (spec's agent name) | Endpoint | Reads | Writes |
|---|---|---|---|
| Document Classification Agent | `process-document.ts` (runs inline per file) | one document's extracted text | `tender_documents.doc_category`, `doc_number`, `revision`, `doc_date`, `discipline` |
| Tender Requirement Agent | `extract-requirements.ts` | all `tender_document_chunks` for the tender | `tender_requirements`, `requirement_sources` |
| (checklist generation, not a separate spec agent) | `generate-checklist.ts` | `tender_requirements` | `tender_checklist_items` |
| Compliance Checker Agent | `generate-compliance.ts` | `tender_requirements` | `compliance_matrix_items` (draft `contractor_response`/`compliance` — user edits from there) |
| Tender Gap Agent | `gap-analysis.ts` | `tender_requirements`, `company_profiles`, `project_experience`, `personnel`, `equipment` | `tender_gap_items` |
| Contract/Technical Risk Agent | `risk-register.ts` | `tender_document_chunks` (conditions of contract + technical spec categories) | `tender_risks` |
| Clarification Agent | `clarifications.ts` | `tender_requirements`, `tender_gap_items` | `tender_clarifications` |
| Submission Generator Agent | `generate-submission.ts` | `tender_requirements`, `company_profiles`, `project_experience`, `personnel` | `submission_sections`, `submission_documents` (with `[USER INPUT REQUIRED: ...]` placeholders) |
| Final Submission Review Agent | `final-qa.ts` | all submission documents + requirements | `tenders` readiness fields (see below), doesn't write new rows — read-only QA pass |

Scope Intelligence Agent, VE Agent, Scope Conflict detection, BOQ Agent, and
Planning Agent are Phase 2 — see `mvp-roadmap.md`. Their prompts follow the
exact same pattern once added.

## Source-of-truth rule (applies to every stage)

Every stage's prompt includes this instruction verbatim, and every JSON schema
requires a `source` object per claim:

```
You are extracting/analyzing information from tender documents. For every
requirement, risk, or fact you output, you MUST include the exact source:
document name, page number (if known), and section/clause label (if known),
plus a direct quote of the sentence(s) it came from. If you cannot point to a
specific source for something, either omit it or mark it explicitly as your
own interpretation with confidence "low" — never state it as a bare fact.
```

`callClaude()` rejects (throws, caller surfaces an error rather than writing
partial data) any structured-output response that's missing a `source` field
on an item that isn't explicitly flagged `"kind": "interpretation"` or
`"kind": "recommendation"`.

## Confidence levels

Every requirement, risk, and gap item carries `ai_confidence: high | medium |
low`. Rule of thumb enforced in each prompt:
- **High** — explicit, unambiguous clause language.
- **Medium** — requirement is clearly implied but the exact wording is
  ambiguous, or it's synthesized from more than one clause.
- **Low** — inferred from general context, not a specific clause; always
  flagged for human review before it affects compliance status.

## Document classification categories

The fixed category list from the spec (Instructions to Tenderers, Tender
Conditions, General/Particular Conditions, Employer Requirements, Technical
Specifications, Architectural/Structural/MEP/Infrastructure Drawings, BOQ,
Pricing Schedule, Tender Form, Contract Form, Addendum, Clarification, Scope
of Work, Project Schedule, QA/QC Requirements, HSE Requirements, Environmental
Requirements, Insurance Requirements, Bonds/Guarantees, Financial
Requirements, Company Qualification Requirements, Key Personnel Requirements,
Equipment Requirements, Material Requirements, Subcontractor Requirements,
Testing and Commissioning, Warranty, Handover Requirements, Other) is stored
as a plain `text` column (not a Postgres enum) specifically so the list can
grow without a migration — the classifier prompt is the source of truth for
valid values, and the UI's manual-correction dropdown reads from a shared
TypeScript const array (`TENDER_DOC_CATEGORIES` in `src/lib/tender-data.ts`)
kept in sync with the prompt by hand (both live in this repo, reviewed
together).

## Document extraction pipeline (`api/tender/lib/extract.ts`)

- **PDF** — `pdfjs-dist` (already a dependency), page-by-page text extraction
  with page numbers preserved for citation.
- **DOCX** — `mammoth` (new dependency, added in this phase) → plain text +
  paragraph structure.
- **XLSX/XLS/CSV** — `xlsx` (already a dependency, used by the CM app's BOQ
  importer) → per-sheet rows, kept as structured data (not flattened to text)
  so BOQ/pricing schedules can be queried as tables later, not just searched
  as prose.
- **Images** — stored, not OCR'd in Phase 1 (spec's Phase 3 territory —
  drawing intelligence). A document classified as a drawing gets its metadata
  (sheet number, discipline) extracted from the filename/user input, not
  image content, until real drawing intelligence is built.
- **ZIP** — expanded client-side before upload so `relative_path` (preserving
  the folder structure) is set per file; the ZIP itself isn't stored.

## Tender Chat

`api/tender/chat.ts` follows the same shape as `/api/chat.ts` (existing
GentryBot pattern): retrieve relevant `tender_document_chunks` for the current
tender via Postgres full-text search on the user's question (keyword
extraction, same technique as `api/lib/rag.ts`), inject them into the system
prompt as cited context, stream the response. Every factual claim in the
answer must cite the chunk(s) it came from (document name + page/section) —
enforced the same way as every other agent's `source` requirement.

## Final Tender QA scoring

`final-qa.ts` computes a **Tender Readiness Score** (0–100) from, in order of
weight: unresolved critical placeholders (heaviest penalty), unresolved
critical/high gap items, `tender_requirements` with `status != 'ready'`,
internal consistency checks (dates, company/client names, tender reference
consistent across all generated documents — a straightforward string-diff
across `submission_documents.content_md`, not an AI call). Status maps to
`not_ready` (any critical issue) / `ready_for_management_review` (only
major/minor issues) / `ready_for_submission` (zero critical, zero major).
This function never changes `tenders.status` itself — it reports the score
and issue list; a human clicks the status change.
