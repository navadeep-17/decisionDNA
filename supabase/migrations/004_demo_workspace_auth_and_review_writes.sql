-- Allow authenticated hackathon users to join only the seeded NovaPay demo workspace
-- and persist Decision Drift reviews. Other organizations remain membership-protected.

drop policy if exists "authenticated users can view novapay demo org" on public.organizations;
create policy "authenticated users can view novapay demo org"
on public.organizations for select to authenticated
using (slug = 'novapay');

drop policy if exists "authenticated users can join novapay demo" on public.organization_members;
create policy "authenticated users can join novapay demo"
on public.organization_members for insert to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
  and exists (
    select 1 from public.organizations o
    where o.id = organization_id
      and o.slug = 'novapay'
  )
);

drop policy if exists "members can create decision reviews" on public.decision_reviews;
create policy "members can create decision reviews"
on public.decision_reviews for insert to authenticated
with check (
  exists (
    select 1 from public.decisions d
    where d.id = decision_id
      and private.is_org_member(d.organization_id)
  )
);
