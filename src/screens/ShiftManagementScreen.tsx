import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, Pressable } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, ClockTimePicker, TabBar } from '../components';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { getTeamMembers } from '../services/teams';
import { createTeamNotification } from '../services/notifications';
import { colors, spacing, typography, fonts, borderRadius } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import type { Team } from '../types';
import type { Shift, ShiftTemplate } from '../types';

type Props = { route: RouteProp<TeamsStackParamList, 'ShiftManagement'> };

type ShiftTabKey = 'tanimlar' | 'haftalik';
const SHIFT_TABS: { key: ShiftTabKey; label: string }[] = [
  { key: 'tanimlar', label: 'Vardiya Saatleri' },
  { key: 'haftalik', label: 'Haftalık plan' },
];

function formatDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function timeFromTemplate(t: ShiftTemplate): string {
  const s = t.start_time.slice(0, 5);
  const e = t.end_time.slice(0, 5);
  return `${s} – ${e}`;
}

function timeStringToDate(s: string): Date {
  const [h = 0, m = 0] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Hafta Pazartesi–Pazar sırasında: [Pzt, Sal, Çar, Per, Cum, Cmt, Paz] */
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
  return `${weekStart.getDate()} – ${end.getDate()} ${weekStart.toLocaleDateString('tr-TR', { month: 'short' })} ${weekStart.getFullYear()}`;
}

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function getShiftsByDay(shifts: (Shift & { user?: { name?: string; surname?: string } })[], weekDays: Date[]) {
  const list = shifts ?? [];
  const byDay: Record<string, (Shift & { user?: { name?: string; surname?: string } })[]> = {};
  weekDays.forEach((d) => {
    const key = d.toDateString();
    byDay[key] = list.filter((s) => new Date(s.start_time).toDateString() === key);
  });
  return byDay;
}

