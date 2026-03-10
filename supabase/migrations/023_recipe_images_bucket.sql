-- Ekip tarifleri fotoğrafları için public storage bucket
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = true;

-- Yol: team_id/recipe_id.ext — sadece ilgili ekip owner/manager yükleyebilir
create policy "recipe_images_insert_team_leader"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and exists (
    select 1 from public.teams t
    where t.id = (split_part(name, '/', 1))::uuid
      and (t.owner_id = auth.uid() or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);

create policy "recipe_images_select_public"
on storage.objects for select to public
using (bucket_id = 'recipe-images');

create policy "recipe_images_update_team_leader"
on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-images'
  and exists (
    select 1 from public.teams t
    where t.id = (split_part(name, '/', 1))::uuid
      and (t.owner_id = auth.uid() or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);

create policy "recipe_images_delete_team_leader"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-images'
  and exists (
    select 1 from public.teams t
    where t.id = (split_part(name, '/', 1))::uuid
      and (t.owner_id = auth.uid() or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);
