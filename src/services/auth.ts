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
  updates: Partial<Pick<UserProfile, 'name' | 'surname' | 'profile_photo'>>
): Promise<void> {
  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
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
