import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components';
import { colors, spacing, typography } from '../utils/theme';
import { COFFEE_TYPES } from '../data/recipes';

export function RecipesScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>
        Global <Text style={styles.titleAccent}>Tarifler</Text>
      </Text>
      <Text style={styles.subtitle}>Dünyanın dört bir yanından standartlara uygun kahve tarifleri.</Text>

      {COFFEE_TYPES.map((coffee) => (
        <Card
          key={coffee.id}
          style={styles.card}
          onPress={() => navigation.navigate('RecipeDetail', { id: coffee.id })}
        >
          <View style={styles.cardInner}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>{coffee.name.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{coffee.name}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardDesc}>{coffee.desc}</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{coffee.type}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, marginBottom: spacing.sm, color: colors.textPrimary },
  titleAccent: { color: colors.accent },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
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
