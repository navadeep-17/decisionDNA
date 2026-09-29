-- Allow authenticated organization members to add and synchronize organizational events.

drop policy if exists "members can create events" on public.events;
create policy "members can create events"
on public.events for insert to authenticated
with check (
  created_by = auth.uid()
  and private.is_org_member(organization_id)
);

drop policy if exists "members can update own events" on public.events;
create policy "members can update own events"
on public.events for update to authenticated
using (
  created_by = auth.uid()
  and private.is_org_member(organization_id)
)
with check (
  created_by = auth.uid()
  and private.is_org_member(organization_id)
);
