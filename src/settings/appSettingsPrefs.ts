import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppSettingsPrefs = {
  defaultTeamId: string | null;
};

export function appSettingsPrefsKey(userId: string) {
  return `@ekibio/app_settings_v1:${userId}`;
}

export async function readAppSettingsPrefs(userId: string): Promise<AppSettingsPrefs> {
  try {
    const raw = await AsyncStorage.getItem(appSettingsPrefsKey(userId));
    if (!raw) return { defaultTeamId: null };
    const parsed = JSON.parse(raw) as Partial<AppSettingsPrefs>;
    return {
      defaultTeamId:
        typeof parsed.defaultTeamId === 'string' && parsed.defaultTeamId.length > 0
          ? parsed.defaultTeamId
          : null,
    };
  } catch {
    return { defaultTeamId: null };
  }
}

export async function writeAppSettingsPrefs(
  userId: string,
  prefs: AppSettingsPrefs
): Promise<void> {
  await AsyncStorage.setItem(appSettingsPrefsKey(userId), JSON.stringify(prefs));
}

/**
 * Kayıtlı varsayılan ekibi üyelik listesine göre çözümler.
 * Tek ekip varsa onu kullanır; kayıtlı id geçersizse listedeki ilk ekibe düşer.
 */
export function resolveDefaultTeamId(
  teamIds: string[],
  storedDefaultTeamId: string | null | undefined
): string | null {
  if (teamIds.length === 0) return null;
  if (teamIds.length === 1) return teamIds[0];
  if (storedDefaultTeamId && teamIds.includes(storedDefaultTeamId)) {
    return storedDefaultTeamId;
  }
  return teamIds[0];
}
