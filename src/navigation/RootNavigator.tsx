import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../hooks/useAuth';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { SplashScreen } from '../components/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { colors, fonts } from '../utils/theme';

export const navigationRef = createNavigationContainerRef<{ Main: undefined }>();

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

const ONBOARDING_KEY = 'doubleshot_onboarding_completed';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!splashDone || !isAuthenticated) return;
    let cancelled = false;
    SecureStore.getItemAsync(ONBOARDING_KEY).then((value) => {
      if (!cancelled) setOnboardingCompleted(value === 'true');
    });
    return () => { cancelled = true; };
  }, [splashDone, isAuthenticated]);

  useEffect(() => {
    if (!onboardingCompleted || !isAuthenticated) return;
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
  }, [onboardingCompleted, isAuthenticated]);

  const handleOnboardingComplete = () => {
    setOnboardingCompleted(true);
  };

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <NavigationContainer theme={darkTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthStack} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (onboardingCompleted === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (onboardingCompleted === false) {
    return (
      <View style={styles.full}>
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={darkTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  full: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
});
