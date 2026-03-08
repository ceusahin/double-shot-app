import { supabase } from '../supabase';
import type { Permission } from '../../types/rbac';

export async function listPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('key');
  if (error) throw error;
  return (data ?? []) as Permission[];
}

export async function getPermissionsForRoleLevel(roleLevelId: string): Promise<Permission[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permission:permissions(*)')
    .eq('role_level_id', roleLevelId);
  if (error) throw error;
  return (data ?? [])
    .map((row: { permission: Permission | null }) => row.permission)
    .filter(Boolean) as Permission[];
}

export async function setPermissionsForRoleLevel(
  roleLevelId: string,
  permissionIds: string[]
): Promise<void> {
  await supabase.from('role_permissions').delete().eq('role_level_id', roleLevelId);
  if (permissionIds.length === 0) return;
  await supabase.from('role_permissions').insert(
    permissionIds.map((permission_id) => ({ role_level_id: roleLevelId, permission_id }))
  );
}

export async function addPermissionToRoleLevel(
  roleLevelId: string,
  permissionId: string
): Promise<void> {
  await supabase.from('role_permissions').upsert(
    { role_level_id: roleLevelId, permission_id: permissionId },
    { onConflict: 'role_level_id,permission_id' }
  );
}
