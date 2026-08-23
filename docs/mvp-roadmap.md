# TenderAI — MVP Roadmap

## Phase 1 (this build) — ship order

Built and shipped incrementally, each step tested + deployed before the next,
matching how the rest of this repo has been built out:

1. Dedicated Supabase project + Phase 1 schema (`database-schema.md`) + RLS.
2. App shell: `/tender` routes, org context, nav, auth gate.
3. Organizations: create/join, Company Knowledge minimal profile.
4. Create Tender, Tender List, Tender Dashboard (static/derived fields first,
   AI-fed fields once the pipeline below exists).
5. Document upload (incl. ZIP folder-structure preservation) + storage.
6. Document processing: extract → classify → chunk (`process-document.ts`).
7. Tender Requirement Agent + Requirements page.
8. Checklist generation + Checklist page.
9. Compliance Matrix (AI-drafted, user-editable).
10. Tender Gap Agent + gap list (severity-sorted).
11. Contract/Technical Risk Agent + Risk Register.
12. Clarification Agent + RFI export.
13. Submission Generator Agent + Submission Manager tree + Document Editor
    (basic rich-text, not full AI-rewrite toolbar yet — see below).
14. Final Tender QA + readiness score + DOCX export.
15. Tender Chat.
16. Seed the ABC Manufacturing Factory demo tender, clearly flagged
    `is_demo = true` and visually labeled SAMPLE/DEMO DATA everywhere it's
    shown.

### Explicitly thin in Phase 1 (present but simplified)

- **Document Editor** — rich-text editing, source citation display, and
  version history (`submission_document_revisions`) ship Phase 1. The AI
  rewrite/expand/shorten/"check against tender" toolbar buttons are Phase 2 —
  Phase 1's generator produces the full draft up front; per-paragraph AI
  editing is a natural follow-on once the base editor is proven.
- **Permissions** — 3 coarse roles (`owner`/`admin`/`member`) rather than the
  spec's full per-module permission matrix. The CM app took a working coarse
  system live before building its 18-role matrix on top; same order here.
- **Retrieval** — Postgres full-text search, not pgvector/embeddings (see
  `architecture.md`). Requirement extraction and chat both work correctly at
  Phase 1 scale (dozens–hundreds of chunks per tender); embeddings become
  worth the added infra once cross-tender semantic search is an actual
  feature, not before.

## Phase 2

Ordered by what most directly improves the Phase 1 workflow before adding new
surface area:

1. **VE Agent** — depends on having a stable requirements/scope model to
   suggest alternatives against; premature before Phase 1's extraction proves
   reliable on real tenders.
2. **Scope Intelligence Agent + Scope Conflict Register** — cross-document
   diffing (BOQ vs. drawings vs. specs) is a genuinely hard extraction problem;
   worth building once there's a corpus of real processed tenders to test
   against, not synthetic ones.
3. **BOQ Agent + cost benchmarking** (`CostBenchmark`, `HistoricalProject`
   tables from the original spec) — needs several real tenders' BOQ data
   before benchmarking numbers mean anything.
4. **Document Editor AI toolbar** (rewrite/expand/shorten/check-against-tender).
5. **Method Statement Library** with per-tender adaptation.
6. **Full per-module permission matrix** (mirroring the CM app's role system).
7. **pgvector-based semantic retrieval**, replacing/augmenting full-text search.
8. **AI provider abstraction's second provider** (OpenAI) — only if a real
   need appears (cost, redundancy, a specific capability Claude lacks for this
   workload).

## Phase 3

Exactly as scoped in the original spec — drawing intelligence, DWG/IFC/Revit/
Tekla ingestion, automated quantity takeoff from drawings, Primavera/MS
Project/ERP integrations. None of Phase 1 or 2's architecture blocks these;
they're deferred because they require substantial new capability (real
drawing/BIM parsing) that has no dependency on anything Phase 1 builds, so
building them first would delay a working product for zero MVP benefit.

## What "done" means for this build session

Per the product spec's success criteria: a user can create a tender, upload a
real tender package, watch it get processed and classified, see every
extracted requirement with its source citation, view a generated compliance
matrix and risk register, generate clarifications, get a generated draft
submission with clearly marked missing-input placeholders, run Final Tender
QA, and export a DOCX. That end-to-end path is what Phase 1 is scoped to
prove — not full feature parity with the 46-section spec.
