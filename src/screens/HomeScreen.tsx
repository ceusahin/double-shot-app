import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import { getTipsPool } from '../services/tips';
import { getOperationTasks } from '../services/operations';
import { getMyRolesSummary } from '../services/rbac';
import { getMyShiftsForToday, getActiveShiftLog, checkOut } from '../services/shifts';
import {
  getMyActiveBreak,
  getTeamBreakTemplates,
  startBreak,
  endBreak,
  type ShiftBreakLog,
  type ShiftBreakTemplate,
} from '../services/breaks';
import { getNotifications } from '../services/notificationsWrapper';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import { useDefaultTeam } from '../hooks/useDefaultTeam';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { useBusinessDayClock } from '../utils/businessDay';
import { themedAlert } from '../utils/themedAlert';
import type { OperationTask, Team } from '../types';

type TeamShiftStatus = {
  activeLog: { id: string; check_in_time: string } | null;
  activeBreak: ShiftBreakLog | null;
};

type BreakPickerState = {
  teamId: string;
  shiftLogId: string;
};

type OpsHomeTab = 'maintenance' | 'opening' | 'closing';

const OPS_HOME_TABS: {
  key: OpsHomeTab;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'maintenance', label: 'Bakım', icon: 'construct-outline' },
  { key: 'opening', label: 'Açılış', icon: 'sunny-outline' },
  { key: 'closing', label: 'Kapanış', icon: 'moon-outline' },
];

