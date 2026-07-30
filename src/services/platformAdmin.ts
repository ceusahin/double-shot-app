import { supabase } from './supabase';
import type { UserProfile, QuotaGrantKind, Team } from '../types';

export type { QuotaGrantKind };

export function isPlatformStaff(user: UserProfile | null | undefined): boolean {
  return !!(user?.is_super_admin || user?.is_platform_admin);
}

/** Takım oluşturma: kalan kota (türler toplamı) > 0 veya platform/süper yönetici. */
export function canUserCreateTeam(
  user: UserProfile | null | undefined,
  _ownedTeamCount: number
): boolean {
  if (!user) return false;
  if (user.is_super_admin || user.is_platform_admin) return true;
  return sumQuotaBalances(user) > 0;
}

export function getQuotaBalance(profile: UserProfile | null | undefined, kind: QuotaGrantKind): number {
  const b = profile?.quota_balances;
  if (!b || typeof b !== 'object') return 0;
  const v = (b as Record<string, unknown>)[kind];
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, Math.floor(v));
  if (typeof v === 'string') return Math.max(0, parseInt(v, 10) || 0);
  return 0;
}

export function sumQuotaBalances(profile: UserProfile | null | undefined): number {
  const kinds: QuotaGrantKind[] = ['trial_15d', 'months_1', 'months_3', 'months_6'];
  return kinds.reduce((s, k) => s + getQuotaBalance(profile, k), 0);
}

/** Süper yöneticinin süre etiketiyle verdiği +1 kota kayıtları. */
export type UserQuotaGrantRow = {
  id: string;
  user_id: string;
  kind: QuotaGrantKind;
  granted_at: string;
  granted_by: string | null;
};

/** Süper yönetici: kullanıcının sahip olabileceği max ekip sayısı (0–999). */
export async function superAdminSetMaxOwnedTeams(userId: string, maxTeams: number): Promise<void> {
  const { error } = await supabase.rpc('super_admin_set_max_owned_teams', {
    p_user_id: userId,
    p_max: maxTeams,
  });
  if (error) throw new Error(error.message ?? 'Kota güncellenemedi');
}

/** Süper yönetici: max_owned_teams +1 ve süre etiketi (audit). */
export async function superAdminGrantOwnedTeamQuota(userId: string, kind: QuotaGrantKind): Promise<void> {
  const { error } = await supabase.rpc('super_admin_grant_owned_team_quota', {
    p_user_id: userId,
    p_kind: kind,
  });
  if (error) throw new Error(error.message ?? 'Kota tanımlanamadı');
}

/** Süper yönetici: seçilen türden 1 kota düşürür. */
export async function superAdminRevokeOwnedTeamQuota(userId: string, kind: QuotaGrantKind): Promise<void> {
  const { error } = await supabase.rpc('super_admin_revoke_owned_team_quota', {
    p_user_id: userId,
    p_kind: kind,
  });
  if (error) throw new Error(error.message ?? 'Kota düşürülemedi');
}

export function quotaGrantKindLabelTr(kind: QuotaGrantKind): string {
  switch (kind) {
    case 'trial_15d':
      return '15 günlük deneme';
    case 'months_1':
      return '1 aylık';
    case 'months_3':
      return '3 aylık';
    case 'months_6':
      return '6 aylık';
    default:
      return kind;
  }
}

export async function listUserQuotaGrants(userId: string): Promise<UserQuotaGrantRow[]> {
  const { data, error } = await supabase
    .from('user_quota_grants')
    .select('id, user_id, kind, granted_at, granted_by')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false });
  if (error) throw new Error(error.message ?? 'Kota geçmişi alınamadı');
  return (data ?? []) as UserQuotaGrantRow[];
}

/** Süper yönetici: ekibin subscription_ends_at tarihini +/- saat ekler. Yeni bitiş tarihini döner. */
export async function superAdminExtendTeamSubscription(
  teamId: string,
  hours: number
): Promise<string> {
  if (!Number.isFinite(hours) || Math.trunc(hours) !== hours) {
    throw new Error('Saat tam sayı olmalı');
  }
  if (hours === 0) {
    throw new Error("Saat değeri 0'dan farklı olmalı");
  }
  const { data, error } = await supabase.rpc('super_admin_extend_team_subscription', {
    p_team_id: teamId,
    p_hours: hours,
  });
  if (error) throw new Error(error.message ?? 'Süre uzatılamadı');
  return String(data);
}

/** Bir kullanıcının sahip olduğu ekipler (süper yönetici görünümü için tüm kolonlarla). */
export async function listTeamsOwnedByUser(userId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message ?? 'Ekipler alınamadı');
  return (data ?? []) as Team[];
}

/** owner_id bazlı ekip sayımı (yönetim listesi). */
export async function countOwnedTeamsByUserIds(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of userIds) map.set(id, 0);
  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const slice = userIds.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    const { data, error } = await supabase.from('teams').select('owner_id').in('owner_id', slice);
    if (error) throw new Error(error.message ?? 'Ekip sayımı alınamadı');
    for (const row of data ?? []) {
      const oid = row.owner_id as string;
      map.set(oid, (map.get(oid) ?? 0) + 1);
    }
  }
  return map;
}

/** Platform personeli: kayıtlı tüm kullanıcılar (RLS). */
export async function listAllUsersForPlatformStaff(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message ?? 'Liste alınamadı');
  return (data ?? []) as UserProfile[];
}

/** Her kullanıcı için kaç ekipte üyelik olduğu (team_members). */
export async function countTeamMembershipsByUserIds(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const slice = userIds.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    const { data, error } = await supabase.from('team_members').select('user_id').in('user_id', slice);
    if (error) throw new Error(error.message ?? 'Üyelik sayısı alınamadı');
    for (const row of data ?? []) {
      const id = row.user_id as string;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
  }
  return map;
}

/** Yönetim ekranında listelenen hesaplar (süper veya platform yöneticisi). */
export async function listPlatformStaffUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or('is_super_admin.eq.true,is_platform_admin.eq.true')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message ?? 'Liste alınamadı');
  return (data ?? []) as UserProfile[];
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const { data, error } = await supabase.from('users').select('*').eq('email', trimmed).maybeSingle();
  if (error) throw new Error(error.message ?? 'Arama başarısız');
  return data as UserProfile | null;
}

export async function promoteToPlatformAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('promote_user_to_platform_admin', { p_user_id: userId });
  if (error) throw new Error(error.message ?? 'Atama yapılamadı');
}

export async function revokePlatformAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_platform_admin', { p_user_id: userId });
  if (error) throw new Error(error.message ?? 'Yetki kaldırılamadı');
}
