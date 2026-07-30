import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components';
import {
  superAdminGrantOwnedTeamQuota,
  superAdminRevokeOwnedTeamQuota,
  superAdminExtendTeamSubscription,
  listUserQuotaGrants,
  listTeamsOwnedByUser,
  quotaGrantKindLabelTr,
  getQuotaBalance,
  sumQuotaBalances,
  type QuotaGrantKind,
  type UserQuotaGrantRow,
} from '../../services/platformAdmin';
import { getProfile } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../../utils/theme';
import { themedAlert } from '../../utils/themedAlert';
import { formatRemainingUntilEnd } from '../../utils/subscriptionPeriod';
import { useMainTabScrollPadding } from '../../hooks/useMainTabScrollPadding';
import type { TeamsStackParamList } from '../../navigation/TeamsStack';
import type { Team, UserProfile } from '../../types';

type Nav = StackNavigationProp<TeamsStackParamList, 'SuperAdminUserDetail'>;
type Rt = RouteProp<TeamsStackParamList, 'SuperAdminUserDetail'>;

type KindCard = {
  kind: QuotaGrantKind;
  title: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const KIND_CARDS: KindCard[] = [
  { kind: 'trial_15d', title: '15 günlük deneme', hint: '15 gün süreli deneme hakkı', icon: 'flask-outline' },
  { kind: 'months_1', title: '1 aylık paket', hint: '30 gün süreli', icon: 'calendar-outline' },
  { kind: 'months_3', title: '3 aylık paket', hint: '90 gün süreli', icon: 'calendar-number-outline' },
  { kind: 'months_6', title: '6 aylık paket', hint: '180 gün süreli', icon: 'calendar-clear-outline' },
];

const HOUR_PRESETS: { label: string; hours: number }[] = [
  { label: '+1 saat', hours: 1 },
  { label: '+6 saat', hours: 6 },
  { label: '+12 saat', hours: 12 },
  { label: '+1 gün', hours: 24 },
  { label: '+3 gün', hours: 72 },
  { label: '+7 gün', hours: 168 },
  { label: '+15 gün', hours: 360 },
  { label: '+30 gün', hours: 720 },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatHoursDelta(hours: number): string {
  const abs = Math.abs(hours);
  const sign = hours > 0 ? '+' : '-';
  if (abs === 0) return '';

  if (abs < 24) return `${sign}${abs} sa`;

  const totalDays = Math.floor(abs / 24);
  const remHours = abs % 24;

  if (totalDays < 30) {
    if (remHours === 0) return `${sign}${totalDays} g`;
    return `${sign}${totalDays} g ${remHours} sa`;
  }

  if (totalDays < 365) {
    const months = Math.floor(totalDays / 30);
    const remDays = totalDays % 30;
    if (remDays === 0) return `${sign}${months} ay`;
    return `${sign}${months} ay ${remDays} g`;
  }

  const years = Math.floor(totalDays / 365);
  const leftDays = totalDays % 365;
  const months = Math.floor(leftDays / 30);
  if (months === 0) return `${sign}${years} y`;
  return `${sign}${years} y ${months} ay`;
}

function planLabel(
  plan: string | null | undefined,
  billingMonths: number | null | undefined,
  manualHours: number | null | undefined
): string {
  let base: string;
  if (!plan) {
    base = 'Paketsiz';
  } else if (plan === 'trial') {
    base = 'Deneme (15 gün)';
  } else {
    const tag = billingMonths ? `${billingMonths} ay` : '';
    const name =
      plan === 'eco' ? 'Eco' : plan === 'growth' ? 'Growth' : plan === 'scale' ? 'Scale' : plan;
    base = tag ? `${name} · ${tag}` : name;
  }
  const mh = manualHours ?? 0;
  if (mh === 0) return base;
  return `${base} · Özel (${formatHoursDelta(mh)})`;
}

export function SuperAdminUserDetailScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const queryClient = useQueryClient();
  const viewer = useAuthStore((s) => s.user);
  const viewerIsSuper = !!viewer?.is_super_admin;

  const [profile, setProfile] = useState<UserProfile>(route.params.user);
  const [busyKind, setBusyKind] = useState<QuotaGrantKind | null>(null);
  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);
  const [extendTeam, setExtendTeam] = useState<Team | null>(null);
  const [extendHoursInput, setExtendHoursInput] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const targetIsPlatformAdmin = !!profile.is_platform_admin;
  const targetIsSuper = !!profile.is_super_admin;
  const canManageQuota = viewerIsSuper && !targetIsPlatformAdmin && !targetIsSuper;

  const teamsQuery = useQuery({
    queryKey: ['super-user-teams', profile.id],
    queryFn: () => listTeamsOwnedByUser(profile.id),
  });

  const grantsQuery = useQuery({
    queryKey: ['super-user-grants', profile.id],
    queryFn: () => listUserQuotaGrants(profile.id),
    enabled: viewerIsSuper,
  });

  const refreshProfile = useCallback(async () => {
    const fresh = await getProfile(profile.id);
    if (fresh) {
      setProfile(fresh);
      if (viewer?.id === profile.id) {
        useAuthStore.getState().setUser(fresh);
      }
    }
  }, [profile.id, viewer?.id]);

  const doGrant = useCallback(
    async (kind: QuotaGrantKind) => {
      setBusyKind(kind);
      try {
        await superAdminGrantOwnedTeamQuota(profile.id, kind);
        await refreshProfile();
        await queryClient.invalidateQueries({ queryKey: ['super-user-grants', profile.id] });
        await queryClient.invalidateQueries({ queryKey: ['management-all-users'] });
      } catch (e) {
        themedAlert('Hata', e instanceof Error ? e.message : 'Kota eklenemedi');
      } finally {
        setBusyKind(null);
      }
    },
    [profile.id, queryClient, refreshProfile]
  );

  const doRevoke = useCallback(
    async (kind: QuotaGrantKind) => {
      setBusyKind(kind);
      try {
        await superAdminRevokeOwnedTeamQuota(profile.id, kind);
        await refreshProfile();
        await queryClient.invalidateQueries({ queryKey: ['super-user-grants', profile.id] });
        await queryClient.invalidateQueries({ queryKey: ['management-all-users'] });
      } catch (e) {
        themedAlert('Hata', e instanceof Error ? e.message : 'Kota düşürülemedi');
      } finally {
        setBusyKind(null);
      }
    },
    [profile.id, queryClient, refreshProfile]
  );

  const applyExtend = useCallback(
    async (hours: number) => {
      if (!extendTeam) return;
      setBusyTeamId(extendTeam.id);
      try {
        const newEnds = await superAdminExtendTeamSubscription(extendTeam.id, hours);
        setExtendTeam(null);
        setExtendHoursInput('');
        await queryClient.invalidateQueries({ queryKey: ['super-user-teams', profile.id] });
        themedAlert(
          'Süre güncellendi',
          `Yeni bitiş: ${formatDate(newEnds)}`
        );
      } catch (e) {
        themedAlert('Hata', e instanceof Error ? e.message : 'Süre eklenemedi');
      } finally {
        setBusyTeamId(null);
      }
    },
    [extendTeam, profile.id, queryClient]
  );

  const onApplyCustomHours = useCallback(() => {
    const raw = extendHoursInput.trim();
    if (!raw) {
      themedAlert('Geçersiz', 'Saat giriniz');
      return;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n === 0) {
      themedAlert('Geçersiz', '0 dışında bir tam sayı giriniz (negatif de olabilir).');
      return;
    }
    void applyExtend(n);
  }, [applyExtend, extendHoursInput]);

  const displayName =
    [profile.name, profile.surname].filter(Boolean).join(' ') || profile.email || '—';

  const totalQuota = useMemo(() => sumQuotaBalances(profile), [profile]);
  const ownedCount = teamsQuery.data?.length ?? 0;
  const activeCount = useMemo(() => {
    const list = teamsQuery.data ?? [];
    return list.filter((t) => {
      if (!t.subscription_ends_at) return false;
      const end = new Date(t.subscription_ends_at).getTime();
      return !Number.isNaN(end) && end > now;
    }).length;
  }, [teamsQuery.data, now]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabScrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.22)', 'rgba(10, 10, 10, 0.4)', colors.bgDark]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[
            styles.hero,
            {
              paddingTop: insets.top + spacing.md,
            },
          ]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={12}
            accessibilityLabel="Geri"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.heroRow}>
            <Avatar source={profile.profile_photo} name={displayName} size={72} />
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>Süper yönetici görünümü</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={1}>
                {profile.email}
              </Text>
              <View style={styles.heroBadges}>
                {targetIsSuper ? (
                  <View style={[styles.badge, styles.badgeSuper]}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.bgDark} />
                    <Text style={styles.badgeTextDark}>Süper yönetici</Text>
                  </View>
                ) : targetIsPlatformAdmin ? (
                  <View style={[styles.badge, styles.badgeAdmin]}>
                    <Ionicons name="shield-outline" size={12} color={colors.accent} />
                    <Text style={styles.badgeText}>Platform yöneticisi</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeDefault]}>
                    <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.badgeTextMuted}>Standart kullanıcı</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard label="Toplam kota" value={`${totalQuota}`} />
            <StatCard label="Sahip ekip" value={`${ownedCount}`} />
            <StatCard label="Aktif paket" value={`${activeCount}`} />
          </View>
        </LinearGradient>

        {canManageQuota ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kota yönetimi</Text>
            <Text style={styles.sectionLead}>
              Tür bazlı ekip kurma hakkı. Her ekle +1, her düşür -1.
            </Text>
            <View style={styles.kindGrid}>
              {KIND_CARDS.map((kc) => {
                const bal = getQuotaBalance(profile, kc.kind);
                const busy = busyKind === kc.kind;
                return (
                  <View key={kc.kind} style={styles.kindCard}>
                    <View style={styles.panelGoldCap} />
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.07)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    <View style={styles.kindCardInner}>
                      <View style={styles.kindHeader}>
                        <View style={styles.kindIconWrap}>
                          <Ionicons name={kc.icon} size={18} color={colors.accent} />
                        </View>
                        <View style={styles.kindHeaderText}>
                          <Text style={styles.kindTitle}>{kc.title}</Text>
                          <Text style={styles.kindHint}>{kc.hint}</Text>
                        </View>
                      </View>
                      <View style={styles.kindControls}>
                        <Pressable
                          onPress={() => void doRevoke(kc.kind)}
                          disabled={busy || bal <= 0}
                          style={({ pressed }) => [
                            styles.kindBtn,
                            (bal <= 0 || busy) && styles.kindBtnDisabled,
                            pressed && styles.kindBtnPressed,
                          ]}
                          accessibilityLabel={`${kc.title} kotasını düşür`}
                        >
                          <Ionicons
                            name="remove"
                            size={20}
                            color={bal <= 0 ? colors.textMuted : colors.error}
                          />
                        </Pressable>
                        <View style={styles.kindValueWrap}>
                          {busy ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                          ) : (
                            <Text style={styles.kindValue}>{bal}</Text>
                          )}
                          <Text style={styles.kindValueLabel}>adet</Text>
                        </View>
                        <Pressable
                          onPress={() => void doGrant(kc.kind)}
                          disabled={busy || bal >= 999}
                          style={({ pressed }) => [
                            styles.kindBtn,
                            styles.kindBtnAccent,
                            (bal >= 999 || busy) && styles.kindBtnDisabled,
                            pressed && styles.kindBtnPressed,
                          ]}
                          accessibilityLabel={`${kc.title} kotası ekle`}
                        >
                          <Ionicons name="add" size={20} color={colors.accent} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.infoPanel}>
              <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
              <Text style={styles.infoPanelText}>
                {targetIsSuper
                  ? 'Süper yönetici hesabı için kota sınırı uygulanmaz.'
                  : targetIsPlatformAdmin
                    ? 'Platform yönetici hesabı için kota sınırı uygulanmaz.'
                    : 'Bu hesap için kota yönetimi yetkiniz yok.'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Sahip olduğu ekipler</Text>
              <Text style={styles.sectionLead}>
                Paket sürelerini saat bazında ekle/çıkar.
              </Text>
            </View>
            {teamsQuery.isFetching ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : null}
          </View>

          {teamsQuery.isLoading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Ekipler yükleniyor…</Text>
            </View>
          ) : teamsQuery.isError ? (
            <View style={styles.errorPanel}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
              <Text style={styles.errorText}>
                {teamsQuery.error instanceof Error
                  ? teamsQuery.error.message
                  : 'Ekip listesi alınamadı.'}
              </Text>
            </View>
          ) : (teamsQuery.data ?? []).length === 0 ? (
            <View style={styles.emptyPanel}>
              <Ionicons name="people-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyText}>Bu kullanıcının sahip olduğu ekip yok.</Text>
            </View>
          ) : (
            (teamsQuery.data ?? []).map((team) => {
              const remaining = formatRemainingUntilEnd(team.subscription_ends_at);
              const expired = remaining === 'Süre doldu';
              const canExtend = viewerIsSuper && !!team.subscription_ends_at;
              const busy = busyTeamId === team.id;
              return (
                <View key={team.id} style={styles.teamCard}>
                  <View style={styles.panelGoldCap} />
                  <LinearGradient
                    colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <View style={styles.teamCardInner}>
                    <View style={styles.teamHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.teamName} numberOfLines={1}>
                          {team.name}
                        </Text>
                        <Text style={styles.teamPlan}>
                          {planLabel(
                            team.subscription_plan,
                            team.subscription_billing_months,
                            team.manual_extension_hours
                          )}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          expired ? styles.statusPillExpired : styles.statusPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            expired ? styles.statusPillTextExpired : styles.statusPillTextActive,
                          ]}
                        >
                          {expired ? 'SÜRESİ DOLDU' : remaining ?? 'PAKETSİZ'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.teamDates}>
                      <View style={styles.teamDateCol}>
                        <Text style={styles.teamDateLabel}>Başladı</Text>
                        <Text style={styles.teamDateValue}>
                          {formatDate(team.subscription_started_at)}
                        </Text>
                      </View>
                      <View style={styles.teamDateCol}>
                        <Text style={styles.teamDateLabel}>Bitiyor</Text>
                        <Text style={styles.teamDateValue}>
                          {formatDate(team.subscription_ends_at)}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => {
                        if (!canExtend) {
                          themedAlert(
                            'Paket yok',
                            'Bu ekip için paket süresi tanımlı değil; önce bir paket/deneme atanmalı.'
                          );
                          return;
                        }
                        setExtendHoursInput('');
                        setExtendTeam(team);
                      }}
                      disabled={busy || !canExtend}
                      style={({ pressed }) => [
                        styles.extendBtn,
                        !canExtend && styles.extendBtnDisabled,
                        pressed && styles.extendBtnPressed,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.bgDark} />
                      ) : (
                        <>
                          <Ionicons name="time-outline" size={18} color={colors.bgDark} />
                          <Text style={styles.extendBtnText}>Süre ekle / düşür</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {viewerIsSuper ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kota geçmişi</Text>
            <Text style={styles.sectionLead}>Verilen ekip kurma hakları (en yeniden eskiye).</Text>
            {grantsQuery.isLoading ? (
              <View style={styles.loadingPanel}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Yükleniyor…</Text>
              </View>
            ) : (grantsQuery.data ?? []).length === 0 ? (
              <View style={styles.emptyPanel}>
                <Ionicons name="document-outline" size={20} color={colors.textMuted} />
                <Text style={styles.emptyText}>Henüz süre etiketli kota kaydı yok.</Text>
              </View>
            ) : (
              <View style={styles.historyPanel}>
                {(grantsQuery.data as UserQuotaGrantRow[]).map((g) => (
                  <View key={g.id} style={styles.historyRow}>
                    <View style={styles.historyDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyKind}>{quotaGrantKindLabelTr(g.kind)}</Text>
                      <Text style={styles.historyWhen}>{formatDate(g.granted_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!extendTeam}
        transparent
        animationType="fade"
        onRequestClose={() => setExtendTeam(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExtendTeam(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalGoldCap} />
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.1)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={styles.modalInner}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Paket süresi</Text>
                <Pressable
                  onPress={() => setExtendTeam(null)}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]}
                  hitSlop={12}
                >
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>
              {extendTeam ? (
                <>
                  <Text style={styles.modalLead}>
                    <Text style={styles.modalLeadStrong}>{extendTeam.name}</Text> için paket bitiş tarihine saat
                    bazında ekle veya çıkar.
                  </Text>
                  <View style={styles.modalDatesRow}>
                    <View style={styles.modalDateCol}>
                      <Text style={styles.teamDateLabel}>Şu anki bitiş</Text>
                      <Text style={styles.teamDateValue}>
                        {formatDate(extendTeam.subscription_ends_at)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalSectionLabel}>Hızlı seçim</Text>
                  <View style={styles.presetGrid}>
                    {HOUR_PRESETS.map((p) => (
                      <Pressable
                        key={p.hours}
                        onPress={() => void applyExtend(p.hours)}
                        disabled={busyTeamId === extendTeam.id}
                        style={({ pressed }) => [
                          styles.presetChip,
                          pressed && styles.presetChipPressed,
                        ]}
                      >
                        <Text style={styles.presetChipText}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.modalSectionLabel}>Özel saat gir</Text>
                  <View style={styles.customRow}>
                    <TextInput
                      style={styles.customInput}
                      value={extendHoursInput}
                      onChangeText={setExtendHoursInput}
                      placeholder="Örn: 36 (veya -12)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                    />
                    <Pressable
                      onPress={onApplyCustomHours}
                      disabled={busyTeamId === extendTeam.id}
                      style={({ pressed }) => [
                        styles.applyBtn,
                        pressed && styles.applyBtnPressed,
                      ]}
                    >
                      {busyTeamId === extendTeam.id ? (
                        <ActivityIndicator size="small" color={colors.bgDark} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color={colors.bgDark} />
                          <Text style={styles.applyBtnText}>Uygula</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  <Text style={styles.modalHint}>
                    Pozitif sayı uzatır, negatif sayı kısaltır. Başlangıçtan öncesine çekilemez.
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.md,
  },
  backBtnPressed: { opacity: 0.75 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeSuper: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  badgeAdmin: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  badgeDefault: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: colors.border,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.accent,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgeTextDark: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.bgDark,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgeTextMuted: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionLead: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  kindGrid: {
    gap: spacing.sm,
  },
  kindCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  panelGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  kindCardInner: { padding: spacing.md },
  kindHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kindIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  kindHeaderText: { flex: 1, minWidth: 0 },
  kindTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  kindHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  kindControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kindBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  kindBtnAccent: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  kindBtnDisabled: { opacity: 0.4 },
  kindBtnPressed: { opacity: 0.75 },
  kindValueWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindValue: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  kindValueLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: -2,
  },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  infoPanelText: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
  },
  loadingText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  errorPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(233, 196, 106, 0.35)',
    backgroundColor: 'rgba(233, 196, 106, 0.08)',
  },
  errorText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  emptyPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emptyText: { ...typography.small, color: colors.textMuted, flex: 1 },
  teamCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  teamCardInner: { padding: spacing.md, gap: spacing.md },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  teamName: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  teamPlan: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.18)',
    borderColor: 'rgba(45, 106, 79, 0.45)',
  },
  statusPillExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    letterSpacing: 0.5,
  },
  statusPillTextActive: { color: '#6fc49a' },
  statusPillTextExpired: { color: colors.error },
  teamDates: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  teamDateCol: { flex: 1, minWidth: 0 },
  teamDateLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  teamDateValue: { ...typography.small, color: colors.textPrimary },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
  },
  extendBtnDisabled: {
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
  },
  extendBtnPressed: { opacity: 0.88 },
  extendBtnText: {
    ...typography.caption,
    color: colors.bgDark,
    fontFamily: fonts.semibold,
  },
  historyPanel: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  historyKind: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  historyWhen: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    overflow: 'hidden',
    ...shadow.lg,
  },
  modalGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.9,
  },
  modalInner: { padding: spacing.lg, zIndex: 1 },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseBtnPressed: { opacity: 0.75 },
  modalTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  modalLead: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalLeadStrong: { color: colors.textPrimary, fontFamily: fonts.semibold },
  modalDatesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginBottom: spacing.md,
  },
  modalDateCol: { flex: 1, minWidth: 0 },
  modalSectionLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  presetChip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  presetChipPressed: { opacity: 0.75 },
  presetChipText: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.semibold,
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
    minWidth: 100,
  },
  applyBtnPressed: { opacity: 0.88 },
  applyBtnText: {
    ...typography.caption,
    color: colors.bgDark,
    fontFamily: fonts.semibold,
  },
  modalHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
