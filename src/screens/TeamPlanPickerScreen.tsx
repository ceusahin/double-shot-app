import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthScreenRoot } from './auth/AuthChrome';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import {
  TEAM_PLANS,
  EXTRA_SEAT_MONTHLY_TRY,
  formatTry,
  priceForBilling,
  type BillingMonths,
  type TeamPlan,
  type TeamPlanId,
} from '../constants/teamPlans';

type Nav = StackNavigationProp<TeamsStackParamList, 'CreateTeamPlanPicker'>;

const BILLING_OPTIONS: { months: BillingMonths; label: string; sub: string }[] = [
  { months: 1, label: 'Aylık', sub: 'Esnek faturalama' },
  { months: 3, label: '3 ay', sub: 'Peşin, indirimli' },
  { months: 6, label: '6 ay', sub: 'En avantajlı dönem' },
];

export function TeamPlanPickerScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - spacing.md * 2, 360);

  const [planId, setPlanId] = useState<TeamPlanId>('eco');
  const [billingMonths, setBillingMonths] = useState<BillingMonths>(1);

  const selected = useMemo(() => TEAM_PLANS.find((p) => p.id === planId)!, [planId]);
  const totalNow = useMemo(() => priceForBilling(selected, billingMonths), [selected, billingMonths]);

  const goSummary = () => {
    navigation.navigate('CreateTeamSummary', { planId, billingMonths });
  };

  return (
    <AuthScreenRoot>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Ionicons name="diamond-outline" size={14} color={colors.accent} />
              <Text style={styles.heroBadgeText}>Premium ekip deneyimi</Text>
            </View>
            <Text style={styles.heroTitle}>Ekibinize uygun paketi seçin</Text>
            <Text style={styles.heroSub}>
              Tüm fiyatlar KDV dahildir. Çalışan sayısı, yalnızca ekibe kabul edilmiş üyelerle hesaplanır;
              bekleyen katılma istekleri kotaya dahil değildir.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Paketler</Text>
          <View style={styles.planList}>
            {TEAM_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={plan.id === planId}
                onSelect={() => setPlanId(plan.id)}
                width={cardWidth}
                billingMonths={billingMonths}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>Ödeme dönemi</Text>
          <View style={styles.billingRow}>
            {BILLING_OPTIONS.map((opt) => {
              const active = billingMonths === opt.months;
              const planPrice = priceForBilling(selected, opt.months);
              return (
                <Pressable
                  key={opt.months}
                  onPress={() => setBillingMonths(opt.months)}
                  style={({ pressed }) => [
                    styles.billingChip,
                    active && styles.billingChipActive,
                    pressed && styles.billingChipPressed,
                  ]}
                >
                  <Text style={[styles.billingChipLabel, active && styles.billingChipLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.billingChipSub} numberOfLines={2}>
                    {opt.sub}
                  </Text>
                  <Text style={[styles.billingChipPrice, active && styles.billingChipPriceActive]}>
                    {opt.months === 1
                      ? `${formatTry(planPrice)}/ay`
                      : formatTry(planPrice)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {billingMonths === 3 && selected.monthlyPriceTry === 10_000 ? (
            <Text style={styles.footnote}>
              *3 aylık Eco pakette toplam 25.000 ₺; aylık ödemeye göre 5.000 ₺ tasarruf.
            </Text>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Ek çalışan kotası</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-add-outline" size={20} color={colors.accent} />
              <Text style={styles.infoText}>
                Paket dahilini aştığınızda her ek çalışan için{' '}
                <Text style={styles.infoStrong}>{formatTry(EXTRA_SEAT_MONTHLY_TRY)}</Text> aylık eklenir — 3 veya 6 aylık
                ana paket alsanız bile bu tutar{' '}
                <Text style={styles.infoStrong}>aylık</Text> faturalanır.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.accent} />
              <Text style={styles.infoText}>
                Ek çalışan kotasını ay içinde düşürürseniz o ay için ek ücret yine yansır; bir sonraki aydan
                itibaren fiyatınız güncellenir.
              </Text>
            </View>
          </View>

          <View style={styles.liveTotal}>
            <Text style={styles.liveTotalLabel}>Seçiminiz</Text>
            <Text style={styles.liveTotalPlan}>{selected.name}</Text>
            <Text style={styles.liveTotalPrice}>
              {billingMonths === 1 ? (
                <>
                  {formatTry(totalNow)}
                  <Text style={styles.liveTotalPer}> / ay</Text>
                </>
              ) : (
                <>
                  Peşin {formatTry(totalNow)}
                  <Text style={styles.liveTotalPer}>
                    {' '}
                    (≈ {formatTry(Math.round(totalNow / billingMonths))} / ay)
                  </Text>
                </>
              )}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <LinearGradient
            colors={['transparent', colors.bgDark]}
            style={styles.footerFade}
            pointerEvents="none"
          />
          <Pressable
            onPress={goSummary}
            style={({ pressed }) => [styles.ctaOuter, styles.ctaShadow, pressed && styles.ctaPressed]}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentHover]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaInner}
            >
              <Text style={styles.ctaText}>Özeti gör ve devam et</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.black} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </AuthScreenRoot>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  width,
  billingMonths,
}: {
  plan: TeamPlan;
  selected: boolean;
  onSelect: () => void;
  width: number;
  billingMonths: BillingMonths;
}) {
  const total = priceForBilling(plan, billingMonths);
  const isEco = plan.id === 'eco';

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.planCardOuter,
        { width },
        selected && styles.planCardOuterSelected,
        pressed && styles.planCardPressed,
      ]}
    >
      {isEco ? (
        <View style={styles.recommendedRibbon}>
          <Text style={styles.recommendedRibbonText}>Çok tercih edilen</Text>
        </View>
      ) : null}
      <View style={[styles.planCardInner, selected && styles.planCardInnerSelected]}>
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{plan.name}</Text>
          <View style={[styles.radio, selected && styles.radioOn]}>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        </View>
        <Text style={styles.planTag}>{plan.tagline}</Text>
        <View style={styles.planMetric}>
          <Text style={styles.planMetricValue}>{plan.includedSeats}</Text>
          <Text style={styles.planMetricLabel}>dahil çalışan</Text>
        </View>
        <Text style={styles.planPriceLine}>
          {billingMonths === 1 ? (
            <>
              <Text style={styles.planPriceMain}>{formatTry(plan.monthlyPriceTry)}</Text>
              <Text style={styles.planPriceUnit}> / ay</Text>
            </>
          ) : (
            <>
              <Text style={styles.planPriceMain}>{formatTry(total)}</Text>
              <Text style={styles.planPriceUnit}> toplam</Text>
            </>
          )}
        </Text>
        {plan.highlights.map((h) => (
          <View key={h} style={styles.planBullet}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.planBulletText}>{h}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  hero: { marginBottom: spacing.lg },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    marginBottom: spacing.md,
  },
  heroBadgeText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  heroTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  heroSub: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  sectionLabel: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  planList: { gap: spacing.md, marginBottom: spacing.lg, alignItems: 'center' },
  planCardOuter: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(22,22,26,0.55)',
    overflow: 'hidden',
  },
  planCardOuterSelected: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  planCardPressed: { opacity: 0.92 },
  recommendedRibbon: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  recommendedRibbonText: {
    ...typography.small,
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  planCardInner: {
    padding: spacing.lg,
  },
  planCardInnerSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: {
    ...typography.subtitle,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  planTag: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  planMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  planMetricValue: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  planMetricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  planPriceLine: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.md },
  planPriceMain: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  planPriceUnit: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  planBullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  planBulletText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  billingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  billingChip: {
    flex: 1,
    minHeight: 104,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  billingChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  billingChipPressed: { opacity: 0.9 },
  billingChipLabel: {
    ...typography.small,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  billingChipLabelActive: { color: colors.textPrimary },
  billingChipSub: {
    ...typography.small,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    flex: 1,
  },
  billingChipPrice: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  billingChipPriceActive: { color: colors.accent },
  footnote: {
    ...typography.small,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  infoCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontSize: 17,
  },
  infoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  infoText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 22 },
  infoStrong: { color: colors.textPrimary, fontFamily: fonts.semibold },
  liveTotal: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(212, 175, 55, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  liveTotalLabel: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  liveTotalPlan: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  liveTotalPrice: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  liveTotalPer: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    height: 48,
  },
  ctaOuter: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadow.md,
  },
  ctaPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  ctaText: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.black,
  },
  ctaShadow: shadow.md,
});
