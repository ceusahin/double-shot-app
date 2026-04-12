import { supabase } from './supabase';
import { getBusinessDayUtcOrdinal } from '../utils/businessDay';

export interface Tip {
  id: string;
  body: string;
  created_at: string;
}

export async function getTipsPool(limit = 500): Promise<Tip[]> {
  const { data, error } = await supabase
    .from('tips')
    .select('id, body, created_at')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Tip[];
}

export async function getLatestTip(refreshOffset = 0): Promise<Tip | null> {
  const tips = await getTipsPool(500);
  if (tips.length === 0) return null;

  // Gunluk stabil secim + manuel yenileme icin offset.
  const dayNumber = getBusinessDayUtcOrdinal(new Date());
  const index = (dayNumber + Math.max(0, refreshOffset)) % tips.length;
  return tips[index] ?? tips[0] ?? null;
}