export function ShiftManagementScreen({ route }: Props) {
  const { team } = route.params;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ShiftTabKey>('tanimlar');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateStart, setTemplateStart] = useState('09:00');
  const [templateEnd, setTemplateEnd] = useState('17:00');
  const [templateSaving, setTemplateSaving] = useState(false);
  /** Seçilen günler (toDateString() ile; birden fazla seçilebilir) */
  const [assignSelectedDateStrings, setAssignSelectedDateStrings] = useState<string[]>([]);
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  /** Açık olan "Günü düzenle" modalı – bu güne ait vardiyalar listelenir, düzenle/sil buradan yapılır */
  const [editingDay, setEditingDay] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<(Shift & { user?: { name?: string; surname?: string } }) | null>(null);
  const [editShiftTemplateId, setEditShiftTemplateId] = useState<string | null>(null);
  const [editShiftUserId, setEditShiftUserId] = useState<string | null>(null);
  const [editShiftSaving, setEditShiftSaving] = useState(false);

  const toggleAssignDate = (d: Date) => {
    const key = d.toDateString();
    setAssignSelectedDateStrings((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end' | null>(null);

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
  const selectedWeekDays = React.useMemo(() => getDaysForWeek(selectedWeekStart), [selectedWeekStart]);

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

  const shiftsByDay = React.useMemo(
    () => getShiftsByDay(shifts as (Shift & { user?: { name?: string; surname?: string } })[], selectedWeekDays),
    [shifts, selectedWeekDays]
  );

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
      Alert.alert('Eksik', 'Vardiya adı girin.');
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
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya tanımı kaydedilemedi.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = (t: ShiftTemplate) => {
    Alert.alert('Vardiyayı sil', `"${t.name}" tanımını silmek istiyor musunuz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShiftTemplate(t.id);
            queryClient.invalidateQueries({ queryKey: ['shift-templates', team.id] });
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  const handleAssignShift = async () => {
    if (!assignTemplateId || !assignUserId) {
      Alert.alert('Eksik', 'Vardiya ve çalışan seçin.');
      return;
    }
    const datesToAssign = assignSelectedDateStrings
      .map((str) => selectedWeekDays.find((d) => d.toDateString() === str))
      .filter((d): d is Date => d != null);
    if (datesToAssign.length === 0) {
      Alert.alert('Eksik', 'En az bir tarih seçin.');
      return;
    }
    setAssignSaving(true);
    try {
      for (const date of datesToAssign) {
        await createShiftFromTemplate(team.id, assignTemplateId, assignUserId, date);
      }
      queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
      setShowAssignModal(false);
      setAssignTemplateId(null);
      setAssignUserId(null);
      setAssignSelectedDateStrings([]);
      Alert.alert(
        'Tamam',
        datesToAssign.length === 1 ? 'Vardiya atandı.' : `${datesToAssign.length} gün için vardiya atandı.`
      );
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya atanamadı.');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleSendShiftNotification = async () => {
    if (members.length === 0) {
      Alert.alert('Bilgi', 'Ekipte henüz çalışan yok.');
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
      Alert.alert('Gönderildi', 'Ekip çalışanlarına "Vardiyanız oluşturuldu" bildirimi iletildi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Bildirim gönderilemedi.');
    } finally {
      setSendingNotif(false);
    }
  };

  const memberOptions = members;

  const handleDeleteShift = (shift: Shift & { user?: { name?: string; surname?: string } }) => {
    const name = shift.user ? `${shift.user.name ?? ''} ${shift.user.surname ?? ''}`.trim() || 'Vardiya' : 'Vardiya';
    Alert.alert(
      'Vardiyayı sil',
      `${name} vardiyasını silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShift(shift.id);
              queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya silinemedi.');
            }
          },
        },
      ]
    );
  };

  const openEditShift = (shift: Shift & { user?: { name?: string; surname?: string } }) => {
    setEditingShift(shift);
    setEditShiftTemplateId(shift.shift_template_id ?? templates[0]?.id ?? null);
    setEditShiftUserId(shift.user_id);
    setEditShiftSaving(false);
  };

  const handleSaveEditShift = async () => {
    if (!editingShift || !editShiftTemplateId || !editShiftUserId) {
      Alert.alert('Eksik', 'Vardiya ve çalışan seçin.');
      return;
    }
    setEditShiftSaving(true);
    try {
      await updateShift(editingShift.id, { userId: editShiftUserId, templateId: editShiftTemplateId });
      queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
      setEditingShift(null);
      Alert.alert('Tamam', 'Vardiya güncellendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya güncellenemedi.');
    } finally {
      setEditShiftSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TabBar tabs={SHIFT_TABS} activeKey={activeTab} onChange={setActiveTab} />

      {activeTab === 'tanimlar' && (
        <>
          <Text style={styles.sectionTitle}>Ayarlanan vardiya saatleri</Text>
          <Text style={styles.hint}>
            Vardiya adı ve saat aralığı (örn. Gündüz 09:00–17:00). Sonra "Haftalık plan" sekmesinden hafta seçip bu vardiyalara çalışan atayın.
          </Text>
          {templates.length === 0 ? (
            <Card>
              <Text style={styles.placeholder}>Henüz vardiya tanımı yok. "Yeni vardiya tanımı" ile ekleyin.</Text>
            </Card>
          ) : (
            templates.map((t) => (
              <Card key={t.id} style={styles.templateCard}>
                <View style={styles.templateRow}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{t.name}</Text>
                    <Text style={styles.templateTime}>{timeFromTemplate(t)}</Text>
                  </View>
                  <View style={styles.templateActions}>
                    <Pressable
                      onPress={() => openEditTemplate(t)}
                      style={({ pressed }) => [styles.templateIconBtn, styles.templateIconBtnEdit, pressed && styles.templateIconBtnPressed]}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={20} color={colors.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteTemplate(t)}
                      style={({ pressed }) => [styles.templateIconBtn, styles.templateIconBtnDelete, pressed && styles.templateIconBtnPressed]}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))
          )}
          <Button
            title="Yeni vardiya tanımı"
            onPress={openNewTemplate}
            variant="outline"
            style={styles.btn}
          />
        </>
      )}

      {activeTab === 'haftalik' && (
        <>
          <View style={styles.weekNav}>
            <Pressable
              onPress={() => {
                const d = new Date(selectedWeekStart);
                d.setDate(d.getDate() - 7);
                setSelectedWeekStart(d);
              }}
              style={styles.weekNavBtn}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.weekNavLabel} numberOfLines={1}>
              {weekRangeLabel(selectedWeekStart)}
            </Text>
            <Pressable
              onPress={() => {
                const d = new Date(selectedWeekStart);
                d.setDate(d.getDate() + 7);
                setSelectedWeekStart(d);
              }}
              style={styles.weekNavBtn}
              hitSlop={12}
            >
              <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => setSelectedWeekStart(getCurrentWeekMonday())}
            style={styles.thisWeekChip}
          >
            <Ionicons name="today-outline" size={16} color={colors.accent} />
            <Text style={styles.thisWeekChipText}>Bu hafta</Text>
          </Pressable>

          <View style={styles.planSectionHeader}>
            <Text style={styles.planSectionTitle}>Haftalık vardiyalar</Text>
            <Pressable
              onPress={() => {
                setAssignSelectedDateStrings([]);
                setAssignTemplateId(templates[0]?.id ?? null);
                setAssignUserId(memberOptions[0]?.user_id ?? null);
                setShowAssignModal(true);
              }}
              style={({ pressed }) => [styles.addShiftHeaderBtn, pressed && styles.addShiftHeaderBtnPressed]}
              disabled={templates.length === 0 || memberOptions.length === 0}
            >
              <Ionicons name="add" size={18} color={colors.accent} />
              <Text style={styles.addShiftHeaderBtnText}>Vardiya ekle</Text>
            </Pressable>
          </View>
          {isLoading ? (
            <View style={styles.dayCard}><Text style={styles.placeholder}>Yükleniyor…</Text></View>
          ) : (
            (() => {
              const todayKey = new Date().toDateString();
              return selectedWeekDays.map((day) => {
                const dayShifts = shiftsByDay[day.toDateString()] ?? [];
                const dayName = WEEKDAY_LABELS[day.getDay()];
                const dateNum = day.getDate();
                const monthShort = day.toLocaleDateString('tr-TR', { month: 'short' });
                const isToday = day.toDateString() === todayKey;
                return (
                  <View key={day.toISOString()} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                    <View style={styles.dayCardHeader}>
                      <View style={styles.dayCardTitleRow}>
                        <Text style={[styles.dayCardTitle, isToday && styles.dayCardTitleToday]}>
                          {dayName}, {dateNum} {monthShort}
                        </Text>
                        {isToday && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>Bugün</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => setEditingDay(day)}
                        style={({ pressed }) => [styles.dayEditIconBtn, pressed && styles.dayEditIconBtnPressed]}
                        hitSlop={8}
                      >
                        <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  {dayShifts.length === 0 ? (
                    <View style={styles.dayEmpty}>
                      <Text style={styles.dayEmptyText}>Atanmış vardiya yok</Text>
                    </View>
                  ) : (
                    dayShifts.map((s) => (
                      <View key={s.id} style={styles.shiftRow}>
                        <View style={styles.shiftRowDot} />
                        <View style={styles.shiftRowContent}>
                          <View style={styles.shiftRowNameRow}>
                            <Text style={styles.shiftRowName}>
                              {s.user ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye' : 'Üye'}
                            </Text>
                            {s.role ? (
                              <View style={styles.shiftRoleBadge}>
                                <Text style={styles.shiftRoleBadgeText}>{s.role}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.shiftRowTime}>
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
                );
              });
            })()
          )}

          <View style={styles.notifySection}>
            <Text style={styles.notifyHint}>
              Tüm vardiyaları atadıktan sonra ekibe bildirim gönderin.
            </Text>
            <Button
              title="Vardiya planını ekibe gönder"
              onPress={handleSendShiftNotification}
              loading={sendingNotif}
              variant="outline"
              style={styles.btnNotify}
            />
          </View>
        </>
      )}

      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTemplateId ? 'Vardiyayı düzenle' : 'Yeni vardiya tanımı'}</Text>
              <Pressable
                onPress={() => {
                  setShowTemplateModal(false);
                  setEditingTemplateId(null);
                }}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            {timePickerMode === null ? (
              <>
                <Input label="Vardiya adı" value={templateName} onChangeText={setTemplateName} placeholder="Örn: Gündüz vardiyası" />
                <Text style={styles.modalLabel}>Başlangıç saati</Text>
                <Pressable
                  style={styles.timePickerTouch}
                  onPress={() => setTimePickerMode('start')}
                >
                  <Text style={styles.timePickerText}>{templateStart}</Text>
                </Pressable>
                <Text style={styles.modalLabel}>Bitiş saati</Text>
                <Pressable
                  style={styles.timePickerTouch}
                  onPress={() => setTimePickerMode('end')}
                >
                  <Text style={styles.timePickerText}>{templateEnd}</Text>
                </Pressable>
                <Button title="Kaydet" onPress={handleSaveTemplate} loading={templateSaving} fullWidth style={styles.modalBtn} />
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

      <Modal visible={!!editingDay} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDay
                  ? `${WEEKDAY_LABELS[editingDay.getDay()]}, ${editingDay.getDate()} ${editingDay.toLocaleDateString('tr-TR', { month: 'short' })}`
                  : ''}
              </Text>
              <Pressable onPress={() => setEditingDay(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            {editingDay && (
              <>
                <Text style={styles.modalLabel}>Vardiyalar</Text>
                {(shiftsByDay[editingDay.toDateString()] ?? []).length === 0 ? (
                  <Text style={styles.placeholder}>Bu güne atanmış vardiya yok.</Text>
                ) : (
                  (shiftsByDay[editingDay.toDateString()] ?? []).map((s) => (
                    <View key={s.id} style={styles.editDayShiftRow}>
                      <View style={styles.editDayShiftInfo}>
                        <View style={styles.shiftRowNameRow}>
                          <Text style={styles.shiftRowName}>
                            {s.user ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye' : 'Üye'}
                          </Text>
                          {s.role ? (
                            <View style={styles.shiftRoleBadge}>
                              <Text style={styles.shiftRoleBadgeText}>{s.role}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.shiftRowTime}>
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </Text>
                      </View>
                      <View style={styles.editDayShiftActions}>
                        <Pressable
                          onPress={() => openEditShift(s)}
                          style={({ pressed }) => [styles.editDayActionBtn, pressed && styles.editDayActionBtnPressed]}
                        >
                          <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                          <Text style={styles.editDayActionText}>Düzenle</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteShift(s)}
                          style={({ pressed }) => [styles.editDayActionBtn, styles.editDayActionBtnDanger, pressed && styles.editDayActionBtnPressed]}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                          <Text style={[styles.editDayActionText, styles.editDayActionTextDanger]}>Sil</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
                <Pressable
                  onPress={() => {
                    setAssignSelectedDateStrings([editingDay.toDateString()]);
                    setAssignTemplateId(templates[0]?.id ?? null);
                    setAssignUserId(memberOptions[0]?.user_id ?? null);
                    setShowAssignModal(true);
                  }}
                  style={({ pressed }) => [styles.addShiftHeaderBtn, pressed && styles.addShiftHeaderBtnPressed, styles.editDayAddBtn]}
                  disabled={templates.length === 0 || memberOptions.length === 0}
                >
                  <Ionicons name="add" size={18} color={colors.accent} />
                  <Text style={styles.addShiftHeaderBtnText}>Vardiya ekle</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vardiya ata</Text>
              <Pressable onPress={() => setShowAssignModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalLabel}>Tarihler (birden fazla gün seçebilirsiniz)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {selectedWeekDays.map((d) => {
                const isSelected = assignSelectedDateStrings.includes(d.toDateString());
                return (
                  <Pressable
                    key={d.toISOString()}
                    style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    onPress={() => toggleAssignDate(d)}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                      {d.toLocaleDateString('tr-TR', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dayChipDay, isSelected && styles.dayChipTextActive]}>{d.getDate()}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.modalLabel}>Vardiya</Text>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.optionRow, assignTemplateId === t.id && styles.optionRowActive]}
                onPress={() => setAssignTemplateId(t.id)}
              >
                <Text style={styles.optionText}>{t.name} ({timeFromTemplate(t)})</Text>
              </Pressable>
            ))}
            <Text style={styles.modalLabel}>Çalışan</Text>
            {memberOptions.map((m) => {
              const name = m.user ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || 'Üye' : 'Üye';
              return (
                <Pressable
                  key={m.id}
                  style={[styles.optionRow, assignUserId === m.user_id && styles.optionRowActive]}
                  onPress={() => setAssignUserId(m.user_id)}
                >
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

      <Modal visible={!!editingShift} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vardiyayı düzenle</Text>
              <Pressable onPress={() => setEditingShift(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            {editingShift && (
              <>
                <Text style={styles.modalLabel}>Vardiya (saat aralığı)</Text>
                {templates.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[styles.optionRow, editShiftTemplateId === t.id && styles.optionRowActive]}
                    onPress={() => setEditShiftTemplateId(t.id)}
                  >
                    <Text style={styles.optionText}>{t.name} ({timeFromTemplate(t)})</Text>
                  </Pressable>
                ))}
                <Text style={styles.modalLabel}>Çalışan</Text>
                {memberOptions.map((m) => {
                  const name = m.user ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || 'Üye' : 'Üye';
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.optionRow, editShiftUserId === m.user_id && styles.optionRowActive]}
                      onPress={() => setEditShiftUserId(m.user_id)}
                    >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  card: { marginBottom: spacing.lg },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  placeholder: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  btn: { marginTop: spacing.sm },
  templateCard: { marginBottom: spacing.sm },
  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateInfo: { flex: 1, minWidth: 0 },
  templateName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  templateTime: { fontSize: 13, color: colors.accent, marginTop: 2 },
  templateActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  templateIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateIconBtnEdit: {
    backgroundColor: colors.accent + '18',
  },
  templateIconBtnDelete: {
    backgroundColor: colors.error + '18',
  },
  templateIconBtnPressed: {
    opacity: 0.7,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  weekNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
  },
  weekNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
  },
  thisWeekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    backgroundColor: colors.accent + '12',
    marginBottom: spacing.lg,
  },
  thisWeekChipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  planSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  planSectionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  addShiftHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '10',
  },
  addShiftHeaderBtnPressed: { opacity: 0.85 },
  addShiftHeaderBtnText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayCardToday: {
    borderColor: colors.accent + '60',
    backgroundColor: colors.accent + '08',
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayEditIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
  },
  dayEditIconBtnPressed: { opacity: 0.8 },
  dayCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dayCardTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  dayCardTitleToday: {
    color: colors.accent,
  },
  todayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  todayBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.bgDark,
  },
  addShiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent + '15',
  },
  addShiftBtnPressed: { opacity: 0.8 },
  addShiftBtnText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  dayEmpty: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },
  dayEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent + '50',
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  shiftRowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginLeft: -spacing.sm - 3,
    marginRight: spacing.sm,
  },
  shiftRowContent: { flex: 1, minWidth: 0 },
  shiftRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 2,
  },
  shiftRowName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  shiftRoleBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  shiftRoleBadgeText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.accent,
    textTransform: 'capitalize',
  },
  shiftRowTime: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  btnPrimary: { marginTop: spacing.md, marginBottom: spacing.lg },
  notifySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notifyHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  btnNotify: { marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { backgroundColor: colors.glassBg, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  modalCloseBtn: {
    padding: spacing.md,
    margin: -spacing.md,
  },
  modalClose: { color: colors.textSecondary, fontSize: 22 },
  modalLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  modalBtn: { marginTop: spacing.lg },
  dayScroll: { marginBottom: spacing.sm, maxHeight: 80 },
  dayChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', minWidth: 56 },
  dayChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(212,175,55,0.15)' },
  dayChipText: { fontSize: 12, color: colors.textSecondary },
  dayChipDay: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  optionRow: { padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  optionRowActive: { borderColor: colors.accent, backgroundColor: 'rgba(212,175,55,0.1)' },
  optionText: { fontSize: 14, color: colors.textPrimary },
  editDayShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editDayShiftInfo: { flex: 1, minWidth: 0 },
  editDayShiftActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editDayActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent + '15',
  },
  editDayActionBtnPressed: { opacity: 0.85 },
  editDayActionBtnDanger: { backgroundColor: colors.error + '15' },
  editDayActionText: { fontSize: 13, fontFamily: fonts.medium, color: colors.accent },
  editDayActionTextDanger: { color: colors.error },
  editDayAddBtn: { marginTop: spacing.md },
  timePickerTouch: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  timePickerText: { fontSize: 16, color: colors.textPrimary },
});
