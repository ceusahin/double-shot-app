-- Ekip üyeliği değişince (katılma onayı, ayrılma) mobil istemcilerin anlık güncellenmesi için Realtime yayını.

do $do$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_members'
  ) then
    alter publication supabase_realtime add table public.team_members;
  end if;
end
$do$;
