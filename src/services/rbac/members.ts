import { supabase } from '../supabase';
import type { Member, MemberRole, Role, RoleLevel } from '../../types/rbac';

export async function getMemberByUserAndOrg(
  userId: string,
  organizationId: string
): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();
  if (error || !data) return null;
  return data as Member;
}

export async function getOrCreateMember(
  userId: string,
  organizationId: string
): Promise<Member> {
  const existing = await getMemberByUserAndOrg(userId, organizationId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('members')
    .insert({ user_id: userId, organization_id: organizationId, status: 'active' })
    .select()
    .single();
  if (error) throw error;
  return data as Member;
}

export async function listMembers(organizationId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select(`
      *,
      user:users(id, name, surname, email, profile_photo)
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m: Record<string, unknown>) => ({
    ...m,
    user: (m.user as Record<string, unknown>) ?? undefined,
  })) as Member[];
}

/** Üyeleri atanmış rollerle birlikte getirir (rol adı + seviye adı). */
export interface MemberWithRoles extends Member {
  member_roles?: { id: string; role?: { name: string }; role_level?: { name: string } }[];
}

export async function listMembersWithRoles(organizationId: string): Promise<MemberWithRoles[]> {
  const { data, error } = await supabase
    .from('members')
    .select(`
      *,
      user:users(id, name, surname, email, profile_photo),
      member_roles(
        id,
        role:roles(name),
        role_level:role_levels(name)
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MemberWithRoles[];
}

export async function getMemberRoles(memberId: string): Promise<MemberRole[]> {
  const { data, error } = await supabase
    .from('member_roles')
    .select(`
      *,
      role:roles(*),
      role_level:role_levels(*)
    `)
    .eq('member_id', memberId);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    member_id: row.member_id,
    role_id: row.role_id,
    role_level_id: row.role_level_id,
    assigned_by: row.assigned_by,
    assigned_at: row.assigned_at,
    role: row.role as Role | undefined,
    role_level: row.role_level as RoleLevel | undefined,
  })) as MemberRole[];
}

export async function assignMemberRole(
  memberId: string,
  roleId: string,
  roleLevelId: string,
  assignedBy: string
): Promise<MemberRole> {
  const { data, error } = await supabase
    .from('member_roles')
    .insert({ member_id: memberId, role_id: roleId, role_level_id: roleLevelId, assigned_by: assignedBy })
    .select()
    .single();
  if (error) throw error;
  return data as MemberRole;
}

export async function updateMemberRole(
  memberRoleId: string,
  roleLevelId: string
): Promise<void> {
  const { error } = await supabase
    .from('member_roles')
    .update({ role_level_id: roleLevelId })
    .eq('id', memberRoleId);
  if (error) throw error;
}

export async function removeMemberRole(memberRoleId: string): Promise<void> {
  const { error } = await supabase.from('member_roles').delete().eq('id', memberRoleId);
  if (error) throw error;
}
