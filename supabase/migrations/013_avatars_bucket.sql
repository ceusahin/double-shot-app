-- Profil fotoğrafları için public storage bucket ve politikaları
-- Bu dosyayı Supabase Dashboard -> SQL Editor'de çalıştırabilirsiniz.

drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- Bucket yoksa oluştur (sadece temel alanlar; tüm projelerde çalışır)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Authenticated kullanıcılar sadece kendi user id ile başlayan dosya adına yükleyebilir (örn. <user_id>.jpg)
create policy "avatars_insert_own"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and name like (auth.uid()::text || '.%'));

-- Public bucket: herkes okuyabilir
create policy "avatars_select_public"
on storage.objects for select to public
using (bucket_id = 'avatars');

-- Kullanıcı kendi dosyasını güncelleyebilir (upsert için; dosya adı <user_id>.uzantı)
create policy "avatars_update_own"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and name like (auth.uid()::text || '.%'))
with check (bucket_id = 'avatars');

-- Kullanıcı kendi dosyasını silebilir
create policy "avatars_delete_own"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and name like (auth.uid()::text || '.%'));
