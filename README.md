# DOUBLE SHOT

Kafeler ve barista takımları için vardiya, eğitim ve iletişim uygulaması.

## Teknolojiler

- **Mobile:** React Native, Expo, TypeScript
- **State:** Zustand
- **Data:** React Query, Supabase (Auth, DB, Storage, Realtime)
- **UI:** Tema tabanlı StyleSheet (kahve paleti)

## Kurulum

1. Bağımlılıklar:
   ```bash
   npm install
   ```

2. Ortam değişkenleri:
   - `.env.example` dosyasını `.env` olarak kopyalayın.
   - Supabase projenizden `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` değerlerini girin.

3. Supabase:
   - [Supabase](https://supabase.com) projesi oluşturun.
   - SQL Editor’da `supabase/migrations/001_initial_schema.sql` dosyasını çalıştırın.
   - **Authentication → Providers** içinde Email’i açın; isteğe bağlı Google ekleyin.
   - **Geliştirme için:** Authentication → Providers → Email → **Confirm email**’i kapatın. Böylece kayıt sonrası e-posta onayı beklemeden giriş yapılır ve "rate limit" riski azalır.

4. Çalıştırma:
   ```bash
   npx expo start
   ```

## Proje yapısı

- `src/components` – Card, Button, Input, Avatar, ProgressBar, LeaderboardItem, ShiftBlock, TrainingCard
- `src/screens` – Auth, Home, Teams, Training, Forum, Profile, TeamDetail, ShiftCheckIn, CreateTeam, JoinTeam
- `src/navigation` – RootNavigator, AuthStack, MainTabs, TeamsStack
- `src/services` – supabase, auth, teams, shifts
- `src/store` – authStore (Zustand)
- `src/hooks` – useAuth, useLocation
- `src/utils` – theme, haversine
- `src/types` – TypeScript tipleri

## Özellikler (MVP)

- E-posta ile giriş / kayıt
- Takım oluşturma, davet kodu ile katılma
- Vardiya planlama (yönetici)
- GPS ile vardiya girişi (mağaza yarıçapı)
- Eğitim modülleri ve quiz
- Liderlik tablosu (XP)
- Shot bildirimleri (acil uyarılar)
- Profil, seviye ve XP

## Tasarım

- Primary: `#6F4E37`
- Secondary: `#C4A484`
- Background: `#F7F6F4`
- Accent: `#2F2F2F`

---

**Double Shot** – Barista takımlarınızı tek yerden yönetin.
