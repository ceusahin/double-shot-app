import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useLocation } from '../hooks/useLocation';
import { getMyTeams, updateTeamStoreLocation } from '../services/teams';
import { colors, spacing, fonts, borderRadius, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import type { Team } from '../types';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';

const RADIUS_OPTIONS: { value: number; label: string; description: string }[] = [
  { value: 100, label: 'Yakın', description: 'Mağaza girişi / tezgah' },
  { value: 250, label: 'Orta', description: 'Bina ve yakın çevre' },
  { value: 500, label: 'Geniş', description: 'Kompleks / blok alanı' },
];
const RADIUS_VALUES = RADIUS_OPTIONS.map((r) => r.value);
const MAP_HEIGHT = 300;
const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

type Props = { route: RouteProp<TeamsStackParamList, 'ShiftLocationManagement'> };

export function ShiftLocationManagementScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const { team: teamFromParams } = route.params;
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

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
    return RADIUS_VALUES.includes(r) ? r : 100;
  });
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapOpenRegion, setMapOpenRegion] = useState<Region | null>(null);
  const [radiusSaving, setRadiusSaving] = useState(false);

  useEffect(() => {
    const r = team.store_radius ?? 100;
    setSelectedRadius(RADIUS_VALUES.includes(r) ? r : 100);
  }, [team.store_radius]);

  const isOwner = team.owner_id === user?.id;
  const hasLocation =
    team.store_latitude != null &&
    team.store_longitude != null &&
    team.store_radius != null;

  const openMapPicker = useCallback(() => {
    if (!isOwner) return;
    if (hasLocation && team.store_latitude != null && team.store_longitude != null) {
      setMapOpenRegion({
        latitude: team.store_latitude,
        longitude: team.store_longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } else {
      setMapOpenRegion(ISTANBUL_REGION);
    }
    setMapVisible(true);
  }, [isOwner, hasLocation, team.store_latitude, team.store_longitude]);

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

  const markerCoord =
    pickedCoord ??
    (hasLocation
      ? { lat: team.store_latitude!, lng: team.store_longitude! }
      : null);

  const handleMapPress = (event: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
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
        themedAlert('Konum alınamadı', 'Lütfen konum iznini verin ve tekrar deneyin.');
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
      themedAlert(
        'Kaydedildi',
        `Vardiya giriş konumu güncellendi. Çalışanlar bu noktaya ${selectedRadius} m içinde vardiya başlatabilir.`
      );
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Konum kaydedilemedi.');
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
      themedAlert(
        'Kaydedildi',
        `Vardiya giriş konumu haritadan seçilen nokta olarak güncellendi. Çalışanlar bu noktaya ${selectedRadius} m içinde vardiya başlatabilir.`
      );
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Konum kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const canSavePicked = isOwner && pickedCoord !== null;

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
        themedAlert('Hata', e instanceof Error ? e.message : 'Yarıçap güncellenemedi.');
      } finally {
        setRadiusSaving(false);
      }
    },
    [user, isOwner, hasLocation, team.id, team.store_latitude, team.store_longitude, queryClient]
  );

  const effectiveRadius = isOwner ? selectedRadius : team.store_radius ?? 100;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabScrollBottomPad + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backPill, pressed && styles.backPillPressed]}
            hitSlop={8}
            accessibilityLabel="Geri"
          >
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={styles.backPillText}>Geri</Text>
          </Pressable>
          <Text style={styles.heroEyebrow}>Vardiya konum yönetimi</Text>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {team.name}
          </Text>
          <View
            style={[
              styles.heroStatusRow,
              hasLocation ? styles.heroStatusRowOn : styles.heroStatusRowOff,
            ]}
          >
            <View
              style={[
                styles.heroStatusDot,
                hasLocation ? styles.heroStatusDotOn : styles.heroStatusDotOff,
              ]}
            />
            <Text
              style={[
                styles.heroStatusText,
                hasLocation ? styles.heroStatusTextOn : styles.heroStatusTextOff,
              ]}
            >
              {hasLocation ? 'Konum kayıtlı' : 'Konum tanımsız'}
            </Text>
            {hasLocation && (
              <>
                <View style={styles.heroStatusDivider} />
                <Ionicons name="resize-outline" size={13} color={colors.accent} />
                <Text style={styles.heroStatusElapsed}>
                  {team.store_radius ?? 100} m
                </Text>
              </>
            )}
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Kayıtlı konum paneli */}
          {hasLocation && (
            <View style={styles.panel}>
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.panelBody}>
                <View style={styles.panelHeaderRow}>
                  <View style={styles.panelIconWrap}>
                    <Ionicons name="pin-outline" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.panelTitle}>Kayıtlı konum</Text>
                  <View style={styles.okBadge}>
                    <View style={styles.okBadgeDot} />
                    <Text style={styles.okBadgeText}>Aktif</Text>
                  </View>
                </View>

                <View style={styles.coordCard}>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Enlem</Text>
                    <Text style={styles.coordValue}>
                      {team.store_latitude!.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.coordDivider} />
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Boylam</Text>
                    <Text style={styles.coordValue}>
                      {team.store_longitude!.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.coordDivider} />
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Yarıçap</Text>
                    <Text style={[styles.coordValue, styles.coordValueAccent]}>
                      {effectiveRadius} m
                      {radiusSaving ? '…' : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Konum ayarlama paneli — sadece owner */}
          {isOwner && (
            <View style={styles.panel}>
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.panelBody}>
                <View style={styles.panelHeaderRow}>
                  <View style={styles.panelIconWrap}>
                    <Ionicons name="location-outline" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.panelTitle}>Konumu ayarla</Text>
                </View>
                <Text style={styles.panelDescription}>
                  Çalışanlar yalnızca bu noktaya belirlediğiniz mesafe içindeyken vardiya
                  başlatabilir. Haritadan dokunarak seçebilir veya şu anki konumunuzu
                  kullanabilirsiniz.
                </Text>

                {Platform.OS !== 'web' && (
                  <View style={styles.actionsStack}>
                    <Pressable
                      onPress={openMapPicker}
                      style={({ pressed }) => [
                        styles.ctaStartWrap,
                        pressed && styles.ctaPressed,
                      ]}
                    >
                      <LinearGradient
                        colors={[colors.accentHover, colors.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ctaStart}
                      >
                        <Ionicons name="map-outline" size={20} color={colors.black} />
                        <Text style={styles.ctaStartText}>Konumu haritadan seç</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={handleUseCurrentLocation}
                      disabled={locationLoading || saving}
                      style={({ pressed }) => [
                        styles.ctaOutlined,
                        pressed && !(locationLoading || saving) && styles.ctaPressed,
                        (locationLoading || saving) && styles.ctaDisabled,
                      ]}
                    >
                      {locationLoading || saving ? (
                        <Text style={styles.ctaOutlinedText}>İşleniyor…</Text>
                      ) : (
                        <>
                          <Ionicons name="locate-outline" size={20} color={colors.accent} />
                          <Text style={styles.ctaOutlinedText}>
                            Mevcut konumumu kullan
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}

                {Platform.OS === 'web' && (
                  <Pressable
                    onPress={handleUseCurrentLocation}
                    disabled={locationLoading || saving}
                    style={({ pressed }) => [
                      styles.ctaStartWrap,
                      pressed && !(locationLoading || saving) && styles.ctaPressed,
                      (locationLoading || saving) && styles.ctaDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={[colors.accentHover, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.ctaStart}
                    >
                      <Ionicons name="locate-outline" size={20} color={colors.black} />
                      <Text style={styles.ctaStartText}>
                        {locationLoading || saving ? 'İşleniyor…' : 'Mevcut konumumu kullan'}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                )}

                {locationError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="warning-outline" size={14} color={colors.error} />
                    <Text style={styles.errorText}>{locationError}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Harita paneli */}
          {isOwner && Platform.OS !== 'web' && mapVisible && (
            <View style={styles.panel}>
              <View style={styles.panelGoldCap} />
              <View style={styles.panelBody}>
                <View style={styles.mapHeader}>
                  <View style={styles.mapHintWrap}>
                    <Ionicons name="hand-left-outline" size={14} color={colors.accent} />
                    <Text style={styles.mapHint}>
                      Bir noktaya dokunun, ardından kaydet butonuna basın
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setMapVisible(false);
                      setMapOpenRegion(null);
                      setPickedCoord(null);
                    }}
                    style={({ pressed }) => [styles.mapCloseBtn, pressed && { opacity: 0.7 }]}
                    hitSlop={8}
                    accessibilityLabel="Haritayı kapat"
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.mapShell}>
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
                </View>
                {canSavePicked && pickedCoord && (
                  <View style={styles.pickedPreview}>
                    <View style={styles.pickedPreviewLeft}>
                      <Ionicons name="pin" size={14} color={colors.accent} />
                      <Text style={styles.pickedPreviewText} numberOfLines={1}>
                        {pickedCoord.lat.toFixed(6)}, {pickedCoord.lng.toFixed(6)}
                      </Text>
                    </View>
                    <View style={styles.radiusChipMini}>
                      <Text style={styles.radiusChipMiniText}>{selectedRadius} m</Text>
                    </View>
                  </View>
                )}
                {canSavePicked && (
                  <Pressable
                    onPress={handleSavePickedLocation}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.ctaStartWrap,
                      { marginTop: spacing.sm },
                      pressed && !saving && styles.ctaPressed,
                      saving && styles.ctaDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={[colors.accentHover, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.ctaStart}
                    >
                      {saving ? (
                        <Text style={styles.ctaStartText}>Kaydediliyor…</Text>
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={20}
                            color={colors.black}
                          />
                          <Text style={styles.ctaStartText}>
                            Seçilen konumu kaydet
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Yarıçap paneli — sadece owner */}
          {isOwner && (
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
                    <Ionicons name="resize-outline" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.panelTitle}>Yarıçap</Text>
                  {radiusSaving && (
                    <Text style={styles.radiusSavingText}>kaydediliyor…</Text>
                  )}
                </View>
                <Text style={styles.panelDescription}>
                  Vardiya girişine izin verilecek maksimum mesafe.
                </Text>
                <View style={styles.radiusGrid}>
                  {RADIUS_OPTIONS.map((r) => {
                    const selected = selectedRadius === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        onPress={() => handleRadiusSelect(r.value)}
                        disabled={radiusSaving}
                        style={({ pressed }) => [
                          styles.radiusCard,
                          selected && styles.radiusCardSelected,
                          pressed && !radiusSaving && styles.ctaPressed,
                          radiusSaving && styles.ctaDisabled,
                        ]}
                      >
                        {selected && (
                          <LinearGradient
                            colors={[
                              'rgba(212, 175, 55, 0.18)',
                              'rgba(212, 175, 55, 0.04)',
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                        )}
                        <View style={styles.radiusCardTop}>
                          <Text
                            style={[
                              styles.radiusCardLabel,
                              selected && styles.radiusCardLabelSelected,
                            ]}
                          >
                            {r.label}
                          </Text>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.radiusCardValue,
                            selected && styles.radiusCardValueSelected,
                          ]}
                        >
                          {r.value}
                          <Text style={styles.radiusCardUnit}> m</Text>
                        </Text>
                        <Text style={styles.radiusCardDescription} numberOfLines={2}>
                          {r.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Owner olmayan, konum yoksa yetki bilgisi */}
          {!hasLocation && !isOwner && (
            <View style={styles.panel}>
              <View style={styles.panelGoldCap} />
              <View style={styles.panelBody}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="lock-closed-outline" size={24} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Konum tanımlı değil</Text>
                <Text style={styles.emptyMessage}>
                  Bu takım için henüz vardiya konumu belirlenmemiş. Yalnızca takım sahibi
                  konum ekleyebilir.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
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

  // BODY
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  // Panel
  panel: {
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

  // Kayıtlı konum
  okBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(45, 106, 79, 0.16)',
    borderColor: 'rgba(45, 106, 79, 0.55)',
  },
  okBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  okBadgeText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: '#9FE7BA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  coordItem: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coordLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  coordValue: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  coordValueAccent: {
    color: colors.accent,
  },

  // Actions
  actionsStack: {
    gap: spacing.sm,
  },
  ctaStartWrap: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  ctaStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  ctaStartText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.black,
    letterSpacing: 0.2,
  },
  ctaOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.55)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  ctaOutlinedText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  ctaPressed: { opacity: 0.88 },
  ctaDisabled: { opacity: 0.5 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239, 68, 68, 0.40)',
  },
  errorText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.error,
    flex: 1,
  },

  // Harita
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mapHintWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    flex: 1,
  },
  mapCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mapShell: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  map: { width: '100%' },
  pickedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.30)',
  },
  pickedPreviewLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickedPreviewText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  radiusChipMini: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.40)',
  },
  radiusChipMiniText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.3,
  },

  // Yarıçap
  radiusSavingText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  radiusGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  radiusCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  radiusCardSelected: {
    borderColor: 'rgba(212, 175, 55, 0.55)',
  },
  radiusCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  radiusCardLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  radiusCardLabelSelected: {
    color: colors.accent,
  },
  radiusCardValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  radiusCardValueSelected: {
    color: colors.accent,
  },
  radiusCardUnit: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    letterSpacing: 0,
  },
  radiusCardDescription: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 15,
  },

  // Empty / no permission
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
});
