import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../components';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import { getTeamRecipe, deleteTeamRecipe } from '../services/teamRecipes';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';

type Nav = StackNavigationProp<RecipesStackParamList, 'TeamRecipeDetail'>;
type Route = RouteProp<RecipesStackParamList, 'TeamRecipeDetail'>;

export function TeamRecipeDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { recipeId, teamId, canEdit } = route.params;
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['team-recipe', recipeId],
    queryFn: () => getTeamRecipe(recipeId),
    enabled: !!recipeId,
  });

  const handleDelete = () => {
    Alert.alert('Tarifi sil', 'Bu tarifi silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTeamRecipe(recipeId);
            queryClient.invalidateQueries({ queryKey: ['team-recipes', teamId] });
            queryClient.invalidateQueries({ queryKey: ['team-recipe', recipeId] });
            navigation.goBack();
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  if (isLoading || !recipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Yükleniyor…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={2}>{recipe.name}</Text>
      </View>

      {recipe.description ? (
        <Text style={styles.desc}>{recipe.description}</Text>
      ) : null}

      {recipe.image_url ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: recipe.image_url }} style={styles.image} resizeMode="cover" />
        </View>
      ) : null}

      {recipe.ingredients && recipe.ingredients.length > 0 ? (
        <>
          <Text style={styles.stepsTitle}>Kullanılacak malzemeler</Text>
          <View style={styles.ingredientsList}>
            {recipe.ingredients.map((ing, idx) => (
              <View key={idx} style={styles.ingredientRow}>
                <Text style={styles.ingredientBullet}>•</Text>
                <Text style={styles.ingredientText}>{ing}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.stepsTitle}>Hazırlama Adımları</Text>
      {recipe.steps.length === 0 ? (
        <Text style={styles.placeholder}>Henüz adım eklenmemiş.</Text>
      ) : (
        recipe.steps.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{idx + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))
      )}

      {canEdit && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, styles.actionCardEdit, pressed && styles.actionCardPressed]}
            onPress={() =>
              navigation.navigate('TeamRecipeEditor', {
                teamId,
                categoryId: recipe.category_id,
                recipeId: recipe.id,
              })
            }
          >
            <View style={styles.actionCardIconWrap}>
              <Ionicons name="pencil-outline" size={22} color={colors.accent} />
            </View>
            <Text style={styles.actionCardLabel}>Düzenle</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionCard, styles.actionCardDelete, pressed && styles.actionCardPressed]}
            onPress={handleDelete}
          >
            <View style={[styles.actionCardIconWrap, styles.actionCardIconWrapDanger]}>
              <Ionicons name="trash-outline" size={22} color={colors.bgDark} />
            </View>
            <Text style={styles.actionCardLabelDanger}>Tarifi sil</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  placeholder: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '18',
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.semibold, color: colors.textPrimary, flex: 1 },
  imageWrap: { marginBottom: spacing.md, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.surface },
  image: { width: '100%', aspectRatio: 1 },
  desc: { fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.lg },
  stepsTitle: { ...typography.subtitle, marginBottom: spacing.md, color: colors.textPrimary },
  ingredientsList: { marginBottom: spacing.lg },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  ingredientBullet: { fontSize: 14, color: colors.accent, marginTop: 2 },
  ingredientText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.textPrimary },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNum: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: colors.bgDark, fontFamily: fonts.bold, fontSize: 14 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.textPrimary },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  actionCardEdit: {
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '12',
  },
  actionCardDelete: {
    borderColor: colors.error + '40',
    backgroundColor: colors.error + '0C',
  },
  actionCardPressed: { opacity: 0.88 },
  actionCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '22',
  },
  actionCardIconWrapDanger: {
    backgroundColor: colors.error,
  },
  actionCardLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  actionCardLabelDanger: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
});
