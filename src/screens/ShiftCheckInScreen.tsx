import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../components/Avatar';
import { useAuthStore } from '../store/authStore';
import { useLocation } from '../hooks/useLocation';
import { getMyTeams } from '../services/teams';
import { getActiveShiftLog, checkIn, checkOut } from '../services/shifts';
import {
  getTeamBreakTemplates,
  getTeamActiveBreaks,
  getMyActiveBreak,
  startBreak,
  endBreak,
} from '../services/breaks';
import { getNotifications } from '../services/notificationsWrapper';
import { colors, spacing, fonts, borderRadius, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import type { Team } from '../types';

type Props = {
  route: { params: { team: Team } };
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

export function ShiftCheckInScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const { team: teamFromParams } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
  const distance =
    hasStoreLocation && location
      ? distanceToStore(team.store_latitude!, team.store_longitude!)
      : null;
  const canCheckIn = hasStoreLocation && location && distance !== null && distance <= radius;

  useEffect(() => {
    if (!user) return;
    getActiveShiftLog(user.id, team.id).then(setActiveLog);
  }, [user?.id, team.id]);

  /** Ekran açıldığında önce önbelleğe alınmış konumu kullan (anında), sonra arka planda taze konum al */
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
        themedAlert('Uzak', `Mağaza ${Math.round(d ?? 0)} m uzakta. En fazla ${radius} m olmalı.`);
        return;
      }
      await checkIn(user.id, team.id, coords.lat, coords.lng);
      const log = await getActiveShiftLog(user.id, team.id);
      setActiveLog(log ?? null);
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya başlatılamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeLog) return;
    themedAlert('Vardiyayı bitir?', 'Vardiyanı şimdi kapatmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Bitir',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await checkOut(activeLog.id);
            setActiveLog(null);
          } catch (e) {
            themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya bitirilemedi.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleStartBreak = async (template: { id: string; duration_minutes: number }) => {
    if (!user) {
      themedAlert('Uyarı', 'Lütfen önce giriş yapın.');
      return;
    }
    if (!activeLog) {
      themedAlert('Uyarı', 'Mola başlatmak için önce vardiya başlatın.');
      return;
    }
    if (myActiveBreak) {
      themedAlert('Uyarı', 'Zaten aktif bir molanız var.');
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
      themedAlert('Hata', e instanceof Error ? e.message : 'Mola başlatılamadı.');
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
      themedAlert('Hata', e instanceof Error ? e.message : 'Mola bitirilemedi.');
    } finally {
      setBreakActionLoading(false);
    }
  };

  const getBreakTimingState = (
    plannedEndAt: string
  ): { isOver: boolean; value: string; label: string } => {
    const diffMs = new Date(plannedEndAt).getTime() - clockTick;
    const abs = Math.abs(Math.floor(diffMs / 1000));
    const mins = Math.floor(abs / 60);
    const secs = abs % 60;
    const value = `${mins}:${pad2(secs)}`;
    if (diffMs >= 0) {
      return { isOver: false, value, label: 'Kalan süre' };
    }
    return { isOver: true, value: `+${value}`, label: `Mola ${value} aşıldı` };
  };

  const distanceRounded = distance !== null ? Math.round(distance) : null;
  const withinRadius = distance !== null && distance <= radius;

  // Vardiya süresi (canlı)
  const shiftElapsedMs = activeLog
    ? Math.max(0, clockTick - new Date(activeLog.check_in_time).getTime())
    : 0;

  // Konum tanımlı değilse erken dönüş (hero yine de gözüksün)
  if (!hasStoreLocation) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabScrollBottomPad + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Hero
            insets={insets}
            onBack={() => navigation.goBack()}
            teamName={team.name}
            statusActive={false}
            statusText="Konum ayarlı değil"
            elapsedText={null}
          />
          <View style={styles.body}>
            <View style={styles.panel}>
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.panelBody}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="location-outline" size={28} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Mağaza konumu tanımlı değil</Text>
                <Text style={styles.emptyMessage}>
                  Bu ekip için mağaza konumu henüz ayarlanmamış. Yöneticiniz Vardiya Konum
                  Yönetimi üzerinden konum ve yarıçap belirleyebilir.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabScrollBottomPad + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Hero
          insets={insets}
          onBack={() => navigation.goBack()}
          teamName={team.name}
          statusActive={!!activeLog}
          statusText={activeLog ? 'Aktif vardiya' : 'Vardiya başlatılmadı'}
          elapsedText={activeLog ? formatElapsed(shiftElapsedMs) : null}
        />

        <View style={styles.body}>
          {/* Mesafe / durum paneli */}
          <View style={styles.panel}>
            <View style={styles.panelGoldCap} />
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.panelBody}>
              <View style={styles.panelHeaderRow}>
                <View style={styles.panelIconWrap}>
                  <Ionicons name="location-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.panelTitle}>Mağazaya yakınlık</Text>
                <View
                  style={[
                    styles.panelBadge,
                    withinRadius ? styles.panelBadgeOk : styles.panelBadgeWarn,
                  ]}
                >
                  <View
                    style={[
                      styles.panelBadgeDot,
                      withinRadius ? styles.panelBadgeDotOk : styles.panelBadgeDotWarn,
                    ]}
                  />
                  <Text
                    style={[
                      styles.panelBadgeText,
                      withinRadius ? styles.panelBadgeTextOk : styles.panelBadgeTextWarn,
                    ]}
                  >
                    {withinRadius ? 'Alan içinde' : 'Alan dışında'}
                  </Text>
                </View>
              </View>

              {locationError ? (
                <View style={styles.distanceErrorRow}>
                  <Ionicons name="warning-outline" size={18} color={colors.error} />
                  <Text style={styles.distanceErrorText}>{locationError}</Text>
                </View>
              ) : locationLoading && distanceRounded === null ? (
                <View style={styles.distanceLoadingRow}>
                  <Ionicons name="locate-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.distanceLoadingText}>Konum alınıyor…</Text>
                </View>
              ) : distanceRounded !== null ? (
                <>
                  <View style={styles.distanceValueRow}>
                    <Text
                      style={[
                        styles.distanceValue,
                        withinRadius && styles.distanceValueOk,
                      ]}
                    >
                      {distanceRounded}
                    </Text>
                    <Text style={styles.distanceUnit}>m</Text>
                    <Text style={styles.distanceOf}> / {radius} m</Text>
                  </View>

                  {/* İlerleme çubuğu — mesafe / yarıçap oranı */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        withinRadius
                          ? styles.progressFillOk
                          : styles.progressFillWarn,
                        {
                          width: `${Math.min(
                            100,
                            Math.round((distanceRounded / radius) * 100)
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.distanceHint,
                      withinRadius ? styles.distanceHintOk : styles.distanceHintFar,
                    ]}
                  >
                    {withinRadius
                      ? 'Vardiya başlatabilirsiniz'
                      : `En fazla ${radius} m içinde olmalısınız`}
                  </Text>
                </>
              ) : (
                <Text style={styles.distanceLoadingText}>Konum bilgisi gerekli</Text>
              )}
            </View>
          </View>

          {/* Vardiya aksiyon paneli */}
          {activeLog ? (
            <View style={[styles.panel, styles.panelActive]}>
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(45, 106, 79, 0.14)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.panelBody}>
                <View style={styles.panelHeaderRow}>
                  <View style={styles.liveDotWrap}>
                    <View style={styles.liveDotRing} />
                    <View style={styles.liveDot} />
                  </View>
                  <Text style={styles.panelTitle}>Vardiya devam ediyor</Text>
                </View>

                <View style={styles.elapsedRow}>
                  <Text style={styles.elapsedValue}>{formatElapsed(shiftElapsedMs)}</Text>
                  <Text style={styles.elapsedLabel}>çalışma süresi</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText}>
                    Başlangıç:{' '}
                    {new Date(activeLog.check_in_time).toLocaleString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <Pressable
                  onPress={handleEndShift}
                  disabled={actionLoading}
                  style={({ pressed }) => [
                    styles.ctaEnd,
                    pressed && !actionLoading && styles.ctaPressed,
                    actionLoading && styles.ctaDisabled,
                  ]}
                >
                  <Ionicons name="stop-circle-outline" size={22} color={colors.accent} />
                  <Text style={styles.ctaEndText}>
                    {actionLoading ? 'İşleniyor…' : 'Vardiyayı Bitir'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.panel}>
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.10)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.panelBody}>
                <View style={styles.panelHeaderRow}>
                  <View style={styles.panelIconWrap}>
                    <Ionicons name="play-circle-outline" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.panelTitle}>Vardiyayı başlat</Text>
                </View>
                <Text style={styles.panelDescription}>
                  Giriş yapmak için mağaza alanının içinde olmalısın. Konum doğrulandıktan sonra
                  aşağıdaki butonla vardiyanı başlatabilirsin.
                </Text>
                <Pressable
                  onPress={handleStartShift}
                  disabled={!canCheckIn || actionLoading || locationLoading}
                  style={({ pressed }) => [
                    styles.ctaStartWrap,
                    pressed &&
                      canCheckIn &&
                      !actionLoading &&
                      !locationLoading &&
                      styles.ctaPressed,
                    (!canCheckIn || actionLoading || locationLoading) && styles.ctaDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={
                      canCheckIn
                        ? [colors.accentHover, colors.accent]
                        : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaStart}
                  >
                    {actionLoading || locationLoading ? (
                      <Text
                        style={[
                          styles.ctaStartText,
                          !canCheckIn && styles.ctaStartTextDisabled,
                        ]}
                      >
                        {locationLoading ? 'Konum alınıyor…' : 'Başlatılıyor…'}
                      </Text>
                    ) : (
                      <>
                        <Ionicons
                          name="play-circle"
                          size={22}
                          color={canCheckIn ? colors.black : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.ctaStartText,
                            !canCheckIn && styles.ctaStartTextDisabled,
                          ]}
                        >
                          Vardiya Başlat
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}

          {/* Molalar */}
          <View style={styles.panel}>
            <View style={styles.panelGoldCap} />
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.panelBody}>
              <View style={styles.panelHeaderRow}>
                <View style={styles.panelIconWrap}>
                  <Ionicons name="cafe-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.panelTitle}>Molalar</Text>
              </View>

              {!activeLog ? (
                <View style={styles.lockCard}>
                  <View style={styles.lockIconWrap}>
                    <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.lockMain}>
                    <Text style={styles.lockTitle}>Mola alanı kilitli</Text>
                    <Text style={styles.lockText}>
                      Molaları kullanabilmek için önce vardiya başlatmanız gerekir.
                    </Text>
                  </View>
                </View>
              ) : myActiveBreak ? (
                <>
                  {(() => {
                    const state = getBreakTimingState(myActiveBreak.planned_end_at);
                    return (
                      <View
                        style={[
                          styles.activeBreakHero,
                          state.isOver && styles.activeBreakHeroOver,
                        ]}
                      >
                        <LinearGradient
                          colors={
                            state.isOver
                              ? ['rgba(239, 68, 68, 0.18)', 'rgba(239, 68, 68, 0.04)']
                              : ['rgba(212, 175, 55, 0.18)', 'rgba(212, 175, 55, 0.04)']
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.activeBreakTopRow}>
                          <View style={styles.activeBreakLabelWrap}>
                            <View
                              style={[
                                styles.activeBreakLiveDotRing,
                                state.isOver && styles.activeBreakLiveDotRingOver,
                              ]}
                            />
                            <View
                              style={[
                                styles.activeBreakLiveDot,
                                state.isOver && styles.activeBreakLiveDotOver,
                              ]}
                            />
                            <Text
                              style={[
                                styles.activeBreakEyebrow,
                                state.isOver && styles.activeBreakEyebrowOver,
                              ]}
                            >
                              {state.isOver ? 'SÜRE AŞIMI' : 'AKTİF MOLA'}
                            </Text>
                          </View>
                          <View style={styles.durationChip}>
                            <Text style={styles.durationChipText}>
                              {myActiveBreak.template?.duration_minutes ?? 0} dk
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.activeBreakName}>
                          {myActiveBreak.template?.name ?? 'Mola'}
                        </Text>
                        <View style={styles.timerRow}>
                          <Text
                            style={[
                              styles.timerValue,
                              state.isOver && styles.timerValueOver,
                            ]}
                          >
                            {state.value}
                          </Text>
                          <Text
                            style={[
                              styles.timerUnit,
                              state.isOver && styles.timerUnitOver,
                            ]}
                          >
                            {state.isOver ? 'aşıldı' : 'kaldı'}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                  <Pressable
                    onPress={handleEndBreak}
                    disabled={breakActionLoading}
                    style={({ pressed }) => [
                      styles.ctaStartWrap,
                      pressed && !breakActionLoading && styles.ctaPressed,
                      breakActionLoading && styles.ctaDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={[colors.accentHover, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.ctaStart}
                    >
                      <Ionicons name="stop-circle-outline" size={20} color={colors.black} />
                      <Text style={styles.ctaStartText}>
                        {breakActionLoading ? 'İşleniyor…' : 'Molayı Bitir'}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : breakTemplates.length === 0 ? (
                <View style={styles.emptyMini}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.emptyMiniText}>
                    Bu ekip için tanımlı mola yok.
                  </Text>
                </View>
              ) : (
                <View style={styles.breakTemplatesGrid}>
                  {breakTemplates.map((template) => (
                    <Pressable
                      key={template.id}
                      onPress={() => {
                        themedAlert(
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
                        pressed && styles.ctaPressed,
                      ]}
                    >
                      <LinearGradient
                        colors={['rgba(212, 175, 55, 0.14)', 'rgba(212, 175, 55, 0.04)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.breakTemplateTop}>
                        <View style={styles.breakTemplateIconWrap}>
                          <Ionicons name="cafe-outline" size={16} color={colors.accent} />
                        </View>
                        <View style={styles.durationChip}>
                          <Text style={styles.durationChipText}>
                            {template.duration_minutes} dk
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.breakTemplateName} numberOfLines={2}>
                        {template.name}
                      </Text>
                      <View style={styles.breakTemplateHintRow}>
                        <Text style={styles.breakTemplateHint}>Başlatmak için dokun</Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Ekipte molada olanlar */}
          <View style={styles.panel}>
            <View style={styles.panelGoldCap} />
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.panelBody}>
              <View style={styles.panelHeaderRow}>
                <View style={styles.panelIconWrap}>
                  <Ionicons name="people-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.panelTitle}>Molada olanlar</Text>
                {teamActiveBreaks.length > 0 && (
                  <View style={styles.countChip}>
                    <Text style={styles.countChipText}>{teamActiveBreaks.length}</Text>
                  </View>
                )}
              </View>
              {teamActiveBreaks.length === 0 ? (
                <View style={styles.emptyMini}>
                  <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.emptyMiniText}>Molada kimse yok.</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {teamActiveBreaks.map((b) => {
                    const name = b.user
                      ? `${b.user.name ?? ''} ${b.user.surname ?? ''}`.trim() || 'Üye'
                      : 'Üye';
                    const state = getBreakTimingState(b.planned_end_at);
                    return (
                      <View
                        key={b.id}
                        style={[styles.teamBreakRow, state.isOver && styles.teamBreakRowOver]}
                      >
                        <View style={styles.teamBreakLeft}>
                          <Avatar
                            source={b.user?.profile_photo ?? null}
                            name={name}
                            size={40}
                            style={[
                              styles.teamBreakAvatar,
                              state.isOver && styles.teamBreakAvatarOver,
                            ]}
                          />
                          <View style={styles.teamBreakMain}>
                            <Text style={styles.teamBreakName} numberOfLines={1}>
                              {name}
                            </Text>
                            <View style={styles.teamBreakMetaRow}>
                              <View style={styles.teamBreakNameChip}>
                                <Ionicons
                                  name="cafe-outline"
                                  size={11}
                                  color={colors.accent}
                                />
                                <Text style={styles.teamBreakNameChipText}>
                                  {b.template?.name ?? 'Mola'}
                                </Text>
                              </View>
                              <View style={styles.teamBreakDurChip}>
                                <Text style={styles.teamBreakDurChipText}>
                                  {b.template?.duration_minutes ?? '-'} dk
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.teamBreakTimeCard,
                            state.isOver && styles.teamBreakTimeCardOver,
                          ]}
                        >
                          <Text
                            style={[
                              styles.teamBreakTimeLabel,
                              state.isOver && styles.teamBreakTimeLabelOver,
                            ]}
                          >
                            {state.isOver ? 'AŞIM' : 'KALAN'}
                          </Text>
                          <Text
                            style={[
                              styles.teamBreakTimeValue,
                              state.isOver && styles.teamBreakTimeValueOver,
                            ]}
                          >
                            {state.value}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type HeroProps = {
  insets: { top: number };
  onBack: () => void;
  teamName: string;
  statusActive: boolean;
  statusText: string;
  elapsedText: string | null;
};

function Hero({ insets, onBack, teamName, statusActive, statusText, elapsedText }: HeroProps) {
  return (
    <LinearGradient
      colors={[
        'rgba(212, 175, 55, 0.22)',
        'rgba(212, 175, 55, 0.06)',
        'rgba(0,0,0,0)',
      ]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
    >
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backPill, pressed && styles.backPillPressed]}
        hitSlop={8}
        accessibilityLabel="Geri"
      >
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        <Text style={styles.backPillText}>Geri</Text>
      </Pressable>
      <Text style={styles.heroEyebrow}>Vardiya ve mola</Text>
      <Text style={styles.heroTitle} numberOfLines={1}>
        {teamName}
      </Text>
      <View
        style={[
          styles.heroStatusRow,
          statusActive ? styles.heroStatusRowOn : styles.heroStatusRowOff,
        ]}
      >
        <View
          style={[
            styles.heroStatusDot,
            statusActive ? styles.heroStatusDotOn : styles.heroStatusDotOff,
          ]}
        />
        <Text
          style={[
            styles.heroStatusText,
            statusActive ? styles.heroStatusTextOn : styles.heroStatusTextOff,
          ]}
        >
          {statusText}
        </Text>
        {elapsedText ? (
          <>
            <View style={styles.heroStatusDivider} />
            <Ionicons name="time-outline" size={13} color={colors.accent} />
            <Text style={styles.heroStatusElapsed}>{elapsedText}</Text>
          </>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  scrollContent: { paddingBottom: 0 },

  // HERO
  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.sm,
  },
  backPillPressed: { opacity: 0.7 },
  backPillText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
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
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroStatusRowOn: {
    backgroundColor: 'rgba(45, 106, 79, 0.18)',
    borderColor: 'rgba(45, 106, 79, 0.55)',
  },
  heroStatusRowOff: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatusDotOn: { backgroundColor: '#34C759' },
  heroStatusDotOff: { backgroundColor: colors.textMuted },
  heroStatusText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    letterSpacing: 0.2,
  },
  heroStatusTextOn: { color: '#D6F5E3' },
  heroStatusTextOff: { color: colors.textSecondary },
  heroStatusDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 2,
  },
  heroStatusElapsed: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.3,
  },

  // BODY (layout wrapper)
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  // Panel (premium glass card)
  panel: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  panelActive: {
    borderColor: 'rgba(45, 106, 79, 0.55)',
  },
  panelGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  panelBody: {
    padding: spacing.md,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  panelIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  panelDescription: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  panelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  panelBadgeOk: {
    backgroundColor: 'rgba(45, 106, 79, 0.16)',
    borderColor: 'rgba(45, 106, 79, 0.55)',
  },
  panelBadgeWarn: {
    backgroundColor: 'rgba(233, 196, 106, 0.12)',
    borderColor: 'rgba(233, 196, 106, 0.50)',
  },
  panelBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  panelBadgeDotOk: { backgroundColor: '#34C759' },
  panelBadgeDotWarn: { backgroundColor: colors.warning },
  panelBadgeText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panelBadgeTextOk: { color: '#9FE7BA' },
  panelBadgeTextWarn: { color: colors.warning },

  // Distance block
  distanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  distanceValue: {
    fontSize: 44,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  distanceValueOk: { color: colors.accent },
  distanceUnit: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  distanceOf: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillOk: { backgroundColor: colors.accent },
  progressFillWarn: { backgroundColor: colors.warning },
  distanceHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  distanceHintOk: { color: '#9FE7BA' },
  distanceHintFar: { color: colors.warning },
  distanceErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  distanceErrorText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontFamily: fonts.medium,
  },
  distanceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  distanceLoadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },

  // Live shift elapsed
  liveDotWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(52, 199, 89, 0.18)',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  elapsedValue: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: -1,
  },
  elapsedLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  metaText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },

  // CTA buttons
  ctaStartWrap: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  ctaStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  ctaStartText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.black,
    letterSpacing: 0.2,
  },
  ctaStartTextDisabled: {
    color: colors.textMuted,
  },
  ctaEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.55)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  ctaEndText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  ctaPressed: { opacity: 0.88 },
  ctaDisabled: { opacity: 0.5 },

  // Break templates
  breakTemplatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  breakTemplateCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.32)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  breakTemplateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  breakTemplateIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakTemplateName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  breakTemplateHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  breakTemplateHint: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  durationChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.40)',
  },
  durationChipText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  countChipText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.accent,
  },

  // Active break hero
  activeBreakHero: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  activeBreakHeroOver: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  activeBreakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  activeBreakLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeBreakLiveDotRing: {
    position: 'absolute',
    left: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
  },
  activeBreakLiveDotRingOver: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
  },
  activeBreakLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 2,
  },
  activeBreakLiveDotOver: {
    backgroundColor: colors.error,
  },
  activeBreakEyebrow: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 1,
  },
  activeBreakEyebrowOver: {
    color: colors.error,
  },
  activeBreakName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  timerValue: {
    fontSize: 40,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: -1,
  },
  timerValueOver: {
    color: colors.error,
  },
  timerUnit: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timerUnitOver: {
    color: colors.error,
  },

  // Empty / lock
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.32)',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  lockIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockMain: { flex: 1, minWidth: 0 },
  lockTitle: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    marginBottom: 2,
  },
  lockText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyMiniText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    flex: 1,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Team active breaks rows
  teamBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  teamBreakRowOver: {
    borderColor: 'rgba(239, 68, 68, 0.40)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  teamBreakLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamBreakAvatar: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  teamBreakAvatarOver: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  teamBreakMain: { flex: 1, minWidth: 0 },
  teamBreakName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  teamBreakMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  teamBreakNameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
  },
  teamBreakNameChipText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  teamBreakDurChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  teamBreakDurChipText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  teamBreakTimeCard: {
    minWidth: 74,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
  },
  teamBreakTimeCardOver: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
  },
  teamBreakTimeLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  teamBreakTimeLabelOver: { color: colors.error },
  teamBreakTimeValue: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  teamBreakTimeValueOver: { color: colors.error },
});
