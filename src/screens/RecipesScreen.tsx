import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components';
import { colors, spacing, typography, fonts } from '../utils/theme';
import { RECIPE_CATEGORIES } from '../data/recipes';

const CATEGORY_OPTIONS: { key: string; label: string }[] = [
  { key: 'hepsi', label: 'Hepsi' },
  ...RECIPE_CATEGORIES.map((c) => ({ key: c.key, label: c.title })),
];

export function RecipesScreen() {
  const navigation = useNavigation<any>();
  const [selectedKey, setSelectedKey] = useState<string>('hepsi');

  const categoriesToShow = selectedKey === 'hepsi'
    ? RECIPE_CATEGORIES
    : RECIPE_CATEGORIES.filter((c) => c.key === selectedKey);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>
        Global <Text style={styles.titleAccent}>Tarifler</Text>
      </Text>
      <Text style={styles.subtitle}>Dünyanın dört bir yanından standartlara uygun tarifler.</Text>

      <View style={styles.chipRow}>
        {CATEGORY_OPTIONS.map((opt) => {
          const isSelected = selectedKey === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSelectedKey(opt.key)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {categoriesToShow.map((category, index) => (
        <View key={category.key} style={[styles.section, index > 0 && styles.sectionNotFirst]}>
          {selectedKey === 'hepsi' && <Text style={styles.sectionTitle}>{category.title}</Text>}
          {category.items.map((item) => (
            <Card
              key={item.id}
              style={styles.card}
              onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
            >
              <View style={styles.cardInner}>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>{item.name.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardDesc}>{item.desc}</Text>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{item.type}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Card>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, marginBottom: spacing.sm, color: colors.textPrimary },
  titleAccent: { color: colors.accent },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.bgDark, fontFamily: fonts.semibold },
  section: { marginBottom: spacing.xl },
  sectionNotFirst: { marginTop: spacing.lg },
  sectionTitle: {
    ...typography.subtitle,
    fontFamily: fonts.semibold,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  card: { marginBottom: spacing.md },
  cardInner: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, marginBottom: 2, color: colors.textPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardDesc: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  pill: {
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  pillText: { fontSize: 10, color: colors.textPrimary },
  chevron: { fontSize: 20, color: colors.textSecondary },
});
