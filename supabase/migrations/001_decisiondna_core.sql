-- DecisionDNA core product schema
-- Hindsight remains the source of truth for semantic/temporal memory.
-- Supabase stores product state, workflow state, and user-facing decision records.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  hindsight_bank_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  external_id text,
  event_type text not null check (event_type in ('proposal', 'decision', 'incident', 'investigation', 'outcome', 'constraint', 'capability_change', 'meeting', 'note')),
  title text not null,
  content text not null,
  source text not null default 'manual',
  event_date timestamptz not null,
  hindsight_document_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  decision_key text not null,
  title text not null,
  summary text,
  decision text not null,
  rationale text,
  status text not null default 'valid' check (status in ('proposed', 'valid', 'awaiting_outcome', 'review_suggested', 'reaffirmed', 'superseded')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  decision_date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_key)
);

create table if not exists public.decision_alternatives (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  alternative text not null,
  reason_rejected text,
  was_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_constraints (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  constraint_text text not null,
  status text not null default 'active' check (status in ('active', 'changed', 'invalid', 'unknown')),
  original_evidence_event_id uuid references public.events(id) on delete set null,
  changed_by_event_id uuid references public.events(id) on delete set null,
  changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_evidence (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  hindsight_memory_id text,
  relationship text not null check (relationship in ('supports', 'contradicts', 'resulted_in', 'invalidates_assumption', 'related')),
  evidence_text text,
  relevance numeric(4,3) check (relevance is null or (relevance >= 0 and relevance <= 1)),
  created_at timestamptz not null default now()
);

create table if not exists public.decision_reviews (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  status text not null default 'review_suggested' check (status in ('review_suggested', 'in_review', 'reaffirmed', 'superseded', 'dismissed')),
  reason text not null,
  analysis text,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_count integer not null default 0,
  hindsight_response jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists projects_org_idx on public.projects(organization_id);
create index if not exists events_org_date_idx on public.events(organization_id, event_date desc);
create index if not exists events_project_idx on public.events(project_id);
create index if not exists decisions_org_status_idx on public.decisions(organization_id, status);
create index if not exists decisions_project_idx on public.decisions(project_id);
create index if not exists decision_constraints_decision_idx on public.decision_constraints(decision_id);
create index if not exists decision_evidence_decision_idx on public.decision_evidence(decision_id);
create index if not exists decision_reviews_decision_idx on public.decision_reviews(decision_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists decisions_set_updated_at on public.decisions;
create trigger decisions_set_updated_at
before update on public.decisions
for each row execute function public.set_updated_at();

-- Row level security
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.events enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_alternatives enable row level security;
alter table public.decision_constraints enable row level security;
alter table public.decision_evidence enable row level security;
alter table public.decision_reviews enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

-- Organizations and membership
create policy "members can view organizations"
on public.organizations for select
using (public.is_org_member(id));

create policy "members can view memberships"
on public.organization_members for select
using (public.is_org_member(organization_id));

-- Organization-scoped product tables
create policy "members can view projects"
on public.projects for select
using (public.is_org_member(organization_id));

create policy "members can view events"
on public.events for select
using (public.is_org_member(organization_id));

create policy "members can view decisions"
on public.decisions for select
using (public.is_org_member(organization_id));

create policy "members can view decision alternatives"
on public.decision_alternatives for select
using (
  exists (
    select 1 from public.decisions d
    where d.id = decision_id and public.is_org_member(d.organization_id)
  )
);

create policy "members can view decision constraints"
on public.decision_constraints for select
using (
  exists (
    select 1 from public.decisions d
    where d.id = decision_id and public.is_org_member(d.organization_id)
  )
);

create policy "members can view decision evidence"
on public.decision_evidence for select
using (
  exists (
    select 1 from public.decisions d
    where d.id = decision_id and public.is_org_member(d.organization_id)
  )
);

create policy "members can view decision reviews"
on public.decision_reviews for select
using (
  exists (
    select 1 from public.decisions d
    where d.id = decision_id and public.is_org_member(d.organization_id)
  )
);

-- MVP writes are intended to go through trusted server routes using the service role key.
-- We intentionally do not grant direct client-side insert/update/delete policies yet.
