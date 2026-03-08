import { supabase } from '../supabase';
import type { PermissionKey } from '../../types/rbac';

/**
 * Get permission keys for a user in an organization (from their assigned role levels).
 * Returns empty array if user has no role or no permissions.
 */
export async function getUserPermissionKeys(
  userId: string,
  organizationId: string
): Promise<PermissionKey[]> {
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
