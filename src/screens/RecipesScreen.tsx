import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, TabBar, Input, Button } from '../components';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import { colors, spacing, typography, fonts, borderRadius, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
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
  ...RECIPE_CATEGORIES.map((c) => ({ key: c.key, label: c.title })),
];

export function RecipesScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();

  const [activeTab, setActiveTab] = useState<RecipeTabKey>('global');
  const [globalSelectedKey, setGlobalSelectedKey] = useState(RECIPE_CATEGORIES[0]?.key ?? '');
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
      themedAlert('Hata', e instanceof Error ? e.message : 'Kategori eklenemedi.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    themedAlert('Kategoriyi sil', `"${categoryName}" ve içindeki tüm tarifler silinecek. Emin misiniz?`, [
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
            themedAlert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
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
      themedAlert('Hata', e instanceof Error ? e.message : 'Kategori güncellenemedi.');
    } finally {
      setCategorySaving(false);
    }
  };

  const selectedGlobalCategory = RECIPE_CATEGORIES.find((c) => c.key === globalSelectedKey) ?? RECIPE_CATEGORIES[0];
  const filteredGlobalItems = selectedGlobalCategory?.items ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabScrollBottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.2)', 'rgba(10, 10, 10, 0.35)', colors.bgDark]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.heroGradient,
          {
            marginHorizontal: -spacing.md,
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.heroIconBadge}>
          <Ionicons name="cafe-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.heroEyebrow}>Global rehber</Text>
        <Text style={styles.heroTitle}>Tarifler</Text>
        <Text style={styles.heroSubtitle}>Kahve, tatlı ve alkolsüz kokteyl koleksiyonu</Text>
      </LinearGradient>

      <TabBar tabs={RECIPE_TABS} activeKey={activeTab} onChange={(k) => setActiveTab(k as RecipeTabKey)} variant="primary" />

      {activeTab === 'global' && (
        <>
          <Text style={styles.intro}>
            Dünyanın dört bir yanından güncel, alkolsüz ve standartlara uygun tarifler — hızlıca göz atın.
          </Text>
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
                  {isSelected ? (
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.35)', 'rgba(212, 175, 55, 0.12)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  ) : null}
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selectedGlobalCategory ? (
            <View key={selectedGlobalCategory.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="library-outline" size={18} color={colors.accent} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionEyebrow}>Kategori</Text>
                  <Text style={styles.sectionTitleLarge}>{selectedGlobalCategory.title}</Text>
                </View>
              </View>
              {filteredGlobalItems.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Text style={styles.noRecipesText}>Bu kategoride tarif bulunamadı.</Text>
                </View>
              ) : (
                filteredGlobalItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.recipeShell, pressed && styles.recipeCardPressed]}
                    onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
                  >
                    <View style={styles.recipeGoldCap} />
                    <View style={styles.recipeCardInner}>
                      <View style={styles.recipeCardIconWrap}>
                        <Ionicons name="cafe-outline" size={22} color={colors.accent} />
                      </View>
                      <View style={styles.recipeCardBody}>
                        <Text style={styles.recipeCardTitle} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <View style={styles.recipeCardPill}>
                          <Text style={styles.recipeCardPillText}>{item.type}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
        </>
      )}

      {activeTab === 'team' && (
        <>
          {teams.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.12)', 'transparent']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="people-outline" size={32} color={colors.accent} />
              </View>
              <Text style={styles.emptyStateEyebrow}>Ekip içeriği</Text>
              <Text style={styles.emptyStateTitle}>Henüz ekip yok</Text>
              <Text style={styles.emptyStateText}>
                Bir ekibe katıldığınızda ekip tarifleri burada listelenir. Yöneticiler kategori ve tarif ekleyebilir.
              </Text>
            </View>
          ) : (
            <>
              {teams.length > 1 && (
                <View style={styles.teamPickerRow}>
                  <Text style={styles.teamPickerLabel}>Ekip seçin</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamChips}>
                    {teams.map((t) => {
                      const sel = t.id === selectedTeamId;
                      return (
                        <Pressable
                          key={t.id}
                          style={[styles.teamChip, sel && styles.teamChipSelected]}
                          onPress={() => setSelectedTeamId(t.id)}
                        >
                          {sel ? (
                            <LinearGradient
                              colors={['rgba(212, 175, 55, 0.28)', 'rgba(212, 175, 55, 0.08)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={StyleSheet.absoluteFill}
                              pointerEvents="none"
                            />
                          ) : null}
                          <Text style={[styles.teamChipText, sel && styles.teamChipTextSelected]} numberOfLines={1}>
                            {t.name}
                          </Text>
                        </Pressable>
                      );
                    })}
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
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.12)', 'transparent']}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.emptyStateIconWrap}>
                      <Ionicons name="book-outline" size={32} color={colors.accent} />
                    </View>
                    <Text style={styles.emptyStateEyebrow}>Ekip tarifleri</Text>
                    <Text style={styles.emptyStateTitle}>Kategori bekleniyor</Text>
                    <Text style={styles.emptyStateText}>
                      Bu ekip için henüz kategori oluşturulmamış. Yönetici, Yönetim sekmesinden kategori ekleyebilir.
                    </Text>
                  </View>
                ) : (
                  teamCategories.map((category) => {
                    const recipes = teamRecipesByCategory[category.id] ?? [];
                    return (
                      <View key={category.id} style={styles.teamCategorySection}>
                        <View style={styles.teamSectionHeader}>
                          <View style={styles.sectionIconBox}>
                            <Ionicons name="folder-open-outline" size={18} color={colors.accent} />
                          </View>
                          <Text style={styles.teamCategoryTitle}>{category.name}</Text>
                        </View>
                        {recipes.length === 0 ? (
                          <Text style={styles.noRecipesText}>Bu kategoride henüz tarif yok.</Text>
                        ) : (
                          recipes.map((recipe) => (
                            <Pressable
                              key={recipe.id}
                              style={({ pressed }) => [styles.teamRecipeShell, pressed && styles.recipeCardPressed]}
                              onPress={() =>
                                navigation.navigate('TeamRecipeDetail', {
                                  recipeId: recipe.id,
                                  teamId: team!.id,
                                  canEdit: isManager,
                                })
                              }
                            >
                              <View style={styles.recipeGoldCap} />
                              <View style={styles.teamRecipeRow}>
                                {recipe.image_url ? (
                                  <Image source={{ uri: recipe.image_url }} style={styles.teamRecipeImage} resizeMode="cover" />
                                ) : (
                                  <View style={styles.teamRecipeImagePlaceholder}>
                                    <Ionicons name="restaurant-outline" size={22} color={colors.accent} />
                                  </View>
                                )}
                                <View style={styles.teamRecipeBody}>
                                  <Text style={styles.teamRecipeTitle} numberOfLines={2}>
                                    {recipe.name}
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                              </View>
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
                    style={({ pressed }) => [styles.addCategoryBtn, pressed && styles.addCategoryBtnPressed]}
                    onPress={() => setAddCategoryModal(true)}
                  >
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.15)', 'rgba(22, 22, 24, 0.95)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.addCategoryIconWrap}>
                      <Ionicons name="add" size={22} color={colors.accent} />
                    </View>
                    <View style={styles.addCategoryTextCol}>
                      <Text style={styles.addCategoryTitle}>Yeni kategori</Text>
                      <Text style={styles.addCategorySub}>Mutfak, bar veya servis alanı</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>

                  {teamCategories.length === 0 ? (
                    <View style={styles.emptyStateCard}>
                      <LinearGradient
                        colors={['rgba(212, 175, 55, 0.12)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      />
                      <View style={styles.emptyStateIconWrap}>
                        <Ionicons name="folder-open-outline" size={32} color={colors.accent} />
                      </View>
                      <Text style={styles.emptyStateEyebrow}>Yönetim</Text>
                      <Text style={styles.emptyStateTitle}>Önce kategori oluşturun</Text>
                      <Text style={styles.emptyStateText}>
                        Mutfak, bar gibi alanlar ekleyin; ardından her alana tarif tanımlayın.
                      </Text>
                    </View>
                  ) : (
                    teamCategories.map((category) => {
                      const recipes = teamRecipesByCategory[category.id] ?? [];
                      return (
                        <View key={category.id} style={styles.teamCategorySection}>
                          <View style={styles.teamCategoryHeader}>
                            <View style={styles.teamSectionHeaderCompact}>
                              <View style={styles.sectionIconBox}>
                                <Ionicons name="pricetag-outline" size={16} color={colors.accent} />
                              </View>
                              <Text style={styles.teamCategoryTitleInline}>{category.name}</Text>
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
                            <Text style={styles.noRecipesText}>Bu kategoride henüz tarif yok.</Text>
                          ) : (
                            recipes.map((recipe) => (
                              <Pressable
                                key={recipe.id}
                                style={({ pressed }) => [styles.teamRecipeShell, pressed && styles.recipeCardPressed]}
                                onPress={() =>
                                  navigation.navigate('TeamRecipeDetail', {
                                    recipeId: recipe.id,
                                    teamId: team!.id,
                                    canEdit: true,
                                  })
                                }
                              >
                                <View style={styles.recipeGoldCap} />
                                <View style={styles.teamRecipeRow}>
                                  {recipe.image_url ? (
                                    <Image source={{ uri: recipe.image_url }} style={styles.teamRecipeImage} resizeMode="cover" />
                                  ) : (
                                    <View style={styles.teamRecipeImagePlaceholder}>
                                      <Ionicons name="restaurant-outline" size={22} color={colors.accent} />
                                    </View>
                                  )}
                                  <View style={styles.teamRecipeBody}>
                                    <Text style={styles.teamRecipeTitle} numberOfLines={2}>
                                      {recipe.name}
                                    </Text>
                                  </View>
                                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                                </View>
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
  content: { padding: spacing.md, paddingBottom: 0 },
  heroGradient: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: '92%',
  },
  intro: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  chipScroll: { marginBottom: spacing.lg },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 42,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: 'rgba(212, 175, 55, 0.55)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  chipPressed: { opacity: 0.88 },
  chipText: { ...typography.small, color: colors.textSecondary, zIndex: 1 },
  chipTextSelected: { color: colors.textPrimary, fontFamily: fonts.semibold },
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sectionTitleLarge: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  recipeShell: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  recipeGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  recipeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  recipeCardPressed: { opacity: 0.92 },
  recipeCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  recipeCardBody: { flex: 1, minWidth: 0 },
  recipeCardTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  recipeCardPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeCardPillText: { fontSize: 11, fontFamily: fonts.medium, color: colors.textMuted },

  emptyStateCard: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadow.md,
  },
  emptyStateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  emptyStateEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: spacing.xs,
  },
  emptyStateTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyStateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  teamPickerRow: { marginBottom: spacing.lg },
  teamPickerLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  teamChips: { flexDirection: 'row', gap: spacing.sm },
  teamChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  teamChipSelected: { borderColor: 'rgba(212, 175, 55, 0.5)' },
  teamChipText: { fontSize: 14, color: colors.textSecondary, zIndex: 1 },
  teamChipTextSelected: { color: colors.textPrimary, fontFamily: fonts.semibold },

  loadingWrap: { padding: spacing.xl, alignItems: 'center' },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.md,
  },
  addCategoryBtnPressed: { opacity: 0.92 },
  addCategoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  addCategoryTextCol: { flex: 1, minWidth: 0 },
  addCategoryTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 2 },
  addCategorySub: { fontSize: 13, color: colors.textMuted },

  teamCategorySection: { marginBottom: spacing.xl },
  teamCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  teamSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  teamSectionHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  teamCategoryTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
  },
  teamCategoryTitleInline: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.2,
  },
  teamCategoryActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  teamCategoryIconBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCategoryIconBtnPressed: { opacity: 0.8 },
  addRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  addRecipeBtnPressed: { opacity: 0.9 },
  addRecipeBtnIconWrap: { alignItems: 'center', justifyContent: 'center' },
  addRecipeBtnText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.bgDark },
  noRecipesText: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 20 },
  emptyInline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  teamRecipeShell: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  teamRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.md,
  },
  teamRecipeImage: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  teamRecipeImagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  teamRecipeBody: { flex: 1, minWidth: 0 },
  teamRecipeTitle: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textPrimary, lineHeight: 21 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: spacing.lg },
  modalBox: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: spacing.lg,
    ...shadow.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary },
  modalCloseBtn: { padding: spacing.sm },
  modalClose: { fontSize: 22, color: colors.textSecondary },
  modalHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  modalBtn: { marginTop: spacing.lg },
});
