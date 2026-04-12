import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, TrainingCard } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTipsPool } from '../services/tips';
import { getMyTeams } from '../services/teams';
import { getOperationTasks } from '../services/operations';
import { getMyRolesSummary } from '../services/rbac';
import { getMyShiftsForToday } from '../services/shifts';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import { useBusinessDayClock } from '../utils/businessDay';

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { businessDateKey, businessDayOfWeekIndex, businessDayOrdinal } = useBusinessDayClock();
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
    teams.forEach((t) => { map[t.id] = t.name; });
    return map;
  }, [teams]);

  const formatShiftTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const goToRecipes = () => navigation.navigate('Recipes');
  const goToOperations = () => navigation.navigate('Training');
  const goToEquipment = () => parentNav?.navigate('Equipment');
  const goToTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) navigation.navigate('Team', { screen: 'TeamDetail', params: { team } });
  };

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
            </View>
          ) : roleBlockLoading && roleLabelFromMembership ? (
            <View style={styles.roleRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleName}>{roleLabelFromMembership}</Text>
              </View>
            </View>
          ) : roleBlockLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.roleLoading} />
          ) : (
            <Text style={styles.roleEmpty}>Henüz rol atanmadı</Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Bugünkü vardiyan</Text>
      {todayShifts.length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.placeholder}>
            Bugün için atanmış vardiya yok. Takım sayfasından vardiya planına bakabilirsiniz.
          </Text>
        </Card>
      ) : (
        todayShifts.map((shift) => (
          <Pressable
            key={shift.id}
            onPress={() => goToTeam(shift.team_id)}
            style={({ pressed }) => [styles.shiftCard, pressed && styles.shiftCardPressed]}
          >
            <Card style={styles.card} padded>
              <View style={styles.shiftRow}>
                <View style={styles.shiftIconWrap}>
                  <Ionicons name="time-outline" size={22} color={colors.accent} />
                </View>
                <View style={styles.shiftContent}>
                  <Text style={styles.shiftTime}>
                    {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                  </Text>
                  {teamById[shift.team_id] && (
                    <Text style={styles.shiftTeam}>{teamById[shift.team_id]}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionTitle}>Bugünkü operasyonlar</Text>
      <Card style={styles.card} onPress={goToOperations}>
        {operationsLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : todayMaintenanceTasks.length === 0 ? (
          <Text style={styles.placeholder}>
            Bugün için haftalık periyodik bakım görevi yok. Operasyon ekranından günleri kontrol edebilirsiniz.
          </Text>
        ) : (
          <View style={styles.operationList}>
            {todayMaintenanceTasks.slice(0, 4).map((task) => (
              <View key={task.id} style={styles.operationRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
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
      </Card>

      <Text style={styles.sectionTitle}>Bugünün İpucu</Text>
      <Card style={[styles.card, styles.tipCard]}>
        <Text style={styles.placeholder}>
          {tip?.body ?? 'Mükemmel bir espresso shot için extraction (demleme) süresi ortalama 25–30 saniye arasında olmalıdır.'}
        </Text>
        <Pressable
          onPress={() => {
            if (tipsPool.length <= 1) return;
            setTipIndex((prev) => (prev + 1) % tipsPool.length);
          }}
          style={({ pressed }) => [styles.tipRefreshBtn, pressed && styles.tipRefreshBtnPressed]}
        >
          <Ionicons name="refresh" size={13} color={colors.textSecondary} />
          <Text style={styles.tipRefreshBtnText}>İpucunu yenile</Text>
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      <View style={styles.quickGrid}>
        <Card style={[styles.quickCard, styles.quickCardAccent]} onPress={goToRecipes}>
          <Text style={styles.cardTitle}>Tarifler</Text>
          <Text style={styles.placeholder}>Global tarif rehberi</Text>
        </Card>
        <Card style={[styles.quickCard, styles.quickCardAccent]} onPress={goToOperations}>
          <Text style={styles.cardTitle}>Operasyon</Text>
          <Text style={styles.placeholder}>Bakım takvimi & açılış/kapanış</Text>
        </Card>
      </View>

      <Card style={[styles.card, styles.equipmentCard]} onPress={goToEquipment}>
        <Text style={styles.cardTitle}>Makine & Ekipman Rehberi</Text>
        <Text style={styles.placeholder}>Arıza tespiti ve işletme bakımları</Text>
      </Card>
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
  roleEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  roleLoading: {
    alignSelf: 'flex-start',
    marginVertical: spacing.xs,
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
  shiftCard: {
    marginBottom: spacing.sm,
  },
  shiftCardPressed: { opacity: 0.85 },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shiftIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftContent: { flex: 1 },
  shiftTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  shiftTeam: {
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
  quickCardAccent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
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
  tipRefreshBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderRadius: borderRadius.full,
  },
  tipRefreshBtnPressed: { opacity: 0.65 },
  tipRefreshBtnText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  operationList: { gap: spacing.sm },
  operationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  operationLabel: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  operationMore: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
  spacer: {
    height: spacing.xl,
  },
});
