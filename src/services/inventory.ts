import { supabase } from './supabase';
import type { TeamInventoryCategory, TeamInventoryItem } from '../types';
import { createTeamNotification } from './notifications';
import { sendExpoPush } from './pushNotifications';

const LOW_STOCK_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 saat

type UpsertInventoryPayload = {
  categoryId: string;
  name: string;
  unit?: string | null;
  currentQty: number;
  notes?: string | null;
};

function normalizeText(value?: string | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

type InventoryRow = Omit<TeamInventoryItem, 'category'> & {
  inventory_categories?: TeamInventoryCategory | null;
};

export async function listInventoryCategories(teamId: string): Promise<TeamInventoryCategory[]> {
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message ?? 'Kategori listesi alınamadı.');
  }

  return (data ?? []) as TeamInventoryCategory[];
}

export async function addInventoryCategory(teamId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Kategori adı boş olamaz.');

  const { data: last, error: sortErr } = await supabase
    .from('inventory_categories')
    .select('sort_order')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (sortErr) throw new Error(sortErr.message ?? 'Kategori eklenemedi.');

  const nextSort = (last?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase.from('inventory_categories').insert({
    team_id: teamId,
    name: trimmed,
    min_alert_qty: 0,
    sort_order: nextSort,
  });
  if (error) throw new Error(error.message ?? 'Kategori eklenemedi.');
}

export async function updateInventoryCategory(
  categoryId: string,
  teamId: string,
  name: string,
  minAlertQty: number
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Kategori adı boş olamaz.');
  const safeMin = Math.max(0, minAlertQty);
  const { error } = await supabase
    .from('inventory_categories')
    .update({ name: trimmed, min_alert_qty: safeMin })
    .eq('id', categoryId)
    .eq('team_id', teamId);
  if (error) throw new Error(error.message ?? 'Kategori güncellenemedi.');
}

export async function deleteInventoryCategory(categoryId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_categories')
    .delete()
    .eq('id', categoryId)
    .eq('team_id', teamId);
  if (error) throw new Error(error.message ?? 'Kategori silinemedi.');
}

export async function listTeamInventory(teamId: string): Promise<TeamInventoryItem[]> {
  const { data, error } = await supabase
    .from('team_inventory_items')
    .select(`
      *,
      inventory_categories (
        id,
        team_id,
        name,
        min_alert_qty,
        sort_order,
        created_at
      )
    `)
    .eq('team_id', teamId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message ?? 'Depo stok verileri alınamadı.');
  }

  return ((data ?? []) as InventoryRow[]).map((row) => ({
    ...row,
    category: row.inventory_categories ?? null,
  }));
}

export async function addInventoryItem(
  teamId: string,
  userId: string,
  payload: UpsertInventoryPayload
): Promise<void> {
  const name = payload.name.trim();
  if (!name) throw new Error('Ürün adı boş olamaz.');

  const { error } = await supabase.from('team_inventory_items').insert({
    team_id: teamId,
    category_id: payload.categoryId,
    name,
    unit: normalizeText(payload.unit) ?? 'adet',
    current_qty: payload.currentQty,
    notes: normalizeText(payload.notes),
    created_by: userId,
  });

  if (error) {
    throw new Error(error.message ?? 'Stok kalemi eklenemedi.');
  }
}

export async function updateInventoryItem(
  itemId: string,
  teamId: string,
  payload: UpsertInventoryPayload
): Promise<void> {
  const name = payload.name.trim();
  if (!name) throw new Error('Ürün adı boş olamaz.');

  const { error } = await supabase
    .from('team_inventory_items')
    .update({
      category_id: payload.categoryId,
      name,
      unit: normalizeText(payload.unit) ?? 'adet',
      current_qty: payload.currentQty,
      notes: normalizeText(payload.notes),
    })
    .eq('id', itemId)
    .eq('team_id', teamId);

  if (error) {
    throw new Error(error.message ?? 'Stok kalemi güncellenemedi.');
  }
}

export async function adjustInventoryQuantity(
  itemId: string,
  teamId: string,
  nextQty: number
): Promise<void> {
  const safeQty = Math.max(0, nextQty);
  const { error } = await supabase
    .from('team_inventory_items')
    .update({ current_qty: safeQty })
    .eq('id', itemId)
    .eq('team_id', teamId);

  if (error) {
    throw new Error(error.message ?? 'Stok miktarı güncellenemedi.');
  }
}

export async function adjustInventoryQuantityAndNotify(
  item: TeamInventoryItem,
  teamId: string,
  nextQty: number,
  teamName: string,
  ownerUserId: string
): Promise<void> {
  const safeQty = Math.max(0, nextQty);
  await adjustInventoryQuantity(item.id, teamId, safeQty);

  const threshold = item.category?.min_alert_qty ?? 0;
  const crossedDown = item.current_qty > threshold && safeQty <= threshold;
  if (!crossedDown) return;

  const notificationType = `inventory_low_stock:${item.id}`;
  const cooldownStartIso = new Date(Date.now() - LOW_STOCK_ALERT_COOLDOWN_MS).toISOString();
  const { data: recentAlerts, error: recentAlertError } = await supabase
    .from('notifications')
    .select('id')
    .eq('team_id', teamId)
    .eq('target_user_id', ownerUserId)
    .eq('type', notificationType)
    .gte('created_at', cooldownStartIso)
    .limit(1);
  if (recentAlertError) {
    throw new Error(recentAlertError.message ?? 'Bildirim cooldown kontrolü yapılamadı.');
  }
  if ((recentAlerts?.length ?? 0) > 0) return;

  const title = 'Depo stok uyarısı';
  const message = `${item.name} stoğu ${safeQty} ${item.unit} seviyesine düştü.`;
  try {
    await createTeamNotification(teamId, notificationType, title, message, ownerUserId);

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', ownerUserId);

    const uniqueTokens = Array.from(
      new Set((tokens ?? []).map((t: { token?: string }) => t.token ?? '').filter(Boolean))
    );
    await Promise.allSettled(uniqueTokens.map((token) => sendExpoPush(token, `${teamName} · Depo`, message)));
  } catch (error) {
    // Stok guncelleme ana islem; bildirim hatasi UX'i kesmemeli.
    console.warn('Low stock notification failed', error);
  }
}

export async function deleteInventoryItem(itemId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('team_inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('team_id', teamId);

  if (error) {
    throw new Error(error.message ?? 'Stok kalemi silinemedi.');
  }
}
