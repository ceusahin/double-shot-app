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

  /** Tam konum al (vardiya başlatırken kullan). */
  const requestPermissionAndGetLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Konum izni verilmedi.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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
