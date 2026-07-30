import React, { useState, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, ClockTimePicker } from '../components';
import {
  getTeamShifts,
  getTeamShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  createShiftFromTemplate,
  deleteShift,
  updateShift,
} from '../services/shifts';
import {
  getTeamBreakTemplates,
  createBreakTemplate,
  deleteBreakTemplate,
} from '../services/breaks';
import { useAuthStore } from '../store/authStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getTeamMembers } from '../services/teams';
import { listMembersWithRoles } from '../services/rbac';
import { createTeamNotification } from '../services/notifications';
import { colors, spacing, fonts, borderRadius, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import {
  buildOrgRoleByUserId,
  resolveShiftRoleLabel,
  teamMemberRoleToStoredShiftRole,
} from '../utils/shiftRoleLabel';
import {
  getCalendarColumnBusinessKey,
  getTimestampBusinessDateKey,
  useBusinessDayClock,
} from '../utils/businessDay';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import type { Shift, ShiftTemplate } from '../types';

type Props = { route: RouteProp<TeamsStackParamList, 'ShiftManagement'> };

type ShiftTabKey = 'tanimlar' | 'haftalik';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
function timeFromTemplate(t: ShiftTemplate): string {
  const s = t.start_time.slice(0, 5);
  const e = t.end_time.slice(0, 5);
  return `${s} – ${e}`;
}

/** Hafta Pazartesi–Pazar sırasında */
function getDaysForWeek(mondayOfWeek: Date): Date[] {
  const year = mondayOfWeek.getFullYear();
  const month = mondayOfWeek.getMonth();
  const date = mondayOfWeek.getDate();
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(year, month, date + i));
  }
  return days;
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  return `${weekStart.getDate()} – ${end.getDate()} ${weekStart.toLocaleDateString('tr-TR', {
    month: 'short',
  })} ${weekStart.getFullYear()}`;
}

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function getShiftsByDay(
  shifts: (Shift & { user?: { name?: string; surname?: string } })[],
  weekDays: Date[]
) {
  const list = shifts ?? [];
  const byDay: Record<string, (Shift & { user?: { name?: string; surname?: string } })[]> = {};
  weekDays.forEach((d) => {
    const key = getCalendarColumnBusinessKey(d);
    byDay[key] = list.filter((s) => getTimestampBusinessDateKey(s.start_time) === key);
  });
  return byDay;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => [
              styles.segmentItem,
              active && styles.segmentItemActive,
              pressed && !active && styles.segmentItemPressed,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                active && styles.segmentLabelActive,
              ]}
            >
              {opt.label}
            </Text>
            {typeof opt.count === 'number' && (
              <View
                style={[
                  styles.segmentBadge,
                  active && styles.segmentBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentBadgeText,
                    active && styles.segmentBadgeTextActive,
                  ]}
                >
                  {opt.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ShiftManagementScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const { team } = route.params;
  const { businessDateKey } = useBusinessDayClock();
  const user = useAuthStore((s) => s.user);
  const isOwner = team.owner_id === user?.id;
  const queryClient = useQueryClient();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [activeTab, setActiveTab] = useState<ShiftTabKey>('tanimlar');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateStart, setTemplateStart] = useState('09:00');
  const [templateEnd, setTemplateEnd] = useState('17:00');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [assignSelectedDateStrings, setAssignSelectedDateStrings] = useState<string[]>([]);
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<
    (Shift & { user?: { name?: string; surname?: string } }) | null
  >(null);
  const [editShiftTemplateId, setEditShiftTemplateId] = useState<string | null>(null);
  const [editShiftUserId, setEditShiftUserId] = useState<string | null>(null);
  const [editShiftSaving, setEditShiftSaving] = useState(false);
  const [breakName, setBreakName] = useState('');
  const [breakDuration, setBreakDuration] = useState('15');
  const [breakSaving, setBreakSaving] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end' | null>(null);

  const toggleAssignDate = (d: Date) => {
    const key = d.toDateString();
    setAssignSelectedDateStrings((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const getCurrentWeekMonday = () => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getCurrentWeekMonday());
  const selectedWeekDays = useMemo(() => getDaysForWeek(selectedWeekStart), [selectedWeekStart]);

  const { data: templates = [] } = useQuery({
    queryKey: ['shift-templates', team.id],
    queryFn: () => getTeamShiftTemplates(team.id),
  });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['team-shifts', team.id, selectedWeekStart.toISOString()],
    queryFn: () => getTeamShifts(team.id, selectedWeekStart),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });
  const orgId = team.organization_id ?? undefined;
  const { data: orgMembersWithRoles = [] } = useQuery({
    queryKey: ['org-members-with-roles', orgId],
    queryFn: () => listMembersWithRoles(orgId!),
    enabled: !!orgId,
  });
  const rbacRoleByUserId = useMemo(
    () => buildOrgRoleByUserId(orgMembersWithRoles),
    [orgMembersWithRoles]
  );
  const { data: breakTemplates = [] } = useQuery({
    queryKey: ['break-templates', team.id],
    queryFn: () => getTeamBreakTemplates(team.id),
  });

  const shiftsByDay = useMemo(
    () =>
      getShiftsByDay(
        shifts as (Shift & { user?: { name?: string; surname?: string } })[],
        selectedWeekDays
      ),
    [shifts, selectedWeekDays]
  );

  const weeklyShiftCount = (shifts ?? []).length;

  const openEditTemplate = (t: ShiftTemplate) => {
    setTemplateName(t.name);
    setTemplateStart(t.start_time.slice(0, 5));
    setTemplateEnd(t.end_time.slice(0, 5));
    setEditingTemplateId(t.id);
    setTimePickerMode(null);
    setShowTemplateModal(true);
  };

  const openNewTemplate = () => {
    setTemplateName('');
    setTemplateStart('09:00');
    setTemplateEnd('17:00');
    setEditingTemplateId(null);
    setTimePickerMode(null);
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      themedAlert('Eksik', 'Vardiya adı girin.');
      return;
    }
    const start = templateStart.trim() || '09:00';
    const end = templateEnd.trim() || '17:00';
    setTemplateSaving(true);
    try {
      if (editingTemplateId) {
        await updateShiftTemplate(editingTemplateId, name, start, end);
      } else {
        await createShiftTemplate(team.id, name, start, end);
      }
      queryClient.invalidateQueries({ queryKey: ['shift-templates', team.id] });
      setShowTemplateModal(false);
      setTemplateName('');
      setTemplateStart('09:00');
      setTemplateEnd('17:00');
      setEditingTemplateId(null);
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya tanımı kaydedilemedi.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = (t: ShiftTemplate) => {
    themedAlert('Vardiyayı sil', `"${t.name}" tanımını silmek istiyor musunuz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShiftTemplate(t.id);
            queryClient.invalidateQueries({ queryKey: ['shift-templates', team.id] });
          } catch (e) {
            themedAlert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  const handleAssignShift = async () => {
    if (!assignTemplateId || !assignUserId) {
      themedAlert('Eksik', 'Vardiya ve çalışan seçin.');
      return;
    }
    const datesToAssign = assignSelectedDateStrings
      .map((str) => selectedWeekDays.find((d) => d.toDateString() === str))
      .filter((d): d is Date => d != null);
    if (datesToAssign.length === 0) {
      themedAlert('Eksik', 'En az bir tarih seçin.');
      return;
    }
    setAssignSaving(true);
    try {
      const assignMember = members.find((m) => m.user_id === assignUserId);
      const roleLabel = teamMemberRoleToStoredShiftRole(
        assignMember?.role,
        assignUserId,
        team.owner_id,
        rbacRoleByUserId[assignUserId]
      );
      for (const date of datesToAssign) {
        await createShiftFromTemplate(
          team.id,
          assignTemplateId,
          assignUserId,
          date,
          roleLabel
        );
      }
      queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
      queryClient.invalidateQueries({ queryKey: ['my-shifts-today'] });
      setShowAssignModal(false);
      setAssignTemplateId(null);
      setAssignUserId(null);
      setAssignSelectedDateStrings([]);
      themedAlert(
        'Tamam',
        datesToAssign.length === 1
          ? 'Vardiya atandı.'
          : `${datesToAssign.length} gün için vardiya atandı.`
      );
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya atanamadı.');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleSendShiftNotification = async () => {
    if (members.length === 0) {
      themedAlert('Bilgi', 'Ekipte henüz çalışan yok.');
      return;
    }
    setSendingNotif(true);
    try {
      for (const member of members) {
        await createTeamNotification(
          team.id,
          'shift_assigned',
          'Vardiyanız oluşturuldu',
          'Vardiya planınız oluşturuldu. Takım sayfasından detaylara bakabilirsiniz.',
          member.user_id
        );
      }
      queryClient.invalidateQueries({ queryKey: ['my-teams-notifications'] });
      themedAlert(
        'Gönderildi',
        'Ekip çalışanlarına "Vardiyanız oluşturuldu" bildirimi iletildi.'
      );
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Bildirim gönderilemedi.');
    } finally {
      setSendingNotif(false);
    }
  };

  const memberOptions = members;
  const canAssignShifts = templates.length > 0 && memberOptions.length > 0;

  const handleDeleteShift = (shift: Shift & { user?: { name?: string; surname?: string } }) => {
    const name = shift.user
      ? `${shift.user.name ?? ''} ${shift.user.surname ?? ''}`.trim() || 'Vardiya'
      : 'Vardiya';
    themedAlert('Vardiyayı sil', `${name} vardiyasını silmek istediğinize emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShift(shift.id);
            queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
            queryClient.invalidateQueries({ queryKey: ['my-shifts-today'] });
          } catch (e) {
            themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya silinemedi.');
          }
        },
      },
    ]);
  };

  const openEditShift = (shift: Shift & { user?: { name?: string; surname?: string } }) => {
    setEditingShift(shift);
    setEditShiftTemplateId(shift.shift_template_id ?? templates[0]?.id ?? null);
    setEditShiftUserId(shift.user_id);
    setEditShiftSaving(false);
  };

  const handleSaveEditShift = async () => {
    if (!editingShift || !editShiftTemplateId || !editShiftUserId) {
      themedAlert('Eksik', 'Vardiya ve çalışan seçin.');
      return;
    }
    setEditShiftSaving(true);
    try {
      const editMember = members.find((m) => m.user_id === editShiftUserId);
      const roleLabel = teamMemberRoleToStoredShiftRole(
        editMember?.role,
        editShiftUserId,
        team.owner_id,
        rbacRoleByUserId[editShiftUserId]
      );
      await updateShift(editingShift.id, {
        userId: editShiftUserId,
        templateId: editShiftTemplateId,
        role: roleLabel,
      });
      queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
      queryClient.invalidateQueries({ queryKey: ['my-shifts-today'] });
      setEditingShift(null);
      themedAlert('Tamam', 'Vardiya güncellendi.');
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Vardiya güncellenemedi.');
    } finally {
      setEditShiftSaving(false);
    }
  };

  const handleCreateBreakTemplate = async () => {
    if (!isOwner) return;
    const name = breakName.trim();
    const mins = Number(breakDuration);
    if (!name || !Number.isFinite(mins) || mins <= 0) {
      themedAlert('Eksik', 'Mola adı ve geçerli süre girin.');
      return;
    }
    setBreakSaving(true);
    try {
      await createBreakTemplate(team.id, name, mins);
      queryClient.invalidateQueries({ queryKey: ['break-templates', team.id] });
      setBreakName('');
      setBreakDuration('15');
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Mola tanımı kaydedilemedi.');
    } finally {
      setBreakSaving(false);
    }
  };

  const handleDeleteBreakTemplate = (templateId: string, name: string) => {
    if (!isOwner) return;
    themedAlert('Mola sil', `"${name}" mola tanımı silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBreakTemplate(templateId);
            queryClient.invalidateQueries({ queryKey: ['break-templates', team.id] });
          } catch (e) {
            themedAlert('Hata', e instanceof Error ? e.message : 'Mola tanımı silinemedi.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabScrollBottomPad + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <LinearGradient
          colors={[
            'rgba(212, 175, 55, 0.22)',
            'rgba(212, 175, 55, 0.06)',
            'rgba(0,0,0,0)',
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backPill, pressed && styles.backPillPressed]}
            hitSlop={8}
            accessibilityLabel="Geri"
          >
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={styles.backPillText}>Geri</Text>
          </Pressable>
          <Text style={styles.heroEyebrow}>Vardiya yönetimi</Text>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {team.name}
          </Text>

          <View style={styles.heroStatsRow}>
            <StatBox icon="time-outline" label="Tanım" value={templates.length} />
            <StatBox
              icon="calendar-outline"
              label="Bu hafta"
              value={weeklyShiftCount}
              accent
            />
            <StatBox icon="cafe-outline" label="Mola" value={breakTemplates.length} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Segmented Tabs */}
          <SegmentedControl
            options={[
              {
                key: 'tanimlar' as ShiftTabKey,
                label: 'Tanımlar',
                count: templates.length + breakTemplates.length,
              },
              {
                key: 'haftalik' as ShiftTabKey,
                label: 'Haftalık plan',
                count: weeklyShiftCount,
              },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === 'tanimlar' && (
            <>
              {/* Vardiya tanımları paneli */}
              <View style={styles.panel}>
                <View style={styles.panelGoldCap} />
                <LinearGradient
                  colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.panelBody}>
                  <View style={styles.panelHeaderRow}>
                    <View style={styles.panelIconWrap}>
                      <Ionicons name="time-outline" size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.panelTitle}>Vardiya saatleri</Text>
                    {templates.length > 0 && (
                      <View style={styles.countChip}>
                        <Text style={styles.countChipText}>{templates.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.panelDescription}>
                    Vardiya adı ve saat aralığı tanımlayın. Sonra haftalık planda çalışanlara atayın.
                  </Text>

                  {templates.length === 0 ? (
                    <EmptyState
                      icon="time-outline"
                      title="Henüz vardiya tanımı yok"
                      hint="Aşağıdan yeni bir vardiya tanımı ekleyin."
                    />
                  ) : (
                    <View style={styles.templateList}>
                      {templates.map((t) => (
                        <View key={t.id} style={styles.templateCard}>
                          <LinearGradient
                            colors={['rgba(212, 175, 55, 0.12)', 'rgba(212, 175, 55, 0.02)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={styles.templateCardInner}>
                            <View style={styles.templateIconWrap}>
                              <Ionicons name="time" size={18} color={colors.accent} />
                            </View>
                            <View style={styles.templateInfo}>
                              <Text style={styles.templateName} numberOfLines={1}>
                                {t.name}
                              </Text>
                              <Text style={styles.templateTime}>{timeFromTemplate(t)}</Text>
                            </View>
                            <View style={styles.templateActions}>
                              <Pressable
                                onPress={() => openEditTemplate(t)}
                                style={({ pressed }) => [
                                  styles.iconBtn,
                                  styles.iconBtnEdit,
                                  pressed && styles.iconBtnPressed,
                                ]}
                                hitSlop={8}
                                accessibilityLabel="Düzenle"
                              >
                                <Ionicons name="pencil" size={16} color={colors.accent} />
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeleteTemplate(t)}
                                style={({ pressed }) => [
                                  styles.iconBtn,
                                  styles.iconBtnDelete,
                                  pressed && styles.iconBtnPressed,
                                ]}
                                hitSlop={8}
                                accessibilityLabel="Sil"
                              >
                                <Ionicons name="trash-outline" size={16} color={colors.error} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <Pressable
                    onPress={openNewTemplate}
                    style={({ pressed }) => [
                      styles.ctaOutlined,
                      { marginTop: spacing.md },
                      pressed && styles.ctaPressed,
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                    <Text style={styles.ctaOutlinedText}>Yeni vardiya tanımı</Text>
                  </Pressable>
                </View>
              </View>

              {/* Mola tanımları paneli */}
              <View style={styles.panel}>
                <View style={styles.panelGoldCap} />
                <LinearGradient
                  colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.panelBody}>
                  <View style={styles.panelHeaderRow}>
                    <View style={styles.panelIconWrap}>
                      <Ionicons name="cafe-outline" size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.panelTitle}>Mola tanımları</Text>
                    {breakTemplates.length > 0 && (
                      <View style={styles.countChip}>
                        <Text style={styles.countChipText}>{breakTemplates.length}</Text>
                      </View>
                    )}
                  </View>
                  {!isOwner && (
                    <Text style={styles.panelDescription}>
                      Sadece ekip lideri yeni mola süresi tanımlayabilir.
                    </Text>
                  )}

                  {breakTemplates.length === 0 ? (
                    <EmptyState
                      icon="cafe-outline"
                      title="Henüz mola tanımı yok"
                      hint={
                        isOwner
                          ? 'Aşağıdan yeni bir mola süresi ekleyin.'
                          : 'Ekip lideri mola tanımı eklediğinde burada görünecek.'
                      }
                    />
                  ) : (
                    <View style={styles.templateList}>
                      {breakTemplates.map((b) => (
                        <View key={b.id} style={styles.templateCard}>
                          <LinearGradient
                            colors={['rgba(212, 175, 55, 0.10)', 'rgba(212, 175, 55, 0.02)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <View style={styles.templateCardInner}>
                            <View style={styles.templateIconWrap}>
                              <Ionicons name="cafe" size={18} color={colors.accent} />
                            </View>
                            <View style={styles.templateInfo}>
                              <Text style={styles.templateName} numberOfLines={1}>
                                {b.name}
                              </Text>
                              <Text style={styles.templateTime}>{b.duration_minutes} dk</Text>
                            </View>
                            {isOwner && (
                              <View style={styles.templateActions}>
                                <Pressable
                                  onPress={() => handleDeleteBreakTemplate(b.id, b.name)}
                                  style={({ pressed }) => [
                                    styles.iconBtn,
                                    styles.iconBtnDelete,
                                    pressed && styles.iconBtnPressed,
                                  ]}
                                  hitSlop={8}
                                  accessibilityLabel="Sil"
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={16}
                                    color={colors.error}
                                  />
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {isOwner && (
                    <View style={styles.breakForm}>
                      <Input
                        label="Mola adı"
                        value={breakName}
                        onChangeText={setBreakName}
                        placeholder="Örn: Öğle molası"
                      />
                      <Input
                        label="Süre (dakika)"
                        value={breakDuration}
                        onChangeText={setBreakDuration}
                        keyboardType="number-pad"
                      />
                      <Pressable
                        onPress={handleCreateBreakTemplate}
                        disabled={breakSaving}
                        style={({ pressed }) => [
                          styles.ctaOutlined,
                          { marginTop: spacing.sm },
                          pressed && !breakSaving && styles.ctaPressed,
                          breakSaving && styles.ctaDisabled,
                        ]}
                      >
                        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                        <Text style={styles.ctaOutlinedText}>
                          {breakSaving ? 'Kaydediliyor…' : 'Yeni mola tanımı'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}

          {activeTab === 'haftalik' && (
            <>
              {/* Hafta navigasyon paneli */}
              <View style={styles.weekPanel}>
                <Pressable
                  onPress={() => {
                    const d = new Date(selectedWeekStart);
                    d.setDate(d.getDate() - 7);
                    setSelectedWeekStart(d);
                  }}
                  style={({ pressed }) => [
                    styles.weekNavBtn,
                    pressed && styles.weekNavBtnPressed,
                  ]}
                  hitSlop={12}
                  accessibilityLabel="Önceki hafta"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.weekNavCenter}>
                  <Text style={styles.weekNavEyebrow}>Hafta</Text>
                  <Text style={styles.weekNavLabel} numberOfLines={1}>
                    {weekRangeLabel(selectedWeekStart)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    const d = new Date(selectedWeekStart);
                    d.setDate(d.getDate() + 7);
                    setSelectedWeekStart(d);
                  }}
                  style={({ pressed }) => [
                    styles.weekNavBtn,
                    pressed && styles.weekNavBtnPressed,
                  ]}
                  hitSlop={12}
                  accessibilityLabel="Sonraki hafta"
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.weekHeaderRow}>
                <Pressable
                  onPress={() => setSelectedWeekStart(getCurrentWeekMonday())}
                  style={({ pressed }) => [
                    styles.thisWeekChip,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="today-outline" size={14} color={colors.accent} />
                  <Text style={styles.thisWeekChipText}>Bu hafta</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!canAssignShifts) {
                      themedAlert(
                        'Eksik bilgi',
                        'Vardiya eklemek için önce "vardiya tanımı" oluşturun ve ekibe çalışan ekleyin.'
                      );
                      return;
                    }
                    setAssignSelectedDateStrings([]);
                    setAssignTemplateId(templates[0]?.id ?? null);
                    setAssignUserId(memberOptions[0]?.user_id ?? null);
                    setShowAssignModal(true);
                  }}
                  style={({ pressed }) => [
                    styles.addShiftHeaderBtn,
                    pressed && styles.ctaPressed,
                    !canAssignShifts && styles.ctaDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={[colors.accentHover, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.addShiftHeaderBtnInner}
                  >
                    <Ionicons name="add" size={16} color={colors.black} />
                    <Text style={styles.addShiftHeaderBtnText}>Vardiya ekle</Text>
                  </LinearGradient>
                </Pressable>
              </View>

              {isLoading ? (
                <View style={styles.loadingCard}>
                  <Text style={styles.loadingText}>Yükleniyor…</Text>
                </View>
              ) : (
                selectedWeekDays.map((day) => {
                  const colKey = getCalendarColumnBusinessKey(day);
                  const dayShifts = shiftsByDay[colKey] ?? [];
                  const dayName = WEEKDAY_LABELS[day.getDay()];
                  const dateNum = day.getDate();
                  const monthShort = day.toLocaleDateString('tr-TR', { month: 'short' });
                  const isToday = colKey === businessDateKey;
                  return (
                    <View
                      key={day.toISOString()}
                      style={[styles.dayPanel, isToday && styles.dayPanelToday]}
                    >
                      {isToday && (
                        <LinearGradient
                          colors={['rgba(212, 175, 55, 0.14)', 'rgba(212, 175, 55, 0.02)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <View style={styles.dayPanelHeader}>
                        <View style={styles.dayDateBox}>
                          <Text
                            style={[
                              styles.dayDateWeekday,
                              isToday && styles.dayDateWeekdayToday,
                            ]}
                          >
                            {dayName}
                          </Text>
                          <Text
                            style={[
                              styles.dayDateNum,
                              isToday && styles.dayDateNumToday,
                            ]}
                          >
                            {dateNum}
                          </Text>
                          <Text style={styles.dayDateMonth}>{monthShort}</Text>
                        </View>
                        <View style={styles.dayHeaderRight}>
                          {isToday && (
                            <View style={styles.todayBadge}>
                              <Text style={styles.todayBadgeText}>Bugün</Text>
                            </View>
                          )}
                          <View style={styles.dayShiftCountChip}>
                            <Ionicons name="people" size={11} color={colors.accent} />
                            <Text style={styles.dayShiftCountText}>{dayShifts.length}</Text>
                          </View>
                          <Pressable
                            onPress={() => setEditingDay(day)}
                            style={({ pressed }) => [
                              styles.dayEditBtn,
                              pressed && styles.iconBtnPressed,
                            ]}
                            hitSlop={8}
                            accessibilityLabel="Günü düzenle"
                          >
                            <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                          </Pressable>
                        </View>
                      </View>
                      {dayShifts.length === 0 ? (
                        <View style={styles.dayEmpty}>
                          <Text style={styles.dayEmptyText}>Atanmış vardiya yok</Text>
                        </View>
                      ) : (
                        <View style={styles.shiftList}>
                          {dayShifts.map((s) => {
                            const roleLabel = resolveShiftRoleLabel(
                              s.user_id,
                              team.owner_id,
                              members,
                              s.role,
                              rbacRoleByUserId[s.user_id]
                            );
                            const memberName = s.user
                              ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye'
                              : 'Üye';
                            return (
                              <View key={s.id} style={styles.shiftRow}>
                                <View style={styles.shiftTimeBlock}>
                                  <Text style={styles.shiftTimeStart}>
                                    {formatTime(s.start_time)}
                                  </Text>
                                  <View style={styles.shiftTimeLine} />
                                  <Text style={styles.shiftTimeEnd}>
                                    {formatTime(s.end_time)}
                                  </Text>
                                </View>
                                <View style={styles.shiftBody}>
                                  <Text style={styles.shiftName} numberOfLines={1}>
                                    {memberName}
                                  </Text>
                                  <View style={styles.shiftRoleBadge}>
                                    <Text style={styles.shiftRoleBadgeText}>{roleLabel}</Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {/* Bildirim gönder paneli */}
              <View style={styles.panel}>
                <View style={styles.panelGoldCap} />
                <LinearGradient
                  colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.panelBody}>
                  <View style={styles.panelHeaderRow}>
                    <View style={styles.panelIconWrap}>
                      <Ionicons
                        name="notifications-outline"
                        size={16}
                        color={colors.accent}
                      />
                    </View>
                    <Text style={styles.panelTitle}>Bildirim</Text>
                  </View>
                  <Text style={styles.panelDescription}>
                    Tüm vardiyaları atadıktan sonra ekibe tek dokunuşla bildirim gönderin.
                  </Text>
                  <Pressable
                    onPress={handleSendShiftNotification}
                    disabled={sendingNotif}
                    style={({ pressed }) => [
                      styles.ctaOutlined,
                      pressed && !sendingNotif && styles.ctaPressed,
                      sendingNotif && styles.ctaDisabled,
                    ]}
                  >
                    <Ionicons
                      name="paper-plane-outline"
                      size={18}
                      color={colors.accent}
                    />
                    <Text style={styles.ctaOutlinedText}>
                      {sendingNotif ? 'Gönderiliyor…' : 'Vardiya planını ekibe gönder'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Template create/edit modal */}
      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTemplateId ? 'Vardiyayı düzenle' : 'Yeni vardiya tanımı'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowTemplateModal(false);
                  setEditingTemplateId(null);
                }}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {timePickerMode === null ? (
              <>
                <Input
                  label="Vardiya adı"
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="Örn: Gündüz vardiyası"
                />
                <Text style={styles.modalLabel}>Başlangıç saati</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.timePickerTouch,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={() => setTimePickerMode('start')}
                >
                  <Ionicons name="time-outline" size={16} color={colors.accent} />
                  <Text style={styles.timePickerText}>{templateStart}</Text>
                </Pressable>
                <Text style={styles.modalLabel}>Bitiş saati</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.timePickerTouch,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={() => setTimePickerMode('end')}
                >
                  <Ionicons name="time-outline" size={16} color={colors.accent} />
                  <Text style={styles.timePickerText}>{templateEnd}</Text>
                </Pressable>
                <Button
                  title="Kaydet"
                  onPress={handleSaveTemplate}
                  loading={templateSaving}
                  fullWidth
                  style={styles.modalBtn}
                />
              </>
            ) : (
              <>
                <Text style={styles.modalLabel}>
                  {timePickerMode === 'start' ? 'Başlangıç saati' : 'Bitiş saati'}
                </Text>
                <ClockTimePicker
                  value={timePickerMode === 'start' ? templateStart : templateEnd}
                  onChange={(str) => {
                    if (timePickerMode === 'start') setTemplateStart(str);
                    else setTemplateEnd(str);
                  }}
                  onClose={() => setTimePickerMode(null)}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Day edit modal */}
      <Modal visible={!!editingDay} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDay
                  ? `${WEEKDAY_LABELS[editingDay.getDay()]}, ${editingDay.getDate()} ${editingDay.toLocaleDateString(
                      'tr-TR',
                      { month: 'short' }
                    )}`
                  : ''}
              </Text>
              <Pressable
                onPress={() => setEditingDay(null)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {editingDay && (
              <>
                <Text style={styles.modalLabel}>Vardiyalar</Text>
                {(shiftsByDay[getCalendarColumnBusinessKey(editingDay)] ?? []).length === 0 ? (
                  <View style={styles.emptyMini}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.emptyMiniText}>Bu güne atanmış vardiya yok.</Text>
                  </View>
                ) : (
                  (shiftsByDay[getCalendarColumnBusinessKey(editingDay)] ?? []).map((s) => {
                    const roleLabel = resolveShiftRoleLabel(
                      s.user_id,
                      team.owner_id,
                      members,
                      s.role,
                      rbacRoleByUserId[s.user_id]
                    );
                    const memberName = s.user
                      ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye'
                      : 'Üye';
                    return (
                      <View key={s.id} style={styles.editDayShiftRow}>
                        <View style={styles.editDayShiftInfo}>
                          <View style={styles.shiftRowNameRow}>
                            <Text style={styles.shiftName}>{memberName}</Text>
                            <View style={styles.shiftRoleBadge}>
                              <Text style={styles.shiftRoleBadgeText}>{roleLabel}</Text>
                            </View>
                          </View>
                          <Text style={styles.editDayShiftTime}>
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </Text>
                        </View>
                        <View style={styles.editDayShiftActions}>
                          <Pressable
                            onPress={() => {
                              setEditingDay(null);
                              openEditShift(s);
                            }}
                            style={({ pressed }) => [
                              styles.editDayActionBtn,
                              pressed && styles.ctaPressed,
                            ]}
                          >
                            <Ionicons name="pencil-outline" size={14} color={colors.accent} />
                            <Text style={styles.editDayActionText}>Düzenle</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteShift(s)}
                            style={({ pressed }) => [
                              styles.editDayActionBtn,
                              styles.editDayActionBtnDanger,
                              pressed && styles.ctaPressed,
                            ]}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.error} />
                            <Text
                              style={[
                                styles.editDayActionText,
                                styles.editDayActionTextDanger,
                              ]}
                            >
                              Sil
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
                <Pressable
                  onPress={() => {
                    if (!canAssignShifts) {
                      themedAlert(
                        'Eksik bilgi',
                        'Vardiya eklemek için önce "vardiya tanımı" oluşturun ve ekibe çalışan ekleyin.'
                      );
                      return;
                    }
                    const dayRef = editingDay;
                    setEditingDay(null);
                    setAssignSelectedDateStrings([dayRef.toDateString()]);
                    setAssignTemplateId(templates[0]?.id ?? null);
                    setAssignUserId(memberOptions[0]?.user_id ?? null);
                    setShowAssignModal(true);
                  }}
                  style={({ pressed }) => [
                    styles.ctaOutlined,
                    { marginTop: spacing.md },
                    pressed && styles.ctaPressed,
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                  <Text style={styles.ctaOutlinedText}>Vardiya ekle</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Assign modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vardiya ata</Text>
              <Pressable
                onPress={() => setShowAssignModal(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalLabel}>
              Tarihler (birden fazla gün seçebilirsiniz)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayScroll}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              {selectedWeekDays.map((d) => {
                const isSelected = assignSelectedDateStrings.includes(d.toDateString());
                return (
                  <Pressable
                    key={d.toISOString()}
                    style={({ pressed }) => [
                      styles.dayChip,
                      isSelected && styles.dayChipActive,
                      pressed && !isSelected && { opacity: 0.85 },
                    ]}
                    onPress={() => toggleAssignDate(d)}
                  >
                    <Text
                      style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}
                    >
                      {d.toLocaleDateString('tr-TR', { weekday: 'short' })}
                    </Text>
                    <Text
                      style={[styles.dayChipDay, isSelected && styles.dayChipTextActive]}
                    >
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.modalLabel}>Vardiya</Text>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                style={({ pressed }) => [
                  styles.optionRow,
                  assignTemplateId === t.id && styles.optionRowActive,
                  pressed && styles.ctaPressed,
                ]}
                onPress={() => setAssignTemplateId(t.id)}
              >
                <Ionicons
                  name={assignTemplateId === t.id ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={assignTemplateId === t.id ? colors.accent : colors.textMuted}
                />
                <Text style={styles.optionText}>
                  {t.name} ({timeFromTemplate(t)})
                </Text>
              </Pressable>
            ))}
            <Text style={styles.modalLabel}>Çalışan</Text>
            {memberOptions.map((m) => {
              const name = m.user
                ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || 'Üye'
                : 'Üye';
              const selected = assignUserId === m.user_id;
              return (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [
                    styles.optionRow,
                    selected && styles.optionRowActive,
                    pressed && styles.ctaPressed,
                  ]}
                  onPress={() => setAssignUserId(m.user_id)}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={selected ? colors.accent : colors.textMuted}
                  />
                  <Text style={styles.optionText}>{name}</Text>
                </Pressable>
              );
            })}
            <Button
              title={
                assignSelectedDateStrings.length === 0
                  ? 'Ata'
                  : assignSelectedDateStrings.length === 1
                    ? '1 güne ata'
                    : `${assignSelectedDateStrings.length} güne ata`
              }
              onPress={handleAssignShift}
              loading={assignSaving}
              fullWidth
              style={styles.modalBtn}
            />
          </View>
        </View>
      </Modal>

      {/* Single shift edit modal */}
      <Modal visible={!!editingShift} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vardiyayı düzenle</Text>
              <Pressable
                onPress={() => setEditingShift(null)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {editingShift && (
              <>
                <Text style={styles.modalLabel}>Vardiya (saat aralığı)</Text>
                {templates.map((t) => (
                  <Pressable
                    key={t.id}
                    style={({ pressed }) => [
                      styles.optionRow,
                      editShiftTemplateId === t.id && styles.optionRowActive,
                      pressed && styles.ctaPressed,
                    ]}
                    onPress={() => setEditShiftTemplateId(t.id)}
                  >
                    <Ionicons
                      name={
                        editShiftTemplateId === t.id ? 'radio-button-on' : 'radio-button-off'
                      }
                      size={16}
                      color={
                        editShiftTemplateId === t.id ? colors.accent : colors.textMuted
                      }
                    />
                    <Text style={styles.optionText}>
                      {t.name} ({timeFromTemplate(t)})
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.modalLabel}>Çalışan</Text>
                {memberOptions.map((m) => {
                  const name = m.user
                    ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || 'Üye'
                    : 'Üye';
                  const selected = editShiftUserId === m.user_id;
                  return (
                    <Pressable
                      key={m.id}
                      style={({ pressed }) => [
                        styles.optionRow,
                        selected && styles.optionRowActive,
                        pressed && styles.ctaPressed,
                      ]}
                      onPress={() => setEditShiftUserId(m.user_id)}
                    >
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={16}
                        color={selected ? colors.accent : colors.textMuted}
                      />
                      <Text style={styles.optionText}>{name}</Text>
                    </Pressable>
                  );
                })}
                <Button
                  title="Kaydet"
                  onPress={handleSaveEditShift}
                  loading={editShiftSaving}
                  fullWidth
                  style={styles.modalBtn}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatBox({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statBox, accent && styles.statBoxAccent]}>
      <Ionicons name={icon} size={14} color={accent ? colors.accent : colors.textSecondary} />
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  scrollContent: { paddingBottom: 0 },

  // HERO
  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.sm,
  },
  backPillPressed: { opacity: 0.7 },
  backPillText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
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
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 4,
  },
  statBoxAccent: {
    borderColor: 'rgba(212, 175, 55, 0.28)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  statValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  statValueAccent: { color: colors.accent },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // BODY
  body: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },

  // Segmented Control
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  segmentItemActive: {
    backgroundColor: colors.accent,
  },
  segmentItemPressed: { opacity: 0.75 },
  segmentLabel: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  segmentLabelActive: { color: colors.bgDark },
  segmentBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeActive: { backgroundColor: 'rgba(0,0,0,0.22)' },
  segmentBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  segmentBadgeTextActive: { color: colors.bgDark },

  // Panel
  panel: {
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
  panelBody: {
    padding: spacing.md,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  panelIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  panelDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  countChipText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.accent,
  },

  // Template cards
  templateList: { gap: spacing.sm },
  templateCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    overflow: 'hidden',
  },
  templateCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  templateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: { flex: 1, minWidth: 0 },
  templateName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  templateTime: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.accent,
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBtnEdit: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  iconBtnDelete: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.40)',
  },
  iconBtnPressed: { opacity: 0.7 },

  // CTAs
  ctaOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.55)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  ctaOutlinedText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.5 },

  // Break form
  breakForm: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 4,
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyMiniText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    flex: 1,
  },

  // Week nav panel
  weekPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    gap: spacing.sm,
    ...shadow.sm,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavBtnPressed: { opacity: 0.75 },
  weekNavCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  weekNavEyebrow: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  weekNavLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  thisWeekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.40)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  thisWeekChipText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  addShiftHeaderBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  addShiftHeaderBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  addShiftHeaderBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.black,
    letterSpacing: 0.2,
  },

  // Day panel
  dayPanel: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  dayPanelToday: {
    borderColor: 'rgba(212, 175, 55, 0.55)',
  },
  dayPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayDateBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  dayDateWeekday: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayDateWeekdayToday: {
    color: colors.accent,
  },
  dayDateNum: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  dayDateNumToday: {
    color: colors.accent,
  },
  dayDateMonth: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  todayBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayShiftCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  dayShiftCountText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  dayEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dayEmpty: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
  },
  dayEmptyText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },

  // Shift rows
  shiftList: { gap: 6 },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  shiftTimeBlock: {
    minWidth: 52,
    alignItems: 'center',
  },
  shiftTimeStart: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: -0.2,
  },
  shiftTimeLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
    marginVertical: 3,
  },
  shiftTimeEnd: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  shiftBody: { flex: 1, minWidth: 0, gap: 4 },
  shiftName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  shiftRoleBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  shiftRoleBadgeText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.accent,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  shiftRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },

  // Loading
  loadingCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    ...shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  modalLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  modalBtn: { marginTop: spacing.lg },

  dayScroll: { marginBottom: spacing.sm, maxHeight: 80 },
  dayChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    minWidth: 56,
    gap: 2,
  },
  dayChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  dayChipText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayChipDay: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  dayChipTextActive: {
    color: colors.accent,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 6,
  },
  optionRowActive: {
    borderColor: 'rgba(212, 175, 55, 0.55)',
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },

  // Day edit modal rows
  editDayShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: spacing.sm,
    marginBottom: 6,
  },
  editDayShiftInfo: { flex: 1, minWidth: 0, gap: 4 },
  editDayShiftTime: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editDayShiftActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editDayActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  editDayActionBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.40)',
  },
  editDayActionText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  editDayActionTextDanger: { color: colors.error },

  // Time picker touch
  timePickerTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    marginBottom: spacing.sm,
  },
  timePickerText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
});
