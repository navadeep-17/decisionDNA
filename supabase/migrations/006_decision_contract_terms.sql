-- Persist explicit decision contracts so review criteria exist independently of later AI analysis.

create table if not exists public.decision_contract_terms (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  term_key text not null,
  term_type text not null check (term_type in ('assumption', 'success_criterion', 'reversal_condition')),
  term_text text not null,
  baseline_status text not null default 'active' check (baseline_status in ('active', 'not_met', 'unknown')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (decision_id, term_key)
);

create index if not exists decision_contract_terms_decision_idx
  on public.decision_contract_terms(decision_id, term_type, sort_order);

alter table public.decision_contract_terms enable row level security;

create policy "members can view decision contract terms"
on public.decision_contract_terms for select
using (
  exists (
    select 1
    from public.decisions d
    where d.id = decision_id
      and private.is_org_member(d.organization_id)
  )
);

-- DEC-021 already contained an explicit reconsideration clause in the NovaPay history.
-- These rows make that contract visible and machine-checkable in the product.
insert into public.decision_contract_terms (decision_id, term_key, term_type, term_text, baseline_status, sort_order)
select d.id, seed.term_key, seed.term_type, seed.term_text, seed.baseline_status, seed.sort_order
from public.decisions d
cross join (
  values
    ('A1', 'assumption', 'Checkout-session reliability requires avoiding Redis memory-eviction risk during burst traffic.', 'active', 10),
    ('A2', 'assumption', 'Operating Redis for checkout sessions creates unacceptable operational burden for the small Platform team.', 'active', 20),
    ('S1', 'success_criterion', 'Checkout sessions remain reliable during campaign-scale traffic without session loss.', 'active', 30),
    ('S2', 'success_criterion', 'The chosen session architecture keeps operational ownership manageable for the Platform team.', 'active', 40),
    ('R1', 'reversal_condition', 'Redis operational work is materially externalized through a managed service that handles scaling, failover, patching, backups, and capacity.', 'not_met', 50),
    ('R2', 'reversal_condition', 'Platform-team capacity expands substantially enough that Redis operational ownership is no longer a limiting constraint.', 'not_met', 60),
    ('R3', 'reversal_condition', 'Managed Redis demonstrates checkout-scale burst reliability with zero session loss and no manual Platform-team intervention.', 'not_met', 70)
) as seed(term_key, term_type, term_text, baseline_status, sort_order)
where d.decision_key = 'DEC-021'
on conflict (decision_id, term_key) do update
set term_type = excluded.term_type,
    term_text = excluded.term_text,
    baseline_status = excluded.baseline_status,
    sort_order = excluded.sort_order;
