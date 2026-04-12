-- Operasyon maddeleri için açıklama/bilgi alanı
alter table if exists public.operation_tasks
add column if not exists details text;

