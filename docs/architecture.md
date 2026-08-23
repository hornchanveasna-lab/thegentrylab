# TenderAI — Architecture

## Key decision: reuse this repo's existing stack, not a new Next.js app

The build spec this doc is derived from recommends Next.js + Prisma + S3 +
a job queue as a greenfield stack. That's the wrong call for this repository,
and the decision is made here explicitly rather than left implicit:

- This repo is a **Vite + TanStack Router/Start** SPA already deployed at
  `thegentrylab.io`, with a real, working Vercel serverless backend
  (`/api/*.ts`, Web-standard `Request`/`Response` handlers — see `/api/chat.ts`,
  `/api/advisor.ts`) that already calls the Anthropic API directly
  (`ANTHROPIC_API_KEY` is already configured in the Vercel project).
- The **CM app** (`src/routes/cm/*`, `src/lib/cm-data.ts`,
  `src/lib/cm-permissions.ts`) is a proven precedent for exactly this shape of
  problem: multi-tenant, permission-gated, file-upload-heavy, Supabase-backed
  module living inside this same site. TenderAI follows the same pattern:
  routes under `/tender/*`, a shared design-system file
  (`src/components/tender/shared.tsx`), a data-access layer
  (`src/lib/tender-data.ts`), and Supabase for everything Prisma/Postgres/S3
  would have done.
- Introducing Next.js would mean a second framework, a second deployment
  target, and a second auth/session system living alongside the one that
  already works. None of that buys anything the existing stack can't already
  do — TanStack Start's server route handlers and Vercel's Node functions
  cover the "backend" role Next.js API routes would have played.

Every "use X" instruction in the original spec is mapped below to what this
decision actually uses instead, and why.

