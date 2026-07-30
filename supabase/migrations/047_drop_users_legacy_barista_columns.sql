-- Eski barista eğitim profili: users.role, level, experience_points kaldırılıyor.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, surname, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'surname', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

alter table public.users drop column if exists role;
alter table public.users drop column if exists level;
alter table public.users drop column if exists experience_points;
