import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../utils/theme';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { weekday: 'short' });
}

interface ShiftBlockProps {
  startTime: string;
  endTime: string;
  role?: string;
  userName?: string;
  compact?: boolean;
}

export function ShiftBlock({
  startTime,
  endTime,
  role = 'Barista',
  userName,
  compact,
}: ShiftBlockProps) {
  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={styles.compactTime}>
          {formatTime(startTime)} – {formatTime(endTime)}
        </Text>
        {userName ? (
          <Text style={styles.compactName} numberOfLines={1}>
            {userName}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.timeRow}>
        <Text style={styles.time}>
          {formatTime(startTime)} – {formatTime(endTime)}
        </Text>
        <Text style={styles.day}>{formatDay(startTime)}</Text>
      </View>
      <Text style={styles.role}>{role}</Text>
      {userName ? (
        <Text style={styles.userName} numberOfLines={1}>
          {userName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    ...typography.subtitle,
    color: colors.accent,
    fontWeight: '700',
  },
  day: {
    ...typography.small,
    color: colors.textMuted,
  },
  role: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  userName: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  compact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  compactTime: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  compactName: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
});
