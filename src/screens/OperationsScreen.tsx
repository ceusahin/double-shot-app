import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '../components';
import { useAuthStore } from '../store/authStore';
import { getMyTeams } from '../services/teams';
import { getOperationTasks, getTodayOperationTaskLogs, setOperationTaskCompleted } from '../services/operations';
import { supabase } from '../services/supabase';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import { useBusinessDayClock } from '../utils/businessDay';
import type { OperationTask, OperationTaskLog } from '../types';

const WEEK_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

/** onLayout döngüsünü kesmek için px eşiği */
const PAGE_H_EPS = 4;

export function OperationsScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.max(0, windowWidth - spacing.md * 2);
  const tabPagerRef = useRef<ScrollView>(null);
  const activeTabRef = useRef<'today' | 'admin'>('today');
  const {
    businessDateKey: todayStr,
    businessDayOfWeekIndex: todayIndex,
    businessDateAnchor,
  } = useBusinessDayClock();

  const dateLine = useMemo(
    () =>
      businessDateAnchor.toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [businessDateAnchor]
  );

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
  const [pageHeights, setPageHeights] = useState({ today: 0, admin: 0 });

  activeTabRef.current = activeTab;

  const user = useAuthStore((s) => s.user);

  const onTodayPageLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setPageHeights((prev) => {
      if (Math.abs(prev.today - h) < PAGE_H_EPS) return prev;
      return { ...prev, today: h };
    });
  }, []);

  const onAdminPageLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setPageHeights((prev) => {
      if (Math.abs(prev.admin - h) < PAGE_H_EPS) return prev;
      return { ...prev, admin: h };
    });
  }, []);

  const { data: teams = [] } = useQuery({
    queryKey: ['my-teams', user?.id],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!user?.id,
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (teams.length === 0) return;
    if (!selectedTeamId || !teams.some((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const activeTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) ?? null : null;
  const canManage =
    !!activeTeam &&
    user &&
    (activeTeam.role === 'MANAGER' || activeTeam.owner_id === user.id);

  useEffect(() => {
    if (!canManage && activeTab === 'admin') {
      setActiveTab('today');
    }
    if (!canManage) {
      tabPagerRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [canManage, activeTab]);

  useEffect(() => {
    if (!canManage) return;
    const w = Math.max(pageWidth, 1);
    tabPagerRef.current?.scrollTo({
      x: activeTabRef.current === 'today' ? 0 : w,
      animated: false,
    });
  }, [pageWidth, canManage]);

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
      themedAlert('Hata', msg);
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
        <View style={styles.checklistTitleRow}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.checklistTitleText}>
            <Text style={styles.checklistTitle}>{title}</Text>
            <Text style={styles.checklistProgress}>
              {items.filter((i) => completedSet.has(i.id)).length}/{items.length} tamamlandı
            </Text>
          </View>
        </View>
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
              style={({ pressed }) => [
                styles.infoBtn,
                checked && styles.infoBtnDone,
                pressed && styles.infoBtnPressed,
              ]}
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
      themedAlert('Hata', msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  const todayPanels = (
    <>
      <View style={styles.panelShell}>
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.panelGoldCap} />
        <View style={styles.panelInner}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="construct-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Haftalık plan</Text>
              <Text style={styles.sectionTitleLarge}>Bakım takvimi</Text>
            </View>
          </View>
          <Text style={styles.sectionCaption}>
            Seçtiğiniz güne göre planlanmış makine ve ekipman bakımları.
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
                  {isActive ? (
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.35)', 'rgba(212, 175, 55, 0.1)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                  ) : null}
                  <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>{day}</Text>
                </Pressable>
              );
            })}
          </View>

          {maintenanceTasksForDay.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={18} color={colors.textMuted} />
              <Text style={styles.emptyText}>{selectedDay} için tanımlı bakım görevi yok.</Text>
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
                    <Ionicons name="information-circle-outline" size={22} color={colors.accent} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.panelShell}>
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.panelGoldCap} />
        <View style={styles.panelInner}>
          <View style={styles.checklistTopColumn}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBox}>
                <Ionicons name="list-outline" size={18} color={colors.accent} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionEyebrow}>Checklıst</Text>
                <Text style={styles.sectionTitleLarge}>Açılış / kapanış</Text>
              </View>
            </View>
            <View style={styles.refreshRow}>
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
                  <ActivityIndicator size="small" color={colors.bgDark} />
                ) : (
                  <Ionicons name="refresh" size={17} color={colors.bgDark} />
                )}
                <Text style={styles.refreshBtnText}>Yenile</Text>
              </Pressable>
            </View>
          </View>
          {renderChecklist(
            'Açılış kontrol listesi',
            openingTasks,
            completedIds,
            (taskId, completed) => toggleMutation.mutate({ taskId, completed })
          )}

          {renderChecklist(
            'Kapanış kontrol listesi',
            closingTasks,
            completedIds,
            (taskId, completed) => toggleMutation.mutate({ taskId, completed })
          )}
        </View>
      </View>
    </>
  );

  const adminPanels = (
    <>
      <View style={styles.panelShell}>
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.panelGoldCap} />
        <View style={styles.panelInner}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Admin</Text>
              <Text style={styles.sectionTitleLarge}>Bakım takvimi</Text>
            </View>
          </View>
          <Text style={styles.sectionCaption}>
            Günlere göre makine bakım maddeleri ekleyin; ekip bu takvimden görür.
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
                  {isActive ? (
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.35)', 'rgba(212, 175, 55, 0.1)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                  ) : null}
                  <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>{day}</Text>
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
                  themedAlert('Hata', msg);
                }
              }}
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />
          </View>
        </View>
      </View>

      <View style={styles.panelShell}>
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.panelGoldCap} />
        <View style={styles.panelInner}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Admin</Text>
              <Text style={styles.sectionTitleLarge}>Açılış / kapanış</Text>
            </View>
          </View>
          <Text style={styles.sectionCaption}>
            Ekibin checklist’lerinde görünecek özel maddeleri buradan tanımlayın.
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
                  themedAlert('Hata', msg);
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
                  themedAlert('Hata', msg);
                }
              }}
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />
          </View>
        </View>
      </View>
    </>
  );

  const wPager = Math.max(pageWidth, 1);
  const tabClipHeight =
    activeTab === 'today' ? pageHeights.today : pageHeights.admin;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabScrollBottomPad },
      ]}
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
          <Ionicons name="calendar-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.heroEyebrow}>İş günü operasyonları</Text>
        <Text style={styles.heroTitle}>
          Operasyon <Text style={styles.heroTitleAccent}>Takvimi</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Bakım planı ile açılış ve kapanış kontrollerini tek ekrandan yönetin.
        </Text>
      </LinearGradient>

      {teams.length > 1 && activeTeam ? (
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
      ) : null}

      {canManage && (
        <View style={styles.tabSwitch}>
          <Pressable
            style={[styles.tabChip, activeTab === 'today' && styles.tabChipSlotActive]}
            onPress={() => {
              setActiveTab('today');
              requestAnimationFrame(() => {
                tabPagerRef.current?.scrollTo({ x: 0, animated: true });
              });
            }}
          >
            {activeTab === 'today' ? (
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.45)', 'rgba(212, 175, 55, 0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            ) : null}
            <Ionicons
              name="today-outline"
              size={16}
              color={activeTab === 'today' ? colors.textPrimary : colors.textMuted}
              style={styles.tabChipIcon}
            />
            <Text style={[styles.tabChipText, activeTab === 'today' && styles.tabChipTextActive]}>
              Günlük görünüm
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabChip, activeTab === 'admin' && styles.tabChipSlotActive]}
            onPress={() => {
              setActiveTab('admin');
              requestAnimationFrame(() => {
                tabPagerRef.current?.scrollTo({ x: wPager, animated: true });
              });
            }}
          >
            {activeTab === 'admin' ? (
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.45)', 'rgba(212, 175, 55, 0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            ) : null}
            <Ionicons
              name="settings-outline"
              size={16}
              color={activeTab === 'admin' ? colors.textPrimary : colors.textMuted}
              style={styles.tabChipIcon}
            />
            <Text style={[styles.tabChipText, activeTab === 'admin' && styles.tabChipTextActive]}>
              Yönetim
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Operasyon görevleri yükleniyor…</Text>
        </View>
      )}
      {error && !isLoading && (
        <View style={styles.errorPanel}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.warning} />
          <Text style={styles.errorText}>
            Görevler yüklenemedi. Bağlantınızı veya ekibinize erişiminizi kontrol edin.
          </Text>
        </View>
      )}

      {canManage ? (
        <View
          style={[
            styles.tabPagerClip,
            tabClipHeight > 0 && {
              height: tabClipHeight,
              overflow: 'hidden',
            },
          ]}
        >
          <ScrollView
            ref={tabPagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.tabPagerContent}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const page = Math.round(x / wPager);
              setActiveTab(page === 0 ? 'today' : 'admin');
            }}
          >
            <View style={{ width: wPager }} onLayout={onTodayPageLayout}>
              {todayPanels}
            </View>
            <View style={{ width: wPager }} onLayout={onAdminPageLayout}>
              {adminPanels}
            </View>
          </ScrollView>
        </View>
      ) : (
        todayPanels
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
            <View style={styles.modalGoldCap} />
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.1)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Madde detayı</Text>
              <Pressable
                onPress={() => setInfoTask(null)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.modalCloseBtnPressed]}
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
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
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  heroGradient: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.md,
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
  heroDate: {
    ...typography.small,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTitleAccent: { color: colors.accent },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: '95%',
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 4,
    ...shadow.sm,
  },
  tabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabChipSlotActive: {
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  tabChipIcon: { marginRight: 2 },
  tabChipText: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  tabChipTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  tabPagerClip: {
    width: '100%',
  },
  tabPagerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  errorPanel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(233, 196, 106, 0.35)',
    backgroundColor: 'rgba(233, 196, 106, 0.08)',
  },
  errorText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  panelShell: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  panelGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  panelInner: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
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
  sectionCaption: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  daysWrap: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    width: '100%',
  },
  dayPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {
    borderColor: 'rgba(212, 175, 55, 0.55)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  dayPillPressed: {
    opacity: 0.88,
  },
  dayPillText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    zIndex: 1,
  },
  dayPillTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 22,
  },
  emptyState: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  maintenanceList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  maintenanceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  maintenanceLabel: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  checklistSection: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  checklistHeader: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checklistTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checklistTitleText: { flex: 1, minWidth: 0 },
  checklistTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  checklistProgress: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  checkRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  checkRowDone: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  checkRowPressed: {
    opacity: 0.92,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
    lineHeight: 22,
  },
  checkLabelDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  infoBtnDone: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  infoBtnPressed: {
    opacity: 0.75,
  },
  checklistTopColumn: {
    marginBottom: spacing.md,
    width: '100%',
  },
  refreshRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    width: '100%',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    maxWidth: '100%',
    ...shadow.sm,
  },
  refreshBtnDisabled: {
    opacity: 0.65,
  },
  refreshBtnPressed: {
    opacity: 0.9,
  },
  refreshBtnText: {
    ...typography.small,
    color: colors.bgDark,
    fontFamily: fonts.semibold,
  },
  addRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    overflow: 'hidden',
    ...shadow.lg,
  },
  modalGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.9,
  },
  modalInner: {
    padding: spacing.lg,
    zIndex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseBtnPressed: { opacity: 0.75 },
  modalCheckedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignSelf: 'flex-start',
  },
  modalCheckedByText: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.medium,
  },
  modalTaskLabel: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  modalDetailsText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
  },

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
});

