-- Fix: "infinite recursion detected in policy for relation team_members"
-- The read policy was querying team_members inside its own check, causing recursion.
-- Use a SECURITY DEFINER function to break the cycle.

create or replace function public.is_team_member_or_owner(check_user_id uuid, check_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = check_team_id and tm.user_id = check_user_id
  )
  or exists (
    select 1 from public.teams t
    where t.id = check_team_id and t.owner_id = check_user_id
  );
$$;

drop policy if exists "Team members read" on public.team_members;

create policy "Team members read" on public.team_members for select using (
  public.is_team_member_or_owner(auth.uid(), team_id)
);
