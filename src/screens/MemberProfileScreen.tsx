import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Card, ProgressBar } from '../components';
import { getTrainingProgress, getGlobalTrainings } from '../services/training';
import { colors, spacing, typography, XP_PER_LEVEL, LEVEL_ORDER } from '../utils/theme';
import type { UserProfile } from '../types';

type Props = {
  route: { params: { user: UserProfile } };
};

export function MemberProfileScreen({ route }: Props) {
  const { user } = route.params;
  const displayName = [user.name, user.surname].filter(Boolean).join(' ') || user.email;
  const xpInLevel = user.experience_points % XP_PER_LEVEL;
  const progress = xpInLevel / XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInLevel;
  const levelOrderKeys = Object.keys(LEVEL_ORDER);
  const currentLevelIndex = levelOrderKeys.indexOf(user.level);
  const isMaxLevel = currentLevelIndex >= levelOrderKeys.length - 1;

  const { data: progressList = [] } = useQuery({
    queryKey: ['training-progress', user.id],
    queryFn: () => getTrainingProgress(user.id),
    enabled: !!user.id,
  });

  const { data: trainingsList = [] } = useQuery({
    queryKey: ['global-trainings'],
    queryFn: getGlobalTrainings,
  });

  const badges = useMemo(() => {
    const completed = progressList.filter((p) => p.completed);
    return completed.map((p) => {
      const training = trainingsList.find((t) => t.id === p.training_id);
      return { id: p.id, title: training?.title ?? 'Eğitim', score: p.score };
    });
  }, [progressList, trainingsList]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Avatar
          source={user.profile_photo}
          name={displayName}
          size={88}
          style={styles.avatar}
        />
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.level}>{user.level}</Text>
        <ProgressBar
          progress={progress}
          label={`${user.experience_points} XP`}
          showLabel
          style={styles.progress}
        />
        <Text style={styles.xpToNext}>
          {isMaxLevel
            ? 'Maksimum seviye'
            : `Sonraki seviyeye ${xpToNextLevel} puan kaldı`}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{user.experience_points}</Text>
          <Text style={styles.statLabel}>Puan</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Eğitim</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Pratik</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Rozetler</Text>
      {badges.length === 0 ? (
        <Card style={styles.badgesCard}>
          <View style={styles.badgesEmpty}>
            <Ionicons name="ribbon-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.badgesEmptyText}>Henüz kazanılan rozet yok</Text>
            <Text style={styles.badgesEmptyHint}>Tamamlanan eğitimler burada görünecek.</Text>
          </View>
        </Card>
      ) : (
        <View style={styles.badgesGrid}>
          {badges.map((b) => (
            <Card key={b.id} style={styles.badgeCard}>
              <View style={styles.badgeIconWrap}>
                <Ionicons name="ribbon" size={28} color={colors.accent} />
              </View>
              <Text style={styles.badgeTitle} numberOfLines={2}>{b.title}</Text>
              {b.score != null && (
                <Text style={styles.badgeScore}>{b.score} puan</Text>
              )}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  avatar: {
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: spacing.md,
  },
  name: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  level: {
    ...typography.body,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  progress: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  xpToNext: {
    ...typography.small,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.title,
    color: colors.accent,
  },
  statLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  badgesCard: {
    paddingVertical: spacing.lg,
  },
  badgesEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  badgesEmptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  badgesEmptyHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    width: '48%',
    minWidth: 140,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  badgeIconWrap: {
    marginBottom: spacing.xs,
  },
  badgeTitle: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  badgeScore: {
    ...typography.small,
    color: colors.accent,
    marginTop: 2,
  },
});
