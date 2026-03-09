import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, TabBar, Input } from '../components';
import { getTeamShiftLogs, type ShiftLogWithUser } from '../services/shifts';
import { getTeamMembers } from '../services/teams';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

const HOURLY_RATE_STORAGE_KEY = 'timesheet-hourly-rate';

type Props = { route: RouteProp<TeamsStackParamList, 'Timesheet'> };

type TimesheetTabKey = 'puantaj' | 'mesai';
const TIMESHEET_TABS: { key: TimesheetTabKey; label: string }[] = [
  { key: 'puantaj', label: 'Puantaj' },
  { key: 'mesai', label: 'Mesai Ücretleri' },
];

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function getCurrentWeekMonday(): Date {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function hoursBetween(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  const h = (b - a) / (1000 * 60 * 60);
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}s ${mins}dk`;
}

function getLogsByDay(logs: ShiftLogWithUser[], weekDays: Date[]): Record<string, ShiftLogWithUser[]> {
  const byDay: Record<string, ShiftLogWithUser[]> = {};
  weekDays.forEach((d) => {
    const key = d.toDateString();
    byDay[key] = (logs ?? []).filter((log) => new Date(log.check_in_time).toDateString() === key);
  });
  return byDay;
}

/** Saat cinsinden süre (ondalıklı), ücret hesabı için */
function hoursBetweenDecimal(startIso: string, endIso: string | null): number {
  if (!endIso) return 0;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return (b - a) / (1000 * 60 * 60);
}

export function TimesheetScreen({ route }: Props) {
  const { team } = route.params;
  const [mainTab, setMainTab] = useState<TimesheetTabKey>('puantaj');
  const [hourlyRate, setHourlyRate] = useState('');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getCurrentWeekMonday());
  const selectedWeekDays = useMemo(() => getDaysForWeek(selectedWeekStart), [selectedWeekStart]);
  const todayKey = new Date().toDateString();
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => todayIndex);
  const selectedDay = selectedWeekDays[Math.min(selectedDayIndex, 6)] ?? selectedWeekDays[0];
  const selectedDayKey = selectedDay?.toDateString() ?? todayKey;
  const weekStart = useMemo(() => {
    const d = new Date(selectedWeekStart);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedWeekStart]);
  const weekEnd = useMemo(() => {
    const d = new Date(selectedWeekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [selectedWeekStart]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['team-shift-logs', team.id, weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () => getTeamShiftLogs(team.id, weekStart, weekEnd),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
    enabled: mainTab === 'mesai',
  });

  useEffect(() => {
    const key = `${HOURLY_RATE_STORAGE_KEY}-${team.id}`;
    AsyncStorage.getItem(key).then((saved) => {
      if (saved != null) setHourlyRate(saved);
    });
  }, [team.id]);

  useEffect(() => {
    const key = `${HOURLY_RATE_STORAGE_KEY}-${team.id}`;
    AsyncStorage.setItem(key, hourlyRate);
  }, [team.id, hourlyRate]);

  const logsWithUser = logs as ShiftLogWithUser[];
  const logsByDay = useMemo(() => getLogsByDay(logsWithUser, selectedWeekDays), [logsWithUser, selectedWeekDays]);

  const wageSummary = useMemo(() => {
    const byUser: Record<string, { totalHours: number; name: string }> = {};
    members.forEach((m) => {
      const name = m.user
        ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || 'Üye'
        : 'Üye';
      byUser[m.user_id] = { totalHours: 0, name };
    });
    logsWithUser.forEach((log) => {
      if (!log.check_out_time) return;
      const h = hoursBetweenDecimal(log.check_in_time, log.check_out_time);
      if (!byUser[log.user_id]) {
        const name = log.user
          ? [log.user.name, log.user.surname].filter(Boolean).join(' ') || 'Üye'
          : 'Üye';
        byUser[log.user_id] = { totalHours: 0, name };
      }
      byUser[log.user_id].totalHours += h;
    });
    return Object.entries(byUser).map(([userId, { totalHours, name }]) => ({
      userId,
      name,
      totalHours,
      pay: totalHours * (parseFloat(hourlyRate) || 0),
    }));
  }, [members, logsWithUser, hourlyRate]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Puantaj Yönetimi</Text>
      <TabBar tabs={TIMESHEET_TABS} activeKey={mainTab} onChange={setMainTab} variant="primary" />

      {mainTab === 'puantaj' && (
        <>
      <Text style={styles.hint}>
        Çalışanların vardiya giriş/çıkış saatleri ve mesai süreleri.
      </Text>

      <View style={styles.weekNavRow}>
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
        onPress={() => {
          setSelectedWeekStart(getCurrentWeekMonday());
          setSelectedDayIndex(todayIndex);
        }}
        style={styles.thisWeekChip}
      >
        <Ionicons name="today-outline" size={16} color={colors.accent} />
        <Text style={styles.thisWeekChipText}>Bu hafta</Text>
      </Pressable>

      <View style={styles.dayChipsWrap}>
        {selectedWeekDays.map((day, i) => {
          const isSelected = i === selectedDayIndex;
          const isToday = day.toDateString() === todayKey;
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => setSelectedDayIndex(i)}
              style={[
                styles.dayChip,
                isSelected && styles.dayChipActive,
                isToday && !isSelected && styles.dayChipToday,
              ]}
            >
              <Text
                style={[
                  styles.dayChipWeekday,
                  isSelected && styles.dayChipTextActive,
                  isToday && !isSelected && styles.dayChipTextToday,
                ]}
              >
                {WEEKDAY_LABELS[day.getDay()]}
              </Text>
              <Text
                style={[
                  styles.dayChipDate,
                  isSelected && styles.dayChipTextActive,
                  isToday && !isSelected && styles.dayChipTextToday,
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <Card><Text style={styles.placeholder}>Yükleniyor…</Text></Card>
      ) : selectedDay ? (
        <View
          style={[
            styles.selectedDayCard,
            selectedDayKey === todayKey && styles.selectedDayCardToday,
          ]}
        >
          <View style={styles.dayCardHeader}>
            <Text
              style={[
                styles.dayCardTitle,
                selectedDayKey === todayKey && styles.dayCardTitleToday,
              ]}
            >
              {WEEKDAY_LABELS[selectedDay.getDay()]}, {selectedDay.getDate()}{' '}
              {selectedDay.toLocaleDateString('tr-TR', { month: 'short' })}
            </Text>
            {selectedDayKey === todayKey && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>Bugün</Text>
              </View>
            )}
          </View>
          {(logsByDay[selectedDayKey] ?? []).length === 0 ? (
            <View style={styles.dayEmpty}>
              <Text style={styles.dayEmptyText}>Bu güne ait kayıt yok.</Text>
            </View>
          ) : (
            (logsByDay[selectedDayKey] ?? []).map((log) => {
              const name = log.user
                ? [log.user.name, log.user.surname].filter(Boolean).join(' ') || 'Üye'
                : 'Üye';
              return (
                <View key={log.id} style={styles.logRow}>
                  <View style={styles.logRowContent}>
                    <Text style={styles.logName}>{name}</Text>
                    <Text style={styles.logTime}>
                      {formatTime(log.check_in_time)} –{' '}
                      {log.check_out_time ? formatTime(log.check_out_time) : '—'}
                    </Text>
                    <Text style={styles.logDuration}>
                      {hoursBetween(log.check_in_time, log.check_out_time)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}
        </>
      )}

      {mainTab === 'mesai' && (
        <>
          <Text style={styles.hint}>
            Saatlik ücreti girin; seçilen haftadaki mesaiye göre ödenecek tutar hesaplanır.
          </Text>
          <View style={styles.weekNavRow}>
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
          <View style={styles.wageInputRow}>
            <Input
              label="Saatlik ücret (₺)"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="Örn: 150"
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.wageSectionTitle}>Seçilen haftaya göre ödeme</Text>
          {wageSummary.length === 0 ? (
            <Card><Text style={styles.placeholder}>Ekipte üye yok veya veri yükleniyor.</Text></Card>
          ) : (
            wageSummary.map((row) => (
              <Card key={row.userId} style={styles.wageRowCard}>
                <View style={styles.wageRow}>
                  <Text style={styles.wageRowName}>{row.name}</Text>
                  <View style={styles.wageRowRight}>
                    <Text style={styles.wageRowHours}>
                      {row.totalHours.toFixed(1)} saat
                    </Text>
                    <Text style={styles.wageRowPay}>
                      {(row.pay || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  placeholder: { ...typography.body, color: colors.textSecondary },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekNavBtn: { padding: spacing.xs },
  weekNavLabel: {
    ...typography.subtitle,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  thisWeekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '12',
  },
  thisWeekChipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  dayChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignSelf: 'stretch',
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  dayChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dayChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '18',
  },
  dayChipToday: {
    borderColor: colors.accent + '60',
  },
  dayChipWeekday: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  dayChipDate: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  dayChipTextActive: { color: colors.accent },
  dayChipTextToday: { color: colors.accent },
  selectedDayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  selectedDayCardToday: {
    borderColor: colors.accent + '60',
    backgroundColor: colors.accent + '08',
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
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayCardTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  dayCardTitleToday: { color: colors.accent },
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
  dayEmpty: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
  },
  dayEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  logRow: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent + '50',
    marginBottom: spacing.xs,
  },
  logRowContent: {},
  logName: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textPrimary },
  logTime: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  logDuration: { fontSize: 12, color: colors.accent, fontFamily: fonts.medium, marginTop: 2 },
  wageInputRow: { marginBottom: spacing.lg },
  wageSectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  wageRowCard: { marginBottom: spacing.sm },
  wageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wageRowName: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textPrimary, flex: 1 },
  wageRowRight: { alignItems: 'flex-end' },
  wageRowHours: { fontSize: 13, color: colors.textSecondary },
  wageRowPay: { fontSize: 15, fontFamily: fonts.semibold, color: colors.accent, marginTop: 2 },
});
