import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, TabBar, Input, Button } from '../components';
import { colors, spacing, typography, fonts, borderRadius } from '../utils/theme';
import { RECIPE_CATEGORIES } from '../data/recipes';
import { getMyTeams } from '../services/teams';
import {
  getTeamRecipeCategories,
  getTeamRecipes,
  createTeamRecipeCategory,
  updateTeamRecipeCategory,
  deleteTeamRecipeCategory,
} from '../services/teamRecipes';
import { useAuthStore } from '../store/authStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RecipesStackParamList } from '../navigation/RecipesStack';
import type { StackNavigationProp } from '@react-navigation/stack';

type Nav = StackNavigationProp<RecipesStackParamList, 'RecipesList'>;

type RecipeTabKey = 'global' | 'team';
type TeamRecipeSubTabKey = 'list' | 'manage';
const RECIPE_TABS: { key: RecipeTabKey; label: string }[] = [
  { key: 'global', label: 'Global Tarifler' },
  { key: 'team', label: 'Ekip Tarifleri' },
];
const TEAM_RECIPE_SUB_TABS: { key: TeamRecipeSubTabKey; label: string }[] = [
  { key: 'list', label: 'Tarifler' },
  { key: 'manage', label: 'Yönetim' },
];

const GLOBAL_CATEGORY_OPTIONS: { key: string; label: string }[] = [
  { key: 'hepsi', label: 'Hepsi' },
  ...RECIPE_CATEGORIES.map((c) => ({ key: c.key, label: c.title })),
];

