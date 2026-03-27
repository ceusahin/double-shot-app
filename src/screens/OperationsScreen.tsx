import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input } from '../components';
import { useAuthStore } from '../store/authStore';
import { getMyTeams } from '../services/teams';
import { getOperationTasks, getTodayOperationTaskLogs, setOperationTaskCompleted } from '../services/operations';
import { supabase } from '../services/supabase';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { OperationTask, OperationTaskLog } from '../types';

const WEEK_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;


export function OperationsScreen() {
  const todayIndex = useMemo(() => {
    const jsIndex = new Date().getDay(); // 0=Paz, 1=Pzt...
    if (jsIndex === 0) return 6; // Paz
    return jsIndex - 1; // Pzt=0 ...
  }, []);

  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(todayIndex);
  const [activeTab, setActiveTab] = useState<'today' | 'admin'>('today');
  const [newOpeningLabel, setNewOpeningLabel] = useState('');
  const [newOpeningDetails, setNewOpeningDetails] = useState('');
  const [newClosingLabel, setNewClosingLabel] = useState('');
  const [newClosingDetails, setNewClosingDetails] = useState('');
  const [newMaintenanceLabel, setNewMaintenanceLabel] = useState('');
  const [newMaintenanceDetails, setNewMaintenanceDetails] = useState('');
  const [maintenanceDayIndex, setMaintenanceDayIndex] = useState<number>(todayIndex);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [infoTask, setInfoTask] = useState<OperationTask | null>(null);

  const user = useAuthStore((s) => s.user);

  const { data: teams = [] } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!user?.id,
  });

  const activeTeam = teams[0] ?? null;
  const canManage =
    !!activeTeam &&
    user &&
    (activeTeam.role === 'MANAGER' || activeTeam.owner_id === user.id);

  useEffect(() => {
    if (!canManage && activeTab === 'admin') {
      setActiveTab('today');
    }
  }, [canManage, activeTab]);

  const todayStr = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  const {
    data: tasks = [],
    isLoading,
    error,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['operation-tasks', activeTeam?.id ?? null],
    queryFn: () => getOperationTasks(activeTeam?.id ?? null),
    enabled: !!user?.id,
  });

  const selectedDay = WEEK_DAYS[selectedDayIndex];

  const maintenanceTasksForDay: OperationTask[] = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.type === 'maintenance' &&
        t.day_of_week === selectedDayIndex
    );
  }, [tasks, selectedDayIndex]);

  const openingTasks: OperationTask[] = useMemo(
    () => tasks.filter((t) => t.type === 'opening'),
    [tasks]
  );
  const closingTasks: OperationTask[] = useMemo(
    () => tasks.filter((t) => t.type === 'closing'),
    [tasks]
  );

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['operation-task-logs', activeTeam?.id ?? null, todayStr],
    queryFn: () => {
      if (!activeTeam?.id) return [];
      return getTodayOperationTaskLogs(activeTeam.id, todayStr);
    },
    enabled: !!user?.id && !!activeTeam?.id,
  });

  const completedIds = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      set.add(log.operation_task_id);
    });
    return set;
  }, [logs]);

  const logByTaskId = useMemo(() => {
    const map = new Map<string, OperationTaskLog>();
    logs.forEach((log) => {
      map.set(log.operation_task_id, log);
    });
    return map;
  }, [logs]);

  const selectedTaskLog = infoTask ? logByTaskId.get(infoTask.id) : undefined;
  const selectedTaskChecker = selectedTaskLog?.user
    ? [selectedTaskLog.user.name, selectedTaskLog.user.surname].filter(Boolean).join(' ') ||
      selectedTaskLog.user.email
    : undefined;

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activeTeam?.id) return;

    const channel = supabase
      .channel(`operation-task-logs:${activeTeam.id}:${todayStr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operation_task_logs',
        },
        (payload) => {
          const changedTeamId =
            (payload.new as { team_id?: string } | null)?.team_id ??
            (payload.old as { team_id?: string } | null)?.team_id;

          if (changedTeamId !== activeTeam.id) return;

          queryClient.refetchQueries({
            queryKey: ['operation-task-logs', activeTeam.id, todayStr],
            type: 'active',
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          queryClient.refetchQueries({
            queryKey: ['operation-task-logs', activeTeam.id, todayStr],
            type: 'active',
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTeam?.id, todayStr, queryClient]);

  const toggleMutation = useMutation({
    mutationFn: async (vars: { taskId: string; completed: boolean }) => {
      if (!activeTeam?.id || !user?.id) return;
      await setOperationTaskCompleted(vars.taskId, activeTeam.id, user.id, !vars.completed, todayStr);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Görev güncellenemedi';
      Alert.alert('Hata', msg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['operation-task-logs', activeTeam?.id ?? null, todayStr],
      });
    },
  });

  const renderChecklist = (
    title: string,
    items: OperationTask[],
    completedSet: Set<string>,
    onToggle: (taskId: string, completed: boolean) => void
  ) => (
    <View style={styles.checklistSection}>
      <View style={styles.checklistHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="checkmark-done-outline" size={14} color={colors.accent} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionCaption}>
          {items.filter((i) => completedSet.has(i.id)).length}/{items.length} tamamlandı
        </Text>
      </View>
      {items.map((item) => {
        const checked = completedSet.has(item.id);
        return (
          <View key={item.id} style={styles.checkRowWrap}>
            <Pressable
              onPress={() => onToggle(item.id, checked)}
              style={({ pressed }) => [
                styles.checkRow,
                checked && styles.checkRowDone,
                pressed && styles.checkRowPressed,
              ]}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && (
                  <Ionicons name="checkmark" size={16} color={colors.black} />
                )}
              </View>
              <Text
                style={[styles.checkLabel, checked && styles.checkLabelDone]}
                numberOfLines={2}
              >
                {item.label}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInfoTask(item)}
              style={({ pressed }) => [styles.infoBtn, pressed && styles.infoBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Madde bilgisi"
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([refetchTasks(), refetchLogs()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Veriler yenilenemedi';
      Alert.alert('Hata', msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Operasyon <Text style={styles.titleAccent}>Takvimi</Text>
      </Text>
      <Text style={styles.subtitle}>
        Makine bakımları ile açılış/kapanış kontrollerini tek ekrandan yönetin.
      </Text>

      {canManage && (
        <View style={styles.tabSwitch}>
          <Pressable
            style={[
              styles.tabChip,
              activeTab === 'today' && styles.tabChipActive,
            ]}
            onPress={() => setActiveTab('today')}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'today' && styles.tabChipTextActive,
              ]}
            >
              Günlük görünüm
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabChip,
              activeTab === 'admin' && styles.tabChipActive,
            ]}
            onPress={() => setActiveTab('admin')}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'admin' && styles.tabChipTextActive,
              ]}
            >
              Admin kontrolleri
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Operasyon görevleri yükleniyor…</Text>
        </View>
      )}
      {error && !isLoading && (
        <Text style={styles.errorText}>
          Operasyon görevleri yüklenemedi. Lütfen bağlantınızı veya yetkilerinizi kontrol edin.
        </Text>
      )}

      {activeTab === 'today' && (
        <>
          <Card style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              </View>
              <Text style={styles.sectionTitle}>Bakım Takvimi</Text>
            </View>
            <Text style={styles.sectionCaption}>
              Haftalık makine & ekipman bakımlarınızı buradan takip edin.
            </Text>

            <View style={styles.daysWrap}>
              {WEEK_DAYS.map((day, index) => {
                const isActive = index === selectedDayIndex;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setSelectedDayIndex(index)}
                    style={({ pressed }) => [
                      styles.dayPill,
                      isActive && styles.dayPillActive,
                      pressed && styles.dayPillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        isActive && styles.dayPillTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {maintenanceTasksForDay.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.emptyText}>
                  Bu gün için tanımlı bakım görevi yok.
                </Text>
              </View>
            ) : (
              <View style={styles.maintenanceList}>
                {maintenanceTasksForDay.map((task) => (
                  <View key={task.id} style={styles.maintenanceRow}>
                    <View style={styles.maintenanceIconWrap}>
                      <Ionicons name="cafe-outline" size={18} color={colors.accent} />
                    </View>
                    <Text style={styles.maintenanceLabel}>{task.label}</Text>
                    <Pressable
                      onPress={() => setInfoTask(task)}
                      style={({ pressed }) => [styles.infoBtn, pressed && styles.infoBtnPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Bakım maddesi bilgisi"
                    >
                      <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <View style={styles.checklistTopRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="list-outline" size={14} color={colors.accent} />
                </View>
                <Text style={styles.sectionTitle}>Açılış / Kapanış Kontrolleri</Text>
              </View>
              <Pressable
                onPress={handleRefresh}
                disabled={isRefreshing}
                style={({ pressed }) => [
                  styles.refreshBtn,
                  isRefreshing && styles.refreshBtnDisabled,
                  pressed && styles.refreshBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Checklist verilerini yenile"
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <Ionicons name="refresh" size={16} color={colors.black} />
                )}
                <Text style={styles.refreshBtnText}>Yenile</Text>
              </Pressable>
            </View>
            {renderChecklist(
              'Açılış Kontrol Listesi',
              openingTasks,
              completedIds,
              (taskId, completed) => toggleMutation.mutate({ taskId, completed })
            )}

            {renderChecklist(
              'Kapanış Kontrol Listesi',
              closingTasks,
              completedIds,
              (taskId, completed) => toggleMutation.mutate({ taskId, completed })
            )}
          </Card>
        </>
      )}

      {activeTab === 'admin' && canManage && (
        <>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Bakım takvimi yönetimi</Text>
            <Text style={styles.sectionCaption}>
              Günlere göre makine bakım görevlerini ekleyin veya güncelleyin.
            </Text>

            <View style={styles.daysWrap}>
              {WEEK_DAYS.map((day, index) => {
                const isActive = index === maintenanceDayIndex;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setMaintenanceDayIndex(index)}
                    style={({ pressed }) => [
                      styles.dayPill,
                      isActive && styles.dayPillActive,
                      pressed && styles.dayPillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        isActive && styles.dayPillTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.addRow}>
              <Input
                label="Yeni bakım maddesi"
                placeholder="Örn: Grup başlıklarını backflush yap"
                value={newMaintenanceLabel}
                onChangeText={setNewMaintenanceLabel}
              />
              <Input
                label="Bilgi notu (opsiyonel)"
                placeholder="Örn: Kör filtreyi 10 sn aralıkla 5 kez çalıştırın."
                value={newMaintenanceDetails}
                onChangeText={setNewMaintenanceDetails}
                multiline
              />
              <Button
                title="Bakım maddesi ekle"
                fullWidth
                variant="outline"
                onPress={async () => {
                  const label = newMaintenanceLabel.trim();
                  if (!label || !activeTeam?.id) return;
                  try {
                    const { data, error } = await supabase
                      .from('operation_tasks')
                      .insert({
                        team_id: activeTeam.id,
                        type: 'maintenance',
                        label,
                        details: newMaintenanceDetails.trim() || null,
                        day_of_week: maintenanceDayIndex,
                        sort_order: maintenanceTasksForDay.length,
                      })
                      .select('*');
                    if (error) throw error;
                    setNewMaintenanceLabel('');
                    setNewMaintenanceDetails('');
                    queryClient.invalidateQueries({
                      queryKey: ['operation-tasks', activeTeam.id],
                    });
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Madde eklenemedi';
                    Alert.alert('Hata', msg);
                  }
                }}
                style={styles.primaryButton}
                textStyle={styles.primaryButtonText}
              />
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Açılış / Kapanış yönetimi</Text>
            <Text style={styles.sectionCaption}>
              Ekibinize özel açılış ve kapanış maddeleri tanımlayın.
            </Text>

            <View style={styles.addRow}>
              <Input
                label="Yeni açılış maddesi"
                placeholder="Örn: İlk shot kalitesini kontrol et"
                value={newOpeningLabel}
                onChangeText={setNewOpeningLabel}
              />
              <Input
                label="Bilgi notu (opsiyonel)"
                placeholder="Örn: Demleme 25–30 sn aralığında olmalı."
                value={newOpeningDetails}
                onChangeText={setNewOpeningDetails}
                multiline
              />
              <Button
                title="Açılış maddesi ekle"
                fullWidth
                variant="outline"
                onPress={async () => {
                  const label = newOpeningLabel.trim();
                  if (!label || !activeTeam?.id) return;
                  try {
                    const { data, error } = await supabase
                      .from('operation_tasks')
                      .insert({
                        team_id: activeTeam.id,
                        type: 'opening',
                        label,
                        details: newOpeningDetails.trim() || null,
                        day_of_week: null,
                        sort_order: openingTasks.length,
                      })
                      .select('*');
                    if (error) throw error;
                    setNewOpeningLabel('');
                    setNewOpeningDetails('');
                    queryClient.invalidateQueries({
                      queryKey: ['operation-tasks', activeTeam.id],
                    });
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Madde eklenemedi';
                    Alert.alert('Hata', msg);
                  }
                }}
                style={styles.primaryButton}
                textStyle={styles.primaryButtonText}
              />
            </View>

            <View style={styles.addRow}>
              <Input
                label="Yeni kapanış maddesi"
                placeholder="Örn: Atık kahve ve temizlik kontrolü"
                value={newClosingLabel}
                onChangeText={setNewClosingLabel}
              />
              <Input
                label="Bilgi notu (opsiyonel)"
                placeholder="Örn: Kapanış sonrası makine yüzeyini kuru bezle silin."
                value={newClosingDetails}
                onChangeText={setNewClosingDetails}
                multiline
              />
              <Button
                title="Kapanış maddesi ekle"
                fullWidth
                variant="outline"
                onPress={async () => {
                  const label = newClosingLabel.trim();
                  if (!label || !activeTeam?.id) return;
                  try {
                    const { data, error } = await supabase
                      .from('operation_tasks')
                      .insert({
                        team_id: activeTeam.id,
                        type: 'closing',
                        label,
                        details: newClosingDetails.trim() || null,
                        day_of_week: null,
                        sort_order: closingTasks.length,
                      })
                      .select('*');
                    if (error) throw error;
                    setNewClosingLabel('');
                    setNewClosingDetails('');
                    queryClient.invalidateQueries({
                      queryKey: ['operation-tasks', activeTeam.id],
                    });
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Madde eklenemedi';
                    Alert.alert('Hata', msg);
                  }
                }}
                style={styles.primaryButton}
                textStyle={styles.primaryButtonText}
              />
            </View>
          </Card>
        </>
      )}

      <Modal
        transparent
        visible={!!infoTask}
        animationType="fade"
        onRequestClose={() => setInfoTask(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoTask(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Madde Detayı</Text>
              <Pressable
                onPress={() => setInfoTask(null)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
            {!!infoTask && infoTask.type !== 'maintenance' && selectedTaskLog && (
              <View style={styles.modalCheckedBy}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                <Text style={styles.modalCheckedByText}>
                  Tikleyen: {selectedTaskChecker || selectedTaskLog.user_id}
                </Text>
              </View>
            )}
            <Text style={styles.modalTaskLabel}>{infoTask?.label}</Text>
            <Text style={styles.modalDetailsText}>
              {infoTask?.details?.trim() || 'Bu madde için henüz bilgi notu eklenmemiş.'}
            </Text>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: 4 },
  titleAccent: { color: colors.accent },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
    borderWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionIconWrap: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: 0,
  },
  sectionCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  daysWrap: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayPill: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayPillPressed: {
    opacity: 0.9,
  },
  dayPillText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  dayPillTextActive: {
    color: colors.black,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyState: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  maintenanceList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  maintenanceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maintenanceLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  checklistSection: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 0,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    marginBottom: spacing.xs,
  },
  checkRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  checkRowDone: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  checkRowPressed: {
    opacity: 0.9,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  checkLabelDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  infoBtn: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoBtnPressed: {
    opacity: 0.75,
  },
  checkoutHeader: {
    marginBottom: spacing.sm,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 3,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  tabChip: {
    flex: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: {
    backgroundColor: colors.accent,
  },
  tabChipText: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  tabChipTextActive: {
    color: colors.black,
  },
  checklistTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  refreshBtnDisabled: {
    opacity: 0.7,
  },
  refreshBtnPressed: {
    opacity: 0.9,
  },
  refreshBtnText: {
    ...typography.small,
    color: colors.black,
    fontFamily: fonts.semibold,
  },
  addRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  primaryButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.full,
  },
  primaryButtonText: {
    ...typography.small,
    fontFamily: fonts.semibold,
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnPressed: { opacity: 0.75 },
  modalCheckedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  modalCheckedByText: {
    ...typography.caption,
    color: colors.accent,
  },
  modalTaskLabel: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalDetailsText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

