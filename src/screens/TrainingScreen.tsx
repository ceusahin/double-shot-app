import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button } from '../components';
import { useAuthStore } from '../store/authStore';
import {
  getGlobalTrainings,
  getTrainingProgress,
  getQuizzesForTraining,
  upsertTrainingProgress,
  insertQuizAttempt,
  type TrainingWithProgress,
  type QuizQuestionForUI,
} from '../services/training';
import { updateProfileXP } from '../services/auth';
import { getProfile } from '../services/auth';
import { colors, spacing, typography, borderRadius } from '../utils/theme';

const LEVEL_TO_GRADE: Record<string, string> = {
  Beginner: 'A1',
  'Junior Barista': 'A2',
  Barista: 'B1',
  'Senior Barista': 'B2',
  'Head Barista': 'C1',
};

const CATEGORIES = [
  { id: 'all', label: 'Tümü' },
  { id: 'espresso', label: 'Espresso Temelleri' },
  { id: 'milk', label: 'Süt Sanatı' },
  { id: 'brew', label: 'Filtre & Demleme' },
];

export function TrainingScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTraining, setSelectedTraining] = useState<TrainingWithProgress | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(1);
  const [quizScore, setQuizScore] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionForUI[]>([]);

  const userId = user?.id ?? '';
  const grade = LEVEL_TO_GRADE[user?.level ?? 'Beginner'] ?? 'A1';
  const points = user?.experience_points ?? 0;

  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings-global'],
    queryFn: getGlobalTrainings,
  });

  const { data: progressList = [] } = useQuery({
    queryKey: ['training-progress', userId],
    queryFn: () => getTrainingProgress(userId),
    enabled: !!userId,
  });

  const progressMap = useMemo(() => {
    const m: Record<string, { completed: boolean; score: number | null }> = {};
    progressList.forEach((p) => {
      m[p.training_id] = { completed: p.completed, score: p.score };
    });
    return m;
  }, [progressList]);

  const trainingsWithProgress: TrainingWithProgress[] = useMemo(() => {
    return trainings.map((t) => {
      const p = progressMap[t.id];
      const completed = p?.completed ?? false;
      const required = t.required_points ?? 0;
      const locked = activeTab === 'active' && points < required;
      return { ...t, completed, score: p?.score ?? null, locked };
    });
  }, [trainings, progressList, activeTab, points]);

  const activeList = useMemo(
    () => trainingsWithProgress.filter((t) => t.course_level === grade && !t.completed),
    [trainingsWithProgress, grade]
  );
  const completedList = useMemo(
    () => trainingsWithProgress.filter((t) => t.completed),
    [trainingsWithProgress]
  );
  const list = activeTab === 'active' ? activeList : completedList;
  const filteredList =
    activeFilter === 'all' ? list : list.filter((t) => t.category === activeFilter);

  const openTraining = (t: TrainingWithProgress) => {
    if (t.locked) return;
    setSelectedTraining(t);
    setShowQuiz(false);
    setQuizStep(1);
    setQuizScore(0);
  };

  const startQuiz = async () => {
    if (!selectedTraining) return;
    const q = await getQuizzesForTraining(selectedTraining.id);
    const shuffled = [...q].sort(() => 0.5 - Math.random());
    setQuizQuestions(shuffled.slice(0, 5));
    setShowQuiz(true);
    setQuizStep(1);
    setQuizScore(0);
  };

  const upsertProgress = useMutation({
    mutationFn: ({
      trainingId,
      completed,
      score,
    }: {
      trainingId: string;
      completed: boolean;
      score: number | null;
    }) => upsertTrainingProgress(trainingId, userId, completed, score),
    onSuccess: (_data, { trainingId }) => {
      queryClient.invalidateQueries({ queryKey: ['training-progress', userId] });
      queryClient.invalidateQueries({ queryKey: ['trainings-global'] });
      setSelectedTraining(null);
      setShowQuiz(false);
    },
  });

  const handleQuizAnswer = (questionIndex: number, chosenIndex: number) => {
    const q = quizQuestions[questionIndex];
    const correct = chosenIndex === q.correct_index;
    if (correct) setQuizScore((s) => s + 1);

    if (questionIndex + 1 < quizQuestions.length) {
      setQuizStep(questionIndex + 2);
    } else {
      setQuizStep('result');
      const passed = (quizScore + (correct ? 1 : 0)) >= 3;
      if (selectedTraining && passed) {
        const newPoints = points + (selectedTraining.points ?? 0);
        upsertProgress.mutate({
          trainingId: selectedTraining.id,
          completed: true,
          score: quizScore + (correct ? 1 : 0),
        });
        updateProfileXP(userId, newPoints, user!.level).then(() => {
          getProfile(userId).then((profile) => profile && setUser(profile));
        });
      } else if (selectedTraining && !passed) {
        upsertProgress.mutate({
          trainingId: selectedTraining.id,
          completed: false,
          score: quizScore + (correct ? 1 : 0),
        });
      }
    }
  };

  const closeModal = () => {
    setSelectedTraining(null);
    setShowQuiz(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Eğitim <Text style={styles.titleAccent}>Akademisi</Text></Text>
      <Text style={styles.subtitle}>Uzmanlık yolculuğunuza devam edin.</Text>

      <Card style={styles.progressCard}>
        <View style={styles.progressRow}>
          <View>
            <Text style={styles.progressLabel}>MEVCUT SEVİYE</Text>
            <Text style={styles.progressLevel}>{user?.level ?? 'Beginner'} <Text style={styles.gradeText}>({grade})</Text></Text>
          </View>
          <View style={styles.pointsBlock}>
            <Text style={styles.pointsValue}>{points}</Text>
            <Text style={styles.pointsLabel}>Eğitim Puanı</Text>
          </View>
        </View>
      </Card>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Aktif Eğitimler</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Tamamlananlar</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills} contentContainerStyle={styles.pillsContent}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.pill, activeFilter === c.id && styles.pillActive]}
            onPress={() => setActiveFilter(c.id)}
          >
            <Text style={[styles.pillText, activeFilter === c.id && styles.pillTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filteredList.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {activeTab === 'active' ? 'Bu alanda açık veya yeni bir ders görünmüyor.' : 'Henüz tamamlanmış bir kursunuz yok.'}
          </Text>
        </Card>
      ) : (
        <View style={styles.grid}>
          {filteredList.map((t) => (
            <Card
              key={t.id}
              style={[styles.courseCard, t.locked && styles.courseCardLocked, t.completed && styles.courseCardDone]}
              onPress={() => openTraining(t)}
            >
              {t.locked && (
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
              )}
              {t.image_url ? (
                <View style={[styles.courseImage, { backgroundColor: colors.surface }]} />
              ) : (
                <View style={[styles.courseImage, styles.courseImagePlaceholder]}>
                  <Text style={styles.courseImageEmoji}>{t.type === 'video' ? '▶' : '📄'}</Text>
                </View>
              )}
              <View style={styles.courseBody}>
                <Text style={styles.courseTitle} numberOfLines={2}>{t.title}</Text>
                <View style={styles.courseMeta}>
                  <Text style={styles.courseCategory}>{CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category}</Text>
                  <Text style={styles.coursePoints}>+{t.points ?? 0} PT</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={!!selectedTraining} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{selectedTraining?.title}</Text>
              <Pressable onPress={closeModal} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕ Kapat</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {!showQuiz ? (
                <>
                  <Text style={styles.modalContent}>{selectedTraining?.content}</Text>
                  <Button title="Okudum, Sınava Geç" onPress={startQuiz} fullWidth style={styles.modalBtn} />
                </>
              ) : quizQuestions.length > 0 && typeof quizStep === 'number' && quizStep <= quizQuestions.length ? (
                <>
                  <Text style={styles.quizProgress}>Soru {quizStep} / {quizQuestions.length}</Text>
                  <Text style={styles.quizQuestion}>{quizQuestions[quizStep - 1].question}</Text>
                  {quizQuestions[quizStep - 1].options.map((opt, idx) => (
                    <Button
                      key={idx}
                      title={opt}
                      variant="secondary"
                      onPress={() => handleQuizAnswer(quizStep - 1, idx)}
                      style={styles.optionBtn}
                      textStyle={styles.optionBtnText}
                    />
                  ))}
                </>
              ) : quizStep === 'result' ? (
                <>
                  <Text style={styles.resultTitle}>{quizScore >= 3 ? 'Sınavı Geçtiniz!' : 'Sınavı Geçemediniz'}</Text>
                  <Text style={styles.resultText}>5 sorudan {quizScore} doğru. {quizScore >= 3 ? `+${selectedTraining?.points ?? 0} PT kazanıldı.` : 'Geçmek için en az 3 doğru gerekir.'}</Text>
                  <Button title="Kapat" onPress={closeModal} fullWidth />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, marginBottom: 4, color: colors.textPrimary },
  titleAccent: { color: colors.accent },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  progressCard: { marginBottom: spacing.lg },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 11, color: colors.accent, fontWeight: '700', letterSpacing: 1 },
  progressLevel: { fontSize: 18, color: colors.textPrimary, marginTop: 4 },
  gradeText: { fontSize: 12, color: colors.textSecondary },
  pointsBlock: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  pointsLabel: { fontSize: 10, color: colors.textSecondary },
  tabRow: { flexDirection: 'row', backgroundColor: colors.surface, padding: 6, borderRadius: 24, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 16 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.black, fontWeight: '600' },
  pills: { marginBottom: spacing.md },
  pillsContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.accent },
  pillText: { fontSize: 13, color: colors.textSecondary },
  pillTextActive: { color: colors.black, fontWeight: '700' },
  emptyCard: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  courseCard: { width: '47%', overflow: 'hidden' },
  courseCardLocked: { opacity: 0.6 },
  courseCardDone: { borderWidth: 1, borderColor: colors.accent },
  courseImage: { height: 100, borderRadius: borderRadius.sm },
  courseImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  courseImageEmoji: { fontSize: 28 },
  courseBody: { padding: spacing.sm },
  courseTitle: { fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs },
  courseMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseCategory: { fontSize: 11, color: colors.textSecondary },
  coursePoints: { fontSize: 11, color: colors.accent, fontWeight: '700' },
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  lockIcon: { fontSize: 28 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: spacing.md },
  modalBox: { backgroundColor: colors.glassBg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.glassBorder, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalHeaderTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  modalClose: { padding: spacing.sm },
  modalCloseText: { color: colors.error, fontSize: 12 },
  modalBody: { padding: spacing.lg },
  modalContent: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  modalBtn: { marginTop: spacing.sm },
  quizProgress: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  quizQuestion: { fontSize: 16, lineHeight: 24, color: colors.textPrimary, marginBottom: spacing.lg },
  optionBtn: { marginBottom: spacing.sm },
  optionBtnText: { textAlign: 'left' },
  resultTitle: { fontSize: 20, color: colors.textPrimary, marginBottom: spacing.sm },
  resultText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
});
