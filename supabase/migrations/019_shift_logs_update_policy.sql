-- Çalışan kendi vardiya kaydında check_out_time güncelleyebilsin (mesaiden çıkış).
-- UPDATE politikası olmadığı için checkout başarısız oluyordu; lider tarafında hâlâ mesaide görünüyordu.
create policy "Shift logs update own" on public.shift_logs
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
