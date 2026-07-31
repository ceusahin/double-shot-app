-- Google OAuth metadata: full_name / given_name / family_name

create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := nullif(trim(coalesce(meta->>'full_name', meta->>'name', '')), '');
  given_name text := nullif(trim(coalesce(meta->>'given_name', '')), '');
  family_name text := nullif(trim(coalesce(meta->>'family_name', meta->>'surname', '')), '');
  first_name text;
  last_name text;
begin
  if given_name is not null then
    first_name := given_name;
  elsif full_name is not null then
    first_name := split_part(full_name, ' ', 1);
  else
    first_name := '';
  end if;

  if family_name is not null then
    last_name := family_name;
  elsif full_name is not null and position(' ' in full_name) > 0 then
    last_name := trim(substring(full_name from position(' ' in full_name) + 1));
  else
    last_name := '';
  end if;

  insert into public.users (id, name, surname, email)
  values (new.id, first_name, last_name, new.email);
  return new;
end;
$$ language plpgsql security definer;
