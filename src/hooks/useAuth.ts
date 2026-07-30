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
    setLoading(true);
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          const msg = (error.message ?? '').toLowerCase();
          if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
            await clearCorruptedLocalSession();
          }
          setUser(null);
          setLoading(false);
          return;
        }
        let session = data?.session ?? null;
        session = await discardPersistedSessionIfRememberMeOff(session);
        if (session) {
          await loadProfile(session);
        } else {
          setUser(null);
        }
        setLoading(false);
      })
      .catch(async (e) => {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        if (msg.includes('invalid refresh token') || msg.includes('refresh token not found')) {
          await clearCorruptedLocalSession();
        }
        setUser(null);
        setLoading(false);
      });

    const { data: authData } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (event === 'SIGNED_IN' && session) {
        await loadProfile(session);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        await loadProfile(session);
      }
    });
    const subscription = authData?.subscription;

    return () => subscription.unsubscribe();
  }, [clearCorruptedLocalSession, loadProfile, setUser, setLoading]);

  return { user, isLoading, isAuthenticated: !!user };
}
