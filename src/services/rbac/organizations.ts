import { supabase } from '../supabase';
import type { Organization } from '../../types/rbac';

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Organization;
}

export async function getOrganizationByTeamId(teamId: string): Promise<Organization | null> {
  const { data: team } = await supabase.from('teams').select('organization_id').eq('id', teamId).single();
  if (!team?.organization_id) return null;
  return getOrganizationById(team.organization_id);
}

/** Ensure team has an organization; create one if not (e.g. legacy team). */
export async function ensureOrganizationForTeam(
  teamId: string,
  name: string,
  ownerId: string
): Promise<Organization> {
  const { data: team } = await supabase.from('teams').select('organization_id').eq('id', teamId).single();
  if (team?.organization_id) {
    const org = await getOrganizationById(team.organization_id);
    if (org) return org;
  }
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  await supabase.from('teams').update({ organization_id: org.id }).eq('id', teamId);
  return org as Organization;
}
