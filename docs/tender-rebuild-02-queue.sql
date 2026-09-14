-- TenderAI rebuild, migration 02 — turn ai_jobs into a real queue (Phase 3)
--
-- Run against the TenderAI Supabase project, after migration 01.
--
-- Today the browser loops document-by-document to dodge Vercel's 60-second
-- function limit, so closing the tab stops a 200-file package half-way.
-- ai_jobs already exists and is being used as a *log*; this inverts it into
-- the queue and has Postgres drive it, because Vercel Hobby's own cron only
-- fires once a day.

alter table ai_jobs
  add column if not exists job_type       text,
  add column if not exists payload        jsonb not null default '{}'::jsonb,
  add column if not exists attempts       int not null default 0,
  add column if not exists max_attempts   int not null default 3,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists claimed_at     timestamptz,
  add column if not exists last_error     text;

-- status values: queued | running | succeeded | failed
-- Partial index: the drain only ever looks for runnable work, so the index
-- stays small no matter how much history accumulates.
create index if not exists ai_jobs_runnable_idx
  on ai_jobs (next_attempt_at)
  where status = 'queued';

create index if not exists ai_jobs_tender_status_idx
  on ai_jobs (tender_id, status);

-- Atomic claim. FOR UPDATE SKIP LOCKED is what makes it safe for more than
-- one drain to run at once — two overlapping cron firings, or a cron firing
-- while someone clicks a manual retry, take disjoint sets of jobs instead of
-- both running the same one and double-charging for the same extraction.
create or replace function claim_tender_jobs(p_limit int default 3)
returns setof ai_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update ai_jobs j
     set status     = 'running',
         claimed_at = now(),
         started_at = now(),
         attempts   = j.attempts + 1
   where j.id in (
     select id
       from ai_jobs
      where status = 'queued'
        and next_attempt_at <= now()
      order by next_attempt_at
      limit p_limit
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function claim_tender_jobs(int) from public, anon, authenticated;

-- A job left 'running' for longer than this was almost certainly killed
-- mid-flight by the function timeout. Returning it to the queue is what
-- makes the queue survive a crash rather than quietly losing work.
create or replace function requeue_stalled_tender_jobs(p_older_than interval default '5 minutes')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with revived as (
    update ai_jobs
       set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
           last_error = coalesce(last_error, 'stalled — reclaimed by sweeper'),
           next_attempt_at = now()
     where status = 'running'
       and claimed_at < now() - p_older_than
    returning 1
  )
  select count(*) into n from revived;
  return n;
end;
$$;

revoke all on function requeue_stalled_tender_jobs(interval) from public, anon, authenticated;

-- ── Drain schedule ───────────────────────────────────────────────────────
-- Requires the pg_cron and pg_net extensions (Database → Extensions in the
-- Supabase dashboard). The schedule lives here rather than in vercel.json
-- because Vercel Hobby crons fire at most once per day, which is useless for
-- draining a queue.
--
-- Set these two first, replacing the placeholders:
--   select vault.create_secret('https://<your-app>/api/tender/jobs', 'tender_jobs_url');
--   select vault.create_secret('<TENDER_JOB_SECRET>',                'tender_jobs_secret');
-- TENDER_JOB_SECRET must match the environment variable of the same name in
-- Vercel — it is what stops anyone on the internet draining your queue.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('tender-drain-jobs') where exists (
  select 1 from cron.job where jobname = 'tender-drain-jobs'
);

select cron.schedule(
  'tender-drain-jobs',
  '* * * * *',
  $cron$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'tender_jobs_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tender-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tender_jobs_secret')
    ),
    body    := '{"action":"drain"}'::jsonb
  );
  $cron$
);

select cron.unschedule('tender-requeue-stalled') where exists (
  select 1 from cron.job where jobname = 'tender-requeue-stalled'
);

select cron.schedule(
  'tender-requeue-stalled',
  '*/5 * * * *',
  $cron$ select requeue_stalled_tender_jobs(); $cron$
);
