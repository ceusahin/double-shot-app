import { supabase } from './supabase';
import type { TeamRecipeCategory, TeamRecipe } from '../types';

const RECIPE_IMAGES_BUCKET = 'recipe-images';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ekip tarifi fotoğrafı yükle; path: teamId/recipeId.ext. Public URL döner. */
export async function uploadRecipeImage(
  teamId: string,
  recipeId: string,
  imageUri: string,
  base64?: string | null
): Promise<string> {
  if (!teamId || !UUID_REGEX.test(teamId) || !recipeId || !UUID_REGEX.test(recipeId)) {
    throw new Error('Geçersiz ekip veya tarif bilgisi. Lütfen sayfayı yenileyip tekrar deneyin.');
  }
  const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${teamId}/${recipeId}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

  if (!base64) {
    throw new Error('Fotoğraf verisi alınamadı. Lütfen daha küçük bir fotoğraf seçip tekrar deneyin.');
  }
  const { decode } = await import('base64-arraybuffer');
  const body = decode(base64);

  const { error: uploadError } = await supabase.storage
    .from(RECIPE_IMAGES_BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (uploadError) throw new Error(uploadError.message || 'Yükleme başarısız.');

  const { data: urlData } = supabase.storage.from(RECIPE_IMAGES_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Ekip tarif kategorilerini getir (Mutfak, Bar vb.) */
export async function getTeamRecipeCategories(teamId: string): Promise<TeamRecipeCategory[]> {
  const { data, error } = await supabase
    .from('team_recipe_categories')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TeamRecipeCategory[];
}

/** Yeni kategori oluştur (ekip lideri) */
export async function createTeamRecipeCategory(teamId: string, name: string): Promise<TeamRecipeCategory> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Kategori adı girin.');
  const { data, error } = await supabase
    .from('team_recipe_categories')
    .insert({ team_id: teamId, name: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data as TeamRecipeCategory;
}

/** Kategori adını güncelle */
export async function updateTeamRecipeCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Kategori adı girin.');
  const { error } = await supabase
    .from('team_recipe_categories')
    .update({ name: trimmed })
    .eq('id', id);
  if (error) throw error;
}

/** Kategori sil (içindeki tarifler de silinir, FK cascade) */
export async function deleteTeamRecipeCategory(id: string): Promise<void> {
  const { error } = await supabase.from('team_recipe_categories').delete().eq('id', id);
  if (error) throw error;
}

/** Ekip tariflerini getir (isteğe bağlı kategori filtresi) */
export async function getTeamRecipes(teamId: string, categoryId?: string): Promise<TeamRecipe[]> {
  let q = supabase
    .from('team_recipes')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  if (error) throw error;

  const list = (data ?? []) as (Omit<TeamRecipe, 'steps' | 'ingredients'> & { steps: unknown; ingredients?: unknown })[];
  return list.map((r) => ({
    ...r,
    steps: Array.isArray(r.steps) ? (r.steps as string[]) : [],
    ingredients: Array.isArray(r.ingredients) ? (r.ingredients as string[]) : [],
  })) as TeamRecipe[];
}

/** Tekil ekip tarifi getir */
export async function getTeamRecipe(id: string): Promise<TeamRecipe | null> {
  const { data, error } = await supabase.from('team_recipes').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  const r = data as Omit<TeamRecipe, 'steps' | 'ingredients'> & { steps: unknown; ingredients?: unknown };
  return {
    ...r,
    steps: Array.isArray(r.steps) ? (r.steps as string[]) : [],
    ingredients: Array.isArray(r.ingredients) ? (r.ingredients as string[]) : [],
  } as TeamRecipe;
}

/** Yeni ekip tarifi oluştur */
export async function createTeamRecipe(
  teamId: string,
  categoryId: string,
  payload: { name: string; description?: string; ingredients?: string[]; steps: string[]; image_url?: string | null }
): Promise<TeamRecipe> {
  const name = payload.name.trim();
  if (!name) throw new Error('Tarif adı girin.');
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  const { data, error } = await supabase
    .from('team_recipes')
    .insert({
      team_id: teamId,
      category_id: categoryId,
      name,
      description: payload.description?.trim() || null,
      ingredients,
      steps,
      image_url: payload.image_url ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const r = data as Omit<TeamRecipe, 'steps' | 'ingredients'> & { steps: unknown; ingredients?: unknown };
  return {
    ...r,
    steps: Array.isArray(r.steps) ? (r.steps as string[]) : [],
    ingredients: Array.isArray(r.ingredients) ? (r.ingredients as string[]) : [],
  } as TeamRecipe;
}

/** Ekip tarifini güncelle */
export async function updateTeamRecipe(
  id: string,
  payload: { name?: string; description?: string; ingredients?: string[]; steps?: string[]; image_url?: string | null }
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.description !== undefined) updates.description = payload.description?.trim() || null;
  if (payload.ingredients !== undefined) updates.ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  if (payload.steps !== undefined) updates.steps = Array.isArray(payload.steps) ? payload.steps : [];
  if (payload.image_url !== undefined) updates.image_url = payload.image_url ?? null;
  const { error } = await supabase.from('team_recipes').update(updates).eq('id', id);
  if (error) throw error;
}

/** Ekip tarifini sil */
export async function deleteTeamRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('team_recipes').delete().eq('id', id);
  if (error) throw error;
}
