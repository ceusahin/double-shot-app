import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components';
import { useAuthStore } from '../store/authStore';
import { useLocation } from '../hooks/useLocation';
import { getMyTeams, updateTeamStoreLocation } from '../services/teams';
import { colors, spacing, typography, fonts } from '../utils/theme';
import type { Team } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

const RADIUS_OPTIONS = [100, 250, 500];
const MAP_HEIGHT = 280;
const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

type Props = { route: RouteProp<TeamsStackParamList, 'ShiftLocationManagement'> };

export function ShiftLocationManagementScreen({ route }: Props) {
  const { team: teamFromParams } = route.params;
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { data: myTeams = [] } = useQuery({
    queryKey: ['my-teams', userId],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!userId,
  });
  /** Ekranda her zaman güncel takım: sorgudan gelen veya ilk açılışta params */
  const team = useMemo(() => {
    const found = myTeams.find((t) => t.id === teamFromParams.id);
    return (found ?? teamFromParams) as Team & { role?: string };
  }, [myTeams, teamFromParams]);

  const {
    requestPermissionAndGetLocation,
    loading: locationLoading,
    error: locationError,
  } = useLocation();

  const [saving, setSaving] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<number>(() => {
    const r = team.store_radius ?? 100;
    return RADIUS_OPTIONS.includes(r) ? r : 100;
  });
  /** Haritada tıklanarak seçilen nokta (henüz kaydedilmedi) */
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | null>(null);
  /** Harita açık mı; açıldığında kullanılan ilk bölge (konum veya İstanbul) */
  const [mapVisible, setMapVisible] = useState(false);
  const [mapOpenRegion, setMapOpenRegion] = useState<Region | null>(null);
  const [mapOpening, setMapOpening] = useState(false);
  const [radiusSaving, setRadiusSaving] = useState(false);

  /** Sorgudan güncel takım gelince yarıçapı senkronize et (ekrana dönünce doğru değer görünsün) */
  useEffect(() => {
    const r = team.store_radius ?? 100;
    setSelectedRadius(RADIUS_OPTIONS.includes(r) ? r : 100);
  }, [team.store_radius]);

  const isOwner = team.owner_id === user?.id;
  const hasLocation =
    team.store_latitude != null &&
    team.store_longitude != null &&
    team.store_radius != null;

  /** "Konumu haritadan seç"e basıldığında: konum açıksa oraya, değilse İstanbul'a odaklan */
  const openMapPicker = useCallback(async () => {
    if (!isOwner) return;
    setMapOpening(true);
    try {
      const coords = await requestPermissionAndGetLocation();
      if (coords) {
        setMapOpenRegion({
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      } else {
        setMapOpenRegion(ISTANBUL_REGION);
      }
      setMapVisible(true);
    } catch {
      setMapOpenRegion(ISTANBUL_REGION);
      setMapVisible(true);
    } finally {
      setMapOpening(false);
    }
  }, [isOwner, requestPermissionAndGetLocation]);

  /** Harita kapalıyken gösterilecek initialRegion yok; açıkken mapOpenRegion veya seçilen nokta */
  const mapInitialRegion = useMemo((): Region => {
    if (pickedCoord) {
      return {
        latitude: pickedCoord.lat,
        longitude: pickedCoord.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
    }
    return mapOpenRegion ?? ISTANBUL_REGION;
  }, [mapOpenRegion, pickedCoord]);

  /** Marker gösterilecek koordinat: haritadan seçilen veya kayıtlı konum */
  const markerCoord = pickedCoord ?? (hasLocation
    ? { lat: team.store_latitude!, lng: team.store_longitude! }
    : null);

  const handleMapPress = (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    if (!isOwner) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPickedCoord({ lat: latitude, lng: longitude });
  };

  const handleUseCurrentLocation = async () => {
    if (!user || !isOwner) return;
    setSaving(true);
    try {
      const coords = await requestPermissionAndGetLocation();
      if (!coords) {
        Alert.alert('Konum alınamadı', 'Lütfen konum iznini verin ve tekrar deneyin.');
        return;
      }
      setPickedCoord({ lat: coords.lat, lng: coords.lng });
      await updateTeamStoreLocation(
        team.id,
        user.id,
        coords.lat,
        coords.lng,
        selectedRadius
      );
      queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      Alert.alert('Kaydedildi', 'Vardiya giriş konumu güncellendi. Çalışanlar bu noktaya ' + selectedRadius + ' m içinde vardiya başlatabilir.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Konum kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePickedLocation = async () => {
    if (!user || !isOwner || !pickedCoord) return;
    setSaving(true);
    try {
      await updateTeamStoreLocation(
        team.id,
        user.id,
        pickedCoord.lat,
        pickedCoord.lng,
        selectedRadius
      );
      queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      setPickedCoord(null);
      setMapVisible(false);
      setMapOpenRegion(null);
      Alert.alert('Kaydedildi', 'Vardiya giriş konumu haritadan seçilen nokta olarak güncellendi. Çalışanlar bu noktaya ' + selectedRadius + ' m içinde vardiya başlatabilir.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Konum kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const canSavePicked = isOwner && pickedCoord !== null;

  /** Yarıçap seçildiğinde state güncelle; kayıtlı konum varsa hemen backend'e yaz */
  const handleRadiusSelect = useCallback(
    async (r: number) => {
      setSelectedRadius(r);
      if (!user || !isOwner || !hasLocation) return;
      setRadiusSaving(true);
      try {
        await updateTeamStoreLocation(
          team.id,
          user.id,
          team.store_latitude!,
          team.store_longitude!,
          r
        );
        queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      } catch (e) {
        Alert.alert('Hata', e instanceof Error ? e.message : 'Yarıçap güncellenemedi.');
      } finally {
        setRadiusSaving(false);
      }
    },
    [user, isOwner, hasLocation, team.id, team.store_latitude, team.store_longitude, queryClient]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.title}>Vardiya girişi konumu</Text>
        <Text style={styles.description}>
          Çalışanlar yalnızca bu noktaya belirlediğiniz mesafe içindeyken vardiya başlatabilir. Konumu haritadan seçin veya mevcut konumunuzu kullanın.
        </Text>

        {isOwner && (
          <View style={styles.actionSection}>
            {Platform.OS !== 'web' && (
              <>
                <Pressable
                  onPress={openMapPicker}
                  disabled={mapOpening}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.actionBtnPrimary,
                    (pressed || mapOpening) && styles.actionBtnPressed,
                    mapOpening && styles.actionBtnDisabled,
                  ]}
                >
                  {mapOpening ? (
                    <Text style={styles.actionBtnTextPrimary}>Açılıyor…</Text>
                  ) : (
                    <>
                      <Ionicons name="map-outline" size={22} color={colors.black} />
                      <Text style={styles.actionBtnTextPrimary}>Konumu haritadan seç</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleUseCurrentLocation}
                  disabled={locationLoading || saving}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.actionBtnSecondary,
                    (pressed || locationLoading || saving) && styles.actionBtnPressed,
                    (locationLoading || saving) && styles.actionBtnDisabled,
                  ]}
                >
                  {locationLoading || saving ? (
                    <Text style={styles.actionBtnTextSecondary}>İşleniyor…</Text>
                  ) : (
                    <>
                      <Ionicons name="locate-outline" size={22} color={colors.accent} />
                      <Text style={styles.actionBtnTextSecondary}>Mevcut konumumu kullan</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
            {Platform.OS === 'web' && (
              <Pressable
                onPress={handleUseCurrentLocation}
                disabled={locationLoading || saving}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  (pressed || locationLoading || saving) && styles.actionBtnPressed,
                ]}
              >
                <Ionicons name="locate-outline" size={22} color={colors.black} />
                <Text style={styles.actionBtnTextPrimary}>
                  {locationLoading || saving ? 'İşleniyor…' : 'Mevcut konumumu kullan'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {isOwner && Platform.OS !== 'web' && mapVisible && (
          <View style={styles.mapWrap}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapHint}>Bir noktaya dokunun, sonra aşağıdaki kaydet butonuna basın</Text>
              <Pressable
                onPress={() => { setMapVisible(false); setMapOpenRegion(null); setPickedCoord(null); }}
                style={({ pressed }) => [styles.mapCloseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </Pressable>
            </View>
            <MapView
              style={[styles.map, { height: MAP_HEIGHT }]}
              initialRegion={mapInitialRegion}
              onPress={handleMapPress}
              mapType="standard"
              showsUserLocation
            >
              {markerCoord != null && (
                <Marker
                  coordinate={{
                    latitude: markerCoord.lat,
                    longitude: markerCoord.lng,
                  }}
                  title="Vardiya giriş noktası"
                />
              )}
            </MapView>
            {canSavePicked && (
              <Pressable
                onPress={handleSavePickedLocation}
                disabled={saving}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  styles.savePickedBtn,
                  pressed && !saving && styles.actionBtnPressed,
                  saving && styles.actionBtnDisabled,
                ]}
              >
                {saving ? (
                  <Text style={styles.actionBtnTextPrimary}>Kaydediliyor…</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.black} />
                    <Text style={styles.actionBtnTextPrimary}>Haritadan seçilen konumu kaydet</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {hasLocation && (
          <View style={styles.currentWrap}>
            <Text style={styles.sectionLabel}>Kayıtlı konum</Text>
            <Text style={styles.coords}>
              {team.store_latitude!.toFixed(6)}, {team.store_longitude!.toFixed(6)}
            </Text>
            <Text style={styles.radiusText}>
              Yarıçap: {isOwner ? selectedRadius : team.store_radius} m
              {radiusSaving ? ' (kaydediliyor…)' : ''}
            </Text>
          </View>
        )}

        {!hasLocation && !isOwner && (
          <Text style={styles.hint}>Bu takım için henüz vardiya konumu tanımlanmamış. Sadece takım sahibi konum ekleyebilir.</Text>
        )}

        {isOwner && (
          <View style={styles.radiusSection}>
            <Text style={styles.sectionLabel}>Yarıçap</Text>
            <Text style={styles.radiusSubtext}>Vardiya girişine izin verilecek mesafe (metre)</Text>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => handleRadiusSelect(r)}
                  disabled={radiusSaving}
                  style={({ pressed }) => [
                    styles.radiusChip,
                    selectedRadius === r && styles.radiusChipSelected,
                    pressed && !radiusSaving && styles.radiusChipPressed,
                    radiusSaving && styles.radiusChipDisabled,
                  ]}
                >
                  <Text style={[styles.radiusChipText, selectedRadius === r && styles.radiusChipTextSelected]}>
                    {r} m
                  </Text>
                </Pressable>
              ))}
            </View>
            {locationError && (
              <Text style={styles.error}>{locationError}</Text>
            )}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  card: { padding: spacing.lg },
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 24 },

  actionSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
  },
  actionBtnPrimary: {
    backgroundColor: colors.accent,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  actionBtnPressed: { opacity: 0.88 },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnTextPrimary: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.black,
  },
  actionBtnTextSecondary: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  savePickedBtn: { marginTop: spacing.sm },

  mapWrap: {
    marginBottom: spacing.lg,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapCloseBtn: { padding: spacing.xs },
  map: { width: '100%', borderRadius: 0 },
  mapHint: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },

  sectionLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  currentWrap: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coords: { ...typography.caption, color: colors.textPrimary, fontFamily: 'monospace' },
  radiusText: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },

  radiusSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  radiusSubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  radiusChip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  radiusChipSelected: {
    backgroundColor: colors.accent + '22',
    borderColor: colors.accent,
  },
  radiusChipPressed: { opacity: 0.85 },
  radiusChipDisabled: { opacity: 0.6 },
  radiusChipText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  radiusChipTextSelected: {
    color: colors.accent,
  },

  hint: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
});
