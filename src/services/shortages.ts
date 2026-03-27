import { supabase } from './supabase';

export interface ShortageArea {
  id: string;
  team_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface ShortageItem {
  id: string;
  team_id: string;
  area: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface ShortageFulfilledItem {
  id: string;
  team_id: string;
  area: string;
  name: string;
  fulfilled_by: string;
  fulfilled_at: string;
}

export async function listShortages(
  teamId: string,
  area: string
): Promise<ShortageItem[]> {
  const { data, error } = await supabase
    .from('shortages')
    .select('*')
    .eq('team_id', teamId)
    .eq('area', area)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message ?? 'Eksik listesi yüklenemedi');
  }

  return (data ?? []) as ShortageItem[];
}

export async function listShortagesFulfilled(
  teamId: string,
  area: string
): Promise<ShortageFulfilledItem[]> {
  const { data, error } = await supabase
    .from('shortage_fulfilled')
    .select('*')
    .eq('team_id', teamId)
    .eq('area', area)
    .order('fulfilled_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message ?? 'Alınanlar listesi yüklenemedi');
  }

  return (data ?? []) as ShortageFulfilledItem[];
}

export async function addShortage(
  teamId: string,
  area: string,
  name: string,
  userId: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase.from('shortages').insert({
    team_id: teamId,
    area,
    name: trimmed,
    created_by: userId,
  });
  if (error) {
    throw new Error(error.message ?? 'Eksik eklenemedi');
  }
}

export async function fulfillShortage(
  shortageId: string,
  teamId: string,
  area: string,
  name: string,
  userId: string
): Promise<void> {
  const { error: insertError } = await supabase.from('shortage_fulfilled').insert({
    team_id: teamId,
    area,
    name,
    fulfilled_by: userId,
  });
  if (insertError) {
    throw new Error(insertError.message ?? 'Eksik alınamadı');
  }

  const { error: deleteError } = await supabase
    .from('shortages')
    .delete()
    .eq('id', shortageId)
    .eq('team_id', teamId);
  if (deleteError) {
    throw new Error(deleteError.message ?? 'Eksik listeden kaldırılamadı');
  }

  // Maksimum 30 kayıt tutulur; fazlasını (en eski) sil.
  const { data: latest, error: listError } = await supabase
    .from('shortage_fulfilled')
    .select('id, fulfilled_at')
    .eq('team_id', teamId)
    .eq('area', area)
    .order('fulfilled_at', { ascending: false });

  if (listError || !latest || latest.length <= 30) {
    return;
  }

  const idsToKeep = latest.slice(0, 30).map((x) => x.id as string);
  const idsToDelete = latest.slice(30).map((x) => x.id as string);
  if (!idsToDelete.length) return;

  await supabase
    .from('shortage_fulfilled')
    .delete()
    .eq('team_id', teamId)
    .eq('area', area)
    .not('id', 'in', `(${idsToKeep.join(',')})`);
}

export async function listShortageAreas(teamId: string): Promise<ShortageArea[]> {
  const { data, error } = await supabase
    .from('shortage_areas')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message ?? 'Alanlar yüklenemedi');
  }

  return (data ?? []) as ShortageArea[];
}

export async function addShortageArea(teamId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const { data: existing, error: listError } = await supabase
    .from('shortage_areas')
    .select('sort_order')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (listError) {
    throw new Error(listError.message ?? 'Alan eklenemedi');
  }

  const nextSort =
    existing && existing.length > 0 ? ((existing[0] as any).sort_order as number) + 1 : 0;

  const { error } = await supabase.from('shortage_areas').insert({
    team_id: teamId,
    name: trimmed,
    sort_order: nextSort,
  });

  if (error) {
    throw new Error(error.message ?? 'Alan eklenemedi');
  }
}

export async function updateShortageAreaName(
  areaId: string,
  teamId: string,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase
    .from('shortage_areas')
    .update({ name: trimmed })
    .eq('id', areaId)
    .eq('team_id', teamId);
  if (error) {
    throw new Error(error.message ?? 'Alan güncellenemedi');
  }
}

export async function deleteShortageArea(areaId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('shortage_areas')
    .delete()
    .eq('id', areaId)
    .eq('team_id', teamId);
  if (error) {
    throw new Error(error.message ?? 'Alan silinemedi');
  }
}

