-- Bir kişi en fazla 1 ekibe üye olabilir; işletme müdürü (en az bir ekibin owner'ı) ise birden fazla ekibe dahil olabilir.

create or replace function public.check_team_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count int;
  is_owner boolean;
begin
  -- Bu kullanıcının (new.user_id) kaç ekibe üye sayılacağı: INSERT'ta mevcut satırlar, UPDATE'ta diğer satırlar (güncellenen satır hariç)
  select count(*) into member_count
  from public.team_members
  where user_id = new.user_id
    and (tg_op = 'INSERT' or id <> new.id);

  -- En az bir ekibin sahibi mi?
  select exists (
    select 1 from public.teams where owner_id = new.user_id
  ) into is_owner;

  -- Zaten 1 (veya daha fazla) ekipte üye ve kullanıcı hiçbir ekibin sahibi değilse yeni üyelik eklenemez
  if member_count >= 1 and not is_owner then
    raise exception 'Bir kişi en fazla bir ekibe üye olabilir. İşletme müdürü (ekip sahibi) birden fazla işletmede yer alabilir.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists check_team_member_count_trigger on public.team_members;
create trigger check_team_member_count_trigger
  before insert or update on public.team_members
  for each row
  execute function public.check_team_member_count();

comment on function public.check_team_member_count() is 'En fazla 1 ekip üyeliği (ekip sahibi hariç); işletme müdürü birden fazla ekibe sahip olabilir.';
