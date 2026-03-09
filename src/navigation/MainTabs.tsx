import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HomeScreen } from '../screens/HomeScreen';
import { TeamsStack } from './TeamsStack';
import { TrainingScreen } from '../screens/TrainingScreen';
import { RecipesStack } from './RecipesStack';
import { AppHeaderTitle } from '../components/AppHeaderTitle';
import { Avatar } from '../components/Avatar';
import { withTabTransition } from '../components/TabScreenWithTransition';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography, fonts } from '../utils/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export type MainTabParamList = {
  Home: undefined;
  Recipes: undefined;
  Training: undefined;
  Team: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_LABELS: Record<string, string> = {
  Home: 'Ana Sayfa',
  Recipes: 'Tarifler',
  Training: 'Eğitim',
  Team: 'Ekip',
};

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Recipes: 'cafe-outline',
  Training: 'book-outline',
  Team: 'people-outline',
};

const TAB_BAR_HEIGHT = 68;

/** Takımlarım listesi aynı kalsın; takım seçilip detay/yönetim açıldığında DoubleShot–stack header boşluğu diğer menülerle aynı olsun */
function TeamTabWrapper() {
  const navigation = useNavigation();
  const state = navigation.getState();
  const teamRoute = state?.routes?.[state.index];
  const stackState = teamRoute?.state as { routes: { name: string }[]; index: number } | undefined;
  const stackRouteName = stackState?.routes?.[stackState.index]?.name;
  const isStackScreenWithHeader = stackRouteName != null && stackRouteName !== 'TeamsList';
  return (
    <View style={[styles.teamTabWrap, isStackScreenWithHeader && styles.teamTabWrapStack]}>
      <TeamsStack />
    </View>
  );
}

const WithTransitionHome = withTabTransition(HomeScreen);
const WithTransitionRecipes = withTabTransition(RecipesStack);
const WithTransitionTraining = withTabTransition(TrainingScreen);
const WithTransitionTeam = withTabTransition(TeamTabWrapper);

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom ?? 0;

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: bottomInset }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label = TAB_LABELS[route.name] ?? route.name;
          const iconName = TAB_ICONS[route.name] ?? 'ellipse-outline';
          const color = isFocused ? colors.accent : colors.textSecondary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabButton}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityRole="button"
            >
              <View style={styles.tabItem}>
                <Ionicons name={iconName} size={24} color={color} />
                <Text
                  style={[styles.tabLabel, { color, textAlign: 'center' }]}
                  numberOfLines={2}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function HeaderProfileButton({ onPress }: { onPress: () => void }) {
  const user = useAuthStore((s) => s.user);
  const displayName = user ? [user.name, user.surname].filter(Boolean).join(' ') || user.email : '';

  return (
    <Pressable onPress={onPress} style={styles.headerProfileBtn} hitSlop={12}>
      {user?.profile_photo ? (
        <Avatar source={user.profile_photo} name={displayName} size={44} />
      ) : (
        <Ionicons name="person-outline" size={26} color={colors.textSecondary} />
      )}
    </Pressable>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ navigation }) => ({
        lazy: true,
        headerShown: true,
        headerStyle: { backgroundColor: colors.bgDark },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { ...typography.subtitle, color: colors.textPrimary },
        headerShadowVisible: false,
        headerTitle: () => <AppHeaderTitle />,
        headerRight: () => (
          <HeaderProfileButton onPress={() => (navigation.getParent() as any)?.navigate('Profile')} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={WithTransitionHome} />
      <Tab.Screen name="Recipes" component={WithTransitionRecipes} />
      <Tab.Screen name="Training" component={WithTransitionTraining} />
      <Tab.Screen name="Team" component={WithTransitionTeam} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  teamTabWrap: {
    flex: 1,
  },
  teamTabWrapStack: {
    marginTop: -52,
  },
  tabBarOuter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  tabLabel: {
    ...typography.small,
    fontFamily: fonts.medium,
    paddingHorizontal: 4,
  },
  headerProfileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
});
