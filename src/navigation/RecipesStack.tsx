import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { RecipesScreen } from '../screens/RecipesScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { colors } from '../utils/theme';

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
        }}
      />
    </Stack.Navigator>
  );
}
