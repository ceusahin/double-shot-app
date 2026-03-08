/**
 * DOUBLE SHOT - Merkezi tip tanımları
 */

export type UserRole = 'BARISTA' | 'MANAGER';
export type TeamMemberRole = 'BARISTA' | 'MANAGER';

export type LevelName =
  | 'Beginner'
  | 'Junior Barista'
  | 'Barista'
  | 'Senior Barista'
  | 'Head Barista';

export interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  level: LevelName;
  experience_points: number;
  profile_photo: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  store_latitude: number | null;
  store_longitude: number | null;
  store_radius: number | null; // metre
  organization_id?: string | null;
  created_at?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  user?: UserProfile;
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

export interface PushTokenRecord {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
}
