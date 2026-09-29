-- Idempotent NovaPay demo seed for DecisionDNA.

with org as (
  insert into public.organizations (name, slug, hindsight_bank_id)
  values ('NovaPay', 'novapay', 'decisiondna-novapay')
  on conflict (slug) do update set hindsight_bank_id = excluded.hindsight_bank_id
  returning id
), org_id as (
  select id from org
  union all
  select id from public.organizations where slug='novapay' limit 1
), proj as (
  insert into public.projects (organization_id, name, slug, description)
  select id, 'Checkout', 'checkout', 'Checkout session architecture and reliability decisions' from org_id
  on conflict (organization_id, slug) do update set description = excluded.description
  returning id, organization_id
), proj_id as (
  select id, organization_id from proj
  union all
  select p.id, p.organization_id from public.projects p join public.organizations o on o.id=p.organization_id where o.slug='novapay' and p.slug='checkout' limit 1
)
insert into public.events (organization_id, project_id, external_id, event_type, title, content, source, event_date, hindsight_document_id)
select p.organization_id, p.id, v.external_id, v.event_type, v.title, v.content, 'synthetic-demo-data', v.event_date::timestamptz, v.external_id
from proj_id p
cross join (values
  ('EVT-001','proposal','Redis session store proposed','NovaPay Platform proposed moving checkout session state from PostgreSQL to a self-managed Redis cluster. The infrastructure team warned that operating another stateful system could increase on-call load.','2026-01-12T09:30:00Z'),
  ('EVT-002','decision','Redis approved for trial','Decision DEC-017 approved a limited rollout of self-managed Redis for checkout sessions, conditional on memory usage staying below 65 percent and no additional infrastructure headcount.','2026-01-18T11:00:00Z'),
  ('EVT-003','incident','INC-142 Redis memory pressure','During a promotion, Redis memory exceeded 92 percent, evictions increased, active sessions were lost, and checkout conversion dropped for 21 minutes.','2026-02-03T18:40:00Z'),
  ('EVT-004','investigation','INC-142 postmortem','The postmortem found underestimated burst traffic, weak capacity alarms, and insufficient infrastructure staff to safely tune and operate the cluster.','2026-02-04T10:15:00Z'),
  ('EVT-005','decision','Redis rejected for checkout sessions','Decision DEC-021 stopped using self-managed Redis for checkout sessions and returned to PostgreSQL. Redis could be reconsidered if operational ownership became externally managed or the infrastructure team expanded substantially.','2026-02-05T16:00:00Z'),
  ('EVT-006','outcome','PostgreSQL session outcome','PostgreSQL-backed sessions remained stable through two marketing campaigns and stayed within SLOs with no session-loss incidents.','2026-03-15T12:00:00Z'),
  ('EVT-007','capability_change','Managed Redis Cloud adopted','NovaPay adopted managed Redis Cloud for rate limiting and ephemeral workloads. The provider now owns patching, failover, memory scaling, backups, and capacity operations.','2026-08-14T09:00:00Z'),
  ('EVT-008','outcome','Managed Redis operating successfully','After four weeks of managed Redis Cloud usage, NovaPay reported no Redis-related incidents and materially lower operational effort.','2026-09-10T14:00:00Z')
) as v(external_id,event_type,title,content,event_date)
on conflict (organization_id, external_id) do update set title=excluded.title, content=excluded.content, event_date=excluded.event_date;

with p as (
  select p.id as project_id, p.organization_id
  from public.projects p join public.organizations o on o.id=p.organization_id
  where o.slug='novapay' and p.slug='checkout'
)
insert into public.decisions (organization_id, project_id, decision_key, title, summary, decision, rationale, status, confidence, decision_date)
select organization_id, project_id, 'DEC-017', 'Redis Trial Approved', 'Limited rollout of self-managed Redis for checkout sessions.', 'Approve a limited Redis trial subject to memory and staffing constraints.', 'Evaluate lower-latency session storage while ensuring memory stays below 65 percent under peak load and no additional infrastructure headcount is required.', 'superseded', 0.95, '2026-01-18T11:00:00Z'
from p
on conflict (organization_id, decision_key) do update set status='superseded', confidence=0.95, rationale=excluded.rationale;

with p as (
  select p.id as project_id, p.organization_id
  from public.projects p join public.organizations o on o.id=p.organization_id
  where o.slug='novapay' and p.slug='checkout'
)
insert into public.decisions (organization_id, project_id, decision_key, title, summary, decision, rationale, status, confidence, decision_date)
select organization_id, project_id, 'DEC-021', 'Redis Session Architecture', 'Return checkout sessions to PostgreSQL after the Redis incident.', 'Use PostgreSQL-backed checkout sessions instead of self-managed Redis.', 'INC-142 exposed memory-pressure risk and unsustainable operational burden for the small Platform team.', 'review_suggested', 0.94, '2026-02-05T16:00:00Z'
from p
on conflict (organization_id, decision_key) do update set status='review_suggested', confidence=0.94, rationale=excluded.rationale;

insert into public.decision_constraints (decision_id, constraint_text, status, original_evidence_event_id, changed_by_event_id, changed_at)
select d.id,
       'Redis operational ownership and memory-management burden must be manageable by NovaPay''s small Platform team.',
       'changed', e5.id, e7.id, '2026-08-14T09:00:00Z'
from public.decisions d
join public.organizations o on o.id=d.organization_id
join public.events e5 on e5.organization_id=o.id and e5.external_id='EVT-005'
join public.events e7 on e7.organization_id=o.id and e7.external_id='EVT-007'
where o.slug='novapay' and d.decision_key='DEC-021'
  and not exists (
    select 1 from public.decision_constraints c
    where c.decision_id=d.id and c.constraint_text like 'Redis operational ownership%'
  );

insert into public.decision_reviews (decision_id, status, reason, analysis, confidence, evidence_count)
select d.id,
       'review_suggested',
       'The original operational-ownership constraint changed after NovaPay adopted managed Redis Cloud.',
       'DEC-021 should be re-evaluated because a key assumption behind the original rejection is no longer true. This is a review recommendation, not an automatic migration decision.',
       0.94,
       20
from public.decisions d
join public.organizations o on o.id=d.organization_id
where o.slug='novapay' and d.decision_key='DEC-021'
  and not exists (
    select 1 from public.decision_reviews r where r.decision_id=d.id and r.status='review_suggested'
  );
