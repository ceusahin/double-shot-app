import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthScreenRoot } from './auth/AuthChrome';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import { useAuthStore } from '../store/authStore';
import { canUserCreateTeam, getQuotaBalance } from '../services/platformAdmin';
import type { QuotaGrantKind } from '../types';
import { countTeamsWhereOwner } from '../services/teams';
import {
  getTeamPlan,
  EXTRA_SEAT_MONTHLY_TRY,
  formatTry,
  priceForBilling,
  billingLabel,
  type TeamPlanId,
} from '../constants/teamPlans';

type Nav = StackNavigationProp<TeamsStackParamList, 'CreateTeamSummary'>;
type Route = RouteProp<TeamsStackParamList, 'CreateTeamSummary'>;

function billingMonthsToQuotaKind(months: number): QuotaGrantKind {
  if (months === 1) return 'months_1';
  if (months === 3) return 'months_3';
  return 'months_6';
}

export function TeamSubscriptionSummaryScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const user = useAuthStore((s) => s.user);
  const { data: ownedTeamCount = 0 } = useQuery({
    queryKey: ['owned-teams-count', user?.id],
    queryFn: () => countTeamsWhereOwner(user!.id),
    enabled: !!user?.id,
  });
  const { planId, billingMonths } = route.params;

  const plan = useMemo(() => getTeamPlan(planId as TeamPlanId), [planId]);
  const total = plan ? priceForBilling(plan, billingMonths) : 0;

  if (!plan) {
    return (
      <AuthScreenRoot>
        <View style={[styles.centered, { paddingTop: insets.top + 40 }]}>
          <Text style={styles.errText}>Paket bulunamadı.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Geri dön</Text>
          </Pressable>
        </View>
      </AuthScreenRoot>
    );
  }

  const goCreateTeam = () => {
    if (!canUserCreateTeam(user, ownedTeamCount)) {
      themedAlert(
        'Takım oluşturma',
        'Kullanılabilir kota hakkınız yok. Süper yöneticinizden süre kotası vermesini isteyin.'
      );
      return;
    }
    const qk = billingMonthsToQuotaKind(billingMonths);
    if (getQuotaBalance(user, qk) < 1) {
      themedAlert(
        'Kota yok',
        `Bu paket süresi (${billingMonths === 1 ? '1 ay' : billingMonths === 3 ? '3 ay' : '6 ay'}) için tanımlı kota hakkınız yok. Süper yöneticiden ilgili süreyle kota isteyin.`
      );
      return;
    }
    navigation.navigate('CreateTeam', { billingMonths });
  };

  return (
    <AuthScreenRoot>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabScrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Sipariş özeti</Text>
        <Text style={styles.title}>Seçiminizi doğrulayın</Text>
        <Text style={styles.lead}>
          Ödeme altyapısı yakında uygulamaya eklenecek. Şimdilik seçtiğiniz paket bilgisi takım oluşturma
          adımıyla birlikte kayda hazırlanır.
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paket</Text>
            <Text style={styles.summaryValue}>{plan.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dahil çalışan</Text>
            <Text style={styles.summaryValue}>{plan.includedSeats} kişi</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dönem</Text>
            <Text style={styles.summaryValue}>{billingLabel(billingMonths)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Tutar (KDV dahil)</Text>
            <Text style={styles.totalValue}>
              {billingMonths === 1 ? (
                <>
                  {formatTry(total)}
                  <Text style={styles.totalHint}> / ay</Text>
                </>
              ) : (
                formatTry(total)
              )}
            </Text>
          </View>
          {billingMonths !== 1 ? (
            <Text style={styles.prepaidHint}>
              Peşin ödeme. Ek çalışan ücretleri yine aylık olarak faturalanır.
            </Text>
          ) : null}
        </View>

        <View style={styles.policy}>
          <View style={styles.policyHeader}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent} />
            <Text style={styles.policyTitle}>Faturalama kuralları</Text>
          </View>
          <PolicyLine
            icon="people-outline"
            text={`Çalışan sayısı yalnızca ekibe kayıtlı üyelerle ölçülür; bekleyen katılma istekleri kotaya dahil değildir.`}
          />
          <PolicyLine
            icon="add-circle-outline"
            text={`Dahil kontenjanı aştığınızda her ek çalışan ${formatTry(
              EXTRA_SEAT_MONTHLY_TRY
            )} / ay eklenir. 3 veya 6 aylık paket alsanız bile bu ek ücret aylık faturalanır.`}
          />
          <PolicyLine
            icon="remove-circle-outline"
            text="Ek çalışan kotasını düşürdüğünüz ay için ek ücret yansır; bir sonraki aydan düşük paket tutarı uygulanır."
          />
        </View>

        <Pressable
          onPress={goCreateTeam}
          style={({ pressed }) => [styles.primaryOuter, shadow.md, pressed && styles.primaryPressed]}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentHover]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.primaryInner}
          >
            <Text style={styles.primaryText}>Takım adına geç</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.black} />
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Paket seçimine dön</Text>
        </Pressable>
      </ScrollView>
    </AuthScreenRoot>
  );
}

function PolicyLine({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.policyLine}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.policyIcon} />
      <Text style={styles.policyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  centered: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.lg },
  errText: { ...typography.body, color: colors.textSecondary },
  backLink: { marginTop: spacing.md },
  backLinkText: { ...typography.body, color: colors.accent, fontFamily: fonts.semibold },
  kicker: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  lead: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  summaryLabel: { ...typography.caption, color: colors.textMuted, flexShrink: 0 },
  summaryValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    textAlign: 'right',
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  totalLabel: { ...typography.subtitle, color: colors.textPrimary, fontSize: 17 },
  totalValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.accent,
    textAlign: 'right',
  },
  totalHint: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  prepaidHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  policy: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(22,22,26,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.xl,
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  policyTitle: { ...typography.subtitle, color: colors.textPrimary, fontSize: 17 },
  policyLine: { flexDirection: 'row', marginBottom: spacing.md },
  policyIcon: { marginTop: 2, marginRight: spacing.sm },
  policyText: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 21 },
  primaryOuter: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  primaryPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  primaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
  },
  primaryText: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.black,
  },
  secondaryBtn: { alignItems: 'center', paddingVertical: spacing.md },
  secondaryText: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
});
