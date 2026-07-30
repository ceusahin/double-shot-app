import React, { useState, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '../components';
import { AuthScreenRoot, AuthFormCard, authFieldLabelStyle } from './auth/AuthChrome';
import { useAuthStore } from '../store/authStore';
import { getProfile } from '../services/auth';
import {
  createTeam,
  countTeamsWhereOwner,
  DEFAULT_TEAM_TRIAL_DAYS,
  type CreateTeamBilling,
} from '../services/teams';
import {
  canUserCreateTeam,
  getQuotaBalance,
  isPlatformStaff,
} from '../services/platformAdmin';
import { scheduleTeamSubscriptionExpiryReminder } from '../services/subscriptionReminder';
import { buildTeamCreatedBody } from '../utils/teamCreatedMessage';
import { type BillingMonths, type TeamPlanId } from '../constants/teamPlans';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import type { QuotaGrantKind } from '../types';

/** Kota süresi dışında paket seçilmediğinde abonelik satırında kullanılan varsayılan plan kodu. */
const DEFAULT_QUOTA_PLAN_ID: TeamPlanId = 'eco';

type Nav = StackNavigationProp<TeamsStackParamList, 'CreateTeam'>;

const KIND_ORDER: QuotaGrantKind[] = ['trial_15d', 'months_1', 'months_3', 'months_6'];

function kindLabel(k: QuotaGrantKind): string {
  switch (k) {
    case 'trial_15d':
      return '15 gün deneme';
    case 'months_1':
      return '1 ay';
    case 'months_3':
      return '3 ay';
    case 'months_6':
      return '6 ay';
    default:
      return k;
  }
}

function kindIcon(k: QuotaGrantKind): React.ComponentProps<typeof Ionicons>['name'] {
  switch (k) {
    case 'trial_15d':
      return 'sparkles-outline';
    case 'months_1':
      return 'today-outline';
    case 'months_3':
      return 'layers-outline';
    case 'months_6':
      return 'diamond-outline';
    default:
      return 'ellipse-outline';
  }
}

function billingMonthsFromKind(k: QuotaGrantKind): BillingMonths | null {
  if (k === 'months_1') return 1;
  if (k === 'months_3') return 3;
  if (k === 'months_6') return 6;
  return null;
}

function routeDurationLabel(months: BillingMonths): string {
  if (months === 1) return '1 ay';
  if (months === 3) return '3 ay';
  return '6 ay';
}

export function CreateTeamScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<TeamsStackParamList, 'CreateTeam'>>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const storeUser = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasDurationFromRoute = route.params?.billingMonths != null;
  const [selectedConsumeKind, setSelectedConsumeKind] = useState<QuotaGrantKind | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile', storeUser?.id],
    queryFn: () => getProfile(storeUser!.id),
    enabled: !!storeUser?.id,
  });
  const user = profile ?? storeUser;

  const skipQuotaGuardAfterSuccess = useRef(false);

  useFocusEffect(
    useCallback(() => {
      skipQuotaGuardAfterSuccess.current = false;
    }, [])
  );

  const { data: ownedTeamCount = 0 } = useQuery({
    queryKey: ['owned-teams-count', user?.id],
    queryFn: () => countTeamsWhereOwner(user!.id),
    enabled: !!user?.id,
  });

  useLayoutEffect(() => {
    if (!user || skipQuotaGuardAfterSuccess.current) return;
    if (!canUserCreateTeam(user, ownedTeamCount)) {
      navigation.goBack();
      themedAlert(
        'Takım oluşturma',
        'Kullanılabilir kota hakkınız yok. Süper yöneticinizden süre kotası vermesini isteyin.'
      );
    }
  }, [user, ownedTeamCount, navigation]);

  const availableKinds = useMemo(
    () => KIND_ORDER.filter((k) => getQuotaBalance(user, k) > 0),
    [user]
  );

  const billingForCreate = useMemo((): CreateTeamBilling | null => {
    const billingMonths = route.params?.billingMonths;
    if (billingMonths != null) {
      return { mode: 'plan', planId: DEFAULT_QUOTA_PLAN_ID, billingMonths };
    }
    if (isPlatformStaff(user)) {
      return null;
    }
    if (!selectedConsumeKind) return null;
    if (selectedConsumeKind === 'trial_15d') {
      return { mode: 'trial', trialDays: DEFAULT_TEAM_TRIAL_DAYS };
    }
    const bm = billingMonthsFromKind(selectedConsumeKind);
    if (bm == null) return null;
    return { mode: 'plan', planId: DEFAULT_QUOTA_PLAN_ID, billingMonths: bm };
  }, [route.params?.billingMonths, user, selectedConsumeKind]);

  const handleCreate = async () => {
    if (!user || !name.trim()) {
      setError('Takım adı girin.');
      return;
    }
    if (!isPlatformStaff(user)) {
      if (!hasDurationFromRoute && !selectedConsumeKind) {
        setError('Kullanacağınız kota süresini seçin.');
        return;
      }
      const checkKind = hasDurationFromRoute
        ? route.params!.billingMonths === 1
          ? 'months_1'
          : route.params!.billingMonths === 3
            ? 'months_3'
            : 'months_6'
        : selectedConsumeKind;
      if (checkKind && getQuotaBalance(user, checkKind) < 1) {
        themedAlert('Yetersiz kota', 'Seçilen kota türü için kullanılabilir hakkınız yok.');
        return;
      }
    }

    setError('');
    setLoading(true);
    try {
      const team = await createTeam(user.id, name.trim(), undefined, undefined, undefined, billingForCreate);
      skipQuotaGuardAfterSuccess.current = true;
      if (team.subscription_ends_at) {
        void scheduleTeamSubscriptionExpiryReminder({
          teamId: team.id,
          teamName: team.name,
          subscriptionEndsAtIso: team.subscription_ends_at,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['my-teams', user.id] });
      queryClient.invalidateQueries({ queryKey: ['owned-teams-count', user.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      const fresh = await getProfile(user.id);
      if (fresh) useAuthStore.getState().setUser(fresh);
      const body = buildTeamCreatedBody(team);
      themedAlert('Takım oluşturuldu', body, [
        { text: 'Tamam', onPress: () => navigation.replace('TeamManagement', { team: { ...team, role: 'MANAGER' } }) },
      ]);
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string };
      const msg = err?.message ?? err?.details ?? 'Takım oluşturulamadı.';
      if (__DEV__) console.warn('createTeam error:', e);
      setError(msg);
      themedAlert('Hata', msg);
    } finally {
      setLoading(false);
    }
  };

  const showLocalQuotaPicker = !hasDurationFromRoute && !isPlatformStaff(user);
  const routeMonths = route.params?.billingMonths;

  return (
    <AuthScreenRoot>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: tabScrollBottomPad, paddingTop: insets.top + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Yeni ekip</Text>
        <Text style={styles.heroTitle}>Takımını oluştur</Text>
        <Text style={styles.heroLead}>
          Ekip adını girin; kota sürenizi seçerek ilk döneminizi başlatın.
        </Text>

        <AuthFormCard style={styles.formCard}>
          <Text style={[authFieldLabelStyle, styles.fieldLabelExtra]}>Takım adı</Text>
          <Input
            label=""
            value={name}
            onChangeText={setName}
            placeholder="Örn: Merkez Şube"
            containerStyle={styles.inputNoMargin}
            style={styles.inputPremium}
          />

          {hasDurationFromRoute && routeMonths != null ? (
            <View style={styles.routePill}>
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.routePillInner}>
                <View style={styles.routePillIcon}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                </View>
                <View style={styles.routePillText}>
                  <Text style={styles.routePillTitle}>Özetten süre</Text>
                  <Text style={styles.routePillBody}>
                    Bu ekip için <Text style={styles.routePillStrong}>{routeDurationLabel(routeMonths)}</Text>{' '}
                    kotası kullanılacak. İlgili sürede en az 1 hak gerekir.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {showLocalQuotaPicker ? (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Kota süresi</Text>
                <Text style={styles.sectionHint}>
                  Süper yöneticinin tanımladığı haklar arasından birini seçin.
                </Text>
              </View>
              {availableKinds.length === 0 ? (
                <View style={styles.emptyQuota}>
                  <Ionicons name="alert-circle-outline" size={28} color={colors.warning} />
                  <Text style={styles.emptyQuotaText}>
                    Kullanılabilir kota yok. Süper yöneticiden süre tanımlaması isteyin.
                  </Text>
                </View>
              ) : (
                <View style={styles.quotaList}>
                  {availableKinds.map((k) => {
                    const active = selectedConsumeKind === k;
                    const balance = getQuotaBalance(user, k);
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setSelectedConsumeKind(k)}
                        style={({ pressed }) => [
                          styles.quotaRow,
                          active && styles.quotaRowActive,
                          pressed && styles.quotaRowPressed,
                        ]}
                      >
                        <View style={[styles.quotaIconRing, active && styles.quotaIconRingActive]}>
                          <Ionicons
                            name={kindIcon(k)}
                            size={22}
                            color={active ? colors.black : colors.accent}
                          />
                        </View>
                        <View style={styles.quotaRowBody}>
                          <Text style={[styles.quotaRowTitle, active && styles.quotaRowTitleActive]}>
                            {kindLabel(k)}
                          </Text>
                          <Text style={styles.quotaRowMeta}>{balance} kullanılabilir hak</Text>
                        </View>
                        <View style={[styles.quotaCountPill, active && styles.quotaCountPillActive]}>
                          <Text style={[styles.quotaCountText, active && styles.quotaCountTextActive]}>
                            {balance}
                          </Text>
                        </View>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={22} color={colors.accent} style={styles.quotaCheck} />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : isPlatformStaff(user) ? (
            <View style={styles.staffNote}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent} />
              <Text style={styles.staffNoteText}>Platform hesabı — kota düşmez, doğrudan oluşturabilirsiniz.</Text>
            </View>
          ) : null}
        </AuthFormCard>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleCreate}
          disabled={loading}
          style={({ pressed }) => [styles.ctaOuter, shadow.md, pressed && styles.ctaPressed, loading && styles.ctaDisabled]}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentHover]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ctaInner}
          >
            {loading ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <>
                <Text style={styles.ctaText}>Takımı oluştur</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.black} />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </AuthScreenRoot>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollInner: {
    paddingHorizontal: spacing.md,
  },
  kicker: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.semibold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  heroLead: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  formCard: {
    marginBottom: spacing.md,
  },
  fieldLabelExtra: {
    marginBottom: spacing.sm,
  },
  inputNoMargin: {
    marginBottom: 0,
  },
  inputPremium: {
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 15,
  },
  routePill: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    overflow: 'hidden',
  },
  routePillInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  routePillIcon: { marginTop: 2 },
  routePillText: { flex: 1, minWidth: 0 },
  routePillTitle: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
    marginBottom: 4,
  },
  routePillBody: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  routePillStrong: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  sectionHead: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
  emptyQuota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(233, 196, 106, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(233, 196, 106, 0.25)',
  },
  emptyQuotaText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  quotaList: {
    gap: spacing.sm,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  quotaRowActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  quotaRowPressed: { opacity: 0.92 },
  quotaIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  quotaIconRingActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  quotaRowBody: { flex: 1, minWidth: 0 },
  quotaRowTitle: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  quotaRowTitleActive: { color: colors.textPrimary },
  quotaRowMeta: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  quotaCountPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  quotaCountPillActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  quotaCountText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
  },
  quotaCountTextActive: { color: colors.textPrimary },
  quotaCheck: { marginLeft: -4 },
  staffNote: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  staffNoteText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  errorBannerText: {
    ...typography.small,
    color: colors.error,
    flex: 1,
    lineHeight: 20,
  },
  ctaOuter: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.black,
    letterSpacing: 0.3,
  },
  ctaPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  ctaDisabled: { opacity: 0.75 },
});
