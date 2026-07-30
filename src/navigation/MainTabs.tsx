import React, { useCallback, useEffect, useState } from 'react';
import type { NavigationState } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HomeScreen } from '../screens/HomeScreen';
import { TeamsStack } from './TeamsStack';
import { OperationsScreen } from '../screens/OperationsScreen';
import { RecipesStack } from './RecipesStack';
import { withTabTransition } from '../components/TabScreenWithTransition';
import { MAIN_TAB_DOCK_BLOCK_HEIGHT } from '../constants/mainTabDock';
import { colors, spacing, fonts } from '../utils/theme';
import { useAuthStore } from '../store/authStore';
import { isPlatformStaff } from '../services/platformAdmin';

export type MainTabParamList = {
  Home: undefined;
  Recipes: undefined;
  Training: undefined;
  Team: undefined;
};

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

const TAB_LABELS: Record<string, string> = {
  Home: 'Ana Sayfa',
  Recipes: 'Tarifler',
  Training: 'Operasyon',
  Team: 'Ekip',
};

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Recipes: 'cafe-outline',
  Training: 'calendar-outline',
  Team: 'people-outline',
};

/** Dock ile ekran altı (home indicator) arasında ek boşluk */
const DOCK_EXTRA_BOTTOM_GAP = 10;

/** Dock'un solid üst kenarının üzerinde, scroll içeriğinin silikleşerek kaybolduğu yumuşak geçiş bandı (px). */
const DOCK_TOP_SCRIM_HEIGHT = 40;

/** Sadece outline glifler — seçili durumda filled’e geçmek bazı cihazlarda ikonun kaybolmasına yol açıyordu. */
function tabIconName(routeName: string, managementTab: boolean): keyof typeof Ionicons.glyphMap {
  if (routeName === 'Team' && managementTab) {
    return 'settings-outline';
  }
  return TAB_ICONS[routeName] ?? 'ellipse-outline';
}

/**
 * Ana sekme içindeki iç stack/drawer vb. hep kökte mi?
 * Örn. Ekip → TeamDetail açıkken false → ana menü yatay kaydırması kapalı.
 */
function isNestedNavigationAtRoot(state: NavigationState | undefined): boolean {
  if (!state?.routes?.length) return true;
  const index = state.index ?? 0;
  if (index > 0) return false;
  const active = state.routes[index];
  if (active?.state) {
    return isNestedNavigationAtRoot(active.state as NavigationState);
  }
  return true;
}

function TeamTabWrapper() {
  return (
    <View style={styles.teamTabWrap}>
      <TeamsStack />
    </View>
  );
}

const WithTransitionHome = withTabTransition(HomeScreen);
const WithTransitionRecipes = withTabTransition(RecipesStack);
const WithTransitionTraining = withTabTransition(OperationsScreen);
const WithTransitionTeam = withTabTransition(TeamTabWrapper);

type CustomTabBarProps = MaterialTopTabBarProps & {
  onTabStateUpdate: (swipeEnabled: boolean) => void;
};

function CustomTabBar({ state, navigation, onTabStateUpdate }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom ?? 0;
  const user = useAuthStore((s) => s.user);
  const managementTab = isPlatformStaff(user);

  const syncSwipeFromNavState = useCallback(() => {
    const navState = navigation.getState();
    if (!navState?.routes?.length) {
      onTabStateUpdate(true);
      return;
    }
    const ok = navState.routes.every((route) => isNestedNavigationAtRoot(route.state));
    onTabStateUpdate(ok);
  }, [navigation, onTabStateUpdate]);

  useEffect(() => {
    syncSwipeFromNavState();
    return navigation.addListener('state', syncSwipeFromNavState);
  }, [navigation, syncSwipeFromNavState]);

  return (
    <View
      style={[
        styles.tabBarOuter,
        { paddingBottom: Math.max(bottomInset, spacing.sm) + DOCK_EXTRA_BOTTOM_GAP },
      ]}
    >
      <View style={styles.dockLift}>
        <View style={styles.dockTabsRow}>
          {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label =
            route.name === 'Team' && managementTab
              ? 'Yönetim'
              : TAB_LABELS[route.name] ?? route.name;
          const color = isFocused ? colors.accentHover : colors.textMuted;

          const onPress = () => {
            const currentRoute = state.routes[state.index];
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) return;

            // Reset recipes stack before leaving, so returning opens list directly.
            if (currentRoute.name === 'Recipes' && route.name !== 'Recipes') {
              navigation.navigate('Recipes', { screen: 'RecipesList' });
            }

            if (!isFocused) {
              if (route.name === 'Recipes') {
                navigation.navigate('Recipes', { screen: 'RecipesList' });
                return;
              }
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabMiniDock,
                isFocused && styles.tabMiniDockActive,
                pressed && styles.tabMiniDockPressed,
              ]}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <LinearGradient
                pointerEvents="none"
                colors={
                  isFocused
                    ? ['rgba(212, 175, 55, 0.22)', 'rgba(184, 115, 51, 0.09)']
                    : ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.12)']
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.tabMiniDockGradient}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.tabMiniDockTopEdge,
                  isFocused && styles.tabMiniDockTopEdgeActive,
                ]}
              />
              <Ionicons
                name={tabIconName(route.name, managementTab)}
                size={22}
                color={color}
              />
              <Text
                style={[
                  styles.tabMiniDockLabel,
                  isFocused && styles.tabMiniDockLabelActive,
                  { color },
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
        </View>
      </View>
    </View>
  );
}

export function MainTabs() {
  const [mainTabsSwipeEnabled, setMainTabsSwipeEnabled] = useState(true);

  const onTabStateUpdate = useCallback((ok: boolean) => {
    setMainTabsSwipeEnabled((prev) => (prev === ok ? prev : ok));
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View style={styles.tabBarOverlay} pointerEvents="box-none">
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(10, 10, 10, 0)', colors.bgDark]}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.dockTopScrim}
          />
          <CustomTabBar {...props} onTabStateUpdate={onTabStateUpdate} />
        </View>
      )}
      tabBarPosition="bottom"
      screenOptions={{
        lazy: true,
        lazyPreloadDistance: 1,
        swipeEnabled: mainTabsSwipeEnabled,
        /** Dock akıştan çıkar; sahne negatif margin ile ekranın en altına kadar uzar */
        sceneStyle: {
          flex: 1,
          marginBottom: -MAIN_TAB_DOCK_BLOCK_HEIGHT,
        },
      }}
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
  tabBarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    ...Platform.select({
      android: { elevation: 24 },
      default: {},
    }),
  },
  dockTopScrim: {
    width: '100%',
    height: DOCK_TOP_SCRIM_HEIGHT,
  },
  tabBarOuter: {
    backgroundColor: colors.bgDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  dockLift: {
    width: '100%',
    marginBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  dockTabsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: 8,
  },
  tabMiniDock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.14)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      default: {
        elevation: 4,
      },
    }),
  },
  tabMiniDockActive: {
    borderColor: 'rgba(212, 175, 55, 0.48)',
    ...Platform.select({
      ios: {
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      default: {
        elevation: 6,
      },
    }),
  },
  tabMiniDockPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  tabMiniDockGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  tabMiniDockTopEdge: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabMiniDockTopEdgeActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.55)',
  },
  tabMiniDockLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: fonts.medium,
    textAlign: 'center',
    width: '100%',
  },
  tabMiniDockLabelActive: {
    fontFamily: fonts.semibold,
  },
});
