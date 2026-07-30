import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { SplashScreen } from '../components/SplashScreen';
import { ThemedAlertHost } from '../components/ThemedAlertHost';
import { navigationRef } from './navigationRef';
import { colors, fonts } from '../utils/theme';

const darkTheme = {
  dark: true,
  colors: {
    primary: colors.accent,
    background: colors.bgDark,
    card: colors.bgDark,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
  fonts,
};

function getInviteTokenFromUrl(url: string): string | null {
  const normalized = url.replace(/^doubleshot:\/\//, 'https://x/');
  const match = normalized.match(/\/invite\/([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleUrl = (url: string) => {
      const token = getInviteTokenFromUrl(url);
      if (token && navigationRef.isReady()) {
        (navigationRef as any).navigate('Main', {
          screen: 'MainTabs',
          params: { screen: 'Team', params: { screen: 'JoinTeam', params: { token } } },
        });
      }
    };
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [isAuthenticated]);

  let body: React.ReactNode;
  if (!splashDone) {
    body = <SplashScreen onComplete={() => setSplashDone(true)} />;
  } else if (isLoading) {
    body = (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  } else if (!isAuthenticated) {
    body = (
      <NavigationContainer theme={darkTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthStack} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  } else {
    body = (
      <NavigationContainer ref={navigationRef} theme={darkTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainStack} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <>
      {body}
      <ThemedAlertHost />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
