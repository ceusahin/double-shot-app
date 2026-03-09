import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { typography, colors } from '../utils/theme';

const appLogo = require('../../assets/logo.png');

const ICON_SIZE = 28;

/** Tüm sekmelerde ve stack ekranlarında üstte görünen "DoubleShot" başlığı + logo. Logo ile yazı birbirine göre dikey ortalanmış. */
export function AppHeaderTitle() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Image source={appLogo} style={styles.icon} resizeMode="contain" />
      </View>
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
    tintColor: colors.accent,
  },
  textWrap: {
    ...typography.subtitle,
    lineHeight: ICON_SIZE,
  },
  default: {
    ...typography.subtitle,
    color: colors.textPrimary,
    lineHeight: ICON_SIZE,
  },
  accent: {
    ...typography.subtitle,
    color: colors.accent,
    lineHeight: ICON_SIZE,
  },
});
