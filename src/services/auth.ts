import { supabase } from './supabase';
import type { UserProfile } from '../types';

const PROFILES_TABLE = 'users';

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn('[getProfile]', userId, error.message);
    return null;
  }
  return data as UserProfile | null;
}

export async function createProfile(
  userId: string,
  payload: {
    name: string;
    surname: string;
    email: string;
  }
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .insert({
      id: userId,
      name: payload.name,
      surname: payload.surname,
      email: payload.email,
      profile_photo: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'name' | 'surname' | 'profile_photo' | 'email'>>
): Promise<void> {
  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
}

/** E-posta değiştirir (Auth + public.users). Yeni e-posta doğrulama gerektirebilir. */
export async function updateAuthEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser?.id) {
    await supabase.from(PROFILES_TABLE).update({ email: newEmail }).eq('id', authUser.id);
  }
}

/** Şifre değiştirir. Mevcut şifre ile doğrulama yapılır. */
export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Oturum bulunamadı.');
  const { error: signError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signError) throw new Error('Mevcut şifre hatalı.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

const AVATARS_BUCKET = 'avatars';

function imageExtensionFromUri(uri: string): string {
  const pathOnly = uri.split('?')[0].split('#')[0];
  const raw = pathOnly.split('.').pop()?.toLowerCase() ?? '';
  if (raw === 'jpeg' || raw === 'jpg') return 'jpg';
  if (raw === 'png' || raw === 'webp' || raw === 'gif') return raw;
  return 'jpg';
}

/** RN fetch Blob'unda arrayBuffer() yok; Response.arrayBuffer veya XHR kullan. */
async function readLocalImageUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Fotoğraf okunamadı (${response.status})`);
  }
  if (typeof response.arrayBuffer === 'function') {
    return response.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error('Fotoğraf okunamadı'));
      }
    };
    xhr.onerror = () => reject(new Error('Fotoğraf okunamadı'));
    xhr.send();
  });
}

/** Seçilen fotoğrafı Storage'a yükleyip profil fotoğrafı URL'ini günceller. Büyük görseller için base64 kullanmayın (OOM riski); URI + küçük dosya tercih edin. */
export async function uploadProfilePhoto(
  userId: string,
  imageUri: string,
  base64?: string | null
): Promise<string> {
  const ext = imageExtensionFromUri(imageUri);
  const path = `${userId}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  let body: ArrayBuffer;
  if (base64) {
    const { decode } = await import('base64-arraybuffer');
    body = decode(base64);
  } else {
    body = await readLocalImageUriAsArrayBuffer(imageUri);
  }

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (uploadError) {
    const msg = uploadError.message || JSON.stringify(uploadError);
    throw new Error(msg);
  }

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const base = urlData.publicUrl;
  // Aynı dosya yolu + aynı URL ile RN/HTTP önbelleği eski görseli göstermeye devam eder; her yüklemede benzersiz sorgu ekle.
  const sep = base.includes('?') ? '&' : '?';
  const publicUrl = `${base}${sep}v=${Date.now()}`;
  await updateProfile(userId, { profile_photo: publicUrl });
  return publicUrl;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  surname: string,
  worksAtCafe: boolean
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, surname, works_at_cafe: worksAtCafe },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function parseAuthCallbackUrl(url: string): {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  error?: string;
  error_description?: string;
} {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const query =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : '';

  const fromSearch = new URLSearchParams(query);
  const fromHash = new URLSearchParams(hash);
  const get = (key: string) =>
    fromSearch.get(key) || fromHash.get(key) || undefined;

  return {
    access_token: get('access_token') ?? undefined,
    refresh_token: get('refresh_token') ?? undefined,
    code: get('code') ?? undefined,
    error: get('error') ?? undefined,
    error_description: get('error_description') ?? undefined,
  };
}

function isAuthCallbackUrl(url: string): boolean {
  const params = parseAuthCallbackUrl(url);
  return Boolean(
    params.code ||
      params.access_token ||
      params.error ||
      url.includes('auth/callback')
  );
}

async function createSessionFromAuthUrl(url: string) {
  if (__DEV__) {
    console.log('[Google OAuth] callback url =', url);
  }

  const params = parseAuthCallbackUrl(url);
  if (params.error) {
    throw new Error(params.error_description || params.error);
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return data;
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data;
  }

  throw new Error(
    'Google oturumu alınamadı. Supabase Redirect URLs listesine Metro’daki redirectTo değerini birebir ekle.'
  );
}

function extractRedirectToFromOAuthUrl(oauthUrl: string): string | null {
  try {
    return new URL(oauthUrl).searchParams.get('redirect_to');
  } catch {
    return null;
  }
}

/**
 * Prod/APK: ekibio://auth/callback
 * Expo Go: Google OAuth desteklenmiyor (Supabase redirect → "requested path is invalid").
 */
export async function signInWithGoogle() {
  const WebBrowser = await import('expo-web-browser');
  const Linking = await import('expo-linking');
  const Constants = await import('expo-constants');

  const isExpoGo = Constants.default.appOwnership === 'expo';
  if (isExpoGo) {
    throw new Error(
      'Google ile giriş Expo Go’da çalışmıyor. Preview APK ile dene:\nnpx eas-cli build -p android --profile preview'
    );
  }

  WebBrowser.maybeCompleteAuthSession();

  const redirectTo = Linking.createURL('auth/callback') || 'ekibio://auth/callback';

  if (__DEV__) {
    console.log('[Google OAuth] redirectTo =', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google giriş bağlantısı oluşturulamadı.');

  if (__DEV__) {
    console.log(
      '[Google OAuth] supabase redirect_to =',
      extractRedirectToFromOAuthUrl(data.url)
    );
  }

  let subscription: { remove: () => void } | undefined;
  let maxWait: ReturnType<typeof setTimeout> | undefined;

  try {
    const callbackUrl = await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (url: string | null) => {
        if (settled) return;
        settled = true;
        if (maxWait) clearTimeout(maxWait);
        subscription?.remove();
        void WebBrowser.dismissBrowser().catch(() => {});
        resolve(url);
      };

      subscription = Linking.addEventListener('url', ({ url }) => {
        if (__DEV__) console.log('[Google OAuth] linking event =', url);
        if (isAuthCallbackUrl(url)) finish(url);
      });

      maxWait = setTimeout(() => finish(null), 20_000);

      void WebBrowser.openAuthSessionAsync(data.url!, redirectTo)
        .then(async (result) => {
          if (__DEV__) {
            console.log(
              '[Google OAuth] browser result =',
              result.type,
              'url' in result ? result.url : ''
            );
          }
          if (result.type === 'success' && 'url' in result && result.url) {
            finish(result.url);
            return;
          }

          await new Promise((r) => setTimeout(r, 800));
          if (settled) return;

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            finish('session-already-set');
            return;
          }
          finish(null);
        })
        .catch((e) => {
          if (__DEV__) console.warn('[Google OAuth] browser error', e);
          finish(null);
        });
    });

    if (callbackUrl === 'session-already-set') {
      return { cancelled: false as const };
    }

    if (!callbackUrl) {
      throw new Error(
        `Google girişi tamamlanamadı.\nSupabase Redirect URLs’de ekibio://** ve ekibio://auth/callback olduğundan emin ol.`
      );
    }

    await createSessionFromAuthUrl(callbackUrl);
    return { cancelled: false as const };
  } finally {
    if (maxWait) clearTimeout(maxWait);
    subscription?.remove();
  }
}

