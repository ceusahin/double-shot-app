import { supabase } from './supabase';
import { getProfile } from './auth';
import { canUserCreateTeam, isPlatformStaff, type QuotaGrantKind } from './platformAdmin';
import type { Team, TeamMember, TeamJoinRequest, UserProfile } from '../types';
import type { BillingMonths, TeamPlanId } from '../constants/teamPlans';
import { addCalendarDays, subscriptionPeriodEnd } from '../utils/subscriptionPeriod';

/** Paket satın alma veya deneme ile abonelik satırı. */
export type CreateTeamBilling =
  | { mode: 'plan'; planId: TeamPlanId; billingMonths: BillingMonths }
  | { mode: 'trial'; trialDays: number };

export const DEFAULT_TEAM_TRIAL_DAYS = 15;

export function consumptionKindFromBilling(billing: CreateTeamBilling | null | undefined): QuotaGrantKind | null {
  if (!billing) return null;
  if (billing.mode === 'trial') return 'trial_15d';
  const m = billing.billingMonths;
  if (m === 1) return 'months_1';
  if (m === 3) return 'months_3';
  return 'months_6';
}

/** @deprecated CreateTeamBilling kullanın */
export type CreateTeamSubscriptionPayload = {
  planId: TeamPlanId;
  billingMonths: BillingMonths;
};

/** Kullanıcının sahibi olduğu ekip sayısı (teams.owner_id). */
export async function countTeamsWhereOwner(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if (error) throw error;
  return count ?? 0;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createTeam(
  ownerId: string,
  name: string,
  storeLat?: number,
  storeLng?: number,
  storeRadius?: number,
  billing?: CreateTeamBilling | null
): Promise<Team> {
  const profile = await getProfile(ownerId);
  if (!profile) throw new Error('Profil bulunamadı.');
  const ownedCount = await countTeamsWhereOwner(ownerId);
  if (!canUserCreateTeam(profile, ownedCount)) {
    throw new Error(
      'Takım oluşturma kotanız yok. Süper yöneticinizden süre kotası vermesini isteyin.'
    );
  }

  const inviteCode = generateInviteCode();
  const startedAt = new Date();
  const insertRow: Record<string, unknown> = {
    name,
    owner_id: ownerId,
    invite_code: inviteCode,
    store_latitude: storeLat ?? null,
    store_longitude: storeLng ?? null,
    store_radius: storeRadius ?? null,
  };
  if (billing?.mode === 'plan') {
    const endsAt = subscriptionPeriodEnd(startedAt, billing.billingMonths);
    insertRow.subscription_plan = billing.planId;
    insertRow.subscription_billing_months = billing.billingMonths;
    insertRow.subscription_started_at = startedAt.toISOString();
    insertRow.subscription_ends_at = endsAt.toISOString();
  } else if (billing?.mode === 'trial') {
    const endsAt = addCalendarDays(startedAt, billing.trialDays);
    insertRow.subscription_plan = 'trial';
    insertRow.subscription_billing_months = null;
    insertRow.subscription_started_at = startedAt.toISOString();
    insertRow.subscription_ends_at = endsAt.toISOString();
  }

  const consumeKind = consumptionKindFromBilling(billing ?? null);
  if (isPlatformStaff(profile)) {
    insertRow.quota_consumed_kind = null;
  } else {
    if (!consumeKind) {
      throw new Error('Kota türü seçilmedi veya paket bilgisi eksik.');
    }
    insertRow.quota_consumed_kind = consumeKind;
  }

  const { data, error } = await supabase.from('teams').insert(insertRow).select().single();

  if (error) {
    const msg = error.message ?? error.details ?? JSON.stringify(error);
    throw new Error(msg);
  }

  const { error: memberError } = await supabase.from('team_members').insert({
    team_id: data.id,
    user_id: ownerId,
    role: 'MANAGER',
  });
  if (memberError) {
    const msg = memberError.message ?? memberError.details ?? JSON.stringify(memberError);
    throw new Error(msg);
  }

  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name, owner_id: ownerId })
      .select('id')
      .single();
    if (!orgError && org) {
      await supabase.from('teams').update({ organization_id: org.id }).eq('id', data.id);
      await supabase.from('stores').insert({
        organization_id: org.id,
        name,
        latitude: storeLat ?? null,
        longitude: storeLng ?? null,
        radius: storeRadius ?? null,
      });
      await supabase.from('members').insert({
        user_id: ownerId,
        organization_id: org.id,
        status: 'active',
      });
      return { ...data, organization_id: org.id } as Team;
    }
  } catch {
    // RBAC tables may not exist yet (migration 002 not run)
  }
  return data as Team;
}

