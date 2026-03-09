import Constants from 'expo-constants';

/** Expo Go'da (SDK 53+) push desteklenmez; modül yüklenmez, konsol hata/uyarı çıkmaz. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Expo Go değilse expo-notifications modülünü yükler; Expo Go'da stub döner (modül hiç require edilmez). */
export function getNotifications(): typeof import('expo-notifications') {
  if (Constants.appOwnership === 'expo') {
    return {
      setNotificationHandler: () => {},
      getPermissionsAsync: async () => ({ status: 'undetermined' as const }),
      requestPermissionsAsync: async () => ({ status: 'undetermined' as const }),
      setNotificationChannelAsync: async () => {},
      getExpoPushTokenAsync: async () => ({ data: '' }),
      AndroidImportance: { MAX: 3 },
    } as unknown as typeof import('expo-notifications');
  }
  return require('expo-notifications');
}
