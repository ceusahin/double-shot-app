-- DOUBLE SHOT - İlk ipucu + örnek eğitimler ve quizler (dinamik veri seed)
-- team_id = null => global akademi, herkes görebilir.

insert into public.tips (body)
select 'Mükemmel bir espresso shot için extraction (demleme) süresi ortalama 25–30 saniye arasında olmalıdır. Aksi halde acı (over-extracted) veya ekşi (under-extracted) olabilir.'
where not exists (select 1 from public.tips limit 1);

-- Örnek global eğitimler (team_id null)
-- Not: id'leri sabit UUID ile vermek seed için kolay; uygulama gen_random ile de yeni ekleyebilir.
insert into public.trainings (id, team_id, title, description, category, course_level, duration_minutes, points, required_points, content, type, image_url) values
  ('a1000000-0000-4000-8000-000000000001', null, 'Kahve Makinesi Temelleri', 'Espresso makinesi ve temel parçalar', 'espresso', 'A1', 8, 30, 0, 'Öncelikle espresso makinesini tanımalıyız. Buhar çubuğu ne işe yarar? Portafiltre nereye takılır? Makineyi sabahları nasıl açarız?', 'video', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80'),
  ('a1000000-0000-4000-8000-000000000002', null, 'Mükemmel Espresso Ekstraksiyonu', '4 M kuralı ve çekim ayarları', 'espresso', 'A2', 8, 50, 0, 'Espresso yapımında 4 M kuralı çok kritiktir: Macinazione (Öğütme), Miscela (Harman), Macchina (Makine) ve Mano (El/Barista yeteneği).', 'video', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&q=80'),
  ('a1000000-0000-4000-8000-000000000003', null, 'Latte Art: Kalp Deseni', 'Süt köpürtme ve kalp çizimi', 'milk', 'A2', 5, 50, 0, 'Latte art dökümünde amaç mikrokremalı sütü (60°C civarı) elde edip kahvenin kreması üzerinde kontrast yaratmaktır.', 'article', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&q=80')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  course_level = excluded.course_level,
  duration_minutes = excluded.duration_minutes,
  points = excluded.points,
  required_points = excluded.required_points,
  content = excluded.content,
  type = excluded.type,
  image_url = excluded.image_url;

-- trainings tablosunda id primary key, on conflict (id) için id'lerin varlığı gerekir; yeni insert'lerde id verildi.
-- Eğer tablo boşsa insert çalışır. Var olan satırları güncellemek için önce kontrol gerekebilir.
-- PostgreSQL'de insert ... on conflict (id) do update için unique/primary key gerekir (id zaten PK).

-- Quiz soruları (training_id = ilk iki eğitime)
-- correct_answer: A=0, B=1, C=2, D=3 (option_a..d sırasıyla)
insert into public.quizzes (training_id, question, option_a, option_b, option_c, option_d, correct_answer) values
  ('a1000000-0000-4000-8000-000000000001', 'Portafiltre nedir?', 'Kahvenin çekildiği değirmen', 'Espresso makinesine takılan kahve süzgeci/kolu', 'Buhar çubuğu', 'Süt köpürtme cezvesi', 'B'),
  ('a1000000-0000-4000-8000-000000000001', 'Buhar çubuğu (Steam Wand) ne işe yarar?', 'Süt köpürtmek ve ısıtmak için', 'Kahve öğütmek için', 'Filtre kahve demlemek için', 'Fincanı yıkamak için', 'A'),
  ('a1000000-0000-4000-8000-000000000001', 'Makine ilk açıldığında ilk iş ne yapılmalıdır?', 'Hemen kahve yapılmalıdır', 'Makinenin ve suyun ısınması beklenmelidir', 'Tamping yapılmalıdır', 'Makine temizlenmelidir', 'B'),
  ('a1000000-0000-4000-8000-000000000002', 'Espresso kaç saniyede demlenmelidir?', '10-15s', '25-30s', '45-60s', '1dk+', 'B'),
  ('a1000000-0000-4000-8000-000000000002', 'Standart bir Single Espresso kaç ml/gram civarıdır?', '15-20 ml', '30 ml', '60 ml', '100 ml', 'B'),
  ('a1000000-0000-4000-8000-000000000002', 'Mükemmel shot için kahve dozu (Double Sepet) ne kadar olmalıdır?', '7-9 gr', '11-13 gr', '16-20 gr', '35 gr', 'C');

-- Seed bir kere çalıştırılmalı; tekrar çalışırsa aynı quiz satırları tekrar eklenebilir.
