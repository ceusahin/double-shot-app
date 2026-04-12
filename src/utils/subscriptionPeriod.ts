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
