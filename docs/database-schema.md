# TenderAI — Database Schema (Phase 1)

Lives in its own Supabase project (see `architecture.md`). All tables use
`uuid` primary keys (`gen_random_uuid()`) and `created_at`/`updated_at`
timestamps unless noted. RLS is enabled on every table; policy shape is one
rule: `org_id IN (SELECT org_id FROM organization_members WHERE user_id =
auth.uid())` (read), narrowed to specific roles for writes where noted.

Entities from the original 46-section spec not listed here (CostBenchmark,
HistoricalProject beyond the minimal `project_experience`, MethodStatement
template versioning, full AuditLog detail) are deferred — see
`mvp-roadmap.md`. This is the actual Phase 1 schema, not the full spec's
34-entity list.

## Identity & tenancy

```sql
organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  short_name    text,
  logo_url      text,
  created_at    timestamptz default now()
)

organization_members (
  org_id        uuid references organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('owner','admin','member')),
  created_at    timestamptz default now(),
  primary key (org_id, user_id)
)
```

## Tender

```sql
tenders (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  name                  text not null,
  client                text,
  consultant            text,
  location              text,
  tender_reference      text,
  issue_date            date,
  submission_deadline   timestamptz,
  project_type          text,     -- industrial_factory | warehouse | logistics | steel_structure
                                    -- | peb_building | multistorey | infrastructure | mep
                                    -- | design_build | epc | residential | commercial | stadium | other
  contract_type         text,
  currency              text default 'USD',
  bidding_company        text,     -- may differ from org name (subsidiary/JV bidding entity)
  status                text not null default 'draft'
                          check (status in ('draft','processing','analysis','submission','submitted','archived')),
  tender_manager_id      uuid references auth.users(id),
  is_demo               boolean not null default false,  -- true for the seeded ABC Manufacturing sample
  created_by            uuid references auth.users(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
)
```

## Documents

```sql
tender_documents (
  id                uuid primary key default gen_random_uuid(),
  tender_id         uuid not null references tenders(id) on delete cascade,
  storage_path      text not null,        -- Supabase Storage path
  relative_path     text not null,        -- preserves uploaded folder structure, e.g. "07 BOQ/boq-main.xlsx"
  file_name         text not null,
  file_type         text not null,        -- pdf | docx | xlsx | xls | csv | txt | image | zip
  file_size_bytes   bigint,
  doc_category      text,                 -- see classification list in ai-agent-architecture.md; null until classified
  doc_category_source text default 'ai' check (doc_category_source in ('ai','user')),
  doc_number        text,
  revision          text,
  doc_date          date,
  discipline        text,
  status            text not null default 'uploaded'
                      check (status in ('uploaded','processing','processed','failed')),
  processing_error  text,
  uploaded_by       uuid references auth.users(id),
  created_at        timestamptz default now()
)

-- Chunked, searchable text with citation anchors. pgvector `embedding` column
-- is added in Phase 2 (see architecture.md) — Phase 1 relies on `content_tsv`.
tender_document_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references tender_documents(id) on delete cascade,
  tender_id     uuid not null references tenders(id) on delete cascade, -- denormalized for RLS + fast scoped search
  chunk_index   int not null,
  content       text not null,
  page_number   int,
  section_label text,          -- e.g. "Clause 7.3" or "Sheet S-201"
  content_tsv   tsvector generated always as (to_tsvector('english', content)) stored,
  created_at    timestamptz default now()
)
create index on tender_document_chunks using gin (content_tsv);
```

## Requirements

