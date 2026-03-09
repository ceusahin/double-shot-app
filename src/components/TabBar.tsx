import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, typography, fonts } from '../utils/theme';

export type TabItem<T> = { key: T; label: string };

export type TabBarVariant = 'default' | 'primary';

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  /** 'primary' = ana sekmeler (uppercase, alt çizgi); 'default' = iç sekmeler (pill) */
  variant?: TabBarVariant;
}

export function TabBar<T extends string>({ tabs, activeKey, onChange, variant = 'default' }: TabBarProps<T>) {
  const isPrimary = variant === 'primary';
  const containerStyle = [styles.container, isPrimary ? styles.containerPrimary : styles.containerDefault];
  const getTabStyle = (active: boolean): ViewStyle[] => [
    styles.tab,
    isPrimary ? styles.tabPrimary : styles.tabDefault,
    active && (isPrimary ? styles.tabPrimaryActive : styles.tabDefaultActive),
  ];
  const getLabelStyle = (active: boolean): TextStyle[] => [
    styles.label,
    isPrimary ? styles.labelPrimary : styles.labelDefault,
    active && (isPrimary ? styles.labelPrimaryActive : styles.labelDefaultActive),
  ];

  return (
    <View style={containerStyle}>
      {tabs.map((tab) => {
        const active = activeKey === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={getTabStyle(active)}
          >
            <Text style={getLabelStyle(active)} numberOfLines={1}>
              {isPrimary ? tab.label.toUpperCase() : tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  containerDefault: {
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: spacing.xs,
  },
  containerPrimary: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDefault: {
    borderRadius: 8,
  },
  tabPrimary: {
    paddingVertical: spacing.md,
    marginBottom: -1,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabDefaultActive: {
    backgroundColor: colors.cardBg,
    ...(colors.cardBg && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 2,
    }),
  },
  tabPrimaryActive: {
    borderBottomColor: colors.accent,
  },
  label: {
    ...typography.caption,
  },
  labelDefault: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  labelDefaultActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  labelPrimary: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  labelPrimaryActive: {
    color: colors.accent,
    fontFamily: fonts.bold,
  },
});
