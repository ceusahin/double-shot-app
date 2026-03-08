import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EquipmentGuideScreen } from '../screens/EquipmentGuideScreen';
import { colors, typography } from '../utils/theme';

export type MainStackParamList = {
  MainTabs: undefined;
  Profile: undefined;
  Equipment: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgDark },
        headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Stack.Screen name="Equipment" component={EquipmentGuideScreen} options={{ title: 'Makine & Ekipman' }} />
    </Stack.Navigator>
  );
}
