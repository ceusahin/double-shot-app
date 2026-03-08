import { supabase } from './supabase';
import type { Shift, ShiftTemplate } from '../types';

/** Vardiya tanımları: isim + saat aralığı (örn. Gündüz 09:00–17:00) */
export async function getTeamShiftTemplates(teamId: string): Promise<ShiftTemplate[]> {
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .eq('team_id', teamId)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShiftTemplate[];
}

/** Yeni vardiya tanımı oluştur. startTime/endTime "HH:mm" veya "HH:mm:ss" */
export async function createShiftTemplate(
  teamId: string,
  name: string,
  startTime: string,
  endTime: string
): Promise<ShiftTemplate> {
  const norm = (t: string) => (t.length === 5 ? `${t}:00` : t);
  const { data, error } = await supabase
    .from('shift_templates')
    .insert({
      team_id: teamId,
      name: name.trim(),
      start_time: norm(startTime),
      end_time: norm(endTime),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ShiftTemplate;
}

export async function updateShiftTemplate(
  id: string,
  name: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const norm = (t: string) => (t.length === 5 ? `${t}:00` : t);
  const { error } = await supabase
    .from('shift_templates')
    .update({ name: name.trim(), start_time: norm(startTime), end_time: norm(endTime) })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteShiftTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('shift_templates').delete().eq('id', id);
  if (error) throw error;
}

/** Şablondan belirli bir tarih için vardiya oluşturur (çalışan atar) */
export async function createShiftFromTemplate(
  teamId: string,
  shiftTemplateId: string,
  userId: string,
  date: Date,
  role: string = 'Barista'
): Promise<Shift> {
  const template = await getTeamShiftTemplates(teamId).then((list) =>
    list.find((t) => t.id === shiftTemplateId)
  );
  if (!template) throw new Error('Vardiya tanımı bulunamadı.');
  const [sh, sm] = template.start_time.split(':').map(Number);
  const [eh, em] = template.end_time.split(':').map(Number);
  const start = new Date(date);
  start.setHours(sh, sm || 0, 0, 0);
  const end = new Date(date);
  end.setHours(eh, em || 0, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      team_id: teamId,
      user_id: userId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      role,
      shift_template_id: shiftTemplateId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Shift;
}

export async function getTeamShifts(
  teamId: string,
  weekStart?: Date
): Promise<Shift[]> {
  const start = weekStart ?? new Date();
  const startOfWeek = new Date(start);
  startOfWeek.setDate(start.getDate() - start.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const { data, error } = await supabase
    .from('shifts')
    .select(`
      *,
      user:users(id, name, surname, profile_photo)
    `)
    .eq('team_id', teamId)
    .gte('start_time', startOfWeek.toISOString())
    .lt('start_time', endOfWeek.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Shift[];
}

export async function createShift(
  teamId: string,
  userId: string,
  startTime: Date,
  endTime: Date,
  role: string
): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      team_id: teamId,
      user_id: userId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      role,
      shift_template_id: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Shift;
}

export async function getMyShifts(userId: string): Promise<Shift[]> {
  const now = new Date();
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', userId)
    .gte('end_time', now.toISOString())
    .order('start_time', { ascending: true })
    .limit(14);

  if (error) throw error;
  return (data ?? []) as Shift[];
}

export async function getActiveShiftLog(
  userId: string,
  teamId: string
): Promise<{ id: string; check_in_time: string } | null> {
  const { data, error } = await supabase
    .from('shift_logs')
    .select('id, check_in_time')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .is('check_out_time', null)
    .order('check_in_time', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as { id: string; check_in_time: string };
}

export async function checkIn(
  userId: string,
  teamId: string,
  lat: number,
  lng: number
): Promise<void> {
  const { error } = await supabase.from('shift_logs').insert({
    user_id: userId,
    team_id: teamId,
    check_in_time: new Date().toISOString(),
    location_lat: lat,
    location_lng: lng,
  });

  if (error) throw error;
}

export async function checkOut(logId: string): Promise<void> {
  const { error } = await supabase
    .from('shift_logs')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', logId);

  if (error) throw error;
}

export interface ShiftLogWithUser {
  id: string;
  user_id: string;
  team_id: string;
  check_in_time: string;
  check_out_time: string | null;
  location_lat: number | null;
  location_lng: number | null;
  user?: { id: string; name: string; surname: string };
}

/** Yönetici: ekibin vardiya giriş/çıkış kayıtları (puantaj) */
export async function getTeamShiftLogs(
  teamId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<ShiftLogWithUser[]> {
  const from = fromDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const to = toDate ?? (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  })();

  const { data, error } = await supabase
    .from('shift_logs')
    .select(`
      id, user_id, team_id, check_in_time, check_out_time, location_lat, location_lng,
      user:users(id, name, surname)
    `)
    .eq('team_id', teamId)
    .gte('check_in_time', from.toISOString())
    .lte('check_in_time', to.toISOString())
    .order('check_in_time', { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data ?? []) as unknown as ShiftLogWithUser[];
}
