import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../utils/theme';

interface ProgressBarProps {
  progress: number; // 0 - 1
  label?: string;
  showLabel?: boolean;
  height?: number;
  color?: string;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  label,
  showLabel = true,
  height = 8,
  color = colors.primary,
  style,
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.wrapper, style]}>
      {(label || showLabel) && (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {showLabel && (
            <Text style={styles.percent}>{Math.round(clamped * 100)}%</Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            { width: `${clamped * 100}%`, height, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.text,
  },
  percent: {
    ...typography.small,
    color: colors.textMuted,
  },
  track: {
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: borderRadius.full,
  },
});