```sql
tender_requirements (
  id                    uuid primary key default gen_random_uuid(),
  tender_id             uuid not null references tenders(id) on delete cascade,
  requirement_code       text not null,   -- e.g. "REQ-014", generated per-tender
  category              text not null,   -- administrative | legal | commercial | technical | financial
                                           -- | planning | design | construction | qaqc | hse | environmental
                                           -- | procurement | personnel | equipment | experience | insurance
                                           -- | bond | warranty | subcontracting | pricing | tender_forms
  description           text not null,
  is_mandatory          boolean not null default true,
  submission_stage       text,             -- e.g. "technical", "commercial", "prequalification"
  responsible_department text,
  required_format        text,
  required_template      text,
  requires_signature      boolean default false,
  requires_stamp          boolean default false,
  required_evidence       text,
  due_date               date,
  status                text not null default 'open'
                          check (status in ('open','in_progress','missing_info','ready','approved')),
  assigned_to            uuid references auth.users(id),
  ai_confidence          text check (ai_confidence in ('high','medium','low')),
  notes                  text,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
)

-- Every requirement traces to >=1 source location — never a bare AI claim.
requirement_sources (
  id              uuid primary key default gen_random_uuid(),
  requirement_id  uuid not null references tender_requirements(id) on delete cascade,
  document_id     uuid not null references tender_documents(id) on delete cascade,
  chunk_id        uuid references tender_document_chunks(id),
  page_number     int,
  section_label   text,
  quoted_text     text     -- the exact source sentence(s) the requirement was derived from
)
```

## Checklist, compliance, gaps

```sql
-- The checklist is a curated view over requirements (grouped by the spec's
-- A–I sections) plus checklist-only bookkeeping fields, so it's its own table
-- rather than reusing tender_requirements directly.
tender_checklist_items (
  id                uuid primary key default gen_random_uuid(),
  tender_id         uuid not null references tenders(id) on delete cascade,
  requirement_id    uuid references tender_requirements(id) on delete set null,
  section           text not null,  -- administrative | commercial | technical | planning | qaqc
                                      -- | hse | company_qualification | personnel | equipment
  item_label        text not null,
  is_required       boolean not null default true,
  document_available boolean not null default false,
  ai_generated       boolean not null default false,
  needs_human_input  boolean not null default true,
  assigned_to        uuid references auth.users(id),
  due_date           date,
  status             text not null default 'not_started'
                       check (status in ('not_started','ai_drafted','in_review','missing_information','ready','approved','submitted')),
  compliance_status  text check (compliance_status in ('comply','partially_comply','deviation','not_applicable','need_clarification','missing')),
  created_at         timestamptz default now(),
  updated_at          timestamptz default now()
)

compliance_matrix_items (
  id                uuid primary key default gen_random_uuid(),
  tender_id         uuid not null references tenders(id) on delete cascade,
  requirement_id    uuid references tender_requirements(id) on delete set null,
  reference         text,     -- clause/section reference shown in the matrix
  contractor_response text,
  compliance        text not null default 'need_clarification'
                       check (compliance in ('comply','partially_comply','deviation','not_applicable','need_clarification','missing')),
  document_ref      text,
  comment           text,
  updated_by        uuid references auth.users(id),
  updated_at        timestamptz default now()
)

tender_gap_items (
  id            uuid primary key default gen_random_uuid(),
  tender_id     uuid not null references tenders(id) on delete cascade,
  category      text not null,   -- document | form | signature | data | qualification | experience
                                  -- | personnel | equipment | schedule | method_statement | bond
                                  -- | insurance | certificate | boq | clause
  description   text not null,
  severity      text not null check (severity in ('critical','high','medium','low')),
  related_requirement_id uuid references tender_requirements(id) on delete set null,
  resolved      boolean not null default false,
  created_at    timestamptz default now()
)
```

## Risk, VE, clarifications

```sql
tender_risks (
  id            uuid primary key default gen_random_uuid(),
  tender_id     uuid not null references tenders(id) on delete cascade,
  category      text not null,  -- contract | commercial | technical | design | construction | schedule
                                  -- | procurement | client | authority | hse | qaqc | site | financial
                                  -- | currency | supply_chain
  description   text not null,
  clause_ref    text,
  probability   int not null check (probability between 1 and 5),
  impact        int not null check (impact between 1 and 5),
  risk_score    int generated always as (probability * impact) stored,
  financial_exposure numeric,
  recommendation text,
  status        text not null default 'open' check (status in ('open','mitigated','accepted','closed')),
  created_at    timestamptz default now()
)

tender_clarifications (
  id            uuid primary key default gen_random_uuid(),
  tender_id     uuid not null references tenders(id) on delete cascade,
  rfi_number    text,
  category      text,   -- technical | commercial | contractual | scope | design | boq | schedule | material | mep | structural
  reference     text,
  question      text not null,
  reason        text,
  potential_impact text,
  selected_for_export boolean not null default false,
  created_at    timestamptz default now()
)

-- Deferred to Phase 2 per mvp-roadmap.md: tender_ve_suggestions,
-- scope_conflict_register, boq_items/cost benchmarking tables.
```

