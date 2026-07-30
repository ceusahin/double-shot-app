/**
 * DOUBLE SHOT - Merkezi tip tanımları
 */

export type UserRole = 'BARISTA' | 'MANAGER';
export type TeamMemberRole = 'BARISTA' | 'MANAGER';

/** Süper yöneticinin verdiği ekip kurma hakkı türleri (DB ile uyumlu). */
export type QuotaGrantKind = 'trial_15d' | 'months_1' | 'months_3' | 'months_6';

export type QuotaBalances = Partial<Record<QuotaGrantKind, number>>;

export interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  profile_photo: string | null;
  created_at: string;
  /** Manuel (DB); ilk süper yönetici SQL ile atanır */
  is_super_admin?: boolean;
  /** Süper yönetici tarafından atanır; Yönetim sekmesi */
  is_platform_admin?: boolean;
  /** quota_balances toplamı ile senkron (kalan hak adedi); görüntüleme/özet için. Yetki: sum(quota_balances) > 0. */
  max_owned_teams?: number;
  /** Tür başına kalan ekip kurma hakkı (trial_15d, months_1, …). */
  quota_balances?: QuotaBalances | null;
}

export type TeamSubscriptionPlan = 'eco' | 'growth' | 'scale' | 'trial';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  store_latitude: number | null;
  store_longitude: number | null;
  store_radius: number | null; // metre
  organization_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  /** Uygulama sahibi paneli / raporlama için */
  subscription_plan?: TeamSubscriptionPlan | null;
  subscription_billing_months?: 1 | 3 | 6 | null;
  subscription_started_at?: string | null;
  subscription_ends_at?: string | null;
  /** Oluştururken hangi kota türünden düşüldü (platform/süper için null olabilir). */
  quota_consumed_kind?: QuotaGrantKind | null;
  /** Süper yöneticinin uyguladığı toplam manuel saat delta (+/-). 0 ise manuel ayarlama yok. */
  manual_extension_hours?: number | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  user?: UserProfile;
}

export type TeamJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TeamJoinRequest {
  id: string;
  team_id: string;
  requester_user_id: string;
  requester_name?: string | null;
  requester_surname?: string | null;
  requester_email?: string | null;
  requester_profile_photo?: string | null;
  invite_token: string | null;
  status: TeamJoinRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  teams?: Pick<Team, 'id' | 'name' | 'owner_id'>;
  requester?: Pick<UserProfile, 'id' | 'name' | 'surname' | 'email' | 'profile_photo'>;
}

export interface ShiftTemplate {
  id: string;
  team_id: string;
  name: string;
  start_time: string;
  end_time: string;
  created_at?: string;
}

export interface Shift {
  id: string;
  team_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  role: string;
  shift_template_id?: string | null;
  user?: UserProfile;
}

export interface ShiftLog {
  id: string;
  user_id: string;
  team_id: string;
  check_in_time: string;
  check_out_time: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

export type OperationTaskType = 'maintenance' | 'opening' | 'closing';

export interface OperationTask {
  id: string;
  team_id: string | null;
  type: OperationTaskType;
  label: string;
  details?: string | null;
  day_of_week: number | null;
  sort_order: number;
  created_at?: string;
}

export interface OperationTaskLog {
  id: string;
  operation_task_id: string;
  team_id: string;
  user_id: string;
  log_date: string;
  completed_at: string;
  user?: Pick<UserProfile, 'id' | 'name' | 'surname' | 'email'>;
}

export interface Training {
  id: string;
  team_id: string | null;
  title: string;
  description: string | null;
  video_url: string | null;
  image_url: string | null;
  created_at: string;
  category?: string | null;
  course_level?: string | null;
  duration_minutes?: number;
  points?: number;
  required_points?: number;
  content?: string | null;
  type?: 'video' | 'article';
}

export interface TrainingProgress {
  id: string;
  training_id: string;
  user_id: string;
  completed: boolean;
  score: number | null;
}

export interface Quiz {
  id: string;
  training_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  selected_answer: 'A' | 'B' | 'C' | 'D';
  is_correct: boolean;
}

export interface NotificationItem {
  id: string;
  team_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

export interface TeamInventoryItem {
  id: string;
  team_id: string;
  category_id: string;
  name: string;
  unit: string;
  current_qty: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: TeamInventoryCategory | null;
}

export interface TeamInventoryCategory {
  id: string;
  team_id: string;
  name: string;
  min_alert_qty: number;
  sort_order: number;
  created_at: string;
}

export interface ForumPost {
  id: string;
  author_id: string;
  team_id: string | null;
  title: string;
  content: string;
  created_at: string;
  author?: UserProfile;
}

export interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: UserProfile;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  steps: string[];
}

/** Ekip tarif kategorisi (Mutfak, Bar vb.) */
export interface TeamRecipeCategory {
  id: string;
  team_id: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

/** Ekip tarifi; kategoriye bağlı, malzemeler, adımlar ve isteğe bağlı fotoğraf */
export interface TeamRecipe {
  id: string;
  team_id: string;
  category_id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  steps: string[];
  image_url: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PushTokenRecord {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
}
