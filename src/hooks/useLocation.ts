import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { haversineDistance } from '../utils/haversine';

export function useLocation() {
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const LOCATION_TIMEOUT_MS = 12_000;

  /** Tam konum al (vardiya başlatırken kullan). Önce son bilinen konumu dene (hızlı), yoksa GPS ile al, en fazla 12 sn bekle. */
  const requestPermissionAndGetLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Konum izni verilmedi.');
        return null;
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          lat: lastKnown.coords.latitude,
          lng: lastKnown.coords.longitude,
        };
        setLocation(coords);
        const fresh = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), LOCATION_TIMEOUT_MS)
          ),
        ]).catch(() => null);
        if (fresh) {
          const updated = { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
          setLocation(updated);
          return updated;
        }
        return coords;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<Location.LocationObject>((_, reject) =>
          setTimeout(() => reject(new Error('Konum zaman aşımı. Açık alanda veya pencerenin yakınında tekrar deneyin.')), LOCATION_TIMEOUT_MS)
        ),
      ]);
      const coords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      setLocation(coords);
      return coords;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Konum alınamadı.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Ekran açılışında hızlı göstermek için: önce önbelleğe alınmış konumu kullan (anında),
   * ardından arka planda güncel konumu al ve güncelle. Tekrar girişte uzun bekletmez.
   */
  const loadLocationForDisplay = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Konum izni verilmedi.');
        setLoading(false);
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
        setLocation(coords);
        setLoading(false);
      }
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => {
          setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      if (!lastKnown) return;
    } catch {
      setLoading(false);
    }
  }, []);

  const distanceToStore = useCallback(
    (storeLat: number, storeLng: number): number | null => {
      if (!location) return null;
      return haversineDistance(
        location.lat,
        location.lng,
        storeLat,
        storeLng
      );
    },
    [location]
  );

  const isWithinRadius = useCallback(
    (storeLat: number, storeLng: number, radiusMeters: number): boolean => {
      const d = distanceToStore(storeLat, storeLng);
      return d !== null && d <= radiusMeters;
    },
    [distanceToStore]
  );

  return {
    location,
    error,
    loading,
    requestPermissionAndGetLocation,
    loadLocationForDisplay,
    distanceToStore,
    isWithinRadius,
  };
}
