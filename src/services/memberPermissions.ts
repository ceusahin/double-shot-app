import { supabase } from './supabase';
import type { TeamMemberFeatureKey } from '../constants/memberFeaturePermissions';

export type TeamMemberFeaturePermissionRow = {
  id: string;
  team_id: string;
  user_id: string;
  feature_key: TeamMemberFeatureKey;
  created_at: string;
};

export async function listTeamMemberFeaturePermissions(teamId: string): Promise<TeamMemberFeaturePermissionRow[]> {
  const { data, error } = await supabase
    .from('team_member_feature_permissions')
    .select('id, team_id, user_id, feature_key, created_at')
    .eq('team_id', teamId);

  if (error) throw new Error(error.message ?? 'Üye izinleri alınamadı.');
  return (data ?? []) as TeamMemberFeaturePermissionRow[];
}

export async function setTeamMemberFeaturePermission(
  teamId: string,
  userId: string,
  featureKey: TeamMemberFeatureKey,
  allowed: boolean
): Promise<void> {
  if (allowed) {
    const { error } = await supabase
      .from('team_member_feature_permissions')
      .upsert(
        { team_id: teamId, user_id: userId, feature_key: featureKey },
        { onConflict: 'team_id,user_id,feature_key', ignoreDuplicates: false }
      );
    if (error) throw new Error(error.message ?? 'İzin verilemedi.');
    return;
  }

  const { error } = await supabase
    .from('team_member_feature_permissions')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('feature_key', featureKey);
  if (error) throw new Error(error.message ?? 'İzin kaldırılamadı.');
}
