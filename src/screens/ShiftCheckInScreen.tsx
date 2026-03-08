import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Card } from '../components';
import { useAuthStore } from '../store/authStore';
import { useLocation } from '../hooks/useLocation';
import { getActiveShiftLog, checkIn, checkOut } from '../services/shifts';
import { colors, spacing, typography } from '../utils/theme';
import type { Team } from '../types';

type Props = {
  route: { params: { team: Team } };
};

export function ShiftCheckInScreen({ route }: Props) {
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const {
    location,
    error: locationError,
    loading: locationLoading,
    requestPermissionAndGetLocation,
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

  const handleStartShift = async () => {
    if (!user || !location || !canCheckIn) return;
    setActionLoading(true);
    try {
      await requestPermissionAndGetLocation();
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
        <Card>
          <Text style={styles.message}>
            Bu takım için mağaza konumu tanımlanmamış. Yönetici mağaza konumu ve yarıçapı ayarlayabilir.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        {locationError && (
          <Text style={styles.error}>{locationError}</Text>
        )}
        {location && distance !== null && (
          <Text style={styles.distance}>
            Mağazaya uzaklık: {Math.round(distance)} m
            {distance <= radius ? ' ✓ Vardiya başlatılabilir' : ` (max ${radius} m)`}
          </Text>
        )}
        {activeLog ? (
          <>
            <Text style={styles.status}>Vardiya başladı</Text>
            <Text style={styles.time}>
              {new Date(activeLog.check_in_time).toLocaleString('tr-TR')}
            </Text>
            <Button
              title="Vardiyayı Bitir"
              onPress={handleEndShift}
              loading={actionLoading}
              fullWidth
            />
          </>
        ) : (
          <Button
            title={locationLoading ? 'Konum alınıyor…' : 'Vardiya Başlat'}
            onPress={handleStartShift}
            loading={actionLoading || locationLoading}
            disabled={!canCheckIn}
            fullWidth
          />
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  card: {
    marginTop: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  distance: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  status: {
    ...typography.subtitle,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});
