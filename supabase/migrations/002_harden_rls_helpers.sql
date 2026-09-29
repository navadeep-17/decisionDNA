-- Harden helper functions used by DecisionDNA RLS policies.

create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;

drop policy if exists "members can view organizations" on public.organizations;
create policy "members can view organizations" on public.organizations for select using (private.is_org_member(id));

drop policy if exists "members can view memberships" on public.organization_members;
create policy "members can view memberships" on public.organization_members for select using (private.is_org_member(organization_id));

drop policy if exists "members can view projects" on public.projects;
create policy "members can view projects" on public.projects for select using (private.is_org_member(organization_id));

drop policy if exists "members can view events" on public.events;
create policy "members can view events" on public.events for select using (private.is_org_member(organization_id));

drop policy if exists "members can view decisions" on public.decisions;
create policy "members can view decisions" on public.decisions for select using (private.is_org_member(organization_id));

drop policy if exists "members can view decision alternatives" on public.decision_alternatives;
create policy "members can view decision alternatives" on public.decision_alternatives for select using (
  exists (select 1 from public.decisions d where d.id = decision_id and private.is_org_member(d.organization_id))
);

drop policy if exists "members can view decision constraints" on public.decision_constraints;
create policy "members can view decision constraints" on public.decision_constraints for select using (
  exists (select 1 from public.decisions d where d.id = decision_id and private.is_org_member(d.organization_id))
);

drop policy if exists "members can view decision evidence" on public.decision_evidence;
create policy "members can view decision evidence" on public.decision_evidence for select using (
  exists (select 1 from public.decisions d where d.id = decision_id and private.is_org_member(d.organization_id))
);

drop policy if exists "members can view decision reviews" on public.decision_reviews;
create policy "members can view decision reviews" on public.decision_reviews for select using (
  exists (select 1 from public.decisions d where d.id = decision_id and private.is_org_member(d.organization_id))
);

drop function if exists public.is_org_member(uuid);