## Submission

```sql
submission_sections (
  id            uuid primary key default gen_random_uuid(),
  tender_id     uuid not null references tenders(id) on delete cascade,
  volume        text not null,   -- e.g. "Volume 1 — Commercial & Administrative"
  title         text not null,
  sort_order    int not null,
  applicable    boolean not null default true,  -- false = AI determined this section doesn't apply to this tender
  created_at    timestamptz default now()
)

submission_documents (
  id                uuid primary key default gen_random_uuid(),
  section_id        uuid not null references submission_sections(id) on delete cascade,
  tender_id         uuid not null references tenders(id) on delete cascade,
  title             text not null,
  content_md        text,             -- current draft content, markdown
  ai_status         text not null default 'not_started'
                       check (ai_status in ('not_started','ai_drafted','in_review','ready','approved')),
  owner_id          uuid references auth.users(id),
  revision          int not null default 1,
  has_unresolved_placeholders boolean not null default false,
  compliance_status text,
  last_updated_by   uuid references auth.users(id),
  updated_at        timestamptz default now(),
  created_at        timestamptz default now()
)

submission_document_revisions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references submission_documents(id) on delete cascade,
  revision        int not null,
  content_md      text not null,
  edited_by       uuid references auth.users(id),
  created_at      timestamptz default now()
)
```

## Company knowledge (reusable across tenders)

```sql
company_profiles (
  org_id            uuid primary key references organizations(id) on delete cascade,
  legal_name        text,
  registration_no    text,
  license_no         text,
  iso_certificates   jsonb default '[]',  -- [{name, number, expiry, file_url}]
  hse_summary        text,
  qaqc_policy        text,
  financial_summary  text,
  capability_summary text,
  updated_at         timestamptz default now()
)

project_experience (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  project_name    text not null,
  client          text,
  consultant      text,
  country         text,
  location        text,
  project_type    text,
  contract_value  numeric,
  currency        text,
  area_m2         numeric,
  duration_months int,
  completion_date date,
  scope_summary   text,
  steel_tonnage   numeric,
  key_features    text,
  reference_person text,
  photos          jsonb default '[]',
  created_at      timestamptz default now()
)

personnel (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  full_name       text not null,
  current_position text,
  education       text,
  certifications  jsonb default '[]',
  years_experience numeric,
  languages       text,
  cv_file_url     text,
  created_at      timestamptz default now()
)

equipment (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  category      text,
  ownership     text check (ownership in ('owned','rented')),
  quantity      int default 1,
  created_at    timestamptz default now()
)
```

## Cross-cutting

```sql
tender_activity_log (
  id            uuid primary key default gen_random_uuid(),
  tender_id     uuid not null references tenders(id) on delete cascade,
  user_id       uuid references auth.users(id),
  action        text not null,   -- upload | delete | ai_generate | ai_regenerate | edit | status_change | approve | export
  entity_type   text,
  entity_id     uuid,
  detail        jsonb,
  created_at    timestamptz default now()
)

ai_jobs (
  id            uuid primary key default gen_random_uuid(),
  tender_id     uuid not null references tenders(id) on delete cascade,
  agent         text not null,   -- e.g. "document_classifier", "requirement_extractor"
  status        text not null default 'running' check (status in ('running','succeeded','failed')),
  input_summary jsonb,
  output_summary jsonb,
  error         text,
  started_at    timestamptz default now(),
  finished_at   timestamptz
)
```

## Indexes worth calling out

- `tender_documents(tender_id, status)` — dashboard polling.
- `tender_requirements(tender_id, category)`, `(tender_id, status)`.
- `tender_document_chunks(tender_id)` — RLS + scoped full-text search.
- `tender_risks(tender_id, risk_score desc)` — risk register default sort.
