import { supabase } from './supabase';
import type { OperationTask, OperationTaskLog } from '../types';

/** Yalnızca ilgili ekibe tanımlı görevler (global `team_id` null satırları dahil değil). */
export async function getOperationTasks(teamId?: string | null): Promise<OperationTask[]> {
  if (!teamId) {
    return [];
  }

  const { data, error } = await supabase
    .from('operation_tasks')
    .select('*')
    .eq('team_id', teamId)
    .order('type')
    .order('day_of_week')
    .order('sort_order');

  if (error) {
    throw new Error(error.message ?? 'Operasyon görevleri yüklenemedi');
  }

  return (data ?? []) as OperationTask[];
}

export async function getTodayOperationTaskLogs(
  teamId: string,
  logDate: string
): Promise<OperationTaskLog[]> {
  const { data, error } = await supabase
    .from('operation_task_logs')
    .select('*, user:users(id, name, surname, email)')
    .eq('team_id', teamId)
    .eq('log_date', logDate);

  if (error) {
    throw new Error(error.message ?? 'Operasyon logları yüklenemedi');
  }

  return (data ?? []) as OperationTaskLog[];
}

export async function setOperationTaskCompleted(
  operationTaskId: string,
  teamId: string,
  userId: string,
  completed: boolean,
  logDate: string
): Promise<void> {
  if (!userId) {
    throw new Error('Kullanıcı doğrulanamadı');
  }

  if (completed) {
    const { error } = await supabase
      .from('operation_task_logs')
      .upsert(
        {
          operation_task_id: operationTaskId,
          team_id: teamId,
          user_id: userId,
          log_date: logDate,
        },
        {
          onConflict: 'operation_task_id,team_id,log_date',
          ignoreDuplicates: true,
        }
      );
    if (error) {
      throw new Error(error.message ?? 'Görev tamamlanamadı');
    }
    return;
  }

  const { error } = await supabase
    .from('operation_task_logs')
    .delete()
    .eq('operation_task_id', operationTaskId)
    .eq('team_id', teamId)
    .eq('log_date', logDate);

  if (error) {
    throw new Error(error.message ?? 'Görev geri alınamadı');
  }
}

