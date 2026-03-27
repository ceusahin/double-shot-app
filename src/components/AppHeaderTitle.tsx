import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { typography, colors, fonts } from '../utils/theme';

const appLogo = require('../../public/logo.png');

const ICON_SIZE = 38;

/** Tüm sekmelerde ve stack ekranlarında üstte görünen "Ekibio" başlığı + logo. */
export function AppHeaderTitle() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Image source={appLogo} style={styles.icon} resizeMode="contain" />
      </View>
      <Text style={styles.textWrap}>
        <Text style={styles.default}>Ekib</Text>
        <Text style={styles.accent}>io</Text>
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
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 6,
  },
  textWrap: {
    ...typography.subtitle,
    fontSize: 26,
    fontFamily: fonts.bold,
    lineHeight: ICON_SIZE,
  },
  default: {
    ...typography.subtitle,
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    lineHeight: ICON_SIZE,
  },
  accent: {
    ...typography.subtitle,
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.accent,
    lineHeight: ICON_SIZE,
  },
});
