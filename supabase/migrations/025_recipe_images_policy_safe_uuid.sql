-- 22P02 (invalid_text_representation) önlemek için: path segment'ini ::uuid ile cast etmek yerine
-- team id ile metin karşılaştırması yapıyoruz (geçersiz UUID string cast hatası vermez).

drop policy if exists "recipe_images_insert_team_leader" on storage.objects;
drop policy if exists "recipe_images_update_team_leader" on storage.objects;
drop policy if exists "recipe_images_delete_team_leader" on storage.objects;

create policy "recipe_images_insert_team_leader"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and exists (
    select 1 from public.teams t
    where t.id::text = split_part(name, '/', 1)
      and (t.owner_id = auth.uid() or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);

create policy "recipe_images_update_team_leader"
on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-images'
  and exists (
    select 1 from public.teams t
    where t.id::text = split_part(name, '/', 1)
      and (t.owner_id = auth.uid() or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);

create policy "recipe_images_delete_team_leader"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-images'
  and exists (
    select 1 from public.teams t
    where t.id::text = split_part(name, '/', 1)
      and (t.owner_id = auth.uid() or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);
