import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { typography, colors } from '../utils/theme';

/** Tüm sekmelerde ve stack ekranlarında üstte görünen "DoubleShot" başlığı */
export function AppHeaderTitle() {
  return (
    <Text style={styles.wrap}>
      <Text style={styles.default}>Double</Text>
      <Text style={styles.accent}>Shot</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...typography.subtitle,
  },
  default: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  accent: {
    ...typography.subtitle,
    color: colors.accent,
  },
});
