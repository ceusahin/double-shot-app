import { useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { getProfile, createProfile } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import type { UserProfile } from '../types';
import type { Session } from '@supabase/supabase-js';

function mapAuthUserToProfile(session: Session): {
  id: string;
  name: string;
  surname: string;
  email: string;
} | null {
  const user = session?.user;
  if (!user?.email) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: meta.name ?? meta.full_name?.split(' ')[0] ?? '',
    surname: meta.surname ?? meta.full_name?.split(' ').slice(1).join(' ') ?? '',
    email: user.email,
  };
}

export function useAuth() {
  const { user, setUser, isLoading, setLoading } = useAuthStore();

  const loadProfile = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null);
      return;
    }
    const meta = mapAuthUserToProfile(session);
    if (!meta) return;

    try {
      let profile: UserProfile | null = await getProfile(meta.id);
      if (!profile) {
        profile = await createProfile(meta.id, {
          name: meta.name,
          surname: meta.surname,
          email: meta.email,
        });
      }
      setUser(profile ?? null);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      if (session) {
        loadProfile(session).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadProfile(session);
      } else {
        setUser(null);
      }
    });
    const subscription = authData?.subscription;

    return () => subscription?.unsubscribe();
  }, [loadProfile, setUser, setLoading]);

  return { user, isLoading, isAuthenticated: !!user };
}
