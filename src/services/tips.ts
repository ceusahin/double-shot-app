import { supabase } from './supabase';

export interface Tip {
  id: string;
  body: string;
  created_at: string;
}

export async function getLatestTip(): Promise<Tip | null> {
  const { data, error } = await supabase
    .from('tips')
    .select('id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as Tip | null;
}
