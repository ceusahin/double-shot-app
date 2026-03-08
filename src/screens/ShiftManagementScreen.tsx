import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, Pressable } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, ClockTimePicker } from '../components';
import {
  getTeamShifts,
  getTeamShiftTemplates,
  createShiftTemplate,
  deleteShiftTemplate,
  createShiftFromTemplate,
} from '../services/shifts';
import { getTeamMembers } from '../services/teams';
import { createTeamNotification } from '../services/notifications';
import { colors, spacing, typography } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import type { Team } from '../types';
import type { Shift, ShiftTemplate } from '../types';

type Props = { route: RouteProp<TeamsStackParamList, 'ShiftManagement'> };

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

function getWeekStartsForYear(year: number): Date[] {
  const jan1 = new Date(year, 0, 1);
  const firstSunday = new Date(jan1);
  firstSunday.setDate(jan1.getDate() - jan1.getDay());
  firstSunday.setHours(0, 0, 0, 0);
  const weeks: Date[] = [];
  const endOfYear = new Date(year, 11, 31);
  for (let i = 0; i < 55; i++) {
    const w = new Date(firstSunday);
    w.setDate(firstSunday.getDate() + i * 7);
    if (w.getTime() > endOfYear.getTime() + 86400000) break;
    weeks.push(w);
  }
  return weeks;
}

function getDaysForWeek(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  return `${weekStart.getDate()} ${weekStart.toLocaleDateString('tr-TR', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('tr-TR', { month: 'short' })}`;
}

