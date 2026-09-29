-- Add covering indexes for foreign keys reported by Supabase advisor.

create index if not exists decision_alternatives_decision_idx on public.decision_alternatives(decision_id);
create index if not exists decision_constraints_original_event_idx on public.decision_constraints(original_evidence_event_id);
create index if not exists decision_constraints_changed_event_idx on public.decision_constraints(changed_by_event_id);
create index if not exists decision_evidence_event_idx on public.decision_evidence(event_id);
create index if not exists decision_reviews_reviewed_by_idx on public.decision_reviews(reviewed_by);
create index if not exists events_created_by_idx on public.events(created_by);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
