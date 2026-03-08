import { supabase } from '../supabase';

export interface MyRoleSummary {
  organizationId: string;
  organizationName: string;
  roleName: string;
  roleLevelName: string;
}

export async function getMyRolesSummary(userId: string): Promise<MyRoleSummary[]> {
  const { data: members, error: memErr } = await supabase
    .from('members')
    .select('id, organization_id, organization:organizations(name)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (memErr || !members?.length) return [];

  const memberIds = members.map((m) => m.id);
  const { data: mrs, error: mrErr } = await supabase
    .from('member_roles')
    .select('member_id, role:roles(name), role_level:role_levels(name)')
    .in('member_id', memberIds);
  if (mrErr || !mrs?.length) return [];

  const result: MyRoleSummary[] = [];
  for (const mr of mrs) {
    const member = members.find((m) => m.id === mr.member_id);
    const org = member?.organization as { name?: string } | undefined;
    const role = mr.role as { name?: string } | undefined;
    const level = mr.role_level as { name?: string } | undefined;
    if (member && org?.name && role?.name && level?.name) {
      result.push({
        organizationId: member.organization_id,
        organizationName: org.name,
        roleName: role.name,
        roleLevelName: level.name,
      });
    }
  }
  return result;
}
