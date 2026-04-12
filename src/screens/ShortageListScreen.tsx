import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Card, Input, Button } from '../components';
import { useAuthStore } from '../store/authStore';
import {
  listShortages,
  listShortagesFulfilled,
  addShortage,
  fulfillShortage,
  listShortageAreas,
  addShortageArea,
  updateShortageAreaName,
  deleteShortageArea,
} from '../services/shortages';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type RouteProps = RouteProp<TeamsStackParamList, 'ShortageList'>;

export function ShortageListScreen() {
  const route = useRoute<RouteProps>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [area, setArea] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [showManageAreas, setShowManageAreas] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');
  const [showEditAreaModal, setShowEditAreaModal] = useState(false);

  const isManager = useMemo(
    () => team.role === 'MANAGER' || team.owner_id === user?.id,
    [team.role, team.owner_id, user?.id]
  );

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['shortage-areas', team.id],
    queryFn: () => listShortageAreas(team.id),
  });

  const currentAreaName = useMemo(() => {
    if (area) return area;
    return areas[0]?.name ?? null;
  }, [area, areas]);

  const { data: shortages = [], isLoading } = useQuery({
    queryKey: ['shortages', team.id, currentAreaName],
    queryFn: () => listShortages(team.id, currentAreaName || ''),
    enabled: !!currentAreaName,
  });

  const { data: fulfilled = [] } = useQuery({
    queryKey: ['shortages-fulfilled', team.id, currentAreaName],
    queryFn: () => listShortagesFulfilled(team.id, currentAreaName || ''),
    enabled: !!currentAreaName,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      if (!currentAreaName) return;
      await addShortage(team.id, currentAreaName, newItem, user.id);
    },
    onSuccess: () => {
      setNewItem('');
      queryClient.invalidateQueries({ queryKey: ['shortages', team.id, currentAreaName] });
      setShowAddModal(false);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Eksik eklenemedi';
      Alert.alert('Hata', msg);
    },
  });

  const fulfillMutation = useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      if (!user?.id) return;
      if (!currentAreaName) return;
      await fulfillShortage(vars.id, team.id, currentAreaName, vars.name, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortages', team.id, currentAreaName] });
      queryClient.invalidateQueries({ queryKey: ['shortages-fulfilled', team.id, currentAreaName] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Eksik alınamadı';
      Alert.alert('Hata', msg);
    },
  });

  const handleAdd = () => {
    const label = newItem.trim();
    if (!label) return;
    addMutation.mutate();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          Eksik <Text style={styles.titleAccent}>Listesi</Text>
        </Text>
        {isManager && (
          <Pressable
            onPress={() => setShowManageAreas(true)}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      <Text style={styles.subtitle}>
        Eksik ürünleri listeleyin, ekip lideri alındıkça işaretlesin.
      </Text>

      {areasLoading ? (
        <Text style={styles.placeholder}>Alanlar yükleniyor…</Text>
      ) : areas.length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Henüz çalışma alanı yok</Text>
          <Text style={styles.sectionCaption}>
            Eksikleri gruplayabilmek için önce en az bir alan ekleyin (örn: Bar, Mutfak).
          </Text>
          {isManager ? (
            <>
              <Input
                label="Yeni alan adı"
                placeholder="Örn: Bar, Mutfak..."
                value={newAreaName}
                onChangeText={setNewAreaName}
              />
              <Button
                title="Alan ekle"
                fullWidth
                onPress={async () => {
                  const name = newAreaName.trim();
                  if (!name) return;
                  try {
                    await addShortageArea(team.id, name);
                    setNewAreaName('');
                    queryClient.invalidateQueries({
                      queryKey: ['shortage-areas', team.id],
                    });
                    setArea(name);
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Alan eklenemedi';
                    Alert.alert('Hata', msg);
                  }
                }}
                style={styles.modalButton}
              />
            </>
          ) : (
            <Text style={styles.placeholder}>
              Çalışma alanlarını ekleyebilmek için ekip liderinden yardım isteyin.
            </Text>
          )}
        </Card>
      ) : (
        <View style={styles.areaSwitch}>
          {areas.map((a) => {
            const active = (currentAreaName ?? '') === a.name;
            return (
              <Pressable
                key={a.id}
                onPress={() => setArea(a.name)}
                style={({ pressed }) => [
                  styles.areaChip,
                  active && styles.areaChipActive,
                  pressed && styles.areaChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.areaChipText,
                    active && styles.areaChipTextActive,
                  ]}
                >
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sectionTitle}>Açık eksikler</Text>
            <Text style={styles.sectionCaption}>
              Tüm ekip üyeleri bu listeye madde ekleyebilir.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => { setNewItem(''); setShowAddModal(true); }}
              style={({ pressed }) => [
                styles.addIconBtn,
                pressed && styles.addIconBtnPressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={26} color={colors.accent} />
            </Pressable>
          </View>
        </View>

        {isLoading || !currentAreaName ? (
          <Text style={styles.placeholder}>Yükleniyor…</Text>
        ) : shortages.length === 0 ? (
          <Text style={styles.placeholder}>Bu alanda kayıtlı eksik yok.</Text>
        ) : (
          <View style={styles.list}>
            {shortages.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color={colors.warning}
                    style={styles.itemIcon}
                  />
                  <Text style={styles.itemLabel}>{item.name}</Text>
                </View>
                {isManager && (
                  <Pressable
                    onPress={() =>
                      fulfillMutation.mutate({ id: item.id, name: item.name })
                    }
                    style={({ pressed }) => [
                      styles.doneChip,
                      pressed && styles.doneChipPressed,
                    ]}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="checkmark-done"
                      size={16}
                      color={colors.black}
                    />
                    <Text style={styles.doneChipText}>Alındı olarak işaretle</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Son alınanlar</Text>
        <Text style={styles.sectionCaption}>
          En son alınan 30 ürün burada listelenir.
        </Text>

        {fulfilled.length === 0 ? (
          <Text style={styles.placeholder}>Henüz alınan eksik yok.</Text>
        ) : (
          <View style={styles.list}>
            {fulfilled.map((item) => (
              <View key={item.id} style={styles.itemRowSmall}>
                <View style={styles.itemLeft}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.accent}
                    style={styles.itemIcon}
                  />
                  <Text style={styles.itemLabel}>{item.name}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eksik ekle</Text>
              <Pressable onPress={() => setShowAddModal(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Input
              label="Eksik ürün"
              placeholder="Örn: Espresso çekirdeği, Süt, Şurup..."
              value={newItem}
              onChangeText={setNewItem}
            />
            <Button
              title="Ekle"
              fullWidth
              onPress={() => {
                handleAdd();
              }}
              loading={addMutation.isLoading}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

      {isManager && (
        <Modal
          visible={showManageAreas}
          transparent
          animationType="fade"
          onRequestClose={() => setShowManageAreas(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alanları düzenle</Text>
                <Pressable onPress={() => setShowManageAreas(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Input
                label="Yeni alan adı"
                placeholder="Örn: Bar, Mutfak, Depo..."
                value={newAreaName}
                onChangeText={setNewAreaName}
              />
              <Button
                title="Alan ekle"
                fullWidth
                onPress={async () => {
                  const name = newAreaName.trim();
                  if (!name) return;
                  try {
                    await addShortageArea(team.id, name);
                    setNewAreaName('');
                    queryClient.invalidateQueries({
                      queryKey: ['shortage-areas', team.id],
                    });
                    setArea(name);
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Alan eklenemedi';
                    Alert.alert('Hata', msg);
                  }
                }}
                style={styles.modalButton}
              />
              {areas.length > 0 && (
                <View style={styles.areaList}>
                  <Text style={styles.areaListHeader}>Mevcut alanlar</Text>
                  {areas.map((a) => {
                    const active = (currentAreaName ?? '') === a.name;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => {
                          setArea(a.name);
                          setEditingAreaId(a.id);
                          setEditingAreaName(a.name);
                          setShowEditAreaModal(true);
                        }}
                        style={({ pressed }) => [
                          styles.areaListRow,
                          active && styles.areaListRowActive,
                          pressed && styles.areaListRowPressed,
                        ]}
                      >
                        <View style={styles.areaListMain}>
                          <View style={styles.areaListDotWrap}>
                            <Ionicons
                              name={active ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={active ? colors.accent : colors.textSecondary}
                            />
                          </View>
                          <View style={styles.areaListTextWrap}>
                            <Text style={styles.areaListText}>{a.name}</Text>
                          </View>
                        </View>
                        <View style={styles.areaListActions}>
                          <Pressable
                            onPress={() => {
                              setEditingAreaId(a.id);
                              setEditingAreaName(a.name);
                              setShowEditAreaModal(true);
                            }}
                            style={({ pressed }) => [
                              styles.smallIconBtn,
                              pressed && styles.smallIconBtnPressed,
                            ]}
                            hitSlop={6}
                          >
                            <Ionicons
                              name="create-outline"
                              size={16}
                              color={colors.textSecondary}
                            />
                          </Pressable>
                          <Pressable
                            onPress={async () => {
                              Alert.alert(
                                'Alanı sil',
                                `"${a.name}" alanını silmek istediğinize emin misiniz? Bu alandaki eksikler etkilenmez ancak filtrelerinizde görünmez.`,
                                [
                                  { text: 'İptal', style: 'cancel' },
                                  {
                                    text: 'Sil',
                                    style: 'destructive',
                                    onPress: async () => {
                                      try {
                                        await deleteShortageArea(a.id, team.id);
                                        if (currentAreaName === a.name) {
                                          setArea(null);
                                        }
                                        queryClient.invalidateQueries({
                                          queryKey: ['shortage-areas', team.id],
                                        });
                                      } catch (e) {
                                        const msg =
                                          e instanceof Error ? e.message : 'Alan silinemedi';
                                        Alert.alert('Hata', msg);
                                      }
                                    },
                                  },
                                ]
                              );
                            }}
                            style={({ pressed }) => [
                              styles.smallIconBtn,
                              pressed && styles.smallIconBtnPressed,
                            ]}
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {isManager && editingAreaId && (
        <Modal
          visible={showEditAreaModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowEditAreaModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alan adını düzenle</Text>
                <Pressable
                  onPress={() => {
                    setShowEditAreaModal(false);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Input
                label="Alan adı"
                placeholder="Yeni alan adı"
                value={editingAreaName}
                onChangeText={setEditingAreaName}
              />
              <Button
                title="Güncelle"
                fullWidth
                onPress={async () => {
                  const name = editingAreaName.trim();
                  if (!name || !editingAreaId) return;
                  try {
                    await updateShortageAreaName(editingAreaId, team.id, name);
                    queryClient.invalidateQueries({
                      queryKey: ['shortage-areas', team.id],
                    });
                    if (currentAreaName && currentAreaName === currentAreaName) {
                      setArea(name);
                    }
                    setShowEditAreaModal(false);
                  } catch (e) {
                    const msg =
                      e instanceof Error ? e.message : 'Alan güncellenemedi';
                    Alert.alert('Hata', msg);
                  }
                }}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleAccent: { color: colors.accent },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  placeholder: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  areaSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 3,
    marginBottom: spacing.lg,
  },
  areaChip: {
    flex: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaChipActive: {
    backgroundColor: colors.accent,
  },
  areaChipPressed: {
    opacity: 0.9,
  },
  areaChipText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  areaChipTextActive: {
    color: colors.black,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  addIconBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addIconBtnPressed: {
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
  },
  iconBtnPressed: {
    opacity: 0.7,
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
  },
  itemRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  itemIcon: {
    marginRight: spacing.xs,
  },
  itemLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  doneChipPressed: {
    opacity: 0.85,
  },
  doneChipText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.black,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  modalTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  modalButton: {
    marginTop: spacing.md,
  },
  editDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  areaList: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  areaListHeader: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  areaListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  areaListRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  areaListRowPressed: {
    opacity: 0.9,
  },
  areaListDot: {
    marginLeft: 2,
  },
  areaListMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  areaListDotWrap: {
    width: 24,
    alignItems: 'center',
  },
  areaListTextWrap: {
    flex: 1,
  },
  areaListText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  areaListActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  smallIconBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
  },
  smallIconBtnPressed: {
    opacity: 0.7,
  },
});

