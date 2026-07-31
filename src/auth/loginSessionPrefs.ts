import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export const LOGIN_SESSION_PREFS_KEY = '@ekibio/login_welcome_prefs_v1';

export type LoginSessionPrefs = {
  rememberMe: boolean;
  greetingName: string;
};

export async function readLoginSessionPrefs(): Promise<LoginSessionPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(LOGIN_SESSION_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LoginSessionPrefs;
  } catch {
    return null;
  }
}

/**
 * "Oturumu açık tut" kapalıysa kalıcı Supabase oturumunu siler.
 * Sadece soğuk açılış / getSession ile okunan oturum için kullanın; canlı giriş (SIGNED_IN) için değil.
 */
export async function discardPersistedSessionIfRememberMeOff(
  session: Session | null
): Promise<Session | null> {
  if (!session) return null;
  const prefs = await readLoginSessionPrefs();
  if (prefs?.rememberMe === false) {
    // Ağda takılan global signOut boot'u kilitlemesin; sadece yerel oturumu temizle.
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }
  return session;
}
