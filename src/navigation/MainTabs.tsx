import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HomeScreen } from '../screens/HomeScreen';
import { TeamsStack } from './TeamsStack';
import { TrainingScreen } from '../screens/TrainingScreen';
import { RecipesStack } from './RecipesStack';
import { AppHeaderTitle } from '../components/AppHeaderTitle';
import { colors, spacing, typography } from '../utils/theme';

export type MainTabParamList = {
  Home: undefined;
  Recipes: undefined;
  Training: undefined;
  Team: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Recipes: 'cafe-outline',
  Training: 'book-outline',
  Team: 'people-outline',
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const iconName = TAB_ICONS[label] ?? 'ellipse-outline';
  const color = focused ? colors.accent : colors.textSecondary;
  return (
    <View style={styles.tabItem}>
      <Ionicons name={iconName} size={24} color={color} />
    </View>
  );
}

function HeaderProfileButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.headerProfileBtn} hitSlop={12}>
      <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.bgDark },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
        headerShadowVisible: false,
        headerTitle: () => <AppHeaderTitle />,
        headerRight: () => (
          <HeaderProfileButton onPress={() => (navigation.getParent() as any)?.navigate('Profile')} />
        ),
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Recipes" component={RecipesStack} options={{ headerShown: false }} />
      <Tab.Screen name="Training" component={TrainingScreen} />
      <Tab.Screen name="Team" component={TeamsStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.glassBg,
    borderTopColor: colors.glassBorder,
    borderTopWidth: 1,
    height: 80,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
