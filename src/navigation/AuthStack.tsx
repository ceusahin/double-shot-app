import React from 'react';
import { Easing } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { JoinTeamScreen } from '../screens/auth/JoinTeamScreen';
import { TRANSITION_DURATION } from '../utils/theme';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  JoinTeam: { inviteCode?: string } | undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

const verticalTransition = {
  gestureDirection: 'vertical' as const,
  cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
  transitionSpec: {
    open: {
      animation: 'timing' as const,
      config: { duration: TRANSITION_DURATION, easing: Easing.out(Easing.ease) },
    },
    close: {
      animation: 'timing' as const,
      config: { duration: TRANSITION_DURATION, easing: Easing.inOut(Easing.ease) },
    },
  },
};

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={verticalTransition}
      />
      <Stack.Screen
        name="JoinTeam"
        component={JoinTeamScreen}
        options={verticalTransition}
      />
    </Stack.Navigator>
  );
}
