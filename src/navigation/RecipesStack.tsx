import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RecipesScreen } from '../screens/RecipesScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { AppHeaderTitle } from '../components/AppHeaderTitle';
import { colors, typography } from '../utils/theme';

export type RecipesStackParamList = {
  RecipesList: undefined;
  RecipeDetail: { id: string };
};

const Stack = createNativeStackNavigator<RecipesStackParamList>();

export function RecipesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgDark },
        headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitle: () => <AppHeaderTitle />,
      }}
    >
      <Stack.Screen name="RecipesList" component={RecipesScreen} options={{ title: 'Tarifler' }} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
