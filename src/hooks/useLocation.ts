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
    distanceToStore,
    isWithinRadius,
  };
}
