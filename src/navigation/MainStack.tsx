import React from 'react';
import { Easing } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { NotificationModalProvider } from '../context/NotificationModalContext';
import { MainTabs } from './MainTabs';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EquipmentGuideScreen } from '../screens/EquipmentGuideScreen';
import { colors, typography, TRANSITION_DURATION } from '../utils/theme';

export type MainStackParamList = {
  MainTabs: undefined;
  Profile: undefined;
  Equipment: undefined;
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
      screenOptions={({ route }) => ({
        headerShown: route.name !== 'MainTabs',
        cardStyle: { backgroundColor: colors.bgDark },
        headerStyle: { backgroundColor: colors.bgDark },
        headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        cardStyleInterpolator:
          route.name === 'MainTabs' ? undefined : CardStyleInterpolators.forVerticalIOS,
        transitionSpec: route.name === 'MainTabs' ? undefined : transitionSpec,
        gestureEnabled: true,
      })}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="Equipment" component={EquipmentGuideScreen} options={{ title: 'Makine & Ekipman' }} />
    </Stack.Navigator>
    </NotificationModalProvider>
  );
}