/** Süreli davet linki oluştur (sadece ekip sahibi). Süre 1–10080 dakika (7 gün). */
export async function createTeamInviteLink(
  teamId: string,
  expiresInMinutes: number
): Promise<{ token: string; expires_at: string; link: string }> {
  if (expiresInMinutes < 1 || expiresInMinutes > 10080) {
    throw new Error('Süre 1 dakika ile 7 gün (10080 dk) arasında olmalıdır.');
  }
  const { data, error } = await supabase.rpc('create_team_invite_link', {
    p_team_id: teamId,
    p_expires_in_minutes: expiresInMinutes,
  });
  if (error) throw new Error(error.message ?? 'Link oluşturulamadı.');
  if (!data) throw new Error('Link oluşturulamadı.');
  return data as { token: string; expires_at: string; link: string };
}

/** Davet linki (token) ile ekibe katıl. */
export async function joinTeamByInviteToken(token: string): Promise<Team> {
  const t = token.trim();
  if (!t) throw new Error('Davet linki veya token girin.');
  const { data, error } = await supabase.rpc('join_team_by_invite_token', {
    p_token: t,
  });
  if (error) throw new Error(error.message ?? 'Geçersiz davet linki.');
  if (!data) throw new Error('Geçersiz davet linki.');
  return data as Team;
}

/** Davet linki ile ekibe direkt katılmak yerine yönetici onayına istek oluşturur. */
export async function requestJoinTeamByInviteToken(token: string): Promise<Team> {
  const t = token.trim();
  if (!t) throw new Error('Davet linki veya token girin.');
  const { data, error } = await supabase.rpc('request_join_team_by_invite_token', {
    p_token: t,
  });
  if (error) throw new Error(error.message ?? 'Katılma isteği gönderilemedi.');
  if (!data) throw new Error('Katılma isteği gönderilemedi.');
  return data as Team;
}

