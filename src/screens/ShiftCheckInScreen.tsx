import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components';
import { Avatar } from '../components/Avatar';
import { useAuthStore } from '../store/authStore';
import { useLocation } from '../hooks/useLocation';
import { getMyTeams } from '../services/teams';
import { getActiveShiftLog, checkIn, checkOut } from '../services/shifts';
import { getTeamBreakTemplates, getTeamActiveBreaks, getMyActiveBreak, startBreak, endBreak } from '../services/breaks';
import { getNotifications } from '../services/notificationsWrapper';
import { colors, spacing, typography, fonts, borderRadius } from '../utils/theme';
import type { Team } from '../types';

type Props = {
  route: { params: { team: Team } };
};

export function ShiftCheckInScreen({ route }: Props) {
  const { team: teamFromParams } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const { data: myTeams = [] } = useQuery({
    queryKey: ['my-teams', userId],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!userId,
  });
  /** Güncel takım (yarıçap vb. yönetici güncellemeleri için) */
  const team = useMemo(() => {
    const found = myTeams.find((t) => t.id === teamFromParams.id);
    return found ?? teamFromParams;
  }, [myTeams, teamFromParams]);
  const {
    location,
    error: locationError,
    loading: locationLoading,
    requestPermissionAndGetLocation,
    loadLocationForDisplay,
    distanceToStore,
    isWithinRadius,
  } = useLocation();

  const [activeLog, setActiveLog] = useState<{ id: string; check_in_time: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [breakActionLoading, setBreakActionLoading] = useState(false);
  const [scheduledBreakNotifIds, setScheduledBreakNotifIds] = useState<string[]>([]);
  const [clockTick, setClockTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: breakTemplates = [] } = useQuery({
    queryKey: ['break-templates', team.id],
    queryFn: () => getTeamBreakTemplates(team.id),
  });
  const { data: teamActiveBreaks = [] } = useQuery({
    queryKey: ['team-active-breaks', team.id],
    queryFn: () => getTeamActiveBreaks(team.id),
    refetchInterval: 2000,
  });
  const { data: myActiveBreak, refetch: refetchMyActiveBreak } = useQuery({
    queryKey: ['my-active-break', user?.id, team.id],
    queryFn: () => getMyActiveBreak(user!.id, team.id),
    enabled: !!user?.id,
    refetchInterval: 2000,
  });

  const hasStoreLocation =
    team.store_latitude != null &&
    team.store_longitude != null &&
    team.store_radius != null;
  const radius = team.store_radius ?? 100;
  const distance = hasStoreLocation && location
    ? distanceToStore(team.store_latitude!, team.store_longitude!)
    : null;
  const canCheckIn =
    hasStoreLocation &&
    location &&
    distance !== null &&
    distance <= radius;

  useEffect(() => {
    if (!user) return;
    getActiveShiftLog(user.id, team.id).then(setActiveLog);
  }, [user?.id, team.id]);

  /** Ekran açıldığında önce önbelleğe alınmış konumu kullan (anında), sonra arka planda taze konum al; tekrar girişte uzun bekletmez */
  useEffect(() => {
    if (!hasStoreLocation) return;
    loadLocationForDisplay();
  }, [hasStoreLocation, loadLocationForDisplay]);

  const handleStartShift = async () => {
    if (!user || !location || !canCheckIn) return;
    setActionLoading(true);
    try {
      const coords = await requestPermissionAndGetLocation();
      if (!coords) return;
      const d = distanceToStore(team.store_latitude!, team.store_longitude!);
      if (d === null || d > radius) {
        Alert.alert('Uzak', `Mağaza ${Math.round(d ?? 0)} m uzakta. En fazla ${radius} m olmalı.`);
        return;
      }
      await checkIn(user.id, team.id, coords.lat, coords.lng);
      const log = await getActiveShiftLog(user.id, team.id);
      setActiveLog(log ?? null);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya başlatılamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeLog) return;
    setActionLoading(true);
    try {
      await checkOut(activeLog.id);
      setActiveLog(null);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya bitirilemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBreak = async (template: { id: string; duration_minutes: number }) => {
    if (!user) {
      Alert.alert('Uyarı', 'Lütfen önce giriş yapın.');
      return;
    }
    if (!activeLog) {
      Alert.alert('Uyarı', 'Mola başlatmak için önce vardiya başlatın.');
      return;
    }
    if (myActiveBreak) {
      Alert.alert('Uyarı', 'Zaten aktif bir molanız var.');
      return;
    }
    setBreakActionLoading(true);
    try {
      const created = await startBreak({
        teamId: team.id,
        userId: user.id,
        shiftLogId: activeLog.id,
        templateId: template.id,
        durationMinutes: template.duration_minutes,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['team-active-breaks', team.id] }),
        queryClient.invalidateQueries({ queryKey: ['team-break-logs', team.id] }),
      ]);
      await refetchMyActiveBreak();
      const Notifications = getNotifications();
      const plannedEndDate = new Date(created.planned_end_at);
      const oneMinuteLeftDate = new Date(plannedEndDate.getTime() - 60_000);
      const now = new Date();
      const ids: string[] = [];

      // Son 1 dk uyarısı (mola süresi 1 dk'dan uzunsa ve zaman geçmiş değilse)
      if (oneMinuteLeftDate.getTime() > now.getTime()) {
        const oneMinuteId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Molanız bitmek üzere',
            body: 'Molanızın bitmesine 1 dakika kaldı.',
            sound: 'default',
            data: { breakLogId: created.id, type: 'break_last_minute' },
          },
          trigger: oneMinuteLeftDate as unknown as import('expo-notifications').NotificationTriggerInput,
        });
        ids.push(oneMinuteId);
      }

      const endId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Mola süreniz bitmiştir',
          body: 'Lütfen molayı bitir tuşuna basın.',
          sound: 'default',
          data: { breakLogId: created.id, type: 'break_ended' },
        },
        trigger: plannedEndDate as unknown as import('expo-notifications').NotificationTriggerInput,
      });
      ids.push(endId);
      setScheduledBreakNotifIds(ids);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Mola başlatılamadı.');
    } finally {
      setBreakActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!myActiveBreak) return;
    setBreakActionLoading(true);
    try {
      await endBreak(myActiveBreak.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['team-active-breaks', team.id] }),
        queryClient.invalidateQueries({ queryKey: ['team-break-logs', team.id] }),
      ]);
      if (scheduledBreakNotifIds.length > 0) {
        const Notifications = getNotifications();
        for (const id of scheduledBreakNotifIds) {
          await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        }
      }

      // Uygulama yeniden açılmışsa state'te id kalmayabilir; güvenli tarafta kalmak için
      // aynı mola kaydına bağlı planlı bildirimleri içerik data'sından da temizleriz.
      const Notifications = getNotifications();
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const related = all.filter((n) => {
        const data = (n.content?.data ?? {}) as Record<string, unknown>;
        return data.breakLogId === myActiveBreak.id;
      });
      for (const n of related) {
        if (n.identifier) {
          await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
        }
      }
      setScheduledBreakNotifIds([]);
      await refetchMyActiveBreak();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Mola bitirilemedi.');
    } finally {
      setBreakActionLoading(false);
    }
  };

  const formatBreakRemaining = (plannedEndAt: string): string => {
    const diffMs = new Date(plannedEndAt).getTime() - clockTick;
    const abs = Math.abs(Math.floor(diffMs / 1000));
    const mins = Math.floor(abs / 60);
    const secs = abs % 60;
    const label = `${mins}:${String(secs).padStart(2, '0')}`;
    return diffMs >= 0 ? label : `+${label}`;
  };

  const getBreakTimingState = (plannedEndAt: string): { isOver: boolean; value: string; label: string } => {
    const diffMs = new Date(plannedEndAt).getTime() - clockTick;
    const abs = Math.abs(Math.floor(diffMs / 1000));
    const mins = Math.floor(abs / 60);
    const secs = abs % 60;
    const value = `${mins}:${String(secs).padStart(2, '0')}`;
    if (diffMs >= 0) {
      return { isOver: false, value, label: 'Kalan süre' };
    }
    return { isOver: true, value: `+${value}`, label: `Mola ${value} aşıldı` };
  };

  if (!hasStoreLocation) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Konum tanımlı değil</Text>
            <Text style={styles.emptyMessage}>
              Bu takım için mağaza konumu henüz ayarlanmamış. Yöneticiniz Vardiya Konum Yönetimi üzerinden konum ve yarıçap belirleyebilir.
            </Text>
          </View>
        </Card>
      </ScrollView>
    );
  }

  const distanceRounded = distance !== null ? Math.round(distance) : null;
  const withinRadius = distance !== null && distance <= radius;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Mesafe / durum kartı */}
      <Card style={styles.card}>
        <View style={styles.distanceSection}>
          {locationError ? (
            <View style={styles.statusRow}>
              <Ionicons name="warning-outline" size={24} color={colors.error} />
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          ) : locationLoading ? (
            <View style={styles.statusRow}>
              <Ionicons name="locate-outline" size={28} color={colors.textMuted} />
              <Text style={styles.distanceLabel}>Konum alınıyor…</Text>
            </View>
          ) : location && distanceRounded !== null ? (
            <>
              <View style={[styles.distanceBadge, withinRadius && styles.distanceBadgeOk]}>
                <Text style={[styles.distanceValue, withinRadius && styles.distanceValueOk]}>
                  {distanceRounded}
                </Text>
                <Text style={styles.distanceUnit}>m</Text>
              </View>
              <Text style={styles.distanceLabel}>
                Mağazaya uzaklık
              </Text>
              <Text style={[styles.distanceHint, withinRadius ? styles.distanceHintOk : styles.distanceHintFar]}>
                {withinRadius
                  ? 'Vardiya başlatabilirsiniz'
                  : `Maksimum ${radius} m içinde olmalısınız`}
              </Text>
            </>
          ) : !locationLoading && !locationError ? (
            <Text style={styles.distanceLabel}>Konum bilgisi gerekli</Text>
          ) : null}
        </View>
      </Card>

      {/* Vardiya başlat / bitir */}
      <Card style={[styles.card, styles.actionCard]}>
        {activeLog ? (
          <>
            <View style={styles.activeHeader}>
              <View style={styles.activeDot} />
              <Text style={styles.activeTitle}>Vardiya devam ediyor</Text>
            </View>
            <Text style={styles.activeTime}>
              Başlangıç: {new Date(activeLog.check_in_time).toLocaleString('tr-TR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Pressable
              onPress={handleEndShift}
              disabled={actionLoading}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnEnd,
                pressed && !actionLoading && styles.actionBtnPressed,
                actionLoading && styles.actionBtnDisabled,
              ]}
            >
              <Ionicons name="stop-circle-outline" size={22} color={colors.accent} />
              <Text style={styles.actionBtnTextEnd}>
                {actionLoading ? 'İşleniyor…' : 'Vardiyayı Bitir'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={handleStartShift}
            disabled={!canCheckIn || actionLoading || locationLoading}
            style={({ pressed }) => [
              styles.actionBtn,
              canCheckIn ? styles.actionBtnStart : styles.actionBtnDisabled,
              pressed && canCheckIn && !actionLoading && !locationLoading && styles.actionBtnPressed,
              (!canCheckIn || actionLoading || locationLoading) && styles.actionBtnDisabled,
            ]}
          >
            {actionLoading || locationLoading ? (
              <Text style={styles.actionBtnTextStart}>
                {locationLoading ? 'Konum alınıyor…' : 'Başlatılıyor…'}
              </Text>
            ) : (
              <>
                <Ionicons
                  name="play-circle"
                  size={24}
                  color={canCheckIn ? colors.black : colors.textMuted}
                />
                <Text
                  style={[
                    styles.actionBtnTextStart,
                    !canCheckIn && styles.actionBtnTextDisabled,
                  ]}
                >
                  Vardiya Başlat
                </Text>
              </>
            )}
          </Pressable>
        )}
      </Card>
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cafe-outline" size={18} color={colors.accent} />
          <Text style={styles.activeTitle}>Molalar</Text>
        </View>
        {!activeLog ? (
          <View style={styles.breakLockCard}>
            <View style={styles.breakLockIconWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.breakLockMain}>
              <Text style={styles.breakLockTitle}>Mola alanı kilitli</Text>
              <Text style={styles.breakLockText}>
                Molaları kullanabilmek için önce vardiya başlatmanız gerekir.
              </Text>
            </View>
          </View>
        ) : myActiveBreak ? (
          <>
            {(() => {
              const state = getBreakTimingState(myActiveBreak.planned_end_at);
              return (
                <View style={[styles.activeBreakHero, state.isOver && styles.activeBreakHeroOver]}>
                  <View style={styles.activeBreakHeroTop}>
                    <Text style={styles.activeBreakHeroTitle}>Aktif mola</Text>
                    <View style={[styles.breakDurationBadge, styles.breakDurationBadgeHero]}>
                      <Text style={styles.breakDurationText}>{myActiveBreak.template?.duration_minutes ?? 0} dk</Text>
                    </View>
                  </View>
                  <Text style={styles.activeBreakHeroName}>{myActiveBreak.template?.name ?? 'Mola'}</Text>
                  <View style={styles.activeBreakHeroTimerRow}>
                    <Ionicons
                      name={state.isOver ? 'warning-outline' : 'hourglass-outline'}
                      size={18}
                      color={state.isOver ? colors.error : colors.accent}
                    />
                    <Text style={[styles.activeBreakHeroTimer, state.isOver && styles.activeBreakHeroTimerOver]}>
                      {state.value}
                    </Text>
                    <Text style={[styles.activeBreakHeroTimerLabel, state.isOver && styles.activeBreakHeroTimerLabelOver]}>
                      {state.isOver ? 'asildi' : 'kaldi'}
                    </Text>
                  </View>
                  {state.isOver ? (
                    <Text style={styles.activeBreakHeroOverrun}>{state.label}</Text>
                  ) : null}
                </View>
              );
            })()}
            <Pressable
              onPress={handleEndBreak}
              disabled={breakActionLoading}
              style={({ pressed }) => [
                styles.endBreakBtn,
                pressed && !breakActionLoading && styles.actionBtnPressed,
                breakActionLoading && styles.actionBtnDisabled,
              ]}
            >
              <Ionicons name="stop-circle-outline" size={20} color={colors.black} />
              <Text style={styles.endBreakBtnText}>{breakActionLoading ? 'İşleniyor…' : 'Molayı Bitir'}</Text>
            </Pressable>
          </>
        ) : breakTemplates.length === 0 ? (
          <View style={styles.breakInfoBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.breakInfoText}>Bu ekip için tanımlı mola yok.</Text>
          </View>
        ) : (
          <View style={styles.breakTemplatesWrap}>
            {breakTemplates.map((template) => (
              <Pressable
                key={template.id}
                onPress={() => {
                  Alert.alert(
                    'Mola başlatılsın mı?',
                    `${template.name} · ${template.duration_minutes} dk`,
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Başlat',
                        onPress: () => handleStartBreak(template),
                      },
                    ]
                  );
                }}
                disabled={breakActionLoading}
                style={({ pressed }) => [
                  styles.breakTemplateCard,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <View style={styles.breakTemplateTop}>
                  <Ionicons name="cafe-outline" size={18} color={colors.accent} />
                  <View style={styles.breakDurationBadge}>
                    <Text style={styles.breakDurationText}>{template.duration_minutes} dk</Text>
                  </View>
                </View>
                <Text style={styles.breakTemplateText}>{template.name}</Text>
                <Text style={styles.breakTemplateHint}>Dokun ve molayı başlat</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={18} color={colors.accent} />
          <Text style={styles.activeTitle}>Molada olanlar</Text>
        </View>
        {teamActiveBreaks.length === 0 ? (
          <View style={styles.emptyBreaksCard}>
            <View style={styles.emptyBreaksIconWrap}>
              <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.emptyBreaksMain}>
              <Text style={styles.emptyBreaksTitle}>Molada kimse yok</Text>
              <Text style={styles.emptyBreaksText}>
                Ekip üyeleri mola başlattığında burada canlı olarak görünecek.
              </Text>
            </View>
          </View>
        ) : (
          teamActiveBreaks.map((b) => {
            const name = b.user ? `${b.user.name ?? ''} ${b.user.surname ?? ''}`.trim() || 'Üye' : 'Üye';
            const state = getBreakTimingState(b.planned_end_at);
            return (
              <View key={b.id} style={[styles.activeBreakRow, state.isOver && styles.activeBreakRowOver]}>
                <View style={styles.activeBreakLeft}>
                  <Avatar
                    source={b.user?.profile_photo ?? null}
                    name={name}
                    size={40}
                    style={[styles.activeBreakAvatar, state.isOver && styles.activeBreakAvatarOver]}
                  />
                  <View style={styles.activeBreakRowMain}>
                    <Text style={styles.activeBreakName} numberOfLines={1}>{name}</Text>
                    <View style={styles.activeBreakMetaRow}>
                      <View style={styles.activeBreakNamePill}>
                        <Ionicons name="cafe-outline" size={12} color={colors.accent} />
                        <Text style={styles.activeBreakNamePillText}>{b.template?.name ?? 'Mola'}</Text>
                      </View>
                      <View style={styles.activeBreakDurationPill}>
                        <Text style={styles.activeBreakDurationPillText}>{b.template?.duration_minutes ?? '-'} dk</Text>
                      </View>
                    </View>
                    {state.isOver ? <Text style={styles.activeBreakOverrun}>Planlanan süre aşıldı</Text> : null}
                  </View>
                </View>
                <View style={[styles.activeBreakTimeCard, state.isOver && styles.activeBreakTimeCardOver]}>
                  <Text style={[styles.activeBreakTimeLabel, state.isOver && styles.activeBreakTimeLabelOver]}>
                    {state.isOver ? 'Asim' : 'Kalan'}
                  </Text>
                  <Text style={[styles.activeBreakTimeValue, state.isOver && styles.activeBreakTimeValueOver]}>{state.value}</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  card: {
    padding: spacing.lg,
    borderRadius: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  distanceSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  distanceBadgeOk: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '18',
  },
  distanceValue: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  distanceValueOk: {
    color: colors.accent,
  },
  distanceUnit: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  distanceLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  distanceHint: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  distanceHintOk: {
    color: colors.accent,
  },
  distanceHintFar: {
    color: colors.warning,
  },
  actionCard: {
    marginTop: spacing.sm,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeTitle: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  activeTime: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  activeTimeCompact: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
  },
  actionBtnStart: {
    backgroundColor: colors.accent,
  },
  actionBtnEnd: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  actionBtnPressed: { opacity: 0.88 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnTextStart: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.black,
  },
  actionBtnTextEnd: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  actionBtnTextDisabled: {
    color: colors.textMuted,
  },
  breakTemplatesWrap: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  breakTemplateCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accent + '12',
  },
  breakTemplateTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  breakTemplateText: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.semibold },
  breakTemplateHint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  breakDurationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.accent + '26',
  },
  breakDurationBadgeHero: { backgroundColor: colors.accent + '2E' },
  breakDurationText: { fontSize: 12, color: colors.accent, fontFamily: fonts.semibold },
  activeBreakRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  activeBreakRowOver: {
    borderBottomColor: colors.error + '55',
  },
  activeBreakLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activeBreakAvatar: {
    borderWidth: 1,
    borderColor: colors.accent + '38',
  },
  activeBreakAvatarOver: {
    borderColor: colors.error + '66',
  },
  activeBreakRowMain: { flex: 1, minWidth: 0 },
  activeBreakName: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textPrimary },
  activeBreakMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  activeBreakNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    backgroundColor: colors.accent + '12',
  },
  activeBreakNamePillText: {
    fontSize: 11,
    color: colors.accent,
    textTransform: 'capitalize',
    fontFamily: fonts.medium,
  },
  activeBreakDurationPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  activeBreakDurationPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  activeBreakOverrun: { fontSize: 11, color: colors.error, marginTop: 6, fontFamily: fonts.medium },
  activeBreakTimeCard: {
    minWidth: 90,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    backgroundColor: colors.accent + '12',
  },
  activeBreakTimeCardOver: { borderColor: colors.error + '66', backgroundColor: colors.error + '12' },
  activeBreakTimeLabel: {
    fontSize: 10,
    color: colors.accent,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  activeBreakTimeLabelOver: { color: colors.error },
  activeBreakTimeValue: { fontSize: 13, fontFamily: fonts.bold, color: colors.accent },
  activeBreakTimeValueOver: { color: colors.error },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  activeBreakHero: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '12',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activeBreakHeroOver: { borderColor: colors.error + '70', backgroundColor: colors.error + '10' },
  activeBreakHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeBreakHeroTitle: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.medium, textTransform: 'uppercase' },
  activeBreakHeroName: { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.bold, marginTop: spacing.xs, marginBottom: spacing.sm },
  activeBreakHeroTimerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  activeBreakHeroTimer: { fontSize: 22, color: colors.accent, fontFamily: fonts.bold },
  activeBreakHeroTimerOver: { color: colors.error },
  activeBreakHeroTimerLabel: { fontSize: 13, color: colors.accent, fontFamily: fonts.medium },
  activeBreakHeroTimerLabelOver: { color: colors.error },
  activeBreakHeroOverrun: { fontSize: 12, color: colors.error, marginTop: spacing.xs, fontFamily: fonts.medium },
  endBreakBtn: {
    minHeight: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  endBreakBtnText: { fontSize: 16, color: colors.black, fontFamily: fonts.semibold },
  breakLockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent + '4D',
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent + '10',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  breakLockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.accent + '5A',
    backgroundColor: colors.accent + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakLockMain: { flex: 1, minWidth: 0 },
  breakLockTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    marginBottom: 2,
  },
  breakLockText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyBreaksCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyBreaksIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBreaksMain: { flex: 1, minWidth: 0 },
  emptyBreaksTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    marginBottom: 2,
  },
  emptyBreaksText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  breakInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  breakInfoText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  overrunText: { fontSize: 12, color: colors.error, marginBottom: spacing.sm },
});
