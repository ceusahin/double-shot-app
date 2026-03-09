import { supabase } from './supabase';
import type { UserProfile } from '../types';
import type { UserRole } from '../types';

const PROFILES_TABLE = 'users';

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function createProfile(
  userId: string,
  payload: {
    name: string;
    surname: string;
    email: string;
    role?: UserRole;
  }
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .insert({
      id: userId,
      name: payload.name,
      surname: payload.surname,
      email: payload.email,
      role: payload.role ?? 'BARISTA',
      level: 'Beginner',
      experience_points: 0,
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

/** Seçilen fotoğrafı Storage'a yükleyip profil fotoğrafı URL'ini günceller. base64 verilirse React Native ağına gerek kalmaz. */
export async function uploadProfilePhoto(
  userId: string,
  imageUri: string,
  base64?: string | null
): Promise<string> {
  const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  let body: ArrayBuffer;
  if (base64) {
    const { decode } = await import('base64-arraybuffer');
    body = decode(base64);
  } else {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    body = await blob.arrayBuffer();
  }

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (uploadError) {
    const msg = uploadError.message || JSON.stringify(uploadError);
    throw new Error(msg);
  }

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;
  await updateProfile(userId, { profile_photo: publicUrl });
  return publicUrl;
}

export async function updateProfileXP(
  userId: string,
  experience_points: number,
  level: UserProfile['level']
): Promise<void> {
  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ experience_points, level })
    .eq('id', userId);

  if (error) throw error;
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

export async function signInWithGoogle() {
  // Expo için Google OAuth: expo-auth-session ile yapılır.
  // Supabase dashboard'da Google provider açılıp redirect URL ayarlanmalı.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) throw error;
  return data;
}
