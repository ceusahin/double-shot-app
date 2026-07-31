import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * EAS derlemesi .env kullanmaz; EXPO_PUBLIC_* değişkenleri expo.dev → Environment variables ile verilmeli.
 * Boş URL ile createClient modül yüklenirken fırlatır → uygulama açılmadan kapanır.
 */
const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const rawKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const missingPublicConfig = !rawUrl || !rawKey;
if (missingPublicConfig) {
  console.error(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY eksik. ' +
      'expo.dev → Project → Environment variables → preview (veya production) ortamına ekleyip yeniden build alın.'
  );
}
const supabaseUrl = rawUrl || 'https://config-missing.supabase.co';
const supabaseAnonKey = rawKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.missing-build-env';

// AsyncStorage kullanıyoruz; SecureStore 2048 byte sınırı auth session'ı aşıyordu.
const AsyncStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
