import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { lockPortraitUnlessFullscreen, subscribeAppStatePortraitLock } from './src/services/appOrientation';
import { getNotifications, isExpoGo } from './src/services/notificationsWrapper';
import { useFonts } from '@expo-google-fonts/outfit/useFonts';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from './src/lib/queryClient';
import { RootNavigator } from './src/navigation/RootNavigator';

const FONT_BOOT_TIMEOUT_MS = 5_000;

// Expo Go'da expo-notifications hiç yüklenmez; böylece konsolda hata/uyarı çıkmaz
if (!isExpoGo()) {
  const Notifications = getNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const [fontWaitExpired, setFontWaitExpired] = useState(false);

  useEffect(() => {
    void lockPortraitUnlessFullscreen();
    return subscribeAppStatePortraitLock();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitExpired(true), FONT_BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  /** Font hatası veya zaman aşımında uygulamayı kilitleme; sistem fontuna düşer. */
  const fontsReady = fontsLoaded || !!fontError || fontWaitExpired;

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
