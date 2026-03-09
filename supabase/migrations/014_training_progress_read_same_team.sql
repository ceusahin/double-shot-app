-- Aynı takımdaki üyelerin eğitim ilerlemesini (tamamlanan eğitimler / rozetler) okuyabilmek için.
drop policy if exists "Training progress read" on public.training_progress;
create policy "Training progress read" on public.training_progress for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id and tm2.user_id = training_progress.user_id
    where tm1.user_id = auth.uid()
  )
);
