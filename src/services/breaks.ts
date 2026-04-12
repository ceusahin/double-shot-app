import { supabase } from './supabase';
import { getBusinessDayStart, getNextBusinessDayStart } from '../utils/businessDay';

export interface ShiftBreakTemplate {
  id: string;
  team_id: string;
  name: string;
  duration_minutes: number;
  created_at?: string;
}

export interface ShiftBreakLog {
  id: string;
  team_id: string;
  user_id: string;
  shift_log_id: string | null;
  break_template_id: string;
  started_at: string;
  planned_end_at: string;
  ended_at: string | null;
  created_at?: string;
  template?: Pick<ShiftBreakTemplate, 'id' | 'name' | 'duration_minutes'>;
  user?: { id: string; name?: string; surname?: string; profile_photo?: string | null };
}

export async function getTeamBreakTemplates(teamId: string): Promise<ShiftBreakTemplate[]> {
  const { data, error } = await supabase
    .from('shift_break_templates')
    .select('*')
    .eq('team_id', teamId)
    .order('duration_minutes', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShiftBreakTemplate[];
}

export async function createBreakTemplate(
  teamId: string,
  name: string,
  durationMinutes: number
): Promise<ShiftBreakTemplate> {
  const { data, error } = await supabase
    .from('shift_break_templates')
    .insert({
      team_id: teamId,
      name: name.trim(),
      duration_minutes: durationMinutes,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ShiftBreakTemplate;
}

export async function deleteBreakTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('shift_break_templates').delete().eq('id', templateId);
  if (error) throw error;
}

export async function getTeamActiveBreaks(teamId: string): Promise<ShiftBreakLog[]> {
  const { data, error } = await supabase
    .from('shift_break_logs')
    .select(`
      id, team_id, user_id, shift_log_id, break_template_id, started_at, planned_end_at, ended_at, created_at,
      template:shift_break_templates(id, name, duration_minutes),
      user:users(id, name, surname, profile_photo)
    `)
    .eq('team_id', teamId)
    .is('ended_at', null)
    .order('started_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ShiftBreakLog[];
}

export async function getMyActiveBreak(userId: string, teamId: string): Promise<ShiftBreakLog | null> {
  const { data, error } = await supabase
    .from('shift_break_logs')
    .select(`
      id, team_id, user_id, shift_log_id, break_template_id, started_at, planned_end_at, ended_at, created_at,
      template:shift_break_templates(id, name, duration_minutes),
      user:users(id, name, surname, profile_photo)
    `)
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ShiftBreakLog | null;
}

export async function startBreak(params: {
  teamId: string;
  userId: string;
  shiftLogId: string;
  templateId: string;
  durationMinutes: number;
}): Promise<ShiftBreakLog> {
  const plannedEndAt = new Date(Date.now() + params.durationMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('shift_break_logs')
    .insert({
      team_id: params.teamId,
      user_id: params.userId,
      shift_log_id: params.shiftLogId,
      break_template_id: params.templateId,
      planned_end_at: plannedEndAt,
    })
    .select(`
      id, team_id, user_id, shift_log_id, break_template_id, started_at, planned_end_at, ended_at, created_at,
      template:shift_break_templates(id, name, duration_minutes),
      user:users(id, name, surname, profile_photo)
    `)
    .single();
  if (error) throw error;
  return data as unknown as ShiftBreakLog;
}

export async function endBreak(breakLogId: string): Promise<void> {
  const { error } = await supabase
    .from('shift_break_logs')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', breakLogId)
    .is('ended_at', null);
  if (error) throw error;
}

/** `at` anındaki iş günü: 06:00–ertesi gün 06:00 (yerel). */
export async function getTeamBreakLogsForDate(teamId: string, at: Date = new Date()): Promise<ShiftBreakLog[]> {
  const start = getBusinessDayStart(at);
  const end = getNextBusinessDayStart(at);
  const { data, error } = await supabase
    .from('shift_break_logs')
    .select(`
      id, team_id, user_id, shift_log_id, break_template_id, started_at, planned_end_at, ended_at, created_at,
      template:shift_break_templates(id, name, duration_minutes),
      user:users(id, name, surname, profile_photo)
    `)
    .eq('team_id', teamId)
    .gte('started_at', start.toISOString())
    .lt('started_at', end.toISOString())
    .order('started_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ShiftBreakLog[];
}
