# TenderAI — Product Specification

## What it is

TenderAI is a tender operating system for construction contractors, EPC/MEP/steel
contractors, and design-build companies. A user uploads an entire tender package
(instructions to tenderers, conditions of contract, specifications, drawings, BOQ,
tender forms) and TenderAI turns that unstructured package into structured,
traceable data that drives the rest of the tender workflow — compliance, risk,
clarifications, and a generated draft submission.

It is not a "summarize this PDF" tool. Every requirement, risk, and generated
document section must trace back to a specific source file, page, and clause.

## Who uses it

- Tender managers, quantity surveyors, contract managers, design/construction
  managers, planning engineers, QA/QC and HSE engineers, procurement and
  commercial managers, document controllers — one company (an "organization")
  per bidding entity, multiple users collaborating on the same tender.

## Core workflow

```
Tender Documents → Structured Requirements → Compliance Analysis
                 → Tender Strategy → Generated Submission Documents
```

1. **Create Tender** — project/client/deadline metadata.
2. **Upload Package** — dozens to hundreds of files, folder structure preserved.
3. **Process** — extract text/tables, classify document type, chunk, index.
4. **Extract Requirements** — every submission obligation becomes a structured,
   sourced requirement row.
5. **Analyze** — checklist, compliance matrix, scope conflicts, gap analysis,
   contract risk register, clarifications.
6. **Generate Submission** — a draft, section-by-section submission built only
   from sections the actual tender requires, with `[USER INPUT REQUIRED: ...]`
   placeholders wherever real company facts are missing (never invented).
7. **Review & Export** — edit sections, resolve placeholders, run Final Tender
   QA, export to DOCX.

A tender cannot be marked **Ready for Submission** while any critical
placeholder or critical compliance gap is unresolved. The system never
auto-submits — a human always approves.

## MVP scope (Phase 1)

The full 46-section spec this product is derived from describes a mature,
multi-year platform. Phase 1 ships the following as one working, tested,
end-to-end slice — see `mvp-roadmap.md` for what's explicitly deferred and why:

1. Organizations + multi-user auth (Google OAuth, matching the rest of the site).
2. Create tender, tender list, tender dashboard.
3. Upload PDF/DOCX/XLSX/CSV/TXT/images/ZIP, folder structure preserved.
4. Text/table extraction + AI document classification.
5. Tender Requirement extraction (AI agent) with full source citation.
6. Tender Submission Checklist, auto-generated and groupable by section.
7. Compliance Matrix (editable).
8. Tender Gap Analysis (missing items, severity-scored).
9. Tender Risk Register (contract + technical, probability × impact scoring).
10. Clarification/RFI generator.
11. Submission Manager (tree view) + Submission Generator Agent (DOCX export).
12. Company Knowledge Base (profile, certificates, past projects, personnel) —
    minimal version: structured facts the Submission Generator can cite instead
    of inventing them.
13. Tender Chat with citations, scoped to the current tender's documents.
14. Final Tender QA / readiness score before export.

Deferred to Phase 2/3 (VE agent, cost benchmarking, drawing intelligence,
BIM/IFC, ERP integrations, scope-conflict cross-document diffing) per the
roadmap doc — these need real usage data from Phase 1 to design well, and
building them speculatively first would delay the working product.

## Non-negotiable AI safety rules

1. Never invent a tender requirement, company fact, employee qualification,
   financial figure, certification, or client reference.
2. Every AI-asserted requirement/fact carries a source citation (file, page,
   section/clause) and a confidence level (High/Medium/Low).
3. Distinguish, visibly, four kinds of content everywhere it appears in the UI:
   **Source fact** (quoted/derived from an uploaded document) · **AI
   interpretation** (the agent's reading of ambiguous source text) · **AI
   recommendation** (VE, clarification wording, risk mitigation — always
   flagged as requiring approval) · **User-entered information** (typed or
   uploaded by a human).
4. Missing information becomes a visible `[USER INPUT REQUIRED: ...]`
   placeholder, never a fabricated fill-in.
5. No automatic submission — every export requires explicit human action.
