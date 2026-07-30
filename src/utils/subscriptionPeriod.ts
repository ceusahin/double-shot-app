/** Takvim günü ekler (deneme süresi bitişi için). */
export function addCalendarDays(startedAt: Date, days: number): Date {
  const d = new Date(startedAt.getTime());
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Abonelik bitiş tarihini hesaplar (takvim ayı; ay sonu taşmaları güvenli). */
export function subscriptionPeriodEnd(startedAt: Date, billingMonths: number): Date {
  const d = new Date(startedAt.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + billingMonths);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Bitişe kalan gün sayısı (tam gün, yukarı yuvarlanır). Süre dolmuşsa negatif. */
export function subscriptionDaysRemaining(subscriptionEndsAtIso: string | null | undefined): number | null {
  if (!subscriptionEndsAtIso) return null;
  const end = new Date(subscriptionEndsAtIso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

function pad2(n: number): string {
  return Math.max(0, n).toString().padStart(2, '0');
}

/**
 * Paket bitiş ISO zamanına göre liste/özet metni.
 * Geçersiz veya yoksa null; dolmuşsa "Süre doldu"; aksi halde "5 g 12:30:45" gibi.
 */
export function formatRemainingUntilEnd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const endMs = new Date(iso).getTime();
  if (Number.isNaN(endMs)) return null;
  const diffMs = endMs - Date.now();
  if (diffMs <= 0) return 'Süre doldu';
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const clock = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  if (days > 0) return `${days} g ${clock}`;
  return clock;
}
