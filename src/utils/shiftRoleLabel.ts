import type { TeamMemberRole } from '../types';

/** `listMembersWithRoles` satırlarından user_id → org rol adı (örn. Garson, Barista). */
export function buildOrgRoleByUserId(
  rows: { user_id: string; member_roles?: { role?: { name?: string } }[] }[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const name = row.member_roles?.[0]?.role?.name?.trim();
    if (name) map[row.user_id] = name;
  }
  return map;
}

/** Vardiya kaydına yazılacak kısa rol metni. Önce ekip üyeliği / sahip, sonra org rol adı. */
export function teamMemberRoleToStoredShiftRole(
  memberRole: TeamMemberRole | string | undefined | null,
  userId: string,
  teamOwnerId: string | undefined | null,
  orgRoleDisplayName?: string | null
): string {
  if (memberRole === 'MANAGER' || userId === teamOwnerId) return 'Yönetici';
  const org = orgRoleDisplayName?.trim();
  if (org) return org;
  return 'Barista';
}

/**
 * Listede gösterilecek rol: yönetici üyelik, org rol adı (Garson vb.), BARISTA, kayıtlı shift.role.
 */
export function resolveShiftRoleLabel(
  userId: string,
  teamOwnerId: string | undefined | null,
  members: { user_id: string; role?: TeamMemberRole | string | null }[],
  shiftStoredRole: string | undefined | null,
  orgRoleDisplayName?: string | null
): string {
  const m = members.find((x) => x.user_id === userId);
  if (m?.role === 'MANAGER' || userId === teamOwnerId) return 'Yönetici';

  const org = orgRoleDisplayName?.trim();
  if (org) return org;

  if (m?.role === 'BARISTA') return 'Barista';

  const t = shiftStoredRole?.trim();
  if (t) return t;
  return 'Barista';
}
