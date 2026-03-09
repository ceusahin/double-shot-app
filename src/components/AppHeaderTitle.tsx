import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { typography, colors } from '../utils/theme';

const appLogo = require('../../assets/logo.png');

/** Tüm sekmelerde ve stack ekranlarında üstte görünen "DoubleShot" başlığı + logo */
export function AppHeaderTitle() {
  return (
    <View style={styles.wrap}>
      <Image source={appLogo} style={[styles.icon, { tintColor: colors.accent }]} resizeMode="contain" />
      <Text style={styles.textWrap}>
        <Text style={styles.default}>Double</Text>
        <Text style={styles.accent}>Shot</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  textWrap: {
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
