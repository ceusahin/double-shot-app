import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { colors, spacing, typography } from '../utils/theme';
import type { UserProfile } from '../types';

interface LeaderboardItemProps {
  rank: number;
  user: UserProfile;
  score: number;
  scoreLabel?: string;
}

export function LeaderboardItem({
  rank,
  user,
  score,
  scoreLabel = 'XP',
}: LeaderboardItemProps) {
  const displayName = [user.name, user.surname].filter(Boolean).join(' ') || user.email;

  return (
    <View style={styles.container}>
      <View style={styles.rank}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>
      <Avatar
        source={user.profile_photo}
        name={displayName}
        size={44}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.level}>{user.level}</Text>
      </View>
      <View style={styles.scoreBox}>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.scoreLabel}>{scoreLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rank: {
    minWidth: 36,
    alignItems: 'center',
  },
  rankText: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  level: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  score: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '700',
  },
  scoreLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
});
