import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography, fonts } from '../utils/theme';

export type TabItem<T> = { key: T; label: string };

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
}

export function TabBar<T extends string>({ tabs, activeKey, onChange }: TabBarProps<T>) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tab, activeKey === tab.key && styles.tabActive]}
        >
          <Text style={[styles.label, activeKey === tab.key && styles.labelActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.cardBg,
    ...colors.cardBg && { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
});
