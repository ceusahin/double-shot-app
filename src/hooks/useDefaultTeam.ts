import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { getMyTeams } from '../services/teams';
import {
  readAppSettingsPrefs,
  resolveDefaultTeamId,
  writeAppSettingsPrefs,
} from '../settings/appSettingsPrefs';
import type { Team } from '../types';

export function useDefaultTeam() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const {
    data: teams = [],
    isPending: teamsPending,
    isFetched: teamsFetched,
  } = useQuery({
    queryKey: ['my-teams', userId],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!userId,
  });

  const {
    data: prefs,
    isPending: prefsPending,
    isFetched: prefsFetched,
  } = useQuery({
    queryKey: ['app-settings', userId],
    queryFn: () => readAppSettingsPrefs(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  /** AsyncStorage + ekipler okunmadan otomatik yazma / teams[0] fallback yapma. */
  const settingsReady = !!userId && prefsFetched && teamsFetched && !prefsPending && !teamsPending;

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);

  const defaultTeamId = useMemo(() => {
    if (!userId) return null;
    const stored = prefs?.defaultTeamId ?? null;

    // Tercihler yüklenirken teams[0]'a düşme; bilinen geçerli kayıt varsa onu kullan.
    if (!settingsReady) {
      if (stored && teamIds.includes(stored)) return stored;
      return null;
    }

    return resolveDefaultTeamId(teamIds, stored);
  }, [userId, settingsReady, teamIds, prefs?.defaultTeamId]);

  const defaultTeam = useMemo(
    () => (defaultTeamId ? teams.find((t) => t.id === defaultTeamId) ?? null : null),
    [teams, defaultTeamId]
  );

  /** Tek ekip üyeliğinde varsayılanı otomatik kaydet. */
  useEffect(() => {
    if (!settingsReady || !userId || teams.length !== 1) return;
    const onlyId = teams[0].id;
    if (prefs?.defaultTeamId === onlyId) return;
    void writeAppSettingsPrefs(userId, { defaultTeamId: onlyId }).then(() => {
      queryClient.setQueryData(['app-settings', userId], { defaultTeamId: onlyId });
    });
  }, [settingsReady, userId, teams, prefs?.defaultTeamId, queryClient]);

  /**
   * Kayıtlı id geçersizse (ekipten çıkılmış vb.) geçerli çözüme yaz.
   * prefs yüklenmeden asla teams[0] ile üzerine yazma.
   */
  useEffect(() => {
    if (!settingsReady || !userId || teams.length <= 1) return;
    const stored = prefs?.defaultTeamId ?? null;
    if (stored && teamIds.includes(stored)) return;
    const resolved = resolveDefaultTeamId(teamIds, stored);
    if (!resolved || resolved === stored) return;
    void writeAppSettingsPrefs(userId, { defaultTeamId: resolved }).then(() => {
      queryClient.setQueryData(['app-settings', userId], { defaultTeamId: resolved });
    });
  }, [settingsReady, userId, teams.length, prefs?.defaultTeamId, teamIds, queryClient]);

  const setDefaultTeamId = useCallback(
    async (teamId: string) => {
      if (!userId) return;
      await writeAppSettingsPrefs(userId, { defaultTeamId: teamId });
      queryClient.setQueryData(['app-settings', userId], { defaultTeamId: teamId });
    },
    [userId, queryClient]
  );

  return {
    teams: teams as (Team & { role: string })[],
    defaultTeam: defaultTeam as (Team & { role: string }) | null,
    defaultTeamId,
    setDefaultTeamId,
    isLoading: !!userId && !settingsReady,
  };
}
