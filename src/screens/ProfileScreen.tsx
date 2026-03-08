import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Card, Button, ProgressBar } from '../components';
import { useAuthStore } from '../store/authStore';
import { signOut } from '../services/auth';
import { getMyRolesSummary } from '../services/rbac';
import { colors, spacing, typography } from '../utils/theme';
import { XP_PER_LEVEL } from '../utils/theme';

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: roleSummaries = [] } = useQuery({
    queryKey: ['my-roles', user?.id],
    queryFn: () => getMyRolesSummary(user!.id),
    enabled: !!user?.id,
  });

  if (!user) return null;

  const displayName = [user.name, user.surname].filter(Boolean).join(' ') || user.email;
  const xpInLevel = user.experience_points % XP_PER_LEVEL;
  const progress = xpInLevel / XP_PER_LEVEL;

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
          size={80}
          style={styles.avatarWrap}
        />
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.level}>{user.level}</Text>
        <ProgressBar
          progress={progress}
          label={`${user.experience_points} XP`}
          showLabel
          style={styles.progress}
        />
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

      {roleSummaries.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Rollerim</Text>
          {roleSummaries.map((r, i) => (
            <Text key={i} style={styles.stat}>
              {r.organizationName}: {r.roleName} → {r.roleLevelName}
            </Text>
          ))}
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>İstatistikler</Text>
        <Text style={styles.stat}>Tamamlanan eğitim: —</Text>
        <Text style={styles.stat}>Quiz skoru: —</Text>
      </Card>

      <Button
        title="Çıkış Yap"
        onPress={() => signOut()}
        variant="outline"
        fullWidth
        style={styles.logoutBtn}
        textStyle={styles.logoutText}
      />
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
  avatarWrap: {
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: spacing.md,
  },
  name: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  level: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  progress: {
    marginTop: spacing.md,
    width: 200,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stat: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  logoutBtn: {
    borderColor: 'rgba(255, 50, 50, 0.3)',
  },
  logoutText: { color: '#ff6b6b' },
});