| Spec said | TenderAI uses | Why |
|---|---|---|
| Next.js + TypeScript + Tailwind + shadcn/ui | Existing Vite + TanStack Router + Tailwind v4 + Radix (already the site's stack) | Same UI capability, zero new framework |
| Next.js server architecture | Vercel serverless functions under `/api/tender/*.ts` (existing pattern) | Already proven in this repo (`/api/chat.ts`, `/api/advisor.ts`) |
| PostgreSQL + Prisma | Supabase Postgres, queried via `@supabase/supabase-js` (matching every other module in this repo) | No ORM needed at this scale; RLS gives multi-tenancy for free; matches 100% of existing code |
| S3-compatible storage / MinIO | Supabase Storage (private bucket, signed URLs) | Already used for CM app photos; no new infra |
| Auth: "a secure modern solution" | Supabase Auth (Google OAuth), `organizations` + `organization_members` tables for multi-tenancy | Matches every other authenticated area of the site |
| AI provider abstraction (Claude + OpenAI) | Direct Anthropic Claude calls via a thin `callClaude()` wrapper in `/api/tender/lib/ai.ts`; the wrapper's signature is provider-agnostic so a second provider is a follow-up, not a rewrite | `ANTHROPIC_API_KEY` already configured; OpenAI adds a second billing relationship for zero MVP benefit |
| pgvector retrieval | Postgres full-text search (`tsvector`/`ILIKE`) for Phase 1, matching the existing `api/lib/rag.ts` pattern; pgvector is a Phase 2 upgrade once there's real usage to justify embedding-generation cost | Ships a working RAG loop today without an embeddings pipeline; documented upgrade path, not a blocker |
| Job queue for document processing | No queue infra for Phase 1. Each uploaded file is processed by one short Vercel function call (extract → classify → store), tracked via a `status` column polled by the client (same UX pattern the CM app already uses with TanStack Query). Files needing longer processing are chunked into multiple short calls rather than one long-running job. | Avoids standing up Redis/BullMQ before there's proof it's needed; Vercel function time limits are the real constraint driving this |

## New Supabase project

TenderAI gets its **own dedicated Supabase project** (like the CM app has its
own, separate from the marketing site's). Reasons:
- Clean RLS/multi-tenancy story — no risk of a policy bug leaking marketing-site
  or CM-app data into a tender org's queries, or vice versa.
- Independent scaling/backup/cost tracking for a genuinely different product.
- Matches the precedent already set by this repo (3 separate Supabase projects
  already exist for 3 separate products).

Env vars added: `VITE_TENDER_SUPABASE_URL`, `VITE_TENDER_SUPABASE_ANON_KEY`
(client-side, RLS-protected) and `TENDER_SUPABASE_SERVICE_ROLE_KEY` (server-only,
used by `/api/tender/*.ts` functions the same way `SUPABASE_SERVICE_ROLE_KEY`
is used by `/api/chat.ts` today).

## Folder structure

```
src/
  routes/
    tender.tsx                 # /tender layout: org check, nav shell
    tender/
      index.tsx                # Dashboard
      list.tsx                 # Tender List
      new.tsx                  # Create Tender
      $tenderId/
        index.tsx              # Tender Overview
        documents.tsx
        requirements.tsx
        scope.tsx
        boq.tsx
        compliance.tsx
        clarifications.tsx
        risks.tsx
        ve.tsx
        submission.tsx
        submission.$docId.tsx  # Document Editor
        chat.tsx
      knowledge.tsx             # Company Knowledge
      projects.tsx              # Project Experience
      people.tsx                 # CVs
      equipment.tsx
      templates.tsx              # Method statement library
      settings.tsx
  components/
    tender/
      shared.tsx                # design system: Card, StatusBadge, FileTree, etc.
      DocumentUploader.tsx
      RequirementTable.tsx
      ComplianceMatrixTable.tsx
      RiskRegisterTable.tsx
      SubmissionTree.tsx
  lib/
    tender-supabase.ts          # dedicated client, mirrors lib/supabase.ts
    tender-data.ts               # types + hooks (mirrors cm-data.ts)
    tender-permissions.ts        # org-role permission checks
api/
  tender/
    lib/
      ai.ts                      # callClaude() wrapper, model/prompt helpers
      extract.ts                 # PDF/DOCX/XLSX text+table extraction
      chunk.ts                   # chunking + citation-preserving splits
    process-document.ts          # extract → classify → chunk → store (per file)
    extract-requirements.ts       # Tender Requirement Agent
    generate-checklist.ts
    generate-compliance.ts
    gap-analysis.ts               # Tender Gap Agent
    risk-register.ts
    clarifications.ts
    generate-submission.ts        # Submission Generator Agent
    final-qa.ts                   # Final Submission Review Agent
    chat.ts                       # Tender Chat, scoped to one tender's docs
docs/
  product-spec.md
  architecture.md
  database-schema.md
  ai-agent-architecture.md
  mvp-roadmap.md
```

## Request flow example: uploading a document

1. Client uploads file to Supabase Storage (tender-scoped path:
   `{org_id}/{tender_id}/{original/relative/path}`), preserving ZIP/folder
   structure client-side before upload.
2. Client inserts a `tender_documents` row (`status: "uploaded"`).
3. Client calls `POST /api/tender/process-document` with the document id.
4. The function (service-role Supabase access): downloads the file, extracts
   text/tables (`api/tender/lib/extract.ts`), calls Claude once to classify the
   document type + pull header metadata (doc number, revision, date,
   discipline), chunks the text with page/section anchors preserved, inserts
   `tender_document_chunks` rows, updates `tender_documents.status →
   "processed"`.
5. Client's TanStack Query subscription (polling `tender_documents.status`)
   updates the UI when done — no queue, no websocket needed for MVP.
6. Once all documents in a tender are processed, the user triggers
   `POST /api/tender/extract-requirements`, which runs the Tender Requirement
   Agent over all chunks and writes `tender_requirements` + `requirement_sources`
   rows.

## Auth & multi-tenancy

- `organizations` (a bidding company) ← `organization_members` (user + role) ←
  `tenders` (owned by one org). Every tender-scoped table carries `org_id`;
  RLS policies restrict all access to `org_id IN (caller's orgs)`. This is the
  direct equivalent of Prisma's org-scoped queries, enforced at the database
  layer instead of the application layer — stronger guarantee, less code.
- Roles per `organization_members`: `owner`, `admin`, `member`. Fine-grained
  per-module permissions (à la the CM app's 18-role system) are a Phase 2
  item once there's a real need for e.g. "QS can edit BOQ but not Risk
  Register" — Phase 1 ships with the 3 coarse roles.
