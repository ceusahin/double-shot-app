import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components';
import { getTeamShiftLogs, type ShiftLogWithUser } from '../services/shifts';
import { colors, spacing, typography } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'Timesheet'> };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export function TimesheetScreen({ route }: Props) {
  const { team } = route.params;
  const [periodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [periodEnd] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['team-shift-logs', team.id, periodStart, periodEnd],
    queryFn: () => getTeamShiftLogs(team.id, periodStart, periodEnd),
  });

  const logsWithUser = logs as ShiftLogWithUser[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Puantaj (son 7 gün)</Text>
      <Text style={styles.hint}>
        Çalışanların vardiya giriş/çıkış saatleri ve mesai süreleri.
      </Text>

      {isLoading ? (
        <Card><Text style={styles.placeholder}>Yükleniyor…</Text></Card>
      ) : logsWithUser.length === 0 ? (
        <Card>
          <Text style={styles.placeholder}>Bu dönemde vardiya giriş/çıkış kaydı yok.</Text>
        </Card>
      ) : (
        logsWithUser.map((log) => {
          const name = log.user
            ? [log.user.name, log.user.surname].filter(Boolean).join(' ') || 'Üye'
            : 'Üye';
          return (
            <Card key={log.id} style={styles.logCard}>
              <Text style={styles.logName}>{name}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Giriş:</Text>
                <Text style={styles.value}>{formatDateTime(log.check_in_time)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Çıkış:</Text>
                <Text style={styles.value}>
                  {log.check_out_time ? formatDateTime(log.check_out_time) : '—'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Süre:</Text>
                <Text style={[styles.value, styles.duration]}>
                  {hoursBetween(log.check_in_time, log.check_out_time)}
                </Text>
              </View>
            </Card>
          );
        })
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
  logCard: { marginBottom: spacing.sm },
  logName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  row: { flexDirection: 'row', marginTop: 6 },
  label: { fontSize: 13, color: colors.textSecondary, width: 56 },
  value: { fontSize: 13, color: colors.textPrimary },
  duration: { color: colors.accent, fontWeight: '600' },
});
