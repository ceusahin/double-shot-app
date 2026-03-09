import React, { useState, useLayoutEffect, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, LeaderboardItem, TabBar } from '../components';
import { useNotificationModal } from '../context/NotificationModalContext';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers, createTeamInviteLink, removeMember } from '../services/teams';
import { getTeamShifts } from '../services/shifts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { Team, Shift } from '../types';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

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

function getShiftsByDay(
  shifts: (Shift & { user?: { name?: string; surname?: string } })[],
  weekDays: Date[]
): Record<string, (Shift & { user?: { name?: string; surname?: string } })[]> {
  const byDay: Record<string, (Shift & { user?: { name?: string; surname?: string } })[]> = {};
  weekDays.forEach((d) => {
    const key = d.toDateString();
    byDay[key] = (shifts ?? []).filter((s) => new Date(s.start_time).toDateString() === key);
  });
  return byDay;
}

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${weekStart.getDate()} – ${end.getDate()} ${weekStart.toLocaleDateString('tr-TR', { month: 'short' })} ${weekStart.getFullYear()}`;
}

type Props = {
  route: { params: { team: Team & { role?: string } } };
};

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamDetail'>;

type TeamTabKey = 'genel' | 'vardiya';

const TABS: { key: TeamTabKey; label: string }[] = [
  { key: 'genel', label: 'Genel' },
  { key: 'vardiya', label: 'Vardiya' },
];

const INVITE_DURATIONS = [
  { label: '15 dakika', minutes: 15 },
  { label: '1 saat', minutes: 60 },
  { label: '6 saat', minutes: 360 },
  { label: '24 saat', minutes: 1440 },
  { label: '7 gün', minutes: 10080 },
];

function formatShiftTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function getCurrentWeekMonday(): Date {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function TeamDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const isManager = team.role === 'MANAGER' || team.owner_id === user?.id;
  const [activeTab, setActiveTab] = useState<TeamTabKey>('genel');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getCurrentWeekMonday());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteDurationMinutes, setInviteDurationMinutes] = useState(60);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const queryClient = useQueryClient();
  const { setCurrentTeamId } = useNotificationModal();

  useEffect(() => {
    setCurrentTeamId(team.id);
    return () => setCurrentTeamId(null);
  }, [team.id, setCurrentTeamId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isManager ? (
          <Pressable onPress={() => { setShowInviteModal(true); setInviteLink(null); }} style={styles.headerInviteBtn}>
            <Text style={styles.headerInviteText}>Ekibe davet et</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setShowOptionsModal(true)} style={styles.headerInviteBtn}>
            <Text style={styles.headerInviteText}>Ekip ayarları</Text>
          </Pressable>
        ),
    });
  }, [isManager, navigation]);

  const handleLeaveTeam = () => {
    if (!user?.id) return;
    Alert.alert(
      'Ekipten ayrıl',
      `"${team.name}" takımından ayrılmak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: async () => {
            setLeaveLoading(true);
            try {
              await removeMember(team.id, user.id);
              queryClient.invalidateQueries({ queryKey: ['my-teams', user.id] });
              setShowOptionsModal(false);
              navigation.reset({ index: 0, routes: [{ name: 'TeamsList' }] });
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Ekipten ayrılınamadı.');
            } finally {
              setLeaveLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateInviteLink = async () => {
    setInviteLoading(true);
    try {
      const result = await createTeamInviteLink(team.id, inviteDurationMinutes);
      setInviteLink(result.link);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Link oluşturulamadı.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('Kopyalandı', 'Davet linki panoya kopyalandı.');
  };

  const handleShareInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await Share.share({ message: inviteLink, title: `${team.name} – Davet linki` });
    } catch (_) {}
  };

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });

  const selectedWeekDays = React.useMemo(() => getDaysForWeek(selectedWeekStart), [selectedWeekStart]);
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['team-shifts', team.id, selectedWeekStart.toISOString()],
    queryFn: () => getTeamShifts(team.id, selectedWeekStart),
    enabled: activeTab === 'vardiya',
  });
  const shiftsByDay = React.useMemo(
    () =>
      getShiftsByDay(shifts as (Shift & { user?: { name?: string; surname?: string } })[], selectedWeekDays),
    [shifts, selectedWeekDays]
  );

  const sortedByXp = [...members]
    .filter((m) => m.user)
    .sort((a, b) => (b.user?.experience_points ?? 0) - (a.user?.experience_points ?? 0));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.teamName}>{team.name}</Text>

      <TabBar tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      {activeTab === 'genel' && (
        <>
          <Pressable
            onPress={() => navigation.navigate('ShiftCheckIn', { team })}
            style={({ pressed }) => [styles.shiftCheckInCard, pressed && styles.shiftCheckInCardPressed]}
          >
            <View style={styles.shiftCheckInIconWrap}>
              <Ionicons name="location" size={28} color={colors.accent} />
            </View>
            <View style={styles.shiftCheckInText}>
              <Text style={styles.shiftCheckInTitle}>Vardiya girişi</Text>
              <Text style={styles.shiftCheckInSubtitle}>Konumunuzla mesai başlatın</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>

          {isManager && (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Yönetici</Text>
              <Button title="Ekip Yönetimi" onPress={() => navigation.navigate('TeamManagement', { team })} variant="outline" style={styles.btn} />
              <Button title="Vardiya Yönetimi" onPress={() => navigation.navigate('ShiftManagement', { team })} variant="outline" style={styles.btn} />
              <Button title="Puantaj Yönetimi" onPress={() => navigation.navigate('Timesheet', { team })} variant="outline" style={styles.btn} />
              <Button title="Vardiya Konum Yönetimi" onPress={() => navigation.navigate('ShiftLocationManagement', { team })} variant="outline" style={styles.btn} />
            </Card>
          )}

          <Text style={styles.sectionTitle}>Liderlik tablosu</Text>
          {sortedByXp.length === 0 ? (
            <Card><Text style={styles.placeholder}>Henüz üye yok.</Text></Card>
          ) : (
            sortedByXp.slice(0, 10).map((m, i) =>
              m.user ? (
                <LeaderboardItem
                  key={m.id}
                  rank={i + 1}
                  user={m.user}
                  score={m.user.experience_points}
                  scoreLabel="XP"
                  onPress={() => navigation.navigate('MemberProfile', { user: m.user! })}
                />
              ) : null
            )
          )}
        </>
      )}

      {activeTab === 'vardiya' && (
        <>
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
          <Text style={styles.planSectionTitle}>Haftalık vardiyalar</Text>
          {shiftsLoading ? (
            <View style={styles.dayCard}><Text style={styles.placeholder}>Yükleniyor…</Text></View>
          ) : (
            selectedWeekDays.map((day) => {
              const dayShifts = shiftsByDay[day.toDateString()] ?? [];
              const dayName = WEEKDAY_LABELS[day.getDay()];
              const dateNum = day.getDate();
              const monthShort = day.toLocaleDateString('tr-TR', { month: 'short' });
              const isToday = day.toDateString() === new Date().toDateString();
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
                          <Text style={styles.shiftRowName}>
                            {s.user ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye' : 'Üye'}
                          </Text>
                          <Text style={styles.shiftRowTime}>
                            {formatShiftTime(s.start_time)} – {formatShiftTime(s.end_time)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Davet linki oluştur</Text>
              <Pressable onPress={() => setShowInviteModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            {!inviteLink ? (
              <>
                <Text style={styles.modalLabel}>Link geçerlilik süresi</Text>
                {INVITE_DURATIONS.map((d) => (
                  <Pressable
                    key={d.minutes}
                    style={[styles.durationOption, inviteDurationMinutes === d.minutes && styles.durationOptionActive]}
                    onPress={() => setInviteDurationMinutes(d.minutes)}
                  >
                    <Text style={[styles.durationLabel, inviteDurationMinutes === d.minutes && styles.durationLabelActive]}>{d.label}</Text>
                  </Pressable>
                ))}
                <Button title="Link oluştur" onPress={handleCreateInviteLink} loading={inviteLoading} fullWidth style={styles.modalBtn} />
              </>
            ) : (
              <>
                <Text style={styles.modalLabel}>Davet linki (süre dolana kadar geçerli)</Text>
                <Text style={styles.linkText} selectable>{inviteLink}</Text>
                <Button title="Kopyala" onPress={handleCopyInviteLink} variant="secondary" fullWidth style={styles.modalBtn} />
                <Button title="Paylaş" onPress={handleShareInviteLink} fullWidth style={styles.modalBtn} />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showOptionsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ekip ayarları</Text>
              <Pressable onPress={() => setShowOptionsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            <Button
              title="Ekipten ayrıl"
              onPress={handleLeaveTeam}
              loading={leaveLoading}
              variant="outline"
              style={[styles.modalBtn, styles.leaveBtn]}
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
  teamName: { ...typography.title, color: colors.accent, marginBottom: spacing.xs },
  inviteCode: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  btn: { marginTop: spacing.sm },
  shiftCheckInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  shiftCheckInCardPressed: { opacity: 0.92 },
  shiftCheckInIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftCheckInText: { flex: 1, minWidth: 0 },
  shiftCheckInTitle: { ...typography.body, fontFamily: fonts.semibold, color: colors.textPrimary },
  shiftCheckInSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md },
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
    marginBottom: spacing.md,
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
  planSectionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  shiftRowContent: { flex: 1 },
  shiftRowName: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  shiftRowTime: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  shiftCard: { marginBottom: spacing.sm },
  shiftDate: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  shiftTime: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  shiftUser: { fontSize: 12, color: colors.accent, marginTop: 4 },
  headerInviteBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerInviteText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { backgroundColor: colors.glassBg, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  modalClose: { color: colors.textSecondary, fontSize: 20 },
  modalLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  durationOption: { padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  durationOptionActive: { borderColor: colors.accent, backgroundColor: 'rgba(212,175,55,0.1)' },
  durationLabel: { color: colors.textPrimary },
  durationLabelActive: { color: colors.accent, fontWeight: '600' },
  modalBtn: { marginTop: spacing.sm },
  linkText: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md },
  leaveBtn: { borderColor: colors.error },
});
