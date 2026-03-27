import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Card } from '../components';
import { useAuthStore } from '../store/authStore';
import { createTeam } from '../services/teams';
import { scheduleTeamSubscriptionExpiryReminder } from '../services/subscriptionReminder';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import { getTeamPlan, billingLabel } from '../constants/teamPlans';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Nav = StackNavigationProp<TeamsStackParamList, 'CreateTeam'>;
type CreateTeamRoute = RouteProp<TeamsStackParamList, 'CreateTeam'>;

export function CreateTeamScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<CreateTeamRoute>();
  const planId = route.params?.planId;
  const billingMonths = route.params?.billingMonths;
  const selectedPlan = planId ? getTeamPlan(planId) : undefined;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!user || !name.trim()) {
      setError('Takım adı girin.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const subscription =
        planId && billingMonths ? { planId, billingMonths } : null;
      const team = await createTeam(user.id, name.trim(), undefined, undefined, undefined, subscription);
      if (team.subscription_ends_at) {
        void scheduleTeamSubscriptionExpiryReminder({
          teamId: team.id,
          teamName: team.name,
          subscriptionEndsAtIso: team.subscription_ends_at,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['my-teams', user.id] });
      Alert.alert('Takım oluşturuldu', 'Üyeleri davet etmek için takım sayfasında sağ üstten "Ekibe davet et" ile süreli link oluşturun.', [
        { text: 'Tamam', onPress: () => navigation.replace('TeamManagement', { team: { ...team, role: 'MANAGER' } }) },
      ]);
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string };
      const msg = err?.message ?? err?.details ?? 'Takım oluşturulamadı.';
      if (__DEV__) console.warn('createTeam error:', e);
      setError(msg);
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {selectedPlan && billingMonths ? (
        <View style={styles.planBanner}>
          <Text style={styles.planBannerLabel}>Seçilen paket</Text>
          <Text style={styles.planBannerTitle}>{selectedPlan.name}</Text>
          <Text style={styles.planBannerMeta}>
            {selectedPlan.includedSeats} dahil çalışan · {billingLabel(billingMonths)}
          </Text>
        </View>
      ) : null}
      <Card>
        <Input
          label="Takım adı"
          value={name}
          onChangeText={setName}
          placeholder="Örn: Merkez Şube"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Oluştur" onPress={handleCreate} loading={loading} fullWidth />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  planBanner: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  planBannerLabel: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  planBannerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontSize: 18,
  },
  planBannerMeta: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.medium,
    marginTop: 4,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
