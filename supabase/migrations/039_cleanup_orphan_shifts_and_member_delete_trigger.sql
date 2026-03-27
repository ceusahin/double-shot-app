-- Önce geçmişte oluşmuş yetim vardiya kayıtlarını temizle:
-- team_members'ta karşılığı olmayan (team_id, user_id) vardiyalar silinir.
delete from public.shifts s
where not exists (
  select 1
  from public.team_members tm
  where tm.team_id = s.team_id
    and tm.user_id = s.user_id
);

-- Ekipten üye çıkarıldığında o üyenin ekipteki tüm vardiyalarını otomatik temizle.
create or replace function public.delete_member_shifts_on_team_member_remove()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.shifts
  where team_id = old.team_id
    and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_delete_member_shifts_on_team_member_remove on public.team_members;
create trigger trg_delete_member_shifts_on_team_member_remove
after delete on public.team_members
for each row
execute function public.delete_member_shifts_on_team_member_remove();
