import { supabase } from './supabase';

export interface Notification {
  id: string;
  team_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
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
