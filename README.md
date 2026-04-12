# Ekibio (Double Shot)

Kafe ve barista ekipleri için **vardiya**, **operasyon görevleri**, **eğitim**, **tarifler**, **stok / eksik yönetimi** ve **takım iletişimi** odaklı bir mobil uygulama. Mağaza içi süreçleri tek uygulamada toplar; Supabase üzerinde çok kiracılı (organizasyon / takım) bir veri modeli ve ayrıntılı **RBAC** (rol tabanlı erişim) kullanır.

> **Not:** Depo adı `double-shot-app`, Expo yapılandırmasında görünen uygulama adı **Ekibio** (`app.json` → `name`).

---

## İçindekiler

- [Özellikler](#özellikler)
- [Teknoloji yığını](#teknoloji-yığını)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Supabase veritabanı](#supabase-veritabanı)
- [Çalıştırma ve derleme](#çalıştırma-ve-derleme)
- [Proje yapısı](#proje-yapısı)
- [Mimari notlar](#mimari-notlar)
- [Tasarım](#tasarım)

---

## Özellikler

### Kimlik ve takım

- E-posta ile **giriş / kayıt** (Supabase Auth).
- **Takım oluşturma**; abonelik planı seçimi (Eco / Growth / Scale), faturalama dönemi ve özet ekranları (`constants/teamPlans.ts`).
- **Davet linki** ile takıma katılma isteği; yönetici onayı (`team_join_requests` akışı).
- **Derin bağlantı:** Uygulama açıkken davet URL’si işlenir (`RootNavigator`). Expo şeması: `ekibio` (`app.json`). Arayüzde bazı yerler eski `doubleshot://` metnini gösterebilir; token/UUID yapıştırma her durumda çalışır.

### Vardiya ve konum

- Vardiya **planlama** ve şablonlar, **puantaj** ve detay ekranları.
- **GPS ile vardiya girişi** (mağaza koordinatı ve yarıçap).
- **Mola** kayıtları (`shift_breaks` migration).
- Aktif vardiya loglarının üye çıkışında kapatılması vb. tetikleyiciler.

### Operasyon

- Günlük **açılış / kapanış / bakım** görevleri; haftanın gününe göre bakım planı.
- Yöneticiler için görev tanımlama; tamamlama **logları** (`operation_task_logs`).

### Tarifler ve içerik

- Genel **tarif kütüphanesi** ve takıma özel **tarifler**, kategoriler, malzemeler.
- Tarif görselleri için **Supabase Storage** (bucket ve güvenlik politikaları migration’larda).

### Eğitim ve gamification

- Eğitim içerikleri, quiz ve ilerleme tabloları (şema `001` ve sonraki migration’lar).
- Kullanıcı **seviye / XP** ve ipuçları havuzu (`tips` servisi, günlük ip rotasyonu).

### Stok ve eksikler

- Takım **envanter** kalemleri ve kategoriler.
- **Eksik listesi** ve alan tanımları (`shortages`, `shortage_areas`).
- Düşük stok için bildirim tetikleri (migration `044`).

### Bildirimler

- Uygulama içi bildirimler ve **Expo Push** token kaydı (`push_tokens`).
- **Expo Go** ortamında push bildirimleri desteklenmez; `notificationsWrapper` modülü bu durumda güvenli şekilde stub kullanır.

### RBAC ve yönetim

- Organizasyon, mağaza, dinamik **roller**, **seviyeler** ve **izin anahtarları** (ör. vardiya oluşturma, shot bildirimi, rol atama).
- Üye bazlı **özellik izinleri** (`memberPermissions`).
- **Shot bildirim** (acil uyarı) ve yönetici bildirimleri.

### Diğer

- **Onboarding** ve **profil** (avatar için storage).
- `TrainingScreen` ve `ForumScreen` dosyaları kod tabanında mevcut; ana **sekme navigasyonunda** şu an kullanılmıyor. Operasyon sekmesi `OperationsScreen` ile temsil ediliyor.

---

## Teknoloji yığını

| Katman | Teknoloji |
|--------|-----------|
| Çerçeve | [Expo](https://expo.dev) SDK ~54, React 19, React Native 0.81 |
| Dil | TypeScript |
| Sunucu / veri | [Supabase](https://supabase.com) (Auth, Postgres, RLS, Storage, Realtime) |
| Sunucu durumu (istemci) | [TanStack React Query](https://tanstack.com/query) |
| Yerel durum | [Zustand](https://github.com/pmndrs/zustand) |
| Navigasyon | React Navigation (native stack, stack, bottom tabs) |
| Doğrulama / şema | Zod |
| Harita | react-native-maps |
| Animasyon | react-native-reanimated |
| Font | Outfit (@expo-google-fonts/outfit) |

---

## Gereksinimler

- **Node.js** (LTS önerilir)
- **npm** veya uyumlu paket yöneticisi
- iOS için Xcode / Android için Android Studio (yerel simülatör veya fiziksel cihaz)
- Kendi Supabase projeniz (geliştirme ve üretim)

---

## Kurulum

```bash
git clone <repo-url>
cd double-shot-app
npm install
```

---

## Ortam değişkenleri

Aşağıdaki değişkenler **istemci tarafında** kullanılır (`EXPO_PUBLIC_*`); production/preview **EAS** derlemelerinde `.env` dosyası kullanılmaz — değerler [Expo Dashboard](https://expo.dev) üzerinden **Environment variables** ile tanımlanmalıdır (bkz. `src/services/supabase.ts` içindeki yorum).

| Değişken | Açıklama |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL’si |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) API anahtarı |

Yerel geliştirme için proje kökünde `.env` oluşturup bu iki değişkeni ekleyebilirsiniz. Eksik bırakıldığında uygulama açılışta hata vermemesi için yer tutucu değerler atanır; **gerçek bağlantı için mutlaka doğru değerleri verin.**

---

## Supabase veritabanı

1. [Supabase](https://supabase.com) üzerinde yeni bir proje oluşturun.
2. **SQL Editor** veya Supabase CLI ile `supabase/migrations/` altındaki dosyaları **numara sırasına göre** (`001` … `046`) uygulayın. Tek dosya olarak sadece `001_initial_schema.sql` yeterli değildir; RBAC, operasyon, envanter, join request vb. sonraki migration’larda tanımlanır.
3. **Authentication → Providers:** E-posta girişini etkinleştirin. Geliştirme sırasında e-posta onayını kapatarak kayıt sonrası hızlı test edebilirsiniz.
4. İsteğe bağlı: Google vb. sağlayıcılar.
5. Storage bucket’ları ve politikalar migration’larla gelir (avatar, tarif görselleri).

---

## Çalıştırma ve derleme

| Komut | Açıklama |
|-------|----------|
| `npm start` | `expo start` — geliştirme sunucusu |
| `npm run start:go` | Expo Go ile başlatma |
| `npm run android` / `npm run ios` / `npm run web` | Platform seçimi |

### EAS Build

`eas.json` içinde:

- **preview:** dahili dağıtım, Android **APK**
- **production:** Android **App Bundle (AAB)**

EAS CLI sürümü `>= 16` beklenir. Android paket adı: `com.baesdigital.ekibio` (`app.json`).

---

## Proje yapısı

```
double-shot-app/
├── App.tsx                 # QueryClient, fontlar, bildirim handler, RootNavigator
├── index.ts                # Kayıt, portre kilidi
├── app.json                # Expo (Ekibio, slug ekibio, scheme ekibio)
├── eas.json                # EAS build profilleri
├── src/
│   ├── navigation/         # RootNavigator, AuthStack, MainStack, MainTabs, TeamsStack, RecipesStack
│   ├── screens/            # Tüm ekranlar (auth, ana sayfa, ekip, tarifler, operasyon, …)
│   ├── components/         # UI bileşenleri (Card, Button, Input, …)
│   ├── services/           # Supabase, auth, teams, shifts, rbac, operations, inventory, …
│   ├── services/rbac/      # Rol, izin, üye, organizasyon servisleri
│   ├── hooks/              # useAuth, usePermissions, useLocation
│   ├── store/              # authStore (Zustand)
│   ├── context/            # Örn. bildirim modal
│   ├── lib/                # queryClient
│   ├── constants/          # teamPlans vb.
│   ├── types/              # Genel ve rbac tipleri
│   ├── utils/              # theme, businessDay, …
│   ├── data/               # Statik veri (ör. onboarding)
│   └── auth/               # Oturum tercihleri
└── supabase/migrations/    # SQL migration’lar (sırayla uygulanmalı)
```

---

## Mimari notlar

- **Oturum:** Supabase Auth; token saklama için **AsyncStorage** kullanılır (SecureStore 2048 bayt sınırı nedeniyle, `supabase.ts` yorumuna bakın).
- **Profil:** İlk oturumda `users` tablosunda profil yoksa oluşturulur (`useAuth` + `auth` servisi).
- **Yetki:** Hem klasik `team_members.role` (BARISTA/MANAGER) hem de organizasyon düzeyinde RBAC birlikte kullanılır; ekranlar `usePermissions` ve ilgili servislerle korunur.
- **React Query:** `staleTime` varsayılan 60 saniye, `retry: 1` (`src/lib/queryClient.ts`).
- **Portre:** Uygulama genelde dikey kilitli; tam ekran senaryoları için `appOrientation` servisi kullanılır.
- **Expo Go:** Push bildirimleri devre dışı bırakılır; production için **development build** veya mağaza derlemesi kullanın.

---

## Tasarım

- Koyu arka plan, **altın** vurgu (`#D4AF37`), cam/panel hissi; tipografi **Outfit**.
- Tema sabitleri: `src/utils/theme.ts` (`colors`, `spacing`, `typography`, `TRANSITION_DURATION`).

Eski README’de geçen açık kahve paleti (`#6F4E37` vb.) yerine güncel ürün arayüzü bu koyu tema ve altın aksan etrafında kurgulanmıştır.

---

## Lisans ve gizlilik

Depo `package.json` içinde `"private": true` olarak işaretlenmiştir. Dağıtım ve lisans koşulları proje sahibinin politikasına tabidir.

---

**Ekibio** — Barista ve kafe ekiplerini tek yerden yönetin.
