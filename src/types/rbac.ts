/**
 * Dynamic RBAC types - no hardcoded role names or levels.
 */

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  subscription_plan: string;
  created_at: string;
}

export interface Store {
  id: string;
  organization_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  created_at?: string;
}

export type MemberStatus = 'active' | 'inactive' | 'pending';

export interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  status: MemberStatus;
  joined_at: string;
  user?: { id: string; name: string; surname: string; email: string; profile_photo: string | null };
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface RoleLevel {
  id: string;
  role_id: string;
  name: string;
  level_rank: number;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface RolePermission {
  id: string;
  role_level_id: string;
  permission_id: string;
  permission?: Permission;
}

export interface MemberRole {
  id: string;
  member_id: string;
  role_id: string;
  role_level_id: string;
  assigned_by: string;
  assigned_at: string;
  role?: Role;
  role_level?: RoleLevel;
}

export interface Invite {
  id: string;
  organization_id: string;
  invite_code: string;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

/** Permission keys (extensible - add new keys in DB and here) */
export const PERMISSION_KEYS = [
  'create_shift',
  'edit_shift',
  'delete_shift',
  'view_reports',
  'send_shot_notification',
  'manage_training',
  'assign_roles',
  'manage_roles',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
