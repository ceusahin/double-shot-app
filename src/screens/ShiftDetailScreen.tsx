import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { RouteProp } from '@react-navigation/native';
import { TabBar, Card } from '../components';
import { Avatar } from '../components/Avatar';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers } from '../services/teams';
import { getTeamMembersOnShift, getTeamShiftLogs } from '../services/shifts';
import { getTeamBreakLogsForDate } from '../services/breaks';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import {
  useBusinessDayClock,
  getBusinessDayStart,
  getNextBusinessDayStart,
  getBusinessDateKey,
  getBusinessDateAnchor,
  toBusinessQueryReference,
} from '../utils/businessDay';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'ShiftDetail'> };
type ShiftTabKey = 'on_shift' | 'off_shift';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDurationMinutes(startedAt: string, endedAt: string | null): string {
  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  const min = Math.max(0, Math.round((endMs - startMs) / 60000));
  return `${min} dk`;
}

function fmtMinutesSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins} dk ${secs} sn`;
}

function getOverrunLabel(plannedEndAt: string, endedAt: string | null): string | null {
  const planMs = new Date(plannedEndAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = endMs - planMs;
  if (diffMs <= 0) return null;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `Mola ${min}:${String(remSec).padStart(2, '0')} aşıldı`;
}

export function ShiftDetailScreen({ route }: Props) {
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const [shiftTab, setShiftTab] = useState<ShiftTabKey>('on_shift');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [managerViewDate, setManagerViewDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState(() => new Date());
  const { snapshot } = useBusinessDayClock();
  const isManager = team.role === 'MANAGER' || team.owner_id === user?.id;

  const effectiveSnapshot = useMemo(() => {
    if (!isManager || managerViewDate == null) return snapshot;
    return toBusinessQueryReference(managerViewDate);
  }, [isManager, managerViewDate, snapshot]);

  const viewedBusinessDateKey = getBusinessDateKey(effectiveSnapshot);
  const businessDateAnchor = useMemo(() => getBusinessDateAnchor(effectiveSnapshot), [effectiveSnapshot]);

  const useLivePresence = isManager && managerViewDate === null;

  const pickerMinDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });
  const { data: onShiftList = [] } = useQuery({
    queryKey: ['team-members-on-shift', team.id],
    queryFn: () => getTeamMembersOnShift(team.id),
    refetchInterval: useLivePresence ? 15000 : false,
    enabled: useLivePresence,
  });
  const { data: breakLogs = [] } = useQuery({
    queryKey: ['team-break-logs', team.id, viewedBusinessDateKey],
    queryFn: () => getTeamBreakLogsForDate(team.id, effectiveSnapshot),
    refetchInterval: isManager ? (useLivePresence ? 3000 : false) : 3000,
    refetchOnMount: 'always',
  });

  const dayStart = useMemo(() => getBusinessDayStart(effectiveSnapshot), [effectiveSnapshot]);
  const dayEndInclusive = useMemo(() => {
    const end = getNextBusinessDayStart(effectiveSnapshot);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return end;
  }, [effectiveSnapshot]);

  const { data: shiftLogs = [] } = useQuery({
    queryKey: ['team-shift-logs', team.id, viewedBusinessDateKey],
    queryFn: () => getTeamShiftLogs(team.id, dayStart, dayEndInclusive),
    refetchInterval: isManager ? (useLivePresence ? 15000 : false) : 15000,
  });

  const onShiftUserIds = useMemo(() => {
    if (isManager && managerViewDate != null) {
      return new Set(shiftLogs.map((x) => x.user_id));
    }
    return new Set(onShiftList.map((x) => x.user_id));
  }, [isManager, managerViewDate, shiftLogs, onShiftList]);
  const membersOnShift = useMemo(() => members.filter((m) => onShiftUserIds.has(m.user_id)), [members, onShiftUserIds]);
  const membersOffShift = useMemo(() => members.filter((m) => !onShiftUserIds.has(m.user_id)), [members, onShiftUserIds]);
  const displayedMembers = useMemo(() => {
    if (!isManager) {
      if (!user?.id) return [];
      return members.filter((m) => m.user_id === user.id);
    }
    return shiftTab === 'on_shift' ? membersOnShift : membersOffShift;
  }, [isManager, user?.id, members, shiftTab, membersOnShift, membersOffShift]);

  const breaksByUser = useMemo(() => {
    const map: Record<string, typeof breakLogs> = {};
    for (const log of breakLogs) {
      if (!map[log.user_id]) map[log.user_id] = [];
      map[log.user_id].push(log);
    }
    return map;
  }, [breakLogs]);

  const shiftLogByUserId = useMemo(() => {
    const map: Record<string, (typeof shiftLogs)[number] | undefined> = {};
    // sorgu check_in_time desc order ile geliyorsa ilkini almak yeterli
    for (const l of shiftLogs) {
      if (!map[l.user_id]) map[l.user_id] = l;
    }
    return map;
  }, [shiftLogs]);

  const breakStatsByUserId = useMemo(() => {
    const map: Record<string, { totalMinutes: number; overrunCount: number; overrunSeconds: number }> = {};
    for (const b of breakLogs) {
      const startMs = new Date(b.started_at).getTime();
      const endMs = new Date(b.ended_at ?? new Date().toISOString()).getTime();
      const plannedMs = new Date(b.planned_end_at).getTime();
      const durationMin = Math.max(0, Math.round((endMs - startMs) / 60000));
      const overrunSec = Math.max(0, Math.floor((endMs - plannedMs) / 1000));
      if (!map[b.user_id]) {
        map[b.user_id] = { totalMinutes: 0, overrunCount: 0, overrunSeconds: 0 };
      }
      map[b.user_id].totalMinutes += durationMin;
      if (overrunSec > 0) {
        map[b.user_id].overrunCount += 1;
        map[b.user_id].overrunSeconds += overrunSec;
      }
    }
    return map;
  }, [breakLogs]);

  const shiftTabs = [
    { key: 'on_shift' as ShiftTabKey, label: `Mesaide (${membersOnShift.length})` },
    { key: 'off_shift' as ShiftTabKey, label: `Mesaide değil (${membersOffShift.length})` },
  ];

  const totalBreaks = breakLogs.length;
  const activeBreaks = breakLogs.filter((b) => !b.ended_at).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Vardiya Detayı</Text>
      </View>

      {isManager ? (
        <Card style={styles.datePickCard}>
          <View style={styles.datePickRow}>
            <View style={styles.datePickTextCol}>
              <Text style={styles.datePickLabel}>İncelenen iş günü</Text>
              {managerViewDate === null ? (
                <>
                  <Text style={styles.datePickValue}>
                    {businessDateAnchor.toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                  <Text style={styles.datePickHint}>Bugün</Text>
                </>
              ) : (
                <>
                  <Text style={styles.datePickValue}>
                    {toBusinessQueryReference(managerViewDate).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.datePickHint}>Seçilen tarih için kayıtlar</Text>
                </>
              )}
            </View>
            <View style={styles.datePickActions}>
              {managerViewDate !== null ? (
                <Pressable
                  onPress={() => setManagerViewDate(null)}
                  style={({ pressed }) => [styles.datePickBtnSecondary, pressed && styles.datePickBtnPressed]}
                >
                  <Text style={styles.datePickBtnSecondaryText}>Bugüne dön</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  setPickerDraft(managerViewDate ?? businessDateAnchor);
                  setDatePickerOpen(true);
                }}
                style={({ pressed }) => [styles.datePickBtn, pressed && styles.datePickBtnPressed]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.bgDark} />
                <Text style={styles.datePickBtnText}>Tarih seç</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      ) : null}

      {datePickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerDraft}
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={pickerMinDate}
          onChange={(event, selected) => {
            setDatePickerOpen(false);
            if (event.type === 'dismissed') return;
            if (selected) setManagerViewDate(selected);
          }}
        />
      ) : null}

      {datePickerOpen && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setDatePickerOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setDatePickerOpen(false)} />
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Tarih seçin</Text>
            <DateTimePicker
              value={pickerDraft}
              mode="date"
              display="inline"
              themeVariant="dark"
              maximumDate={new Date()}
              minimumDate={pickerMinDate}
              onChange={(_, selected) => {
                if (selected) setPickerDraft(selected);
              }}
              style={styles.pickerIos}
            />
            <View style={styles.pickerActions}>
              <Pressable
                onPress={() => setDatePickerOpen(false)}
                style={({ pressed }) => [styles.pickerActionBtn, pressed && styles.datePickBtnPressed]}
              >
                <Text style={styles.pickerActionCancel}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setManagerViewDate(pickerDraft);
                  setDatePickerOpen(false);
                }}
                style={({ pressed }) => [styles.pickerActionBtnPrimary, pressed && styles.datePickBtnPressed]}
              >
                <Text style={styles.pickerActionOk}>Tamam</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

      {isManager ? (
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{membersOnShift.length}</Text>
            <Text style={styles.metricLabel}>Mesaide</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{activeBreaks}</Text>
            <Text style={styles.metricLabel}>Aktif mola</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalBreaks}</Text>
            <Text style={styles.metricLabel}>Toplam mola</Text>
          </View>
        </View>
      ) : null}

      {isManager ? <TabBar tabs={shiftTabs} activeKey={shiftTab} onChange={setShiftTab} /> : null}
      {displayedMembers.length === 0 ? (
        <Card>
          <Text style={styles.placeholder}>Bu listede üye yok.</Text>
        </Card>
      ) : (
        displayedMembers.map((m) => {
          const displayName = m.user ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || 'Üye' : 'Üye';
          const myBreaks = breaksByUser[m.user_id] ?? [];
          const myShiftLog = shiftLogByUserId[m.user_id];
          const stats = breakStatsByUserId[m.user_id] ?? { totalMinutes: 0, overrunCount: 0, overrunSeconds: 0 };
          const isExpanded = !isManager || expandedUserId === m.user_id;

          return (
            <Card key={m.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <Avatar source={m.user?.profile_photo ?? null} name={displayName} size={42} style={styles.memberAvatar} />
                <View style={styles.memberHeaderLeft}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  <View style={styles.memberPills}>
                    <View style={styles.pill}>
                      <Ionicons name="log-in-outline" size={12} color={colors.accent} />
                      <Text style={styles.pillText}>
                        {myShiftLog ? fmtTime(myShiftLog.check_in_time) : 'Giris yok'}
                      </Text>
                    </View>
                    <View style={styles.pill}>
                      <Ionicons name="cafe-outline" size={12} color={colors.accent} />
                      <Text style={styles.pillText}>{myBreaks.length} mola · {stats.totalMinutes} dk</Text>
                    </View>
                  </View>
                </View>
                {isManager ? (
                  <Pressable
                    onPress={() => setExpandedUserId((prev) => (prev === m.user_id ? null : m.user_id))}
                    style={({ pressed }) => [styles.viewBtn, pressed && styles.viewBtnPressed]}
                  >
                    <Text style={styles.viewBtnText}>{isExpanded ? 'Kapat' : 'Detayları gör'}</Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>

              {isExpanded ? (
                <View style={styles.memberDetails}>
                  <View style={styles.timelineCard}>
                    <Text style={styles.timelineTitle}>Vardiya Zaman Çizgisi</Text>
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <Text style={styles.timelineLabel}>Vardiya girişi</Text>
                      <Text style={styles.timelineValue}>{myShiftLog ? fmtTime(myShiftLog.check_in_time) : '-'}</Text>
                    </View>
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineDotMuted} />
                      <Text style={styles.timelineLabel}>Vardiya çıkışı</Text>
                      <Text style={styles.timelineValue}>
                        {myShiftLog ? (myShiftLog.check_out_time ? fmtTime(myShiftLog.check_out_time) : 'Devam ediyor') : '-'}
                      </Text>
                    </View>
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <Text style={styles.timelineLabel}>Toplam vardiya süresi</Text>
                      <Text style={styles.timelineValue}>
                        {myShiftLog ? fmtDurationMinutes(myShiftLog.check_in_time, myShiftLog.check_out_time) : '-'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGrid}>
                    <View style={styles.detailTile}>
                      <Text style={styles.detailLabel}>Toplam mola</Text>
                      <Text style={styles.detailValue}>{stats.totalMinutes} dk</Text>
                    </View>
                    <View style={styles.detailTile}>
                      <Text style={styles.detailLabel}>Aşım adedi</Text>
                      <Text style={styles.detailValue}>{stats.overrunCount}</Text>
                    </View>
                    <View style={styles.detailTile}>
                      <Text style={styles.detailLabel}>Toplam aşım</Text>
                      <Text style={[styles.detailValue, stats.overrunSeconds > 0 && styles.detailValueDanger]}>
                        {fmtMinutesSeconds(stats.overrunSeconds)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.breaksCard}>
                    <View style={styles.breaksHeader}>
                      <Text style={styles.breaksTitle}>Mola Detayları</Text>
                    </View>
                    {myBreaks.length === 0 ? (
                      <Text style={styles.placeholderSmall}>
                        {managerViewDate != null ? 'Bu iş gününde mola kaydı yok.' : 'Bugün mola kaydı yok.'}
                      </Text>
                    ) : (
                      myBreaks.map((b, idx) => {
                        const overrun = getOverrunLabel(b.planned_end_at, b.ended_at);
                        return (
                          <View
                            key={b.id}
                            style={[
                              styles.breakItem,
                              idx < myBreaks.length - 1 && styles.breakItemDivider,
                            ]}
                          >
                            <View style={styles.breakItemTop}>
                              <View style={styles.breakNameWrap}>
                                <Text style={styles.breakName}>{b.template?.name ?? 'Mola'}</Text>
                              </View>
                              <View style={styles.breakDurationBadge}>
                                <Text style={styles.breakDurationText}>{b.template?.duration_minutes ?? '-'} dk</Text>
                              </View>
                            </View>
                            <Text style={styles.breakTimelineMeta}>
                              {fmtTime(b.started_at)} - {b.ended_at ? fmtTime(b.ended_at) : 'Devam ediyor'} · {fmtDurationMinutes(b.started_at, b.ended_at)}
                            </Text>
                            <View style={styles.breakFooter}>
                              <Text style={styles.breakDurationMeta}>Toplam süre</Text>
                              {overrun ? <Text style={styles.overrunPill}>{overrun}</Text> : <Text style={styles.onTimePill}>Plan içinde</Text>}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  heroCard: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  heroDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  heroTitle: { fontSize: 26, color: colors.textPrimary, fontFamily: fonts.bold, letterSpacing: 0.2 },
  datePickCard: { marginBottom: spacing.sm, borderRadius: borderRadius.lg },
  datePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  datePickTextCol: { flex: 1, minWidth: 0 },
  datePickLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  datePickValue: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  datePickHint: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  datePickActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  datePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  datePickBtnText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.bgDark },
  datePickBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  datePickBtnSecondaryText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  datePickBtnPressed: { opacity: 0.88 },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerSheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: '18%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  pickerIos: { alignSelf: 'stretch' },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerActionBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  pickerActionBtnPrimary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
  },
  pickerActionCancel: { fontSize: 15, color: colors.textSecondary, fontFamily: fonts.medium },
  pickerActionOk: { fontSize: 15, color: colors.bgDark, fontFamily: fonts.semibold },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary },
  metricLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 3, textTransform: 'uppercase' },
  placeholder: { ...typography.body, color: colors.textMuted },
  placeholderSmall: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  memberCard: { marginBottom: spacing.sm, borderRadius: borderRadius.lg },
  memberHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingBottom: spacing.xs },
  memberAvatar: { borderWidth: 1, borderColor: colors.border },
  memberHeaderLeft: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 17, fontFamily: fonts.semibold, color: colors.textPrimary, marginBottom: 6 },
  memberPills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '10',
  },
  pillText: { fontSize: 11, color: colors.accent, fontFamily: fonts.medium },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accent + '45',
    backgroundColor: colors.accent + '12',
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  viewBtnPressed: { opacity: 0.85 },
  viewBtnText: { fontSize: 12, color: colors.accent, fontFamily: fonts.semibold },
  memberDetails: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  timelineCard: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontFamily: fonts.medium,
    marginBottom: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
  },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  timelineDotMuted: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  timelineLabel: { flex: 1, fontSize: 12, color: colors.textSecondary },
  timelineValue: { fontSize: 12, color: colors.textPrimary, fontFamily: fonts.semibold },
  detailGrid: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  detailTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  detailLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.semibold },
  detailValueDanger: { color: colors.error },
  breaksCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  breaksHeader: { marginBottom: spacing.xs },
  breaksTitle: { fontSize: 12, color: colors.accent, fontFamily: fonts.semibold, textTransform: 'uppercase' },
  breakItem: {
    paddingVertical: spacing.sm,
  },
  breakItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  breakNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  breakName: { fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary },
  breakDurationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent + '45',
    backgroundColor: colors.accent + '12',
  },
  breakDurationText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.accent },
  breakTimelineMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  breakFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  breakDurationMeta: { fontSize: 11, color: colors.textMuted },
  overrunPill: {
    fontSize: 10,
    color: colors.error,
    fontFamily: fonts.semibold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error + '14',
  },
  onTimePill: {
    fontSize: 10,
    color: colors.success,
    fontFamily: fonts.semibold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success + '14',
  },
});
