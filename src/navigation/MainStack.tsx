import React from 'react';
import { Easing, Pressable, StyleSheet } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { NotificationModalProvider } from '../context/NotificationModalContext';
import { MainTabs, type MainTabParamList } from './MainTabs';
import { AppHeaderTitle } from '../components/AppHeaderTitle';
import { HeaderRightWithNotif } from '../components/HeaderRightWithNotif';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EquipmentGuideScreen } from '../screens/EquipmentGuideScreen';
import { JoinRequestsScreen } from '../screens/JoinRequestsScreen';
import { JoinRequestProfileScreen } from '../screens/JoinRequestProfileScreen';
import { colors, spacing, typography, TRANSITION_DURATION } from '../utils/theme';
import type { TeamJoinRequest } from '../types';

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Profile: undefined;
  Equipment: undefined;
  JoinRequests: { teamId?: string } | undefined;
  JoinRequestProfile: { request: TeamJoinRequest };
};

const Stack = createStackNavigator<MainStackParamList>();

const transitionSpec = {
  open: {
    animation: 'timing' as const,
    config: { duration: TRANSITION_DURATION, easing: Easing.out(Easing.ease) },
  },
  close: {
    animation: 'timing' as const,
    config: { duration: TRANSITION_DURATION, easing: Easing.inOut(Easing.ease) },
  },
};

export function MainStack() {
  return (
    <NotificationModalProvider>
    <Stack.Navigator
      screenOptions={({ route, navigation }) => {
        const common = {
          headerTitleAlign: 'left' as const,
          cardStyle: { backgroundColor: colors.bgDark },
          headerStyle: { backgroundColor: colors.bgDark },
          headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          gestureEnabled: true,
        };
        if (route.name === 'MainTabs') {
          return {
            ...common,
            headerShown: true,
            headerTitle: () => null,
            headerTitleContainerStyle: { left: 0, right: 0 },
            headerLeft: () => (
              <Pressable
                onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
                style={mainTabsHeaderStyles.brand}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Ana sayfaya git"
              >
                <AppHeaderTitle />
              </Pressable>
            ),
            headerRight: () => <HeaderRightWithNotif />,
            cardStyleInterpolator: undefined,
            transitionSpec: undefined,
          };
        }
        return {
          ...common,
          headerShown: true,
          headerTitleContainerStyle: { left: 0 },
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
          transitionSpec,
        };
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="Equipment" component={EquipmentGuideScreen} options={{ title: 'Makine & Ekipman' }} />
      <Stack.Screen name="JoinRequests" component={JoinRequestsScreen} options={{ title: 'Katılma istekleri' }} />
      <Stack.Screen name="JoinRequestProfile" component={JoinRequestProfileScreen} options={{ title: 'Aday profili' }} />
    </Stack.Navigator>
    </NotificationModalProvider>
  );
}

const mainTabsHeaderStyles = StyleSheet.create({
  brand: {
    marginLeft: spacing.md,
    marginTop: spacing.md,
  },
});
