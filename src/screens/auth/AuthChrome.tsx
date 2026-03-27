import React from 'react';
import { View, StyleSheet, ViewStyle, Text, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, spacing, typography, fonts } from '../../utils/theme';

/** Sadece nötr koyu gradient — vurgu rengi buton ve tipografide kalır */
export function AuthScreenRoot({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#121214', colors.bgDark, '#0B0B0C']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.03)', 'transparent', 'rgba(0, 0, 0, 0.35)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/** Cam panel form kartı */
export function AuthFormCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.06)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.cardTopGlow}
        pointerEvents="none"
      />
      <View style={styles.cardTopLine} />
      {children}
    </View>
  );
}

export function AuthDivider() {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.text}>veya</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}

export const authFieldContainerStyle: ViewStyle = {
  marginBottom: spacing.md,
};

export const authFieldLabelStyle: TextStyle = {
  ...typography.small,
  color: 'rgba(255, 255, 255, 0.55)',
  marginBottom: spacing.xs + 2,
  fontFamily: fonts.semibold,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  fontSize: 11,
};

export const authFieldInputStyle: TextStyle = {
  ...typography.body,
  color: colors.textPrimary,
  backgroundColor: 'rgba(255, 255, 255, 0.045)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.08)',
  borderRadius: 14,
  paddingHorizontal: spacing.md + 2,
  paddingVertical: 15,
  minHeight: 52,
  fontSize: 16,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  card: {
    backgroundColor: 'rgba(22, 22, 26, 0.72)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.lg + 4,
    paddingTop: spacing.lg + 8,
    paddingBottom: spacing.lg + 6,
    overflow: 'hidden',
  },
  cardTopGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 88,
    opacity: 0.5,
  },
  cardTopLine: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  text: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.medium,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    fontSize: 10,
  },
});