export async function getMyTeams(userId: string): Promise<(Team & { role: string })[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      role,
      teams (*)
    `)
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? [])
    .filter((row: { teams?: Team | null }) => row.teams != null)
    .map((row: { role: string; teams: Team }) => ({
      ...row.teams,
      role: row.role,
    })) as (Team & { role: string })[];
}

/** Platform yönetimi: uygulamadaki tüm ekipler (RLS: platform personeli). */
export async function getAllTeamsForPlatformStaff(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message ?? 'Ekipler yüklenemedi.');
  return (data ?? []) as Team[];
}

export async function listPendingJoinRequests(teamId?: string): Promise<TeamJoinRequest[]> {
  let query = supabase
    .from('team_join_requests')
    .select(`
      id,
      team_id,
      requester_user_id,
      requester_name,
      requester_surname,
      requester_email,
      requester_profile_photo,
      invite_token,
      status,
      created_at,
      resolved_at,
      resolved_by
    `)
    .eq('status', 'pending');

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(error.message ?? 'Katılma istekleri alınamadı.');
  const rows = (data ?? []) as TeamJoinRequest[];
  if (rows.length === 0) return [];

  const teamIds = [...new Set(rows.map((r) => r.team_id))];
  const requesterIds = [...new Set(rows.map((r) => r.requester_user_id))];

  const [{ data: teamsData }, { data: usersData }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, owner_id')
      .in('id', teamIds),
    supabase
      .from('users')
      .select('id, name, surname, email, profile_photo')
      .in('id', requesterIds),
  ]);

  const teamsById = new Map((teamsData ?? []).map((t: Record<string, unknown>) => [t.id as string, t]));
  const usersById = new Map((usersData ?? []).map((u: Record<string, unknown>) => [u.id as string, u]));

  return rows.map((r) => {
    const u = usersById.get(r.requester_user_id) as TeamJoinRequest['requester'] | undefined;
    const snapPhoto = typeof r.requester_profile_photo === 'string' ? r.requester_profile_photo.trim() : '';
    const dbPhoto = u?.profile_photo && String(u.profile_photo).trim();
    const profilePhoto = (dbPhoto || snapPhoto || null) as string | null;

    return {
      ...r,
      teams: teamsById.get(r.team_id) as TeamJoinRequest['teams'],
      requester: {
        id: r.requester_user_id,
        name: (u?.name?.trim() || r.requester_name?.trim() || '') as string,
        surname: (u?.surname?.trim() || r.requester_surname?.trim() || '') as string,
        email: (u?.email?.trim() || r.requester_email?.trim() || '') as string,
        profile_photo: profilePhoto,
      },
    };
  });
}

export async function getPendingJoinRequestsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('team_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw new Error(error.message ?? 'İstek sayısı alınamadı.');
  return count ?? 0;
}

/** Bu ekip için bekleyen katılma isteği sayısı (ekip detay badge). */
export async function getPendingJoinRequestsCountForTeam(teamId: string): Promise<number> {
  const { count, error } = await supabase
    .from('team_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('team_id', teamId);

  if (error) throw new Error(error.message ?? 'İstek sayısı alınamadı.');
  return count ?? 0;
}

export async function respondToJoinRequest(requestId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('resolve_team_join_request', {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw new Error(error.message ?? 'İstek güncellenemedi.');
}

/** Ekip adını güncelle (owner veya MANAGER). */
export async function updateTeamName(teamId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Ekip adı boş olamaz.');
  const { error } = await supabase
    .from('teams')
    .update({ name: trimmed })
    .eq('id', teamId);
  if (error) throw error;
}

/** Ekip sil: satır kalıcı silinir (owner veya MANAGER; FK CASCADE). */
export async function closeTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

/** Platform personeli: RPC ile kalıcı silme. */
export async function platformStaffCloseTeam(teamId: string): Promise<void> {
  const { error } = await supabase.rpc('platform_staff_close_team', { p_team_id: teamId });
  if (error) throw new Error(error.message ?? 'Ekip silinemedi.');
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      user:users(id, name, surname, email, profile_photo, created_at)
    `)
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((m: Record<string, unknown>) => {
    const u = m.user as Record<string, unknown> | null;
    return {
      id: m.id,
      team_id: m.team_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      user: u
        ? {
            id: u.id as string,
            name: (u.name as string) ?? '',
            surname: (u.surname as string) ?? '',
            email: (u.email as string) ?? '',
            profile_photo: (u.profile_photo as string | null) ?? null,
            created_at: (u.created_at as string) ?? '',
          }
        : undefined,
    };
  }) as TeamMember[];
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  // Üye çıkarılırken açık vardiya/mola oturumlarını kapat.
  const nowIso = new Date().toISOString();
  const { error: shiftLogError } = await supabase
    .from('shift_logs')
    .update({ check_out_time: nowIso })
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .is('check_out_time', null);
  if (shiftLogError) throw shiftLogError;

  const { error: breakLogError } = await supabase
    .from('shift_break_logs')
    .update({ ended_at: nowIso })
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .is('ended_at', null);
  if (breakLogError) throw breakLogError;

  // Üye ekipten çıkarılırken o ekibe ait atanmış vardiyaları da temizle.
  // Aksi halde haftalık plan ekranında adı çözümlenemeyen "Üye" satırları kalabiliyor.
  const { error: shiftsError } = await supabase
    .from('shifts')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (shiftsError) throw shiftsError;

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) throw error;
}

/** RBAC member_roles'a göre team_members.role (BARISTA/MANAGER) senkronlar. */
export async function syncTeamMemberRoleWithRbac(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_team_member_role_with_rbac', {
    p_team_id: teamId,
    p_user_id: userId,
  });
  if (error) {
    throw new Error(error.message ?? 'Ekip üyeliği rolü güncellenemedi');
  }
}

export async function updateTeamStoreLocation(
  teamId: string,
  ownerId: string,
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({
      store_latitude: lat,
      store_longitude: lng,
      store_radius: radiusMeters,
    })
    .eq('id', teamId)
    .eq('owner_id', ownerId);

  if (error) throw error;
}
