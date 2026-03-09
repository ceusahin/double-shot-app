import { supabase } from '../supabase';
import { type PermissionKey, PERMISSION_KEYS } from '../../types/rbac';

/**
 * Ekip lideri (ekip sahibi veya MANAGER) kendi ekiplerinde tüm yetkilere sahiptir.
 */
async function isTeamLeader(userId: string, organizationId: string): Promise<boolean> {
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('organization_id', organizationId)
    .limit(1);
  if (teamError || !teams?.length) return false;
  const team = teams[0];
  if (team.owner_id === userId) return true;
  const { data: member, error: tmError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', userId)
    .eq('role', 'MANAGER')
    .limit(1)
    .maybeSingle();
  return !tmError && !!member;
}

/**
 * Get permission keys for a user in an organization (from their assigned role levels).
 * Ekip liderleri (owner veya MANAGER) kendi ekiplerinde tüm yetkilere sahiptir.
 */
export async function getUserPermissionKeys(
  userId: string,
  organizationId: string
): Promise<PermissionKey[]> {
  if (await isTeamLeader(userId, organizationId)) {
    return [...PERMISSION_KEYS];
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId);
  if (memberError || !memberRows?.length) return [];

  const memberIds = memberRows.map((r) => r.id);
  const { data: memberRoles, error: mrError } = await supabase
    .from('member_roles')
    .select('role_level_id')
    .in('member_id', memberIds);
  if (mrError || !memberRoles?.length) return [];

  const levelIds = [...new Set(memberRoles.map((r) => r.role_level_id))];
  const { data: rpRows, error: rpError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .in('role_level_id', levelIds);
  if (rpError || !rpRows?.length) return [];

  const permIds = [...new Set(rpRows.map((r) => r.permission_id))];
  const { data: perms, error: permError } = await supabase
    .from('permissions')
    .select('key')
    .in('id', permIds);
  if (permError || !perms?.length) return [];

  const keys = perms.map((p) => p.key as PermissionKey);
  return keys;
}

/**
 * Check if user has a specific permission in the organization.
 */
export async function userHasPermission(
  userId: string,
  organizationId: string,
  permissionKey: PermissionKey
): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId, organizationId);
  return keys.includes(permissionKey);
}
