-- DOUBLE SHOT - Eğitim akademisi alanları + Bugünün İpucu (dinamik veri)
-- Tarifler ve ekipman verisi uygulama tarafında statik kalır; diğer tüm içerik Supabase ile dinamik.

-- 1) Trainings tablosuna akademi alanları
alter table public.trainings
  add column if not exists category text,
  add column if not exists course_level text,
  add column if not exists duration_minutes int default 0,
  add column if not exists points int not null default 0,
  add column if not exists required_points int not null default 0,
  add column if not exists content text,
  add column if not exists type text not null default 'video' check (type in ('video', 'article'));

comment on column public.trainings.category is 'E.g. espresso, milk, brew';
comment on column public.trainings.course_level is 'E.g. A1, A2, B1, B2, C1';
comment on column public.trainings.required_points is 'Min XP to unlock this course';

-- 2) Bugünün İpucu – ana sayfada gösterilecek metin
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.tips enable row level security;

create policy "Tips read all" on public.tips for select using (auth.role() = 'authenticated');

-- 3) Bildirimler: kullanıcıya özel hedef (opsiyonel) – ekip bildirimi dışında
alter table public.notifications
  add column if not exists target_user_id uuid references public.users(id) on delete cascade,
  add column if not exists sender_id uuid references public.users(id) on delete set null;

comment on column public.notifications.target_user_id is 'When set, only this user sees the notification (e.g. kicked from team)';

-- Notifications RLS: ekip üyeleri veya hedef kullanıcı okuyabilsin
drop policy if exists "Notifications read" on public.notifications;
create policy "Notifications read" on public.notifications for select using (
  target_user_id = auth.uid()
  or exists (select 1 from public.team_members where team_id = notifications.team_id and user_id = auth.uid())
);

-- 4) Training progress: score nullable zaten var; completed ile birlikte kullanılır
-- (Mevcut training_progress yapısı yeterli)

-- 5) Quizzes: mevcut yapı option_a..d, correct_answer A-D – kalır
-- (Uygulama tarafında options array ve correct_index’e çevrilebilir)
