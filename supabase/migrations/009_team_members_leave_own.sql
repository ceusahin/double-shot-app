-- Üye kendi ekibinden ayrılabilir (kendi team_members satırını silebilir).
-- Owner sadece başkalarını atar; kendi satırını silmez (takımı bırakmaz).
create policy "Team members delete own" on public.team_members for delete using (user_id = auth.uid());
