import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTipsPool } from '../services/tips';
import { getMyTeams } from '../services/teams';
import { getOperationTasks } from '../services/operations';
import { getMyRolesSummary } from '../services/rbac';
import { getMyShiftsForToday } from '../services/shifts';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { useBusinessDayClock } from '../utils/businessDay';

const SCREEN_W = Dimensions.get('window').width;

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const {
    businessDateKey,
    businessDayOfWeekIndex,
    businessDayOrdinal,
    businessDateAnchor,
    snapshot,
  } = useBusinessDayClock();
  const navigation = useNavigation<any>();
  const parentNav = navigation.getParent?.();
  const [tipIndex, setTipIndex] = React.useState(0);
  const { data: tipsPool = [] } = useQuery({
    queryKey: ['tips-pool'],
    queryFn: () => getTipsPool(500),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!user?.id,
  });
  const {
    data: roleData,
    isPending: rolesPending,
  } = useQuery({
    queryKey: ['my-roles', user?.id],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyRolesSummary(uid);
    },
    enabled: !!user?.id,
  });
  const roleSummaries = roleData ?? [];
  const { data: todayShifts = [], refetch: refetchTodayShifts } = useQuery({
    queryKey: ['my-shifts-today', user?.id, businessDateKey],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyShiftsForToday(uid);
    },
    enabled: !!user?.id,
  });

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void refetchTodayShifts();
    }, [user?.id, refetchTodayShifts])
  );
  const todayDayIndex = businessDayOfWeekIndex;
  const activeTeamId = teams[0]?.id ?? null;
  const { data: operationTasks = [], isLoading: operationsLoading } = useQuery({
    queryKey: ['home-operation-tasks', activeTeamId],
    queryFn: () => getOperationTasks(activeTeamId),
    enabled: !!activeTeamId,
  });
  const todayMaintenanceTasks = React.useMemo(
    () =>
      operationTasks.filter(
        (task) => task.type === 'maintenance' && task.day_of_week === todayDayIndex
      ),
    [operationTasks, todayDayIndex]
  );
  const baseTipIndex = React.useMemo(() => {
    if (tipsPool.length === 0) return 0;
    return businessDayOrdinal % tipsPool.length;
  }, [tipsPool.length, businessDayOrdinal]);

  React.useEffect(() => {
    setTipIndex(baseTipIndex);
  }, [baseTipIndex]);

  const tip = tipsPool[tipIndex] ?? null;

  const isOwnerOnly = teams.length === 0 || teams.every((t) => t.owner_id === user?.id);
  const currentRole = roleSummaries[0];
  const roleBlockLoading = !!user?.id && rolesPending && roleSummaries.length === 0;
  /** Ekip üyeliği (BARISTA/MANAGER); RBAC özeti gecikirse anında gösterilir. */
  const roleLabelFromMembership = React.useMemo(() => {
    if (!user?.id || teams.length === 0) return null;
    const t = teams.find((x) => x.owner_id !== user.id) ?? teams[0];
    const r = t.role;
    if (!r) return null;
    return r === 'MANAGER' ? 'Yönetici' : 'Barista';
  }, [teams, user?.id]);
  const teamById = React.useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [teams]);

  const formatShiftTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const dateLine = useMemo(
    () =>
      businessDateAnchor.toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [businessDateAnchor]
  );

  const greeting = useMemo(() => {
    const h = snapshot.getHours();
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }, [snapshot]);

  const goToRecipes = () => navigation.navigate('Recipes');
  const goToOperations = () => navigation.navigate('Training');
  const goToEquipment = () => parentNav?.navigate('Equipment');
  const goToTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) navigation.navigate('Team', { screen: 'TeamDetail', params: { team } });
  };

  const firstName = user?.name?.trim() || 'Barista';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: tabScrollBottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.22)', 'rgba(10, 10, 10, 0.4)', colors.bgDark]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
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
        <Text style={styles.heroDate}>{dateLine}</Text>
        <Text style={styles.heroGreeting}>{greeting},</Text>
        <Text style={styles.heroName}>{firstName}</Text>
        <Text style={styles.heroTagline}>Bugünkü iş gününün özeti</Text>
      </LinearGradient>

      <View style={styles.body}>
        {!isOwnerOnly && (
          <View style={styles.roleCard}>
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.12)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.roleCardInner}>
              <View style={styles.roleIconWrap}>
                <Ionicons name="ribbon-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.roleTextCol}>
                <Text style={styles.roleKicker}>Güncel rol</Text>
                {currentRole ? (
                  <Text style={styles.roleValue}>{currentRole.roleName}</Text>
                ) : roleBlockLoading && roleLabelFromMembership ? (
                  <Text style={styles.roleValue}>{roleLabelFromMembership}</Text>
                ) : roleBlockLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} style={styles.roleLoading} />
                ) : (
                  <Text style={styles.roleEmpty}>Henüz rol atanmadı</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.sectionEyebrow}>Vardiya</Text>
            <Text style={styles.sectionTitle}>Bugünkü plan</Text>
          </View>
        </View>
        {todayShifts.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.panelPlaceholder}>
              Bugün için atanmış vardiya yok. Ekip sekmesinden vardiya planına bakabilirsiniz.
            </Text>
          </View>
        ) : (
          todayShifts.map((shift) => (
            <Pressable
              key={shift.id}
              onPress={() => goToTeam(shift.team_id)}
              style={({ pressed }) => [styles.shiftOuter, pressed && styles.shiftOuterPressed]}
            >
              <View style={styles.shiftGoldCap} />
              <View style={styles.shiftInner}>
                <View style={styles.shiftIconWrap}>
                  <Ionicons name="hourglass-outline" size={22} color={colors.accent} />
                </View>
                <View style={styles.shiftContent}>
                  <Text style={styles.shiftTime}>
                    {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                  </Text>
                  {teamById[shift.team_id] ? (
                    <Text style={styles.shiftTeam}>{teamById[shift.team_id]}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Pressable>
          ))
        )}

        <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="construct-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.sectionEyebrow}>Operasyon</Text>
            <Text style={styles.sectionTitle}>Bugünkü görevler</Text>
          </View>
        </View>
        <Pressable
          onPress={goToOperations}
          style={({ pressed }) => [styles.opsPanel, pressed && styles.opsPanelPressed]}
        >
          {operationsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : todayMaintenanceTasks.length === 0 ? (
            <Text style={styles.panelPlaceholder}>
              Bu iş günü için haftalık periyodik bakım görevi yok. Operasyon ekranından günleri
              kontrol edebilirsiniz.
            </Text>
          ) : (
            <View style={styles.operationList}>
              {todayMaintenanceTasks.slice(0, 4).map((task) => (
                <View key={task.id} style={styles.operationRow}>
                  <View style={styles.operationDot} />
                  <Text style={styles.operationLabel} numberOfLines={2}>
                    {task.label}
                  </Text>
                </View>
              ))}
              {todayMaintenanceTasks.length > 4 ? (
                <Text style={styles.operationMore}>+{todayMaintenanceTasks.length - 4} görev daha</Text>
              ) : null}
            </View>
          )}
          <View style={styles.opsChevronRow}>
            <Text style={styles.opsLinkText}>Operasyona git</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accent} />
          </View>
        </Pressable>

        <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.sectionEyebrow}>Barista köşesi</Text>
            <Text style={styles.sectionTitle}>Bugünün ipucu</Text>
          </View>
        </View>
        <View style={styles.tipShell}>
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.1)', 'rgba(22, 22, 24, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text style={styles.tipQuote}>“</Text>
          <Text style={styles.tipBody}>
            {tip?.body ??
              'Mükemmel bir espresso shot için extraction (demleme) süresi ortalama 25–30 saniye arasında olmalıdır.'}
          </Text>
          <Pressable
            onPress={() => {
              if (tipsPool.length <= 1) return;
              setTipIndex((prev) => (prev + 1) % tipsPool.length);
            }}
            style={({ pressed }) => [styles.tipRefreshBtn, pressed && styles.tipRefreshBtnPressed]}
          >
            <Ionicons name="refresh" size={15} color={colors.accent} />
            <Text style={styles.tipRefreshBtnText}>Başka ipucu</Text>
          </Pressable>
        </View>

        <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="flash-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.sectionEyebrow}>Kısayol</Text>
            <Text style={styles.sectionTitle}>Hızlı erişim</Text>
          </View>
        </View>
        <View style={styles.quickGrid}>
          <Pressable
            onPress={goToRecipes}
            style={({ pressed }) => [styles.quickTile, pressed && styles.quickTilePressed]}
          >
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.14)', 'rgba(22, 22, 24, 0.98)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.quickIconCircle}>
              <Ionicons name="cafe-outline" size={24} color={colors.accent} />
            </View>
            <Text style={styles.quickTileTitle}>Tarifler</Text>
            <Text style={styles.quickTileSub}>Global tarif rehberi</Text>
          </Pressable>
          <Pressable
            onPress={goToOperations}
            style={({ pressed }) => [styles.quickTile, pressed && styles.quickTilePressed]}
          >
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.14)', 'rgba(22, 22, 24, 0.98)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.quickIconCircle}>
              <Ionicons name="calendar-outline" size={24} color={colors.accent} />
            </View>
            <Text style={styles.quickTileTitle}>Operasyon</Text>
            <Text style={styles.quickTileSub}>Bakım ve açılış / kapanış</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={goToEquipment}
          style={({ pressed }) => [styles.equipmentRow, pressed && styles.equipmentRowPressed]}
        >
          <View style={styles.equipmentIconWrap}>
            <Ionicons name="hardware-chip-outline" size={26} color={colors.accent} />
          </View>
          <View style={styles.equipmentTextCol}>
            <Text style={styles.equipmentTitle}>Makine & ekipman</Text>
            <Text style={styles.equipmentSub}>Arıza tespiti ve işletme bakımları</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  /** Üst: diğer ana sekmelerdeki `content` padding’i ile hizalı (Operasyon, Ekip). Alt: aşağıda override. */
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  heroGradient: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroDate: {
    ...typography.small,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  heroGreeting: {
    fontSize: 17,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  heroName: {
    fontSize: 34,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTagline: {
    ...typography.small,
    color: colors.textMuted,
    maxWidth: SCREEN_W * 0.88,
  },
  body: {
    gap: 0,
  },
  roleCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  roleCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  roleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  roleKicker: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  roleValue: {
    ...typography.subtitle,
    fontSize: 18,
    color: colors.textPrimary,
  },
  roleEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  roleLoading: {
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeaderSpaced: {
    marginTop: spacing.xl,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  sectionEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  panel: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  panelPlaceholder: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  shiftOuter: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.md,
  },
  shiftOuterPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  shiftGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  shiftInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  shiftIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  shiftContent: { flex: 1, minWidth: 0 },
  shiftTime: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  shiftTeam: {
    ...typography.small,
    color: colors.textMuted,
  },
  opsPanel: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  opsPanelPressed: {
    opacity: 0.92,
  },
  opsChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  opsLinkText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  operationList: { gap: spacing.sm },
  operationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  operationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 7,
    opacity: 0.9,
  },
  operationLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  operationMore: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
  },
  tipShell: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    padding: spacing.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.md,
  },
  tipQuote: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    fontSize: 48,
    fontFamily: fonts.bold,
    color: 'rgba(212, 175, 55, 0.2)',
    lineHeight: 52,
  },
  tipBody: {
    ...typography.caption,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    paddingTop: spacing.sm,
    paddingLeft: spacing.sm,
    zIndex: 1,
  },
  tipRefreshBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  tipRefreshBtnPressed: { opacity: 0.75 },
  tipRefreshBtnText: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.semibold,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickTile: {
    flex: 1,
    minWidth: (SCREEN_W - spacing.md * 2 - spacing.sm) / 2 - 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    padding: spacing.md,
    minHeight: 132,
    overflow: 'hidden',
    ...shadow.md,
  },
  quickTilePressed: { opacity: 0.9 },
  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  quickTileTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  quickTileSub: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 18,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    padding: spacing.md,
    ...shadow.md,
  },
  equipmentRowPressed: { opacity: 0.92 },
  equipmentIconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  equipmentTextCol: { flex: 1, minWidth: 0 },
  equipmentTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  equipmentSub: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
