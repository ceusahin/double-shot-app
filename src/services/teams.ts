import { supabase } from './supabase';
import type { Team, TeamMember, UserProfile } from '../types';

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
  storeRadius?: number
): Promise<Team> {
  const inviteCode = generateInviteCode();
  const { data, error } = await supabase
    .from('teams')
    .insert({
      name,
      owner_id: ownerId,
      invite_code: inviteCode,
      store_latitude: storeLat ?? null,
      store_longitude: storeLng ?? null,
      store_radius: storeRadius ?? null,
    })
    .select()
    .single();

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
    .filter((row: { teams?: Team }) => row.teams?.is_active !== false)
    .map((row: { role: string; teams: Team }) => ({
      ...row.teams,
      role: row.role,
    })) as (Team & { role: string })[];
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

/** Ekip kapat: is_active = false (owner veya MANAGER). Kapalı ekipler listelenmez. */
export async function closeTeam(teamId: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ is_active: false })
    .eq('id', teamId);
  if (error) throw error;
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      user:users(id, name, surname, email, level, experience_points, profile_photo)
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
            level: (u.level as UserProfile['level']) ?? 'Beginner',
            experience_points: (u.experience_points as number) ?? 0,
            profile_photo: (u.profile_photo as string | null) ?? null,
            role: 'BARISTA' as const,
            created_at: (u.created_at as string) ?? '',
          }
        : undefined,
    };
  }) as TeamMember[];
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) throw error;
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
