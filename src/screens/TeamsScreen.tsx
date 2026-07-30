import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '../components';
import {
  getMyTeams,
  getAllTeamsForPlatformStaff,
  updateTeamName,
  closeTeam,
  countTeamsWhereOwner,
} from '../services/teams';
import { isPlatformStaff, canUserCreateTeam, sumQuotaBalances } from '../services/platformAdmin';
import { useAuthStore } from '../store/authStore';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import { formatRemainingUntilEnd } from '../utils/subscriptionPeriod';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import type { Team } from '../types';
import Ionicons from '@expo/vector-icons/Ionicons';

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamsList'>;

/** Çalışan: tek ekip, MANAGER değil → liste gösterme, doğrudan takım sayfasına git */
function isWorkerSingleTeam(teams: { role?: string }[], isLoading: boolean): boolean {
  return !isLoading && teams.length === 1 && teams[0].role !== 'MANAGER';
}

/** Üyelik listesinde role zorunlu; yönetim “tüm ekipler” görünümünde yalnızca takım satırı. */
type TeamListItem = Team & { role?: string };

function formatTeamDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/** Tüm ekipler listesinde yalnızca süper yönetici için paket kalan süre satırı */
function SuperAdminSubscriptionLine({ team }: { team: TeamListItem }) {
  if (!team.subscription_ends_at) {
    return (
      <Text style={styles.teamSubscriptionNoEnd} numberOfLines={1}>
        Paket bitişi tanımlı değil
      </Text>
    );
  }
  const remain = formatRemainingUntilEnd(team.subscription_ends_at);
  if (!remain) return null;
  const expired = remain === 'Süre doldu';
  return (
    <Text
      style={[styles.teamSubscriptionRemain, expired && styles.teamSubscriptionRemainExpired]}
      numberOfLines={1}
    >
      {expired ? 'Süre doldu' : `Kalan: ${remain}`}
    </Text>
  );
}

const MS_WEEK = 7 * 86400000;

/** Bitişe 1 haftadan az (ve henüz dolmamış) süre kaldı mı? */
function subscriptionEndsWithinOneWeek(team: Team): boolean {
  if (!team.subscription_ends_at) return false;
  const end = new Date(team.subscription_ends_at).getTime();
  if (Number.isNaN(end)) return false;
  const diff = end - Date.now();
  return diff > 0 && diff <= MS_WEEK;
}

/** Tüm ekipler: kritik süreli ekipler üstte (bitiş tarihi yakın önce). */
function sortStaffTeamsWithUrgentFirst(teams: TeamListItem[]): TeamListItem[] {
  const urgent: TeamListItem[] = [];
  const rest: TeamListItem[] = [];
  for (const t of teams) {
    if (subscriptionEndsWithinOneWeek(t)) urgent.push(t);
    else rest.push(t);
  }
  urgent.sort(
    (a, b) =>
      new Date(a.subscription_ends_at!).getTime() - new Date(b.subscription_ends_at!).getTime()
  );
  return [...urgent, ...rest];
}

function invalidateTeamLists(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['my-teams', userId] });
    queryClient.invalidateQueries({ queryKey: ['owned-teams-count', userId] });
  }
  queryClient.invalidateQueries({ queryKey: ['platform-all-teams'] });
}

