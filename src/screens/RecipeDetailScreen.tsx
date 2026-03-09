import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../components';
import { colors, spacing, typography } from '../utils/theme';
import { getRecipeDetail } from '../data/recipes';

export function RecipeDetailScreen() {
  const route = useRoute<{ params: { id: string } }>();
  const navigation = useNavigation<any>();
  const id = route.params?.id ?? 'espresso';
  const recipe = getRecipeDetail(id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle}>{recipe.name}</Text>
      </View>

      <Text style={styles.desc}>{recipe.desc}</Text>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statIcon}>⏱</Text>
          <Text style={styles.statLabel}>Süre</Text>
          <Text style={styles.statValue}>{recipe.stats.time}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statIcon}>💧</Text>
          <Text style={styles.statLabel}>Çıktı (Yield)</Text>
          <Text style={styles.statValue}>{recipe.stats.water}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statIcon}>🌡</Text>
          <Text style={styles.statLabel}>Sıcaklık</Text>
          <Text style={styles.statValue}>{recipe.stats.temp}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statIcon}>ℹ</Text>
          <Text style={styles.statLabel}>Demleme Oranı</Text>
          <Text style={styles.statValue}>{recipe.stats.ratio}</Text>
        </Card>
      </View>

      <Text style={styles.stepsTitle}>Hazırlama Adımları</Text>
      {recipe.steps.map((step, idx) => (
        <View key={idx} style={styles.stepRow}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{idx + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1.5, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, color: colors.textPrimary, flex: 1 },
  desc: { fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: { width: '47%', alignItems: 'center', padding: spacing.md },
  statIcon: { fontSize: 20, marginBottom: spacing.sm },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  statValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  stepsTitle: { ...typography.subtitle, marginBottom: spacing.md, color: colors.textPrimary },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  stepNum: {
    minWidth: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: colors.black, fontWeight: '700', fontSize: 14 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.textPrimary },
});
