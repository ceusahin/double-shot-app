import { supabase } from './supabase';
import type { Training, TrainingProgress, Quiz } from '../types';

export interface TrainingWithProgress extends Training {
  completed?: boolean;
  score?: number | null;
  locked?: boolean;
}

export interface QuizQuestionForUI {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

const TRAININGS = 'trainings';
const TRAINING_PROGRESS = 'training_progress';
const QUIZZES = 'quizzes';
const QUIZ_ATTEMPTS = 'quiz_attempts';

export async function getGlobalTrainings(): Promise<Training[]> {
  const { data, error } = await supabase
    .from(TRAININGS)
    .select('*')
    .is('team_id', null)
    .order('course_level')
    .order('title');

  if (error) throw new Error(error.message ?? 'Eğitimler yüklenemedi');
  return (data ?? []) as Training[];
}

export async function getTrainingProgress(userId: string): Promise<TrainingProgress[]> {
  const { data, error } = await supabase
    .from(TRAINING_PROGRESS)
    .select('*')
    .eq('user_id', userId);

  if (error) throw new Error(error.message ?? 'İlerleme yüklenemedi');
  return (data ?? []) as TrainingProgress[];
}

export async function getQuizzesForTraining(trainingId: string): Promise<QuizQuestionForUI[]> {
  const { data, error } = await supabase
    .from(QUIZZES)
    .select('*')
    .eq('training_id', trainingId);

  if (error) throw new Error(error.message ?? 'Sorular yüklenemedi');
  const list = (data ?? []) as Quiz[];
  const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  return list.map((q) => ({
    id: q.id,
    question: q.question,
    options: [q.option_a, q.option_b, q.option_c, q.option_d],
    correct_index: map[q.correct_answer] ?? 0,
  }));
}

export async function upsertTrainingProgress(
  trainingId: string,
  userId: string,
  completed: boolean,
  score: number | null
): Promise<void> {
  const { error } = await supabase.from(TRAINING_PROGRESS).upsert(
    {
      training_id: trainingId,
      user_id: userId,
      completed,
      score,
    },
    { onConflict: 'training_id,user_id' }
  );
  if (error) throw new Error(error.message ?? 'İlerleme kaydedilemedi');
}

export async function insertQuizAttempt(
  quizId: string,
  userId: string,
  selectedAnswer: 'A' | 'B' | 'C' | 'D',
  isCorrect: boolean
): Promise<void> {
  const { error } = await supabase.from(QUIZ_ATTEMPTS).insert({
    quiz_id: quizId,
    user_id: userId,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
  });
  if (error) throw new Error(error.message ?? 'Cevaplar kaydedilemedi');
}
