-- Geçmişte ekip üyeliği silinmiş ama aktif (check_out_time null) vardiya logu kalmış kayıtları kapat.
update public.shift_logs sl
set check_out_time = coalesce(sl.check_out_time, now())
where sl.check_out_time is null
  and not exists (
    select 1
    from public.team_members tm
    where tm.team_id = sl.team_id
      and tm.user_id = sl.user_id
  );

-- Aynı şekilde açık mola loglarını da kapat.
update public.shift_break_logs bl
set ended_at = coalesce(bl.ended_at, now())
where bl.ended_at is null
  and not exists (
    select 1
    from public.team_members tm
    where tm.team_id = bl.team_id
      and tm.user_id = bl.user_id
  );

-- Üye ekipten çıkarılınca vardiya/mola oturumlarını kapat + plan vardiyalarını temizle.
create or replace function public.delete_member_shifts_on_team_member_remove()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Aktif vardiyayı kapat
  update public.shift_logs
  set check_out_time = coalesce(check_out_time, now())
  where team_id = old.team_id
    and user_id = old.user_id
    and check_out_time is null;

  -- Aktif molaları kapat
  update public.shift_break_logs
  set ended_at = coalesce(ended_at, now())
  where team_id = old.team_id
    and user_id = old.user_id
    and ended_at is null;

  -- Atanmış plan vardiyalarını temizle
  delete from public.shifts
  where team_id = old.team_id
    and user_id = old.user_id;

  return old;
end;
$$;
