import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotifications, isExpoGo } from './notificationsWrapper';

export { isExpoGo };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Bildirim izni iste ve Expo Push Token al. Fiziksel cihaz gerekir. Expo Go'da token alınmaz (modül yüklenmez). */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  if (isExpoGo()) {
    return null;
  }
  const Notifications = getNotifications();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    if (status !== 'granted') {
      return null;
    }
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Varsayılan',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4AF37',
    });
  }
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch {
    return null;
  }
}

/** Expo Push API ile tek bir cihaza bildirim gönder (test için). */
export async function sendExpoPush(
  expoPushToken: string,
  title: string,
  body: string
): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      to: expoPushToken,
      title,
      body,
      sound: 'default',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Push gönderilemedi');
  }
  const data = await response.json();
  if (data.data?.status === 'error') {
    throw new Error(data.data.message ?? 'Push hatası');
  }
}
