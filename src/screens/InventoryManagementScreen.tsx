import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input } from '../components';
import { useAuthStore } from '../store/authStore';
import {
  addInventoryCategory,
  addInventoryItem,
  adjustInventoryQuantityAndNotify,
  deleteInventoryCategory,
  deleteInventoryItem,
  listInventoryCategories,
  listTeamInventory,
  updateInventoryCategory,
  updateInventoryItem,
} from '../services/inventory';
import { borderRadius, colors, fonts, spacing, typography } from '../utils/theme';
import type { TeamInventoryCategory, TeamInventoryItem } from '../types';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type RouteProps = RouteProp<TeamsStackParamList, 'InventoryManagement'>;
type MainTab = 'stock' | 'admin';

type ItemFormState = {
  categoryId: string;
  name: string;
  currentQty: string;
  notes: string;
};

type CategoryFormState = {
  id: string | null;
  name: string;
  minAlertQty: string;
};

const EMPTY_ITEM_FORM: ItemFormState = {
  categoryId: '',
  name: '',
  currentQty: '0',
  notes: '',
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  id: null,
  name: '',
  minAlertQty: '0',
};

function toNumber(value: string): number {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export function InventoryManagementScreen() {
  const route = useRoute<RouteProps>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<MainTab>('stock');
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const tabAnim = React.useRef(new Animated.Value(0)).current;

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamInventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [newCategoryName, setNewCategoryName] = useState('');

  const isManager = useMemo(
    () => team.role === 'MANAGER' || team.owner_id === user?.id,
    [team.role, team.owner_id, user?.id]
  );

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['inventory-categories', team.id],
    queryFn: () => listInventoryCategories(team.id),
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory-items', team.id],
    queryFn: () => listTeamInventory(team.id),
  });

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategoryId('');
      return;
    }
    if (!categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: mainTab === 'stock' ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [mainTab, tabAnim]);

  useEffect(() => {
    if (query.trim().length > 0) setShowSearch(true);
  }, [query]);

  useEffect(() => {
    if (!isManager && mainTab === 'admin') {
      setMainTab('stock');
    }
  }, [isManager, mainTab]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const lowStockCount = useMemo(
    () => items.filter((item) => item.current_qty <= (item.category?.min_alert_qty ?? 0)).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (!selectedCategoryId) return false;
        if (item.category_id !== selectedCategoryId) return false;
        if (!search) return true;
        return item.name.toLowerCase().includes(search);
      })
      .sort((a, b) => {
        const aLow = a.current_qty <= (a.category?.min_alert_qty ?? 0);
        const bLow = b.current_qty <= (b.category?.min_alert_qty ?? 0);
        if (aLow !== bLow) return aLow ? -1 : 1;
        return a.name.localeCompare(b.name, 'tr');
      });
  }, [items, selectedCategoryId, query]);

  const tabIndicatorWidth = tabBarWidth > 0 ? (tabBarWidth - 6) / 2 : 0;
  const tabTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabIndicatorWidth],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-items', team.id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-categories', team.id] });
  };

  const addCategoryMutation = useMutation({
    mutationFn: async () => addInventoryCategory(team.id, newCategoryName),
    onSuccess: () => {
      setNewCategoryName('');
      invalidate();
    },
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Kategori eklenemedi.'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!categoryForm.id) return;
      await updateInventoryCategory(
        categoryForm.id,
        team.id,
        categoryForm.name,
        toNumber(categoryForm.minAlertQty)
      );
    },
    onSuccess: () => {
      setShowCategoryModal(false);
      setCategoryForm(EMPTY_CATEGORY_FORM);
      invalidate();
    },
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Kategori güncellenemedi.'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (category: TeamInventoryCategory) => deleteInventoryCategory(category.id, team.id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Kategori silinemedi.'),
  });

  const saveItemMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Kullanıcı bilgisi bulunamadı.');
      if (editingItem) {
        await updateInventoryItem(editingItem.id, team.id, {
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          currentQty: toNumber(itemForm.currentQty),
          notes: itemForm.notes,
        });
        return;
      }
      await addInventoryItem(team.id, user.id, {
        categoryId: itemForm.categoryId,
        name: itemForm.name,
        currentQty: toNumber(itemForm.currentQty),
        notes: itemForm.notes,
      });
    },
    onSuccess: () => {
      setShowItemModal(false);
      setEditingItem(null);
      setItemForm(EMPTY_ITEM_FORM);
      invalidate();
    },
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Ürün kaydedilemedi.'),
  });

  const adjustMutation = useMutation({
    mutationFn: async (vars: { item: TeamInventoryItem; delta: number }) =>
      adjustInventoryQuantityAndNotify(
        vars.item,
        team.id,
        vars.item.current_qty + vars.delta,
        team.name,
        team.owner_id
      ),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Stok değiştirilemedi.'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => deleteInventoryItem(itemId, team.id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Ürün silinemedi.'),
  });

  const openCreateItemModal = () => {
    setEditingItem(null);
    setItemForm({ ...EMPTY_ITEM_FORM, categoryId: categories[0]?.id ?? '' });
    setShowItemModal(true);
  };

  const openEditItemModal = (item: TeamInventoryItem) => {
    setEditingItem(item);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      currentQty: String(item.current_qty),
      notes: item.notes ?? '',
    });
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    if (!isManager) {
      Alert.alert('Yetki yok', 'Ürün yönetimi sadece ekip lideri/yönetici içindir.');
      return;
    }
    if (!itemForm.name.trim()) return Alert.alert('Uyarı', 'Ürün adı girin.');
    if (!itemForm.categoryId) return Alert.alert('Uyarı', 'Kategori seçin.');
    saveItemMutation.mutate();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      <View style={[styles.statusCard, lowStockCount > 0 && styles.statusCardAlert]}>
        <View style={[styles.statusIconWrap, lowStockCount > 0 && styles.statusIconWrapAlert]}>
          <Ionicons
            name={lowStockCount > 0 ? 'sparkles-outline' : 'shield-checkmark-outline'}
            size={16}
            color={lowStockCount > 0 ? colors.warning : colors.accent}
          />
        </View>
        <View style={styles.statusMain}>
          <Text style={styles.statusTitle}>
            {lowStockCount > 0 ? 'Kritik stok takibi aktif' : 'Stok durumu stabil'}
          </Text>
          <Text style={[styles.statusSubtitle, lowStockCount > 0 && styles.statusSubtitleAlert]}>
            {lowStockCount > 0
              ? 'Bazı ürünler eşik seviyesinde, kontrol önerilir.'
              : 'Tüm ürünler minimum seviyenin üzerinde.'}
          </Text>
        </View>
        <View style={[styles.statusBadge, lowStockCount > 0 && styles.statusBadgeAlert]}>
          <Text style={[styles.statusBadgeValue, lowStockCount > 0 && styles.statusBadgeValueAlert]}>
            {lowStockCount}
          </Text>
          <Text style={[styles.statusBadgeLabel, lowStockCount > 0 && styles.statusBadgeLabelAlert]}>
            kritik
          </Text>
        </View>
      </View>

      {isManager ? (
        <View style={styles.tabBar} onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}>
          {tabIndicatorWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabIndicator,
                {
                  width: tabIndicatorWidth,
                  transform: [{ translateX: tabTranslateX }],
                },
              ]}
            />
          )}
          <Pressable
            onPress={() => setMainTab('stock')}
            style={styles.tabBtn}
          >
            <Text style={[styles.tabBtnText, mainTab === 'stock' && styles.tabBtnTextActive]}>Depo</Text>
          </Pressable>
          <Pressable
            onPress={() => setMainTab('admin')}
            style={styles.tabBtn}
          >
            <Text style={[styles.tabBtnText, mainTab === 'admin' && styles.tabBtnTextActive]}>Admin</Text>
          </Pressable>
        </View>
      ) : null}

      <Card style={styles.contentCard}>
        {mainTab === 'stock' ? (
          <>
            <View style={styles.categoryTopRow}>
              <View style={styles.categoryTitleWrap}>
                <Text style={styles.categoryTitle}>Depo Kategorileri</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (showSearch) {
                    setShowSearch(false);
                    setQuery('');
                  } else {
                    setShowSearch(true);
                  }
                }}
                style={({ pressed }) => [styles.searchToggleBtn, pressed && styles.searchToggleBtnPressed]}
              >
                <Ionicons
                  name={showSearch ? 'close-outline' : 'search-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={styles.searchToggleText}>
                  {showSearch ? 'Kapat' : 'Urun Ara'}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stockCategoryRow}
              style={styles.categoryRowWrap}
            >
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setSelectedCategoryId(category.id)}
                  style={[
                    styles.stockCategoryChip,
                    selectedCategoryId === category.id && styles.stockCategoryChipActive,
                  ]}
                >
                  <View
                    style={[
                      styles.stockCategoryDot,
                      selectedCategoryId === category.id && styles.stockCategoryDotActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.stockCategoryChipText,
                      selectedCategoryId === category.id && styles.stockCategoryChipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {showSearch && (
              <Input
                placeholder={`${selectedCategory?.name ?? 'Kategori'} içinde ürün ara...`}
                value={query}
                onChangeText={setQuery}
                containerStyle={styles.searchInputWrap}
                autoFocus
              />
            )}

            {itemsLoading || categoriesLoading ? (
              <Text style={styles.placeholder}>Stoklar yükleniyor…</Text>
            ) : filteredItems.length === 0 ? (
              <Text style={styles.placeholder}>
                {selectedCategory ? `${selectedCategory.name} kategorisinde ürün yok.` : 'Kategori bulunamadı.'}
              </Text>
            ) : (
              <View style={styles.list}>
                {filteredItems.map((item) => {
                  const threshold = item.category?.min_alert_qty ?? 0;
                  const low = item.current_qty <= threshold;
                  return (
                    <View key={item.id} style={[styles.stockCompactRow, low && styles.stockCompactRowLow]}>
                      <Text style={styles.stockCompactName} numberOfLines={1}>
                        {item.name}
                      </Text>

                      <View style={styles.stockCompactControls}>
                        <Pressable
                          onPress={() => adjustMutation.mutate({ item, delta: -1 })}
                          style={({ pressed }) => [
                            styles.qtyBtn,
                            styles.qtyBtnNegative,
                            pressed && styles.qtyBtnPressed,
                          ]}
                        >
                          <Ionicons name="remove" size={16} color={colors.error} />
                        </Pressable>

                        <Text style={styles.stockCompactQty}>
                          {item.current_qty}
                        </Text>

                        <Pressable
                          onPress={() => adjustMutation.mutate({ item, delta: 1 })}
                          style={({ pressed }) => [
                            styles.qtyBtn,
                            styles.qtyBtnPositive,
                            pressed && styles.qtyBtnPressed,
                          ]}
                        >
                          <Ionicons name="add" size={16} color={colors.accent} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Kategori Ayarları</Text>
              <Text style={styles.sectionCaption}>
                Her kategori için minimum uyarı eşiğini belirleyin.
              </Text>
              <Input
                label="Yeni kategori"
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Örn: Bar"
              />
              <Button
                title="Kategori ekle"
                fullWidth
                onPress={() => addCategoryMutation.mutate()}
                loading={addCategoryMutation.isPending}
              />

              <View style={styles.list}>
                {categories.map((category) => (
                  <View key={category.id} style={styles.adminRow}>
                    <View style={styles.adminMain}>
                      <Text style={styles.adminTitle}>{category.name}</Text>
                      <Text style={styles.adminMeta}>Minimum uyarı: {category.min_alert_qty}</Text>
                    </View>
                    <View style={styles.stockActions}>
                      <Pressable
                        onPress={() => {
                          setCategoryForm({
                            id: category.id,
                            name: category.name,
                            minAlertQty: String(category.min_alert_qty),
                          });
                          setShowCategoryModal(true);
                        }}
                        style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          Alert.alert('Kategori sil', `"${category.name}" silinsin mi?`, [
                            { text: 'İptal', style: 'cancel' },
                            {
                              text: 'Sil',
                              style: 'destructive',
                              onPress: () => deleteCategoryMutation.mutate(category),
                            },
                          ])
                        }
                        style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Ürün Yönetimi</Text>
              <Pressable
                onPress={openCreateItemModal}
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              >
                <Ionicons name="add" size={18} color={colors.black} />
                <Text style={styles.addBtnText}>Ürün ekle</Text>
              </Pressable>
            </View>

            <View style={styles.list}>
              {items.map((item) => (
                <View key={item.id} style={styles.adminRow}>
                  <View style={styles.adminMain}>
                    <Text style={styles.adminTitle}>{item.name}</Text>
                    <Text style={styles.adminMeta}>
                      {item.category?.name ?? 'Kategori yok'} • {item.current_qty} adet
                    </Text>
                  </View>
                  <View style={styles.stockActions}>
                    <Pressable
                      onPress={() => openEditItemModal(item)}
                      style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Ürün sil', `"${item.name}" silinsin mi?`, [
                          { text: 'İptal', style: 'cancel' },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: () => deleteItemMutation.mutate(item.id),
                          },
                        ])
                      }
                      style={({ pressed }) => [styles.qtyBtn, pressed && styles.qtyBtnPressed]}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <Modal visible={showItemModal} transparent animationType="fade" onRequestClose={() => setShowItemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Ürün düzenle' : 'Yeni ürün'}</Text>
              <Pressable onPress={() => setShowItemModal(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Input
              label="Ürün adı"
              value={itemForm.name}
              onChangeText={(v) => setItemForm((prev) => ({ ...prev, name: v }))}
            />
            <Text style={styles.modalLabel}>Kategori</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalCategoryRow}>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setItemForm((prev) => ({ ...prev, categoryId: category.id }))}
                  style={[
                    styles.categoryChip,
                    itemForm.categoryId === category.id && styles.categoryChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      itemForm.categoryId === category.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Input
              label="Mevcut stok"
              value={itemForm.currentQty}
              onChangeText={(v) => setItemForm((prev) => ({ ...prev, currentQty: v }))}
              keyboardType="decimal-pad"
            />
            <Input
              label="Not (opsiyonel)"
              value={itemForm.notes}
              onChangeText={(v) => setItemForm((prev) => ({ ...prev, notes: v }))}
              multiline
              numberOfLines={3}
            />
            <Button
              title={editingItem ? 'Güncelle' : 'Kaydet'}
              fullWidth
              onPress={handleSaveItem}
              loading={saveItemMutation.isPending}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kategori Ayarı</Text>
              <Pressable onPress={() => setShowCategoryModal(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Input
              label="Kategori adı"
              value={categoryForm.name}
              onChangeText={(v) => setCategoryForm((prev) => ({ ...prev, name: v }))}
            />
            <Input
              label="Minimum stok uyarı adedi"
              value={categoryForm.minAlertQty}
              onChangeText={(v) => setCategoryForm((prev) => ({ ...prev, minAlertQty: v }))}
              keyboardType="decimal-pad"
            />
            <Button
              title="Kaydet"
              fullWidth
              onPress={() => updateCategoryMutation.mutate()}
              loading={updateCategoryMutation.isPending}
              style={styles.modalButton}
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

  heroCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '35',
    backgroundColor: colors.accent + '0C',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  statusCardAlert: {
    borderColor: colors.warning + '66',
    backgroundColor: colors.warning + '10',
  },
  statusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '14',
  },
  statusIconWrapAlert: {
    backgroundColor: colors.warning + '18',
  },
  statusMain: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    ...typography.small,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  statusSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusSubtitleAlert: {
    color: colors.warning,
  },
  statusBadge: {
    minWidth: 54,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDark,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeAlert: {
    borderColor: colors.warning + '66',
    backgroundColor: colors.warning + '14',
  },
  statusBadgeValue: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  statusBadgeValueAlert: {
    color: colors.warning,
  },
  statusBadgeLabel: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusBadgeLabelAlert: {
    color: colors.warning,
  },

  tabBar: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 3,
    marginBottom: spacing.md,
  },
  tabIndicator: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  tabBtn: {
    flex: 1,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  tabBtnDisabled: { opacity: 0.45 },
  tabBtnText: { ...typography.small, color: colors.textSecondary, fontFamily: fonts.medium },
  tabBtnTextActive: { color: colors.black },

  contentCard: { marginBottom: spacing.lg },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  categoryTitleWrap: { flex: 1, minWidth: 0 },
  categoryTitle: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  searchToggleBtn: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
  },
  searchToggleBtnPressed: { opacity: 0.8 },
  searchToggleText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  categoryRowWrap: {
    marginBottom: spacing.xs,
  },
  stockCategoryRow: {
    gap: spacing.xs,
    paddingBottom: 2,
    paddingRight: 2,
    marginBottom: spacing.sm,
  },
  stockCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    paddingVertical: 9,
    paddingHorizontal: spacing.md - 2,
  },
  stockCategoryChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '1F',
  },
  stockCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  stockCategoryDotActive: {
    backgroundColor: colors.accent,
  },
  stockCategoryChipText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  stockCategoryChipTextActive: {
    color: colors.accent,
    fontFamily: fonts.semibold,
  },
  categoryRow: { gap: spacing.xs, marginBottom: spacing.sm },
  categoryChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  categoryChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  categoryChipText: { ...typography.small, color: colors.textSecondary, fontFamily: fonts.medium },
  categoryChipTextActive: { color: colors.black },
  searchInputWrap: { marginBottom: spacing.sm },

  list: { gap: spacing.xs, marginTop: spacing.xs },
  stockCompactRow: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stockCompactRowLow: {
    borderColor: colors.warning + '66',
    backgroundColor: colors.warning + '0E',
  },
  stockCompactName: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.xs,
  },
  stockCompactControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  stockCompactQty: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    minWidth: 72,
    textAlign: 'center',
  },
  stockActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDark + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnNegative: {
    borderColor: colors.error + '55',
    backgroundColor: colors.error + '14',
  },
  qtyBtnPositive: {
    borderColor: colors.accent + '55',
    backgroundColor: colors.accent + '14',
  },
  qtyBtnPressed: { opacity: 0.8 },

  sectionBlock: { marginBottom: spacing.md },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: 4 },
  sectionCaption: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  adminMain: { flex: 1, minWidth: 0 },
  adminTitle: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.semibold },
  adminMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  addBtnPressed: { opacity: 0.9 },
  addBtnText: { ...typography.small, color: colors.black, fontFamily: fonts.semibold },

  placeholder: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.subtitle, color: colors.textPrimary },
  modalLabel: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: fonts.medium },
  modalCategoryRow: { gap: spacing.xs, marginBottom: spacing.md },
  modalButton: { marginTop: spacing.sm },
});