const SCREEN_W = Dimensions.get('window').width;

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const queryClient = useQueryClient();
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
  const [actionTeamId, setActionTeamId] = useState<string | null>(null);
  const [breakPicker, setBreakPicker] = useState<BreakPickerState | null>(null);
  const [opsHomeTab, setOpsHomeTab] = useState<OpsHomeTab>('maintenance');
  const { data: tipsPool = [] } = useQuery({
    queryKey: ['tips-pool'],
    queryFn: () => getTipsPool(500),
  });
  const { teams, defaultTeam, defaultTeamId } = useDefaultTeam();
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
  const { data: allTodayShifts = [], refetch: refetchTodayShifts } = useQuery({
    queryKey: ['my-shifts-today', user?.id, businessDateKey],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyShiftsForToday(uid);
    },
    enabled: !!user?.id,
  });

  const todayShifts = useMemo(
    () =>
      defaultTeamId
        ? allTodayShifts.filter((s) => s.team_id === defaultTeamId)
        : [],
    [allTodayShifts, defaultTeamId]
  );

  const todayTeamIds = useMemo(
    () => (defaultTeamId ? [defaultTeamId] : []),
    [defaultTeamId]
  );

  const {
    data: shiftStatusByTeam = {},
    refetch: refetchShiftStatuses,
  } = useQuery({
    queryKey: ['home-shift-status', user?.id, todayTeamIds.join('|')],
    queryFn: async (): Promise<Record<string, TeamShiftStatus>> => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return {};
      const entries = await Promise.all(
        todayTeamIds.map(async (teamId) => {
          const [activeLog, activeBreak] = await Promise.all([
            getActiveShiftLog(uid, teamId),
            getMyActiveBreak(uid, teamId),
          ]);
          return [teamId, { activeLog, activeBreak }] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: !!user?.id && todayTeamIds.length > 0,
    refetchInterval: 15_000,
  });

  const {
    data: breakTemplates = [],
    isPending: breakTemplatesLoading,
  } = useQuery({
    queryKey: ['break-templates', breakPicker?.teamId],
    queryFn: () => getTeamBreakTemplates(breakPicker!.teamId),
    enabled: !!breakPicker?.teamId,
  });

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void refetchTodayShifts();
      void refetchShiftStatuses();
    }, [user?.id, refetchTodayShifts, refetchShiftStatuses])
  );
  const todayDayIndex = businessDayOfWeekIndex;
  const activeTeamId = defaultTeamId;
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
  const openingTasks = React.useMemo(
    () => operationTasks.filter((task) => task.type === 'opening'),
    [operationTasks]
  );
  const closingTasks = React.useMemo(
    () => operationTasks.filter((task) => task.type === 'closing'),
    [operationTasks]
  );
  const opsTabTasks: OperationTask[] =
    opsHomeTab === 'maintenance'
      ? todayMaintenanceTasks
      : opsHomeTab === 'opening'
        ? openingTasks
        : closingTasks;
  const opsTabEmptyMessage =
    opsHomeTab === 'maintenance'
      ? 'Bu iş günü için haftalık periyodik bakım görevi yok. Operasyon ekranından günleri kontrol edebilirsiniz.'
      : opsHomeTab === 'opening'
        ? 'Açılış kontrol listesinde henüz görev yok. Operasyon yönetiminden ekleyebilirsiniz.'
        : 'Kapanış kontrol listesinde henüz görev yok. Operasyon yönetiminden ekleyebilirsiniz.';
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
    if (!user?.id || !defaultTeam) return null;
    const r = defaultTeam.role;
    if (!r) return null;
    return r === 'MANAGER' ? 'Yönetici' : 'Barista';
  }, [defaultTeam, user?.id]);
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
  const resolveTeam = (teamId: string): (Team & { role?: string }) | null =>
    teams.find((t) => t.id === teamId) ?? null;

  const goToTeam = (teamId: string) => {
    const team = resolveTeam(teamId);
    if (team) navigation.navigate('Team', { screen: 'TeamDetail', params: { team } });
  };

  const goToShiftCheckIn = (teamId: string) => {
    const team = resolveTeam(teamId);
    if (!team) {
      themedAlert('Uyarı', 'Ekip bilgisi bulunamadı.');
      return;
    }
    navigation.navigate('Team', { screen: 'ShiftCheckIn', params: { team } });
  };

  const openBreakPicker = (teamId: string, shiftLogId: string) => {
    setBreakPicker({ teamId, shiftLogId });
  };

  const closeBreakPicker = () => {
    if (actionTeamId) return;
    setBreakPicker(null);
  };

  const invalidateShiftStatus = async (teamId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-shift-status'] }),
      queryClient.invalidateQueries({ queryKey: ['my-active-break', user?.id, teamId] }),
      queryClient.invalidateQueries({ queryKey: ['team-active-breaks', teamId] }),
      queryClient.invalidateQueries({ queryKey: ['team-break-logs', teamId] }),
    ]);
    await refetchShiftStatuses();
  };

  const scheduleBreakNotifications = async (breakLog: ShiftBreakLog) => {
    const Notifications = getNotifications();
    const plannedEndDate = new Date(breakLog.planned_end_at);
    const oneMinuteLeftDate = new Date(plannedEndDate.getTime() - 60_000);
    const now = new Date();

    if (oneMinuteLeftDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Molanız bitmek üzere',
          body: 'Molanızın bitmesine 1 dakika kaldı.',
          sound: 'default',
          data: { breakLogId: breakLog.id, type: 'break_last_minute' },
        },
        trigger: oneMinuteLeftDate as unknown as import('expo-notifications').NotificationTriggerInput,
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Mola süreniz bitmiştir',
        body: 'Lütfen molayı bitir tuşuna basın.',
        sound: 'default',
        data: { breakLogId: breakLog.id, type: 'break_ended' },
      },
      trigger: plannedEndDate as unknown as import('expo-notifications').NotificationTriggerInput,
    });
  };

  const cancelBreakNotifications = async (breakLogId: string) => {
    const Notifications = getNotifications();
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const related = all.filter((n) => {
      const data = (n.content?.data ?? {}) as Record<string, unknown>;
      return data.breakLogId === breakLogId;
    });
    for (const n of related) {
      if (n.identifier) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  };

  const handleEndShift = (teamId: string, logId: string) => {
    themedAlert('Vardiyayı bitir?', 'Vardiyanı şimdi kapatmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Bitir',
        style: 'destructive',
        onPress: async () => {
          setActionTeamId(teamId);
          try {
            await checkOut(logId);
            await invalidateShiftStatus(teamId);
          } catch (e) {
            themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya bitirilemedi.');
          } finally {
            setActionTeamId(null);
          }
        },
      },
    ]);
  };

  const handleStartBreak = async (template: ShiftBreakTemplate) => {
    if (!user?.id || !breakPicker) return;
    const status = shiftStatusByTeam[breakPicker.teamId];
    if (status?.activeBreak) {
      themedAlert('Uyarı', 'Zaten aktif bir molanız var.');
      return;
    }
    setActionTeamId(breakPicker.teamId);
    try {
      const created = await startBreak({
        teamId: breakPicker.teamId,
        userId: user.id,
        shiftLogId: breakPicker.shiftLogId,
        templateId: template.id,
        durationMinutes: template.duration_minutes,
      });
      await scheduleBreakNotifications(created);
      await invalidateShiftStatus(breakPicker.teamId);
      setBreakPicker(null);
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Mola başlatılamadı.');
    } finally {
      setActionTeamId(null);
    }
  };

  const handleEndBreak = async (teamId: string, breakLogId: string) => {
    setActionTeamId(teamId);
    try {
      await endBreak(breakLogId);
      await cancelBreakNotifications(breakLogId);
      await invalidateShiftStatus(teamId);
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Mola bitirilemedi.');
    } finally {
      setActionTeamId(null);
    }
  };

  const firstName = user?.name?.trim() || 'Barista';
  const breakPickerBusy = !!breakPicker && actionTeamId === breakPicker.teamId;

  return (
    <>
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
        {defaultTeam ? (
          <View style={styles.heroTeamChip}>
            <Ionicons name="people-outline" size={14} color={colors.accent} />
            <Text style={styles.heroTeamChipText} numberOfLines={1}>
              {defaultTeam.name}
            </Text>
          </View>
        ) : null}
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
          todayShifts.map((shift) => {
            const status = shiftStatusByTeam[shift.team_id];
            const activeLog = status?.activeLog ?? null;
            const activeBreak = status?.activeBreak ?? null;
            const busy = actionTeamId === shift.team_id;
            const isOnBreak = !!activeBreak;
            const isOnShift = !!activeLog;

            return (
              <View key={shift.id} style={styles.shiftOuter}>
                <View style={styles.shiftGoldCap} />
                <Pressable
                  onPress={() => goToTeam(shift.team_id)}
                  style={({ pressed }) => [styles.shiftInner, pressed && styles.shiftInnerPressed]}
                >
                  <View style={styles.shiftIconWrap}>
                    <Ionicons
                      name={
                        isOnBreak
                          ? 'cafe-outline'
                          : isOnShift
                            ? 'play-circle-outline'
                            : 'hourglass-outline'
                      }
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <View style={styles.shiftContent}>
                    <Text style={styles.shiftTime}>
                      {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                    </Text>
                    {teamById[shift.team_id] ? (
                      <Text style={styles.shiftTeam}>{teamById[shift.team_id]}</Text>
                    ) : null}
                  </View>
                  {isOnBreak ? (
                    <View style={[styles.shiftStatusPill, styles.shiftStatusPillBreak]}>
                      <Text style={styles.shiftStatusPillTextBreak}>Molada</Text>
                    </View>
                  ) : isOnShift ? (
                    <View style={[styles.shiftStatusPill, styles.shiftStatusPillActive]}>
                      <Text style={styles.shiftStatusPillTextActive}>Aktif</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  )}
                </Pressable>

                <View style={styles.shiftActions}>
                  {isOnBreak && activeBreak ? (
                    <Pressable
                      onPress={() => handleEndBreak(shift.team_id, activeBreak.id)}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.shiftActionPrimary,
                        pressed && !busy && styles.shiftActionPressed,
                        busy && styles.shiftActionDisabled,
                      ]}
                    >
                      <LinearGradient
                        colors={['#E8C547', colors.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.shiftActionPrimaryGrad}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={colors.bgDark} />
                        ) : (
                          <>
                            <Ionicons name="play-outline" size={16} color={colors.bgDark} />
                            <Text style={styles.shiftActionPrimaryText}>Molayı Bitir</Text>
                          </>
                        )}
                      </LinearGradient>
                    </Pressable>
                  ) : isOnShift && activeLog ? (
                    <>
                      <Pressable
                        onPress={() => openBreakPicker(shift.team_id, activeLog.id)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.shiftActionPrimary,
                          pressed && !busy && styles.shiftActionPressed,
                          busy && styles.shiftActionDisabled,
                        ]}
                      >
                        <LinearGradient
                          colors={['#E8C547', colors.accent]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.shiftActionPrimaryGrad}
                        >
                          <Ionicons name="cafe-outline" size={16} color={colors.bgDark} />
                          <Text style={styles.shiftActionPrimaryText}>Mola</Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable
                        onPress={() => handleEndShift(shift.team_id, activeLog.id)}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.shiftActionSecondary,
                          pressed && !busy && styles.shiftActionPressed,
                          busy && styles.shiftActionDisabled,
                        ]}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <>
                            <Ionicons name="stop-circle-outline" size={16} color={colors.accent} />
                            <Text style={styles.shiftActionSecondaryText}>Bitir</Text>
                          </>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => goToShiftCheckIn(shift.team_id)}
                      style={({ pressed }) => [
                        styles.shiftActionPrimary,
                        pressed && styles.shiftActionPressed,
                      ]}
                    >
                      <LinearGradient
                        colors={['#E8C547', colors.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.shiftActionPrimaryGrad}
                      >
                        <Ionicons name="play-outline" size={16} color={colors.bgDark} />
                        <Text style={styles.shiftActionPrimaryText}>Vardiya Başlat</Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
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
        <View style={styles.opsPanel}>
          <View style={styles.opsTabSwitch}>
            {OPS_HOME_TABS.map((tab) => {
              const active = opsHomeTab === tab.key;
              const count =
                tab.key === 'maintenance'
                  ? todayMaintenanceTasks.length
                  : tab.key === 'opening'
                    ? openingTasks.length
                    : closingTasks.length;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setOpsHomeTab(tab.key)}
                  style={({ pressed }) => [
                    styles.opsTabChip,
                    active && styles.opsTabChipActive,
                    pressed && styles.opsTabChipPressed,
                  ]}
                >
                  {active ? (
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.42)', 'rgba(212, 175, 55, 0.12)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  ) : null}
                  <Ionicons
                    name={tab.icon}
                    size={15}
                    color={active ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.opsTabChipText, active && styles.opsTabChipTextActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 ? (
                    <View style={[styles.opsTabCount, active && styles.opsTabCountActive]}>
                      <Text
                        style={[styles.opsTabCountText, active && styles.opsTabCountTextActive]}
                      >
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {operationsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : opsTabTasks.length === 0 ? (
            <Text style={styles.panelPlaceholder}>{opsTabEmptyMessage}</Text>
          ) : (
            <View style={styles.operationList}>
              {opsTabTasks.slice(0, 4).map((task) => (
                <View key={task.id} style={styles.operationRow}>
                  <View style={styles.operationDot} />
                  <Text style={styles.operationLabel} numberOfLines={2}>
                    {task.label}
                  </Text>
                </View>
              ))}
              {opsTabTasks.length > 4 ? (
                <Text style={styles.operationMore}>+{opsTabTasks.length - 4} görev daha</Text>
              ) : null}
            </View>
          )}
          <Pressable
            onPress={goToOperations}
            style={({ pressed }) => [styles.opsChevronRow, pressed && styles.opsPanelPressed]}
          >
            <Text style={styles.opsLinkText}>Operasyona git</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accent} />
          </Pressable>
        </View>

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

    <Modal
      visible={!!breakPicker}
      transparent
      animationType="fade"
      onRequestClose={closeBreakPicker}
    >
      <View style={styles.breakModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeBreakPicker} />
        <View style={styles.breakModalBox}>
          <View style={styles.breakModalGoldCap} />
          <View style={styles.breakModalHeader}>
            <View style={styles.breakModalTitleCol}>
              <Text style={styles.breakModalEyebrow}>Mola seç</Text>
              <Text style={styles.breakModalTitle}>
                {breakPicker ? teamById[breakPicker.teamId] ?? 'Mola başlat' : 'Mola başlat'}
              </Text>
            </View>
            <Pressable
              onPress={closeBreakPicker}
              disabled={breakPickerBusy}
              hitSlop={12}
              style={styles.breakModalCloseBtn}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {breakTemplatesLoading ? (
            <View style={styles.breakModalLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : breakTemplates.length === 0 ? (
            <Text style={styles.breakModalEmpty}>
              Bu ekip için tanımlı mola yok. Yöneticiniz vardiya yönetimine mola ekleyebilir.
            </Text>
          ) : (
            <ScrollView
              style={styles.breakModalList}
              contentContainerStyle={styles.breakModalListContent}
              showsVerticalScrollIndicator={false}
            >
              {breakTemplates.map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => handleStartBreak(template)}
                  disabled={breakPickerBusy}
                  style={({ pressed }) => [
                    styles.breakTemplateRow,
                    pressed && !breakPickerBusy && styles.shiftActionPressed,
                    breakPickerBusy && styles.shiftActionDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(212, 175, 55, 0.12)', 'rgba(212, 175, 55, 0.03)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.breakTemplateIconWrap}>
                    <Ionicons name="cafe-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.breakTemplateTextCol}>
                    <Text style={styles.breakTemplateName} numberOfLines={1}>
                      {template.name}
                    </Text>
                    <Text style={styles.breakTemplateHint}>Dokunarak başlat</Text>
                  </View>
                  <View style={styles.breakDurationChip}>
                    <Text style={styles.breakDurationChipText}>{template.duration_minutes} dk</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {breakPickerBusy ? (
            <View style={styles.breakModalBusyRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.breakModalBusyText}>Mola başlatılıyor…</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
    </>
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
  heroTeamChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    maxWidth: '100%',
  },
  heroTeamChipText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
    flexShrink: 1,
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
  shiftInnerPressed: {
    opacity: 0.92,
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
  shiftStatusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  shiftStatusPillActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.2)',
    borderColor: 'rgba(45, 106, 79, 0.45)',
  },
  shiftStatusPillBreak: {
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  shiftStatusPillTextActive: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: '#7dcea0',
  },
  shiftStatusPillTextBreak: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  shiftActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  shiftActionPrimary: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  shiftActionPrimaryGrad: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  shiftActionPrimaryText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.bgDark,
  },
  shiftActionSecondary: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  shiftActionSecondaryText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  shiftActionPressed: {
    opacity: 0.88,
  },
  shiftActionDisabled: {
    opacity: 0.55,
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
  opsTabSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.14)',
    gap: 4,
  },
  opsTabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 40,
  },
  opsTabChipActive: {
    borderColor: 'rgba(212, 175, 55, 0.5)',
  },
  opsTabChipPressed: {
    opacity: 0.88,
  },
  opsTabChipText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  opsTabChipTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  opsTabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  opsTabCountActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
  },
  opsTabCountText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
  },
  opsTabCountTextActive: {
    color: colors.accent,
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
  breakModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  breakModalBox: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.bgDark,
    overflow: 'hidden',
    maxHeight: '70%',
    ...shadow.md,
  },
  breakModalGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  breakModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  breakModalTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  breakModalEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  breakModalTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  breakModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  breakModalLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  breakModalEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  breakModalList: {
    maxHeight: 360,
  },
  breakModalListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  breakTemplateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  breakTemplateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  breakTemplateTextCol: {
    flex: 1,
    minWidth: 0,
  },
  breakTemplateName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  breakTemplateHint: {
    ...typography.small,
    color: colors.textMuted,
  },
  breakDurationChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  breakDurationChipText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  breakModalBusyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  breakModalBusyText: {
    ...typography.small,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
});
