import { supabase } from './supabase';
import { getMyTeams } from './teams';

export interface Notification {
  id: string;
  team_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

/** Kullanıcının üye olduğu tüm takımların bildirimleri; her biri takım adı ile (ekip lideri çok takımlı ise hangi ekip için olduğu belli olur). */
export interface NotificationWithTeam extends Notification {
  team_name: string;
}

export async function getNotificationsForMyTeams(userId: string): Promise<NotificationWithTeam[]> {
  const teams = await getMyTeams(userId);
  const results = await Promise.all(
    teams.map(async (team) => {
      const list = await getTeamNotifications(team.id);
      return list.map((n) => ({ ...n, team_name: team.name }));
    })
  );
  const merged = results.flat();
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return merged.slice(0, 50);
}

export async function getTeamNotifications(teamId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message ?? 'Bildirimler yüklenemedi');
  return (data ?? []) as Notification[];
}

/** Yönetici: ekip bildirimi oluşturur (örn. vardiya bildirimi) */
export async function createTeamNotification(
  teamId: string,
  type: string,
  title: string,
  message: string,
  targetUserId?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    team_id: teamId,
    type,
    title,
    message,
  };
  if (targetUserId) payload.target_user_id = targetUserId;
  const { error } = await supabase.from('notifications').insert(payload);
  if (error) throw new Error(error.message ?? 'Bildirim gönderilemedi');
}
