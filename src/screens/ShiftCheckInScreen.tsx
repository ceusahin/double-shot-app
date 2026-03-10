import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components';
import { useAuthStore } from '../store/authStore';
import { useLocation } from '../hooks/useLocation';
import { getMyTeams } from '../services/teams';
import { getActiveShiftLog, checkIn, checkOut } from '../services/shifts';
import { colors, spacing, typography, fonts } from '../utils/theme';
import type { Team } from '../types';

type Props = {
  route: { params: { team: Team } };
};

export function ShiftCheckInScreen({ route }: Props) {
  const { team: teamFromParams } = route.params;
  const user = useAuthStore((s) => s.user);
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

  if (!hasStoreLocation) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Konum tanımlı değil</Text>
            <Text style={styles.emptyMessage}>
              Bu takım için mağaza konumu henüz ayarlanmamış. Yöneticiniz Vardiya Konum Yönetimi üzerinden konum ve yarıçap belirleyebilir.
            </Text>
          </View>
        </Card>
      </View>
    );
  }

  const distanceRounded = distance !== null ? Math.round(distance) : null;
  const withinRadius = distance !== null && distance <= radius;

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
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
});