export function RecipesScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const [activeTab, setActiveTab] = useState<RecipeTabKey>('global');
  const [globalSelectedKey, setGlobalSelectedKey] = useState('hepsi');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamRecipeSubTab, setTeamRecipeSubTab] = useState<TeamRecipeSubTabKey>('list');
  const [addCategoryModal, setAddCategoryModal] = useState(false);
  const [editCategoryModal, setEditCategoryModal] = useState<{ id: string; name: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ['my-teams', userId],
    queryFn: () => (userId ? getMyTeams(userId) : []),
    enabled: !!userId && activeTab === 'team',
  });

  useEffect(() => {
    if (activeTab === 'team' && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [activeTab, teams, selectedTeamId]);

  const team = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) : teams[0] ?? null;
  const isManager = !!(team && (team.role === 'MANAGER' || team.owner_id === userId));

  const { data: teamCategories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['team-recipe-categories', team?.id],
    queryFn: () => getTeamRecipeCategories(team!.id),
    enabled: !!team?.id,
  });

  const { data: allTeamRecipes = [] } = useQuery({
    queryKey: ['team-recipes', team?.id],
    queryFn: () => (team?.id ? getTeamRecipes(team.id) : []),
    enabled: !!team?.id,
  });

  const teamRecipesByCategory = React.useMemo(() => {
    const out: Record<string, typeof allTeamRecipes> = {};
    for (const cat of teamCategories) {
      out[cat.id] = allTeamRecipes.filter((r) => r.category_id === cat.id);
    }
    return out;
  }, [teamCategories, allTeamRecipes]);

  const handleAddCategory = async () => {
    if (!team || !newCategoryName.trim()) return;
    setCategorySaving(true);
    try {
      await createTeamRecipeCategory(team.id, newCategoryName.trim());
      queryClient.invalidateQueries({ queryKey: ['team-recipe-categories', team.id] });
      setAddCategoryModal(false);
      setNewCategoryName('');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kategori eklenemedi.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    Alert.alert('Kategoriyi sil', `"${categoryName}" ve içindeki tüm tarifler silinecek. Emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          if (!team) return;
          try {
            await deleteTeamRecipeCategory(categoryId);
            queryClient.invalidateQueries({ queryKey: ['team-recipe-categories', team.id] });
            queryClient.invalidateQueries({ queryKey: ['team-recipes', team.id] });
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  const handleSaveEditCategory = async () => {
    if (!editCategoryModal || !editCategoryModal.name.trim()) return;
    setCategorySaving(true);
    try {
      await updateTeamRecipeCategory(editCategoryModal.id, editCategoryModal.name.trim());
      queryClient.invalidateQueries({ queryKey: ['team-recipe-categories', team?.id] });
      setEditCategoryModal(null);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kategori güncellenemedi.');
    } finally {
      setCategorySaving(false);
    }
  };

  const globalCategoriesToShow =
    globalSelectedKey === 'hepsi' ? RECIPE_CATEGORIES : RECIPE_CATEGORIES.filter((c) => c.key === globalSelectedKey);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.title}>Tarifler</Text>
        <Text style={styles.heroSubtitle}>Kahve, tatlı ve kokteyl rehberi</Text>
      </View>
      <TabBar tabs={RECIPE_TABS} activeKey={activeTab} onChange={(k) => setActiveTab(k as RecipeTabKey)} variant="primary" />

      {activeTab === 'global' && (
        <>
          <Text style={styles.subtitle}>Dünyanın dört bir yanından standartlara uygun tarifler.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            {GLOBAL_CATEGORY_OPTIONS.map((opt) => {
              const isSelected = globalSelectedKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setGlobalSelectedKey(opt.key)}
                  style={({ pressed }) => [styles.chip, isSelected && styles.chipSelected, pressed && styles.chipPressed]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {globalCategoriesToShow.map((category, index) => (
            <View key={category.key} style={[styles.section, index > 0 && styles.sectionNotFirst]}>
              {globalSelectedKey === 'hepsi' && (
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionTitleAccent} />
                  <Text style={styles.sectionTitle}>{category.title}</Text>
                </View>
              )}
              {category.items.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.recipeCard, pressed && styles.recipeCardPressed]}
                  onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
                >
                  <View style={styles.recipeCardIconWrap}>
                    <Ionicons name="cafe-outline" size={24} color={colors.accent} />
                  </View>
                  <View style={styles.recipeCardBody}>
                    <Text style={styles.recipeCardTitle} numberOfLines={1}>{item.name.toUpperCase()}</Text>
                    <View style={styles.recipeCardPill}>
                      <Text style={styles.recipeCardPillText}>{item.type}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          ))}
        </>
      )}

      {activeTab === 'team' && (
        <>
          {teams.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="restaurant-outline" size={40} color={colors.accent} />
              </View>
              <Text style={styles.emptyStateTitle}>Ekip tarifleri</Text>
              <Text style={styles.emptyStateText}>Bir ekibe katıldığınızda burada ekip tariflerini görebilirsiniz. Ekip lideri Yönetim sekmesinden kategoriler ve tarifler ekleyebilir.</Text>
            </View>
          ) : (
            <>
              {teams.length > 1 && (
                <View style={styles.teamPickerRow}>
                  <Text style={styles.teamPickerLabel}>Ekip</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamChips}>
                    {teams.map((t) => (
                      <Pressable
                        key={t.id}
                        style={[styles.teamChip, t.id === selectedTeamId && styles.teamChipSelected]}
                        onPress={() => setSelectedTeamId(t.id)}
                      >
                        <Text style={[styles.teamChipText, t.id === selectedTeamId && styles.teamChipTextSelected]} numberOfLines={1}>
                          {t.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {isManager ? (
                <TabBar
                  tabs={TEAM_RECIPE_SUB_TABS}
                  activeKey={teamRecipeSubTab}
                  onChange={(k) => setTeamRecipeSubTab(k as TeamRecipeSubTabKey)}
                />
              ) : null}

              {categoriesLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={colors.accent} />
                </View>
              ) : teamRecipeSubTab === 'list' || !isManager ? (
                /* Tarifler: sadece listeleme, düzenleme yok */
                teamCategories.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <View style={styles.emptyStateIconWrap}>
                      <Ionicons name="book-outline" size={40} color={colors.accent} />
                    </View>
                    <Text style={styles.emptyStateTitle}>Henüz tarif yok</Text>
                    <Text style={styles.emptyStateText}>Bu ekip için henüz tarif kategorisi eklenmemiş. Ekip lideriniz Yönetim sekmesinden ekleyebilir.</Text>
                  </View>
                ) : (
                  teamCategories.map((category) => {
                    const recipes = teamRecipesByCategory[category.id] ?? [];
                    return (
                      <View key={category.id} style={styles.teamCategorySection}>
                        <View style={styles.sectionTitleRow}>
                          <View style={styles.sectionTitleAccent} />
                          <Text style={styles.teamCategoryTitle}>{category.name}</Text>
                        </View>
                        {recipes.length === 0 ? (
                          <Text style={styles.noRecipesText}>Henüz tarif yok.</Text>
                        ) : (
                          recipes.map((recipe) => (
                            <Pressable
                              key={recipe.id}
                              style={({ pressed }) => [styles.teamRecipeCard, pressed && styles.recipeCardPressed]}
                              onPress={() =>
                                navigation.navigate('TeamRecipeDetail', {
                                  recipeId: recipe.id,
                                  teamId: team!.id,
                                  canEdit: isManager,
                                })
                              }
                            >
                              {recipe.image_url ? (
                                <Image source={{ uri: recipe.image_url }} style={styles.teamRecipeImage} resizeMode="cover" />
                              ) : (
                                <View style={styles.teamRecipeImagePlaceholder}>
                                  <Ionicons name="restaurant-outline" size={24} color={colors.accent} />
                                </View>
                              )}
                              <View style={styles.teamRecipeBody}>
                                <Text style={styles.teamRecipeTitle} numberOfLines={1}>{recipe.name.toUpperCase()}</Text>
                              </View>
                              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                            </Pressable>
                          ))
                        )}
                      </View>
                    );
                  })
                )
              ) : (
                /* Yönetim: sadece ekip lideri görür – kategori ekle, düzenle/sil, tarif ekle */
                <>
                  <Pressable
                    style={[styles.addCategoryBtn, addCategoryModal && styles.addCategoryBtnPressed]}
                    onPress={() => setAddCategoryModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                    <Text style={styles.addCategoryBtnText}>Kategori ekle (Mutfak, Bar vb.)</Text>
                  </Pressable>

                  {teamCategories.length === 0 ? (
                    <View style={styles.emptyStateCard}>
                      <View style={styles.emptyStateIconWrap}>
                        <Ionicons name="folder-open-outline" size={40} color={colors.accent} />
                      </View>
                      <Text style={styles.emptyStateTitle}>Henüz kategori yok</Text>
                      <Text style={styles.emptyStateText}>Yukarıdaki butonla Mutfak, Bar gibi çalışma alanları oluşturun, sonra kategoriye tarif ekleyin.</Text>
                    </View>
                  ) : (
                    teamCategories.map((category) => {
                      const recipes = teamRecipesByCategory[category.id] ?? [];
                      return (
                        <View key={category.id} style={styles.teamCategorySection}>
                          <View style={styles.teamCategoryHeader}>
                            <View style={styles.sectionTitleRow}>
                              <View style={styles.sectionTitleAccent} />
                              <Text style={styles.teamCategoryTitle}>{category.name}</Text>
                            </View>
                            <View style={styles.teamCategoryActions}>
                              <Pressable
                                style={({ pressed }) => [styles.teamCategoryIconBtn, pressed && styles.teamCategoryIconBtnPressed]}
                                onPress={() => setEditCategoryModal({ id: category.id, name: category.name })}
                              >
                                <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [styles.teamCategoryIconBtn, pressed && styles.teamCategoryIconBtnPressed]}
                                onPress={() => handleDeleteCategory(category.id, category.name)}
                              >
                                <Ionicons name="trash-outline" size={18} color={colors.error} />
                              </Pressable>
                              <Pressable
                                style={({ pressed }) => [styles.addRecipeBtn, pressed && styles.addRecipeBtnPressed]}
                                onPress={() =>
                                  navigation.navigate('TeamRecipeEditor', {
                                    teamId: team!.id,
                                    categoryId: category.id,
                                  })
                                }
                              >
                                <View style={styles.addRecipeBtnIconWrap}>
                                  <Ionicons name="add" size={18} color={colors.bgDark} />
                                </View>
                                <Text style={styles.addRecipeBtnText}>Tarif ekle</Text>
                              </Pressable>
                            </View>
                          </View>
                          {recipes.length === 0 ? (
                            <Text style={styles.noRecipesText}>Henüz tarif yok.</Text>
                          ) : (
                            recipes.map((recipe) => (
                              <Pressable
                                key={recipe.id}
                                style={({ pressed }) => [styles.teamRecipeCard, pressed && styles.recipeCardPressed]}
                                onPress={() =>
                                  navigation.navigate('TeamRecipeDetail', {
                                    recipeId: recipe.id,
                                    teamId: team!.id,
                                    canEdit: true,
                                  })
                                }
                              >
                                {recipe.image_url ? (
                                  <Image source={{ uri: recipe.image_url }} style={styles.teamRecipeImage} resizeMode="cover" />
                                ) : (
                                  <View style={styles.teamRecipeImagePlaceholder}>
                                    <Ionicons name="restaurant-outline" size={24} color={colors.accent} />
                                  </View>
                                )}
                                <View style={styles.teamRecipeBody}>
                                  <Text style={styles.teamRecipeTitle} numberOfLines={1}>{recipe.name.toUpperCase()}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                              </Pressable>
                            ))
                          )}
                        </View>
                      );
                    })
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <Modal visible={addCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni kategori</Text>
              <Pressable onPress={() => setAddCategoryModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalHint}>Çalışma alanı adı (örn. Mutfak, Bar)</Text>
            <Input
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Kategori adı"
              autoCapitalize="words"
            />
            <Button title="Ekle" onPress={handleAddCategory} loading={categorySaving} style={styles.modalBtn} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!editCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kategoriyi düzenle</Text>
              <Pressable onPress={() => setEditCategoryModal(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalHint}>Kategori adı</Text>
            <Input
              value={editCategoryModal?.name ?? ''}
              onChangeText={(name) => editCategoryModal && setEditCategoryModal({ ...editCategoryModal, name })}
              placeholder="Mutfak, Bar..."
              autoCapitalize="words"
            />
            <Button
              title="Kaydet"
              onPress={handleSaveEditCategory}
              loading={categorySaving}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  hero: { marginBottom: spacing.md },
  title: { ...typography.title, marginBottom: spacing.xs, color: colors.textPrimary },
  heroSubtitle: { fontSize: 14, color: colors.textMuted, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  chipScroll: { marginBottom: spacing.lg },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipPressed: { opacity: 0.85 },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.bgDark, fontFamily: fonts.semibold },
  section: { marginBottom: spacing.xl },
  sectionNotFirst: { marginTop: spacing.lg },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionTitleAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.accent, marginRight: spacing.sm },
  sectionTitle: {
    ...typography.subtitle,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  recipeCardPressed: { opacity: 0.92 },
  recipeCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeCardBody: { flex: 1, minWidth: 0 },
  recipeCardTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.textPrimary, letterSpacing: 0.5 },
  recipeCardPill: { alignSelf: 'flex-start', marginTop: spacing.xs, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surface, borderRadius: borderRadius.sm },
  recipeCardPillText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary },

  emptyStateCard: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  emptyStateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: { fontSize: 17, fontFamily: fonts.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyStateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  teamPickerRow: { marginBottom: spacing.lg },
  teamPickerLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  teamChips: { flexDirection: 'row', gap: spacing.sm },
  teamChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamChipSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  teamChipText: { fontSize: 14, color: colors.textSecondary },
  teamChipTextSelected: { color: colors.accent, fontFamily: fonts.semibold },

  loadingWrap: { padding: spacing.xl, alignItems: 'center' },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '0C',
  },
  addCategoryBtnPressed: { opacity: 0.9 },
  addCategoryBtnText: { fontSize: 14, fontFamily: fonts.medium, color: colors.accent },

  teamCategorySection: { marginBottom: spacing.xl },
  teamCategoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  teamCategoryTitle: { ...typography.subtitle, fontFamily: fonts.semibold, color: colors.accent },
  teamCategoryActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamCategoryIconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCategoryIconBtnPressed: { opacity: 0.8 },
  addRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  addRecipeBtnPressed: { opacity: 0.9 },
  addRecipeBtnIconWrap: { alignItems: 'center', justifyContent: 'center' },
  addRecipeBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.bgDark },
  noRecipesText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  teamRecipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  teamRecipeImage: { width: 56, height: 56, borderRadius: borderRadius.md },
  teamRecipeImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRecipeBody: { flex: 1, minWidth: 0 },
  teamRecipeTitle: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textPrimary, letterSpacing: 0.4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { backgroundColor: colors.glassBg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontFamily: fonts.semibold, color: colors.textPrimary },
  modalCloseBtn: { padding: spacing.sm },
  modalClose: { fontSize: 22, color: colors.textSecondary },
  modalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  modalBtn: { marginTop: spacing.lg },
});
