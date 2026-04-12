import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * İş günü sabah 6'da başlar: 00:00–05:59 arası hâlâ önceki takvim gününün iş günü sayılır.
 */
export const BUSINESS_DAY_START_HOUR = 6;

/** İş gününün bağlı olduğu takvim günü (yerel, gece yarısı normalleştirilmiş). */
export function getBusinessDateAnchor(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (now.getHours() < BUSINESS_DAY_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/** Yerel YYYY-MM-DD — operasyon logları ve API ile uyum için. */
export function getBusinessDateKey(now: Date = new Date()): string {
  const a = getBusinessDateAnchor(now);
  const y = a.getFullYear();
  const m = String(a.getMonth() + 1).padStart(2, '0');
  const day = String(a.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Haftalık planda bir sütun = bir takvim günü. Gece yarısı tarihinde `getBusinessDateKey`
 * yanlış önceki güne kaymasın diye öğlen referansı kullanılır.
 */
export function getCalendarColumnBusinessKey(calendarDay: Date): string {
  const noon = new Date(
    calendarDay.getFullYear(),
    calendarDay.getMonth(),
    calendarDay.getDate(),
    12,
    0,
    0,
    0
  );
  return getBusinessDateKey(noon);
}

/** Olay zamanının (vardiya başı, giriş saati vb.) ait olduğu iş günü anahtarı. */
export function getTimestampBusinessDateKey(isoOrDate: string | Date): string {
  const t = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return getBusinessDateKey(t);
}

/** Pazartesi = 0 … Pazar = 6 (uygulama convention). */
export function getBusinessMondayFirstDayIndex(now: Date = new Date()): number {
  const a = getBusinessDateAnchor(now);
  const js = a.getDay();
  return js === 0 ? 6 : js - 1;
}

/**
 * Takvimden seçilen gün için iş günü sorgularında kullanılacak referans (öğlen 12:00 yerel).
 * Gece yarısı seçiminde `getBusinessDateKey` kayması olmaz.
 */
export function toBusinessQueryReference(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
}

export function getBusinessDayStart(now: Date = new Date()): Date {
  const anchor = getBusinessDateAnchor(now);
  const s = new Date(anchor);
  s.setHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
  return s;
}

export function getNextBusinessDayStart(now: Date = new Date()): Date {
  const s = getBusinessDayStart(now);
  const n = new Date(s);
  n.setDate(n.getDate() + 1);
  return n;
}

/** Günlük ipucu seçimi için stabil gün sayısı (iş günü takvim tarihine göre). */
export function getBusinessDayUtcOrdinal(now: Date = new Date()): number {
  const a = getBusinessDateAnchor(now);
  return Math.floor(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) / 86400000);
}

/** Seçili haftada “bugün” sütunu; yoksa -1. */
export function getBusinessTodayColumnIndex(weekDays: Date[], now: Date = new Date()): number {
  const k = getBusinessDateKey(now);
  return weekDays.findIndex((d) => getCalendarColumnBusinessKey(d) === k);
}

/** Ekran odaklanınca iş günü anahtarının güncellenmesi (gece 6’yı geçince). */
export function useBusinessDayClock() {
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );
  const snapshot = useMemo(() => new Date(), [tick]);
  return {
    tick,
    snapshot,
    businessDateKey: getBusinessDateKey(snapshot),
    businessDayOfWeekIndex: getBusinessMondayFirstDayIndex(snapshot),
    businessDayOrdinal: getBusinessDayUtcOrdinal(snapshot),
    businessDateAnchor: getBusinessDateAnchor(snapshot),
  };
}
