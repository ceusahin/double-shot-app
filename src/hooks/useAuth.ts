import { useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { getProfile, createProfile } from '../services/auth';
import { getMyTeams } from '../services/teams';
import { getMyRolesSummary } from '../services/rbac';
import { queryClient } from '../lib/queryClient';
import { discardPersistedSessionIfRememberMeOff } from '../auth/loginSessionPrefs';
import { useAuthStore } from '../store/authStore';
import type { UserProfile } from '../types';
import type { Session } from '@supabase/supabase-js';

/** getSession / profil ağda takılırsa login asla gelmesin diye. */
const AUTH_BOOT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function mapAuthUserToProfile(session: Session): {
  id: string;
  name: string;
  surname: string;
  email: string;
} | null {
  const user = session?.user;
  if (!user?.email) return null;
  const meta = user.user_metadata ?? {};
  const given = typeof meta.given_name === 'string' ? meta.given_name.trim() : '';
  const family = typeof meta.family_name === 'string' ? meta.family_name.trim() : '';
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  const parts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
  return {
    id: user.id,
    name: given || parts[0] || '',
    surname:
      family ||
      (typeof meta.surname === 'string' ? meta.surname.trim() : '') ||
      parts.slice(1).join(' ') ||
      '',
    email: user.email,
  };
}

export function useAuth() {
  const { user, setUser, isLoading, setLoading } = useAuthStore();

  const clearCorruptedLocalSession = useCallback(async () => {
    // Sunucuda zaten geçersiz olan refresh token için ağ çağrısı yapmak yerine
    // yerel oturumu temizleyip uygulamayı tutarlı auth durumuna alır.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }, []);

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
        try {
          profile = await createProfile(meta.id, {
            name: meta.name,
            surname: meta.surname,
            email: meta.email,
          });
        } catch (createErr: unknown) {
          const code =
            typeof createErr === 'object' && createErr !== null && 'code' in createErr
              ? String((createErr as { code?: string }).code)
              : '';
          const msg = createErr instanceof Error ? createErr.message : String(createErr);
          const isDuplicate =
            code === '23505' || msg.includes('duplicate') || msg.includes('unique');
          if (isDuplicate) {
            profile = await getProfile(meta.id);
          } else {
            if (__DEV__) console.error('[useAuth] createProfile failed', createErr);
            throw createErr;
          }
        }
      }
      setUser(profile ?? null);
      if (profile) {
        void Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['my-roles', profile.id],
            queryFn: () => getMyRolesSummary(profile.id),
          }),
          queryClient.prefetchQuery({
            queryKey: ['my-teams', profile.id],
            queryFn: () => getMyTeams(profile.id),
          }),
        ]).catch(() => {});
      }
    } catch (e) {
      if (__DEV__) console.error('[useAuth] loadProfile failed', e);
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const finishLoading = () => {
      if (!cancelled) setLoading(false);
    };

    (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_BOOT_TIMEOUT_MS,
          'getSession'
        );

        if (error) {
          const msg = (error.message ?? '').toLowerCase();
          if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
            await clearCorruptedLocalSession();
          }
          setUser(null);
          return;
        }

        let session = data?.session ?? null;
        session = await discardPersistedSessionIfRememberMeOff(session);

        if (session) {
          try {
            await withTimeout(loadProfile(session), AUTH_BOOT_TIMEOUT_MS, 'loadProfile');
          } catch (profileErr) {
            if (__DEV__) console.warn('[useAuth] loadProfile timed out or failed', profileErr);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
          await clearCorruptedLocalSession();
        } else if (msg.includes('timeout')) {
          if (__DEV__) console.warn('[useAuth] auth boot timed out; showing login');
          await clearCorruptedLocalSession();
        }
        setUser(null);
      } finally {
        finishLoading();
      }
    })();

    const { data: authData } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (event === 'SIGNED_IN' && session) {
        void loadProfile(session);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        void loadProfile(session);
      }
    });
    const subscription = authData?.subscription;

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [clearCorruptedLocalSession, loadProfile, setUser, setLoading]);

  return { user, isLoading, isAuthenticated: !!user };
}
