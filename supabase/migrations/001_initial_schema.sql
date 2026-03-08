-- DOUBLE SHOT - Initial schema
-- Run in Supabase SQL Editor or via Supabase CLI

-- Users (profiles) - id matches auth.users.id
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  surname text not null,
  email text not null unique,
  role text not null default 'BARISTA' check (role in ('BARISTA', 'MANAGER')),
  level text not null default 'Beginner' check (level in ('Beginner', 'Junior Barista', 'Barista', 'Senior Barista', 'Head Barista')),
  experience_points int not null default 0,
  profile_photo text,
  created_at timestamptz not null default now()
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  invite_code text not null unique,
  store_latitude double precision,
  store_longitude double precision,
  store_radius int,
  created_at timestamptz not null default now()
);

-- Team members
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'BARISTA' check (role in ('BARISTA', 'MANAGER')),
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

-- Shifts
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  role text not null default 'Barista'
);

-- Shift logs (check-in/out)
create table if not exists public.shift_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  check_in_time timestamptz not null,
  check_out_time timestamptz,
  location_lat double precision,
  location_lng double precision
);

-- Trainings
create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  title text not null,
  description text,
  video_url text,
  image_url text,
  created_at timestamptz not null default now()
);

-- Training progress
create table if not exists public.training_progress (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  completed boolean not null default false,
  score int,
  unique(training_id, user_id)
);

-- Quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D'))
);

-- Quiz attempts
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  selected_answer text not null check (selected_answer in ('A', 'B', 'C', 'D')),
  is_correct boolean not null
);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Forum posts
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Forum comments
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Recipes (global library)
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]'
);

-- Push tokens for Expo Push
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

-- RLS
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_logs enable row level security;
alter table public.trainings enable row level security;
alter table public.training_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.notifications enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.recipes enable row level security;
alter table public.push_tokens enable row level security;

-- Users: own row
create policy "Users read own" on public.users for select using (auth.uid() = id);
create policy "Users insert own" on public.users for insert with check (auth.uid() = id);
create policy "Users update own" on public.users for update using (auth.uid() = id);

-- Teams: members can read
create policy "Teams read" on public.teams for select using (
  exists (select 1 from public.team_members where team_id = teams.id and user_id = auth.uid())
  or owner_id = auth.uid()
);
create policy "Teams insert" on public.teams for insert with check (owner_id = auth.uid());
create policy "Teams update owner" on public.teams for update using (owner_id = auth.uid());

-- Team members
create policy "Team members read" on public.team_members for select using (
  exists (select 1 from public.team_members tm where tm.team_id = team_members.team_id and tm.user_id = auth.uid())
  or exists (select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid())
);
create policy "Team members insert" on public.team_members for insert with check (
  user_id = auth.uid() or exists (select 1 from public.teams where id = team_id and owner_id = auth.uid())
);
create policy "Team members delete owner" on public.team_members for delete using (
  exists (select 1 from public.teams where id = team_id and owner_id = auth.uid())
);

-- Shifts
create policy "Shifts read" on public.shifts for select using (
  exists (select 1 from public.team_members where team_id = shifts.team_id and user_id = auth.uid())
);
create policy "Shifts insert manager" on public.shifts for insert with check (
  exists (select 1 from public.team_members where team_id = shifts.team_id and user_id = auth.uid() and role = 'MANAGER')
  or exists (select 1 from public.teams where id = shifts.team_id and owner_id = auth.uid())
);

-- Shift logs
create policy "Shift logs read" on public.shift_logs for select using (user_id = auth.uid() or
  exists (select 1 from public.team_members where team_id = shift_logs.team_id and user_id = auth.uid()));
create policy "Shift logs insert" on public.shift_logs for insert with check (user_id = auth.uid());

-- Trainings: team or global
create policy "Trainings read" on public.trainings for select using (
  team_id is null or exists (select 1 from public.team_members where team_id = trainings.team_id and user_id = auth.uid())
);
create policy "Trainings insert" on public.trainings for insert with check (
  team_id is null or exists (select 1 from public.teams where id = trainings.team_id and owner_id = auth.uid())
);

-- Training progress
create policy "Training progress read" on public.training_progress for select using (user_id = auth.uid() or
  exists (select 1 from public.training_progress tp join public.trainings t on t.id = tp.training_id
    join public.team_members tm on tm.team_id = t.team_id where tp.id = training_progress.id and tm.user_id = auth.uid()));
create policy "Training progress insert" on public.training_progress for insert with check (user_id = auth.uid());
create policy "Training progress update" on public.training_progress for update using (user_id = auth.uid());

-- Quizzes: same as trainings
create policy "Quizzes read" on public.quizzes for select using (
  exists (select 1 from public.trainings t where t.id = quizzes.training_id and (t.team_id is null or
    exists (select 1 from public.team_members where team_id = t.team_id and user_id = auth.uid())))
);

-- Quiz attempts
create policy "Quiz attempts read" on public.quiz_attempts for select using (user_id = auth.uid());
create policy "Quiz attempts insert" on public.quiz_attempts for insert with check (user_id = auth.uid());

-- Notifications
create policy "Notifications read" on public.notifications for select using (
  exists (select 1 from public.team_members where team_id = notifications.team_id and user_id = auth.uid())
);

-- Forum posts
create policy "Forum posts read" on public.forum_posts for select using (true);
create policy "Forum posts insert" on public.forum_posts for insert with check (author_id = auth.uid());

-- Forum comments
create policy "Forum comments read" on public.forum_comments for select using (true);
create policy "Forum comments insert" on public.forum_comments for insert with check (author_id = auth.uid());

-- Recipes: public read
create policy "Recipes read" on public.recipes for select using (true);

-- Push tokens: own only
create policy "Push tokens own" on public.push_tokens for all using (user_id = auth.uid());

-- Trigger: create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, surname, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'surname', ''),
    new.email,
    'BARISTA'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