export function ShiftManagementScreen({ route }: Props) {
  const { team } = route.params;
  const queryClient = useQueryClient();
  const [sendingNotif, setSendingNotif] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateStart, setTemplateStart] = useState('09:00');
  const [templateEnd, setTemplateEnd] = useState('17:00');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [assignDate, setAssignDate] = useState<Date | null>(null);
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end' | null>(null);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const weekStarts = React.useMemo(() => getWeekStartsForYear(selectedYear), [selectedYear]);
  const defaultWeekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 7);
    return d;
  })();
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(defaultWeekStart);
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

  const handleCreateTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      Alert.alert('Eksik', 'Vardiya adı girin.');
      return;
    }
    const start = templateStart.trim() || '09:00';
    const end = templateEnd.trim() || '17:00';
    setTemplateSaving(true);
    try {
      await createShiftTemplate(team.id, name, start, end);
      queryClient.invalidateQueries({ queryKey: ['shift-templates', team.id] });
      setShowTemplateModal(false);
      setTemplateName('');
      setTemplateStart('09:00');
      setTemplateEnd('17:00');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya tanımı oluşturulamadı.');
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
      Alert.alert('Eksik', 'Tarih, vardiya ve çalışan seçin.');
      return;
    }
    const userIdToNotify = assignUserId;
    setAssignSaving(true);
    try {
      await createShiftFromTemplate(team.id, assignTemplateId, assignUserId, assignDate);
      queryClient.invalidateQueries({ queryKey: ['team-shifts', team.id] });
      setShowAssignModal(false);
      setAssignTemplateId(null);
      setAssignUserId(null);
      Alert.alert(
        'Vardiya atandı',
        "Çalışana 'Vardiyanız oluşturuldu' bildirimi gönderilsin mi?",
        [
          { text: 'Sonra', style: 'cancel' },
          {
            text: 'Gönder',
            onPress: async () => {
              try {
                await createTeamNotification(
                  team.id,
                  'shift_assigned',
                  'Vardiyanız oluşturuldu',
                  'Size yeni bir vardiya atandı. Takım sayfasından detaylara bakabilirsiniz.',
                  userIdToNotify
                );
                Alert.alert('Gönderildi', 'Çalışana bildirim iletildi.');
              } catch (e) {
                Alert.alert('Hata', e instanceof Error ? e.message : 'Bildirim gönderilemedi.');
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Vardiya atanamadı.');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleSendShiftNotification = async () => {
    setSendingNotif(true);
    try {
      await createTeamNotification(
        team.id,
        'shift',
        'Vardiya planı güncellendi',
        'Bir sonraki haftanın vardiya planını kontrol edin.'
      );
      Alert.alert('Gönderildi', 'Vardiya bildirimi ekip üyelerine iletildi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Bildirim gönderilemedi.');
    } finally {
      setSendingNotif(false);
    }
  };

  const memberOptions = members;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Ayarlanan vardiya saatleri</Text>
      <Text style={styles.hint}>
        Vardiya adı ve saat aralığı (örn. Gündüz 09:00–17:00). Sonra aşağıdan hafta seçip bu vardiyalara çalışan atayın.
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
              <Pressable onPress={() => handleDeleteTemplate(t)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Sil</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
      <Button
        title="Yeni vardiya tanımı"
        onPress={() => {
          setTimePickerMode(null);
          setShowTemplateModal(true);
        }}
        variant="outline"
        style={styles.btn}
      />

      <Text style={styles.sectionTitle}>Hafta seçimi</Text>
      <Text style={styles.hint}>Yıl ve hafta seçin; seçilen haftaya vardiya atayabilirsiniz.</Text>
      <View style={styles.yearRow}>
        <Pressable
          style={styles.yearBtn}
          onPress={() => setSelectedYear((y) => y - 1)}
        >
          <Text style={styles.yearBtnText}>← {selectedYear - 1}</Text>
        </Pressable>
        <Text style={styles.yearLabel}>{selectedYear}</Text>
        <Pressable
          style={styles.yearBtn}
          onPress={() => setSelectedYear((y) => y + 1)}
        >
          <Text style={styles.yearBtnText}>{selectedYear + 1} →</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.weekScroll}
        contentContainerStyle={styles.weekScrollContent}
      >
        {weekStarts.map((weekStart) => {
          const isSelected = selectedWeekStart.toDateString() === weekStart.toDateString();
          return (
            <Pressable
              key={weekStart.toISOString()}
              style={[styles.weekChip, isSelected && styles.weekChipActive]}
              onPress={() => setSelectedWeekStart(weekStart)}
            >
              <Text style={[styles.weekChipText, isSelected && styles.weekChipTextActive]} numberOfLines={1}>
                {weekRangeLabel(weekStart)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>Seçilen hafta: {weekRangeLabel(selectedWeekStart)}</Text>
      <Text style={styles.hint}>
        Bu haftaya atanmış vardiyalar aşağıda. "Vardiya ata" ile yeni atama yapın.
      </Text>
      {isLoading ? (
        <Card><Text style={styles.placeholder}>Yükleniyor…</Text></Card>
      ) : shifts.length === 0 ? (
        <Card>
          <Text style={styles.placeholder}>Bu hafta için henüz atama yok. "Vardiya ata" ile çalışan atayın.</Text>
        </Card>
      ) : (
        (shifts as (Shift & { user?: { name?: string; surname?: string } })[]).map((s) => (
          <Card key={s.id} style={styles.shiftCard}>
            <Text style={styles.shiftUser}>
              {s.user ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye' : 'Üye'}
            </Text>
            <Text style={styles.shiftTime}>
              {formatDate(new Date(s.start_time))} · {formatTime(s.start_time)} – {formatTime(s.end_time)}
            </Text>
          </Card>
        ))
      )}
      <Button
        title="Vardiya ata"
        onPress={() => {
          setAssignDate(selectedWeekDays[0]);
          setAssignTemplateId(templates[0]?.id ?? null);
          setAssignUserId(memberOptions[0]?.user_id ?? null);
          setShowAssignModal(true);
        }}
        variant="primary"
        style={styles.btn}
        disabled={templates.length === 0 || memberOptions.length === 0}
      />

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Vardiya bildirimi</Text>
        <Text style={styles.placeholder}>
          Planlanan vardiyayı ekip üyelerine bildirim olarak gönderin.
        </Text>
        <Button
          title="Vardiya bildirimi gönder"
          onPress={handleSendShiftNotification}
          loading={sendingNotif}
          variant="outline"
          style={styles.btn}
        />
      </Card>

      <Modal visible={showTemplateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni vardiya tanımı</Text>
              <Pressable onPress={() => setShowTemplateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <Input label="Vardiya adı" value={templateName} onChangeText={setTemplateName} placeholder="Örn: Gündüz vardiyası" />
            {timePickerMode === null ? (
              <>
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
              </>
            ) : (
              <ClockTimePicker
                value={timePickerMode === 'start' ? templateStart : templateEnd}
                onChange={(str) => {
                  if (timePickerMode === 'start') setTemplateStart(str);
                  else setTemplateEnd(str);
                }}
                onClose={() => setTimePickerMode(null)}
              />
            )}
            {timePickerMode === null && (
              <Button title="Kaydet" onPress={handleCreateTemplate} loading={templateSaving} fullWidth style={styles.modalBtn} />
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
            <Text style={styles.modalLabel}>Tarih (seçilen hafta)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {selectedWeekDays.map((d) => (
                <Pressable
                  key={d.toISOString()}
                  style={[styles.dayChip, assignDate?.toDateString() === d.toDateString() && styles.dayChipActive]}
                  onPress={() => setAssignDate(d)}
                >
                  <Text style={[styles.dayChipText, assignDate?.toDateString() === d.toDateString() && styles.dayChipTextActive]}>
                    {d.toLocaleDateString('tr-TR', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayChipDay, assignDate?.toDateString() === d.toDateString() && styles.dayChipTextActive]}>{d.getDate()}</Text>
                </Pressable>
              ))}
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
            <Button title="Ata" onPress={handleAssignShift} loading={assignSaving} fullWidth style={styles.modalBtn} />
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
  templateInfo: { flex: 1 },
  templateName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  templateTime: { fontSize: 13, color: colors.accent, marginTop: 2 },
  deleteBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  deleteBtnText: { fontSize: 13, color: colors.error },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, gap: spacing.md },
  yearBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  yearBtnText: { fontSize: 14, color: colors.textPrimary },
  yearLabel: { fontSize: 18, fontWeight: '600', color: colors.accent, minWidth: 48, textAlign: 'center' },
  weekScroll: { marginBottom: spacing.md, maxHeight: 56 },
  weekScrollContent: { paddingRight: spacing.md, flexDirection: 'row', alignItems: 'center' },
  weekChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  weekChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(212,175,55,0.15)' },
  weekChipText: { fontSize: 12, color: colors.textSecondary },
  weekChipTextActive: { color: colors.accent, fontWeight: '600' },
  shiftCard: { marginBottom: spacing.sm },
  shiftUser: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  shiftTime: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { backgroundColor: colors.glassBg, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  modalClose: { color: colors.textSecondary, fontSize: 20 },
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
