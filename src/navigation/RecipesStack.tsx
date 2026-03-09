import React from 'react';
import { Easing } from 'react-native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { RecipesScreen } from '../screens/RecipesScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { colors, TRANSITION_DURATION } from '../utils/theme';

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

export type RecipesStackParamList = {
  RecipesList: undefined;
  RecipeDetail: { id: string };
};

const Stack = createStackNavigator<RecipesStackParamList>();

export function RecipesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.bgDark },
        cardOverlayEnabled: true,
      }}
    >
      <Stack.Screen name="RecipesList" component={RecipesScreen} />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
          gestureEnabled: true,
          transitionSpec,
        }}
      />
    </Stack.Navigator>
  );
}
