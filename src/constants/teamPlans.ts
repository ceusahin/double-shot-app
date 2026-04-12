/** Ekip oluşturma / abonelik planları — fiyatlar KDV dahil (TL). */

export type TeamPlanId = 'eco' | 'growth' | 'scale';

export type BillingMonths = 1 | 3 | 6;

export const EXTRA_SEAT_MONTHLY_TRY = 1000;

export interface TeamPlan {
  id: TeamPlanId;
  name: string;
  tagline: string;
  includedSeats: number;
  /** Aylık taban (KDV dahil) */
  monthlyPriceTry: number;
  highlights: string[];
}

export const TEAM_PLANS: TeamPlan[] = [
  {
    id: 'eco',
    name: 'Ekibio Eco Paket',
    tagline: 'Butik kafeler ve küçük ekipler',
    includedSeats: 5,
    monthlyPriceTry: 10_000,
    highlights: ['Temel ekip yönetimi', 'Davet linkleri', 'Vardiya ve operasyon'],
  },
  {
    id: 'growth',
    name: 'Ekibio Growth',
    tagline: 'Büyüyen ekipler, daha fazla kapasite',
    includedSeats: 15,
    monthlyPriceTry: 24_000,
    highlights: ['Eco’daki her şey', 'Daha geniş çalışan kotası', 'Ölçeklenebilir yapı'],
  },
  {
    id: 'scale',
    name: 'Ekibio Scale',
    tagline: 'Yoğun operasyon ve çok sayıda çalışan',
    includedSeats: 40,
    monthlyPriceTry: 38_000,
    highlights: ['Growth’taki her şey', 'Yüksek üye limiti', 'Kurumsal ölçek'],
  },
];

export function getTeamPlan(id: TeamPlanId): TeamPlan | undefined {
  return TEAM_PLANS.find((p) => p.id === id);
}

/** 3 ay / 6 ay peşin: Eco ile aynı indirim oranı (25/30 ve 50/60). */
export function prepaidTotalTry(monthlyPriceTry: number, months: 3 | 6): number {
  if (months === 3) return Math.round((monthlyPriceTry * 3 * 25) / 30);
  return Math.round((monthlyPriceTry * 6 * 50) / 60);
}

export function formatTry(amount: number): string {
  return `${new Intl.NumberFormat('tr-TR').format(amount)} ₺`;
}

export function billingLabel(months: BillingMonths): string {
  if (months === 1) return 'Aylık';
  if (months === 3) return '3 ay (peşin)';
  return '6 ay (peşin)';
}

export function priceForBilling(plan: TeamPlan, months: BillingMonths): number {
  if (months === 1) return plan.monthlyPriceTry;
  return prepaidTotalTry(plan.monthlyPriceTry, months);
}
