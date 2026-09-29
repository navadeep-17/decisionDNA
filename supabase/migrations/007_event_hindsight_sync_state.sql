-- DecisionDNA ingestion hardening
-- Adds idempotency and explicit Supabase <-> Hindsight synchronization state.
-- This migration is intentionally non-destructive for existing demo data.

alter table public.events
  add column if not exists idempotency_key text,
  add column if not exists hindsight_sync_status text not null default 'pending',
  add column if not exists hindsight_sync_error text,
  add column if not exists hindsight_sync_attempts integer not null default 0,
  add column if not exists hindsight_synced_at timestamptz;

-- Existing rows that already carry a Hindsight document id are known to be synchronized.
update public.events
set hindsight_sync_status = 'synced',
    hindsight_synced_at = coalesce(hindsight_synced_at, created_at),
    hindsight_sync_error = null
where hindsight_document_id is not null
  and hindsight_sync_status <> 'synced';

alter table public.events
  drop constraint if exists events_hindsight_sync_status_check;

alter table public.events
  add constraint events_hindsight_sync_status_check
  check (hindsight_sync_status in ('pending', 'synced', 'failed'));

alter table public.events
  drop constraint if exists events_hindsight_sync_attempts_check;

alter table public.events
  add constraint events_hindsight_sync_attempts_check
  check (hindsight_sync_attempts >= 0);

create unique index if not exists events_org_idempotency_key_uidx
  on public.events(organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists events_hindsight_sync_status_idx
  on public.events(organization_id, hindsight_sync_status, created_at desc);

comment on column public.events.idempotency_key is
  'SHA-256 fingerprint for de-duplicating equivalent ingestion requests inside an organization.';
comment on column public.events.hindsight_sync_status is
  'Synchronization lifecycle for Hindsight retention: pending, synced, or failed.';
comment on column public.events.hindsight_sync_error is
  'Last Hindsight synchronization error, cleared after a successful retry.';
comment on column public.events.hindsight_sync_attempts is
  'Number of Hindsight retain attempts for this event.';
