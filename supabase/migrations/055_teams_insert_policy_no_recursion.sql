-- Teams INSERT politikasındaki "SELECT count(*) FROM teams" RLS altında Teams↔team_members döngüsüne giriyordu.
-- Sayım SECURITY DEFINER ile yapılır (RLS atlanır).

create or replace function public.count_teams_owned_by(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Geçersiz kullanım';
  end if;
  return (select count(*)::int from public.teams where owner_id = p_user_id);
end;
$$;

comment on function public.count_teams_owned_by(uuid) is 'RLS özyinelemesini önlemek için sahip olunan ekip sayısı; INSERT politikasında kullanılır.';

grant execute on function public.count_teams_owned_by(uuid) to authenticated;

drop policy if exists "Teams insert" on public.teams;
create policy "Teams insert"
on public.teams
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.is_super_admin = true
        or u.is_platform_admin = true
        or (
          public.count_teams_owned_by(auth.uid()) < coalesce(u.max_owned_teams, 0)
        )
      )
  )
);
