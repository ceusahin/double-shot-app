-- Storage RLS policy'de public.teams / team_members okunurken RLS engeli olabiliyor.
-- SECURITY DEFINER fonksiyonu ile kontrolü yapıyoruz; fonksiyon definer yetkisiyle tablolara erişir.

create or replace function public.can_upload_recipe_image(object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.teams t
    where t.id::text = split_part(object_path, '/', 1)
      and (t.owner_id = auth.uid()
           or exists (
             select 1 from public.team_members tm
             where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'
           ))
  );
$$;

drop policy if exists "recipe_images_insert_team_leader" on storage.objects;
drop policy if exists "recipe_images_update_team_leader" on storage.objects;
drop policy if exists "recipe_images_delete_team_leader" on storage.objects;

create policy "recipe_images_insert_team_leader"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and public.can_upload_recipe_image(name)
);

create policy "recipe_images_update_team_leader"
on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-images'
  and public.can_upload_recipe_image(name)
);

create policy "recipe_images_delete_team_leader"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-images'
  and public.can_upload_recipe_image(name)
);
