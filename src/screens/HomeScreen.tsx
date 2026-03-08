import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Card, TrainingCard } from '../components';
import { useAuthStore } from '../store/authStore';
import { getLatestTip } from '../services/tips';
import { getMyTeams } from '../services/teams';
import { getMyRolesSummary } from '../services/rbac';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const parentNav = navigation.getParent?.();
  const { data: tip } = useQuery({
    queryKey: ['tip'],
    queryFn: getLatestTip,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => getMyTeams(user!.id),
    enabled: !!user?.id,
  });
  const { data: roleSummaries = [] } = useQuery({
    queryKey: ['my-roles', user?.id],
    queryFn: () => getMyRolesSummary(user!.id),
    enabled: !!user?.id,
  });

  const isOwnerOnly = teams.length === 0 || teams.every((t) => t.owner_id === user?.id);
  const currentRole = roleSummaries[0];

  const goToRecipes = () => navigation.navigate('Recipes');
  const goToTraining = () => navigation.navigate('Training');
  const goToEquipment = () => parentNav?.navigate('Equipment');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greetingLabel}>
        Hoş Geldin, <Text style={styles.greetingAccent}>{user?.name ?? 'Barista'}</Text>
      </Text>

      {!isOwnerOnly && (
        <View style={styles.roleBlock}>
          <Text style={styles.roleBlockCaption}>Güncel rol</Text>
          {currentRole ? (
            <View style={styles.roleRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleName}>{currentRole.roleName}</Text>
              </View>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText}>{currentRole.roleLevelName}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.roleEmpty}>Henüz rol atanmadı</Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      <View style={styles.quickGrid}>
        <Card style={styles.quickCard} onPress={goToRecipes}>
          <Text style={styles.cardTitle}>Tarifler</Text>
          <Text style={styles.placeholder}>Global tarif rehberi</Text>
        </Card>
        <Card style={styles.quickCard} onPress={goToTraining}>
          <Text style={styles.cardTitle}>Eğitim</Text>
          <Text style={styles.placeholder}>Akademi modülü</Text>
        </Card>
      </View>

      <Card style={[styles.card, styles.equipmentCard]} onPress={goToEquipment}>
        <Text style={styles.cardTitle}>Makine & Ekipman Rehberi</Text>
        <Text style={styles.placeholder}>Arıza tespiti ve işletme bakımları</Text>
      </Card>

      <Text style={styles.sectionTitle}>Bugünün İpucu</Text>
      <Card style={[styles.card, styles.tipCard]}>
        <Text style={styles.placeholder}>
          {tip?.body ?? 'Mükemmel bir espresso shot için extraction (demleme) süresi ortalama 25–30 saniye arasında olmalıdır.'}
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Bugünkü vardiyan</Text>
      <Card style={styles.card}>
        <Text style={styles.placeholder}>
          Henüz atanmış vardiya yok. Takımınıza katılıp vardiya planına bakın.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Eğitimler</Text>
      <TrainingCard
        title="Espresso Temelleri"
        description="Espresso makinesi ve çekim ayarları"
        progress={0}
        onPress={() => {}}
      />
      <View style={styles.spacer} />
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
  greeting: {
    marginBottom: spacing.lg,
  },
  greetingLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  greetingText: {
    ...typography.title,
    color: colors.textPrimary,
  },
  greetingAccent: { color: colors.accent },
  roleBlock: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  roleBlockCaption: {
    ...typography.small,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  roleName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  levelPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  levelPillText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  roleEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  placeholder: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickCard: {
    minWidth: '47%',
    flex: 1,
  },
  equipmentCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  tipCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  spacer: {
    height: spacing.xl,
  },
});