export function TeamsScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const staffUser = isPlatformStaff(user);
  const superAdmin = !!user?.is_super_admin;
  const { data: teams = [], isLoading } = useQuery({
    queryKey: staffUser ? ['platform-all-teams'] : ['my-teams', userId],
    queryFn: () => {
      if (staffUser) return getAllTeamsForPlatformStaff();
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!userId,
  });

  const displayTeams = useMemo((): TeamListItem[] => {
    if (staffUser) return sortStaffTeamsWithUrgentFirst(teams as TeamListItem[]);
    return teams as TeamListItem[];
  }, [staffUser, teams]);

  const { data: ownedTeamCount = 0 } = useQuery({
    queryKey: ['owned-teams-count', userId],
    queryFn: () => countTeamsWhereOwner(userId!),
    enabled: !!userId && !staffUser,
  });

  useFocusEffect(
    useCallback(() => {
      invalidateTeamLists(queryClient, userId);
    }, [userId, queryClient])
  );

  const [editTeam, setEditTeam] = useState<TeamListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const canEditTeam = (team: TeamListItem) =>
    team.owner_id === userId || team.role === 'MANAGER';

  /** Yönetim → Tüm Ekipler (platform personeli) ekranında katıl/oluştur yok; normal Takımlarım’da var. */
  const showMemberJoinCreateActions = !staffUser;
  const canCreateTeam = canUserCreateTeam(user, ownedTeamCount);
  const remainingQuota = sumQuotaBalances(user);

  const goCreateTeam = () => {
    if (canCreateTeam) {
      navigation.navigate('CreateTeam', {});
      return;
    }
    themedAlert(
      'Takım oluşturma',
      'Kullanılabilir kota hakkınız kalmadı. Süper yöneticinizden süre kotası vermesini isteyin.'
    );
  };

  const workerSingleTeam = !staffUser && isWorkerSingleTeam(teams as { role?: string }[], isLoading);

  useEffect(() => {
    if (!workerSingleTeam || staffUser) return;
    navigation.replace('TeamDetail', { team: teams[0] });
  }, [workerSingleTeam, teams, navigation, staffUser]);

  const openEditModal = (team: TeamListItem) => {
    setEditTeam(team);
    setEditName(team.name);
  };

  const handleSaveName = async () => {
    if (!editTeam || !editName.trim()) return;
    setSaving(true);
    try {
      await updateTeamName(editTeam.id, editName.trim());
      invalidateTeamLists(queryClient, userId);
      setEditTeam(null);
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Ekip adı güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseTeam = () => {
    if (!editTeam) return;
    themedAlert(
      'Ekibi sil',
      `"${editTeam.name}" ekibini silmek istediğinize emin misiniz? Ekip listeden kaldırılır.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ekibi sil',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await closeTeam(editTeam.id);
              invalidateTeamLists(queryClient, userId);
              setEditTeam(null);
            } catch (e) {
              themedAlert('Hata', e instanceof Error ? e.message : 'Ekip kapatılamadı.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // Veri yokken veya çalışan tek ekipte: liste gösterme (çalışan direkt takım sayfasına gidecek)
  if (isLoading || workerSingleTeam) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: tabScrollBottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.2)', 'rgba(10, 10, 10, 0.35)', colors.bgDark]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[
              styles.heroGradient,
              {
                marginHorizontal: -spacing.md,
                paddingTop: insets.top + spacing.md,
                paddingBottom: spacing.xl,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <View style={styles.heroIconBadge}>
              <Ionicons name="people-outline" size={22} color={colors.accent} />
            </View>
            <Text style={styles.heroEyebrow}>Ekip</Text>
            <Text style={styles.heroTitle}>
              {staffUser ? (
                <>
                  Tüm <Text style={styles.heroTitleAccent}>ekipler</Text>
                </>
              ) : (
                <>
                  Takımları<Text style={styles.heroTitleAccent}>m</Text>
                </>
              )}
            </Text>
            <Text style={styles.heroSubtitle}>
              {staffUser
                ? 'Platformdaki ekipler yükleniyor…'
                : 'Ekip bilgileriniz yükleniyor…'}
            </Text>
          </LinearGradient>
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Bir saniye…</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabScrollBottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.2)', 'rgba(10, 10, 10, 0.35)', colors.bgDark]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.heroGradient,
          {
            marginHorizontal: -spacing.md,
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.heroIconBadge}>
          <Ionicons name="people-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.heroEyebrow}>Ekip</Text>
        <Text style={styles.heroTitle}>
          {staffUser ? (
            <>
              Tüm <Text style={styles.heroTitleAccent}>ekipler</Text>
            </>
          ) : (
            <>
              Takımla<Text style={styles.heroTitleAccent}>rım</Text>
            </>
          )}
        </Text>
        <Text style={styles.heroSubtitle}>
          {staffUser
            ? 'Uygulamada oluşturulmuş tüm ekipler; detay ve abonelik için karta dokunun.'
            : 'Bağlı olduğunuz ekipleri yönetin, davet ile katılın veya yeni takım oluşturun.'}
        </Text>
      </LinearGradient>

      {teams.length === 0 ? (
        <View style={styles.panelShell}>
          <View style={styles.panelGoldCap} />
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.panelInner}>
            <Text style={styles.placeholder}>
              {staffUser
                ? 'Henüz kayıtlı ekip yok.'
                : 'Henüz bir takıma katılmadınız. Yöneticinizden davet linki isteyin.'}
            </Text>
            {showMemberJoinCreateActions ? (
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) =>
                    pressed
                      ? [styles.actionCard, styles.actionCardJoin, styles.actionCardPressed]
                      : [styles.actionCard, styles.actionCardJoin]
                  }
                  onPress={() => navigation.navigate('JoinTeam', {})}
                >
                  <LinearGradient
                    colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.06)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="link-outline" size={26} color={colors.accent} />
                  </View>
                  <Text style={styles.actionTitle}>Takıma katıl</Text>
                  <Text style={styles.actionSubtitle}>Davet linki ile</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionCard,
                    styles.actionCardCreate,
                    !canCreateTeam && styles.actionCardMuted,
                    pressed && canCreateTeam && styles.actionCardPressed,
                  ]}
                  onPress={goCreateTeam}
                >
                  {canCreateTeam ? (
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.35)', 'rgba(212, 175, 55, 0.12)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  ) : null}
                  <View
                    style={[
                      styles.actionIconWrap,
                      canCreateTeam ? styles.actionIconWrapPrimary : styles.actionIconWrapMuted,
                    ]}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={26}
                      color={canCreateTeam ? colors.bgDark : colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.actionTitle, !canCreateTeam && styles.actionTitleMuted]}>
                    Takım oluştur
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    {canCreateTeam ? `Kalan oluşturma: ${remainingQuota}` : 'Kota yok'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {displayTeams.length > 0 ? (
            <Text style={styles.listSectionEyebrow}>
              {staffUser ? 'Kayıtlı ekipler' : 'Ekiplerin'}
            </Text>
          ) : null}
          {displayTeams.map((team) => (
            <View
              key={team.id}
              style={[
                styles.teamPanel,
                staffUser && subscriptionEndsWithinOneWeek(team) && styles.teamPanelUrgentWeek,
              ]}
            >
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <Pressable
                style={styles.teamPanelInner}
                onPress={() =>
                  navigation.navigate('TeamDetail', {
                    team: { ...team, role: team.role },
                  })
                }
              >
                <View style={styles.teamCardTextWrap}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  {staffUser ? (
                    <>
                      <Text style={styles.teamMeta}>{formatTeamDate(team.created_at) ?? '—'}</Text>
                      {superAdmin ? <SuperAdminSubscriptionLine team={team} /> : null}
                    </>
                  ) : (
                    <Text style={styles.teamRole}>
                      {team.role === 'MANAGER' ? 'Yönetici' : 'Barista'}
                    </Text>
                  )}
                </View>
                {canEditTeam(team) && (
                  <Pressable
                    style={({ pressed }) => [styles.teamEditBtn, pressed && styles.teamEditBtnPressed]}
                    onPress={() => openEditModal(team)}
                    hitSlop={12}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.accent} />
                  </Pressable>
                )}
              </Pressable>
            </View>
          ))}
          {showMemberJoinCreateActions ? (
            <View style={styles.actionsSection}>
              <Text style={styles.actionsSectionEyebrow}>Hızlı işlemler</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) =>
                    pressed
                      ? [styles.actionCard, styles.actionCardJoin, styles.actionCardPressed]
                      : [styles.actionCard, styles.actionCardJoin]
                  }
                  onPress={() => navigation.navigate('JoinTeam', {})}
                >
                  <LinearGradient
                    colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.06)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="link-outline" size={24} color={colors.accent} />
                  </View>
                  <Text style={styles.actionTitle}>Takıma katıl</Text>
                  <Text style={styles.actionSubtitle}>Davet linki ile</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionCard,
                    styles.actionCardCreate,
                    !canCreateTeam && styles.actionCardMuted,
                    pressed && canCreateTeam && styles.actionCardPressed,
                  ]}
                  onPress={goCreateTeam}
                >
                  {canCreateTeam ? (
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.35)', 'rgba(212, 175, 55, 0.12)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  ) : null}
                  <View
                    style={[
                      styles.actionIconWrap,
                      canCreateTeam ? styles.actionIconWrapPrimary : styles.actionIconWrapMuted,
                    ]}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color={canCreateTeam ? colors.bgDark : colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.actionTitle, !canCreateTeam && styles.actionTitleMuted]}>
                    Takım oluştur
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    {canCreateTeam ? `Kalan oluşturma: ${remainingQuota}` : 'Kota yok'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}

      <Modal visible={!!editTeam} animationType="fade" transparent onRequestClose={() => setEditTeam(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditTeam(null)} />
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
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ekip düzenle</Text>
                <Pressable
                  onPress={() => setEditTeam(null)}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]}
                  hitSlop={16}
                >
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>
              {editTeam && (
                <>
                  <Input
                    label="Ekip adı"
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Ekip adını girin"
                    autoCapitalize="words"
                  />
                  <Button
                    title="Ekip adını güncelle"
                    onPress={handleSaveName}
                    loading={saving}
                    fullWidth
                    style={styles.modalBtn}
                  />
                  <View style={styles.modalDivider} />
                  <Button
                    title="Ekibi sil"
                    onPress={handleCloseTeam}
                    variant="outline"
                    fullWidth
                    disabled={saving}
                    style={StyleSheet.flatten([styles.modalBtn, styles.closeTeamBtn])}
                    textStyle={styles.closeTeamBtnText}
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.xl,
  },
  heroGradient: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTitleAccent: { color: colors.accent },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: '98%',
  },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    ...shadow.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  panelShell: {
    marginBottom: spacing.md,
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
  panelInner: {
    padding: spacing.lg,
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  actionsSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionsSectionEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  listSectionEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    overflow: 'hidden',
  },
  actionCardJoin: {
    borderColor: 'rgba(212, 175, 55, 0.38)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  actionCardCreate: {
    borderColor: 'rgba(212, 175, 55, 0.45)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  actionCardPressed: {
    opacity: 0.88,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    zIndex: 1,
  },
  actionIconWrapPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionIconWrapMuted: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  actionCardMuted: {
    opacity: 0.85,
  },
  actionTitleMuted: {
    color: colors.textMuted,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
    zIndex: 1,
  },
  actionSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    zIndex: 1,
  },
  teamPanel: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  /** Tüm ekipler: bitişe ≤7 gün kalan satırlar */
  teamPanelUrgentWeek: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  teamPanelInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  teamCardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  teamMeta: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  teamSubscriptionRemain: {
    ...typography.small,
    fontFamily: fonts.medium,
    color: colors.accent,
    marginTop: 4,
  },
  teamSubscriptionRemainExpired: {
    color: colors.error,
    fontFamily: fonts.semibold,
  },
  teamSubscriptionNoEnd: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  teamRole: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  teamEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '35',
    marginLeft: spacing.sm,
  },
  teamEditBtnPressed: {
    opacity: 0.85,
    backgroundColor: colors.accent + '22',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    overflow: 'hidden',
    ...shadow.lg,
  },
  modalGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.9,
  },
  modalInner: {
    padding: spacing.lg,
    zIndex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    flex: 1,
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
  modalBtn: {
    marginTop: spacing.md,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  closeTeamBtn: {
    borderColor: colors.error + '60',
    backgroundColor: colors.error + '10',
  },
  closeTeamBtnText: {
    color: colors.error,
  },
});
