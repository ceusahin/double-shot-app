import { supabase } from '../supabase';
import type { Role, RoleLevel } from '../../types/rbac';

export async function listRoles(organizationId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Role[];
}

export async function createRole(
  organizationId: string,
  name: string,
  description?: string
): Promise<Role> {
  const { data, error } = await supabase
    .from('roles')
    .insert({ organization_id: organizationId, name, description: description ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Role;
}

export async function updateRole(
  roleId: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  const { error } = await supabase.from('roles').update(updates).eq('id', roleId);
  if (error) throw error;
}

export async function deleteRole(roleId: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', roleId);
  if (error) throw error;
}

export async function listRoleLevels(roleId: string): Promise<RoleLevel[]> {
  const { data, error } = await supabase
    .from('role_levels')
    .select('*')
    .eq('role_id', roleId)
    .order('level_rank');
  if (error) throw error;
  return (data ?? []) as RoleLevel[];
}

export async function createRoleLevel(
  roleId: string,
  name: string,
  levelRank: number
): Promise<RoleLevel> {
  const { data, error } = await supabase
    .from('role_levels')
    .insert({ role_id: roleId, name, level_rank: levelRank })
    .select()
    .single();
  if (error) throw error;
  return data as RoleLevel;
}

export async function updateRoleLevel(
  levelId: string,
  updates: { name?: string; level_rank?: number }
): Promise<void> {
  const { error } = await supabase.from('role_levels').update(updates).eq('id', levelId);
  if (error) throw error;
}

export async function deleteRoleLevel(levelId: string): Promise<void> {
  const { error } = await supabase.from('role_levels').delete().eq('id', levelId);
  if (error) throw error;
}
