import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Card, Button } from '../components';
import { useAuthStore } from '../store/authStore';
import { getProfile } from '../services/auth';
import { updateProfileXP } from '../services/auth';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import { ONBOARDING_ROLES, ONBOARDING_QUESTION_POOL, getOnboardingLevel } from '../data/onboarding';

const ONBOARDING_STORAGE_KEY = 'doubleshot_onboarding_completed';

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<1 | 'result' | number>(1);
  const [role, setRole] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState<typeof ONBOARDING_QUESTION_POOL>([]);

  useEffect(() => {
    const shuffled = [...ONBOARDING_QUESTION_POOL].sort(() => 0.5 - Math.random());
    setQuestions(shuffled.slice(0, 5));
  }, []);

  const handleRoleSelect = (r: string) => {
    setRole(r);
    setTimeout(() => setStep(2), 400);
  };

  const handleAnswer = (idx: number) => {
    const currentStep = typeof step === 'number' ? step : 0;
    const questionIndex = currentStep - 2;
    const isCorrect = idx === questions[questionIndex]?.answer;
    if (isCorrect) setScore((s) => s + 1);

    if (currentStep - 1 < questions.length) {
      setStep(currentStep + 1);
    } else {
      setStep('result');
    }
  };

  const handleFinish = async () => {
    const levelInfo = getOnboardingLevel(score);
    if (!user?.id) {
      onComplete();
      return;
    }
    try {
      await updateProfileXP(user.id, levelInfo.points, levelInfo.level);
      const updated = await getProfile(user.id);
      if (updated) setUser(updated);
    } catch (_) {
      // ignore
    }
    await SecureStore.setItemAsync(ONBOARDING_STORAGE_KEY, 'true');
    onComplete();
  };

  const levelInfo = step === 'result' ? getOnboardingLevel(score) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Double<Text style={styles.headerTitleAccent}>Shot</Text>
        </Text>
        <Text style={styles.headerSub}>Global Kahve Topluluğu</Text>
      </View>

      {step === 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bize kendinden bahset</Text>
          <Text style={styles.sectionDesc}>Kahve sektöründeki rolün nedir?</Text>
          {ONBOARDING_ROLES.map((r) => (
            <Card
              key={r.id}
              style={[styles.roleCard, role === r.id && styles.roleCardSelected]}
              onPress={() => handleRoleSelect(r.id)}
            >
              <View style={styles.roleRow}>
                <View>
                  <Text style={styles.roleLabel}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </View>
                <View style={[styles.radio, role === r.id && styles.radioSelected]}>
                  {role === r.id ? <Text style={styles.radioCheck}>✓</Text> : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {typeof step === 'number' && step >= 2 && step <= questions.length + 1 && questions[step - 2] && (
        <View style={styles.section}>
          <View style={styles.quizHeader}>
            <Text style={styles.quizProgress}>Soru {step - 1} / {questions.length}</Text>
            <Text style={styles.quizBadge}>Seviye Tespiti</Text>
          </View>
          <Text style={styles.questionText}>{questions[step - 2].q}</Text>
          {questions[step - 2].options.map((opt, idx) => (
            <Button
              key={idx}
              title={opt}
              variant="secondary"
              onPress={() => handleAnswer(idx)}
              style={styles.optionBtn}
              textStyle={styles.optionBtnText}
            />
          ))}
        </View>
      )}

      {step === 'result' && levelInfo && (
        <View style={styles.section}>
          <View style={styles.resultIcon}>
            <Text style={styles.resultIconText}>✓</Text>
          </View>
          <Text style={styles.resultTitle}>Test Tamamlandı!</Text>
          <Text style={styles.resultSub}>Belirlenen Kahve Seviyen:</Text>
          <Card style={styles.resultCard}>
            <Text style={styles.resultGrade}>{levelInfo.grade}</Text>
            <Text style={styles.resultLevel}>{levelInfo.title}</Text>
          </Card>
          <Button title="Ana Sayfaya Git" onPress={handleFinish} fullWidth />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1, justifyContent: 'center', minHeight: '100%' },
  header: { alignItems: 'center', marginBottom: 40 },
  headerTitle: { fontSize: 28, letterSpacing: -1, color: colors.textPrimary, fontWeight: '700' },
  headerTitleAccent: { color: colors.accent },
  headerSub: { marginTop: spacing.sm, color: colors.textSecondary, fontSize: 14 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 22, marginBottom: spacing.sm, textAlign: 'center', color: colors.textPrimary },
  sectionDesc: { textAlign: 'center', marginBottom: spacing.lg, fontSize: 14, color: colors.textSecondary },
  roleCard: { marginBottom: spacing.sm },
  roleCardSelected: { borderColor: colors.accent, borderWidth: 1 },
  roleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleLabel: { fontSize: 16, marginBottom: 4, color: colors.textPrimary },
  roleDesc: { fontSize: 12, color: colors.textSecondary },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.accent },
  radioCheck: { color: colors.black, fontSize: 14, fontWeight: '700' },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  quizProgress: { fontSize: 14, color: colors.textSecondary },
  quizBadge: { fontSize: 14, color: colors.accent },
  questionText: { fontSize: 20, marginBottom: spacing.xl, lineHeight: 28, color: colors.textPrimary },
  optionBtn: { marginBottom: spacing.sm },
  optionBtnText: { textAlign: 'left' },
  resultIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  resultIconText: { color: colors.accent, fontSize: 40, fontWeight: '700' },
  resultTitle: { fontSize: 24, marginBottom: spacing.sm, textAlign: 'center', color: colors.textPrimary },
  resultSub: { textAlign: 'center', marginBottom: spacing.md, color: colors.textSecondary },
  resultCard: { padding: spacing.lg, marginBottom: spacing.xl, alignItems: 'center' },
  resultGrade: { fontSize: 36, fontWeight: '700', color: colors.accent, marginBottom: spacing.sm },
  resultLevel: { fontSize: 18, color: colors.textPrimary },
});
