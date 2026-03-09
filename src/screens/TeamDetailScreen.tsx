import React, { useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, LeaderboardItem, TabBar } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers, createTeamInviteLink, removeMember } from '../services/teams';
import { getTeamShifts } from '../services/shifts';
import { getTeamNotifications } from '../services/notifications';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { Team } from '../types';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = {
  route: { params: { team: Team & { role?: string } } };
};

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamDetail'>;

type TeamTabKey = 'genel' | 'vardiya' | 'bildirimler';

const TABS: { key: TeamTabKey; label: string }[] = [
  { key: 'genel', label: 'Genel' },
  { key: 'vardiya', label: 'Vardiya' },
  { key: 'bildirimler', label: 'Bildirimler' },
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

function formatShiftDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function TeamDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const isManager = team.role === 'MANAGER' || team.owner_id === user?.id;
  const [activeTab, setActiveTab] = useState<TeamTabKey>('genel');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteDurationMinutes, setInviteDurationMinutes] = useState(60);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const queryClient = useQueryClient();

  useLayoutEffect(() => {
    if (isManager) {
      navigation.setOptions({
        headerRight: () => (
          <Pressable onPress={() => { setShowInviteModal(true); setInviteLink(null); }} style={styles.headerInviteBtn}>
            <Text style={styles.headerInviteText}>Ekibe davet et</Text>
          </Pressable>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: () => (
          <Pressable onPress={() => setShowOptionsModal(true)} style={styles.headerInviteBtn}>
            <Text style={styles.headerInviteText}>Ekip ayarları</Text>
          </Pressable>
        ),
      });
    }
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

  const { data: shifts = [] } = useQuery({
    queryKey: ['team-shifts', team.id],
    queryFn: () => getTeamShifts(team.id),
    enabled: activeTab === 'vardiya',
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['team-notifications', team.id],
    queryFn: () => getTeamNotifications(team.id),
    enabled: activeTab === 'bildirimler',
  });

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
              <Button title="Alan/Rol Yönetimi" onPress={() => navigation.navigate('AreaRoleManagement', { team })} variant="outline" style={styles.btn} />
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
          <Text style={styles.sectionTitle}>Bu haftanın vardiyaları</Text>
          {shifts.length === 0 ? (
            <Card><Text style={styles.placeholder}>Planlanmış vardiya yok.</Text></Card>
          ) : (
            shifts.map((s) => (
              <Card key={s.id} style={styles.shiftCard}>
                <Text style={styles.shiftDate}>{formatShiftDate(s.start_time)}</Text>
                <Text style={styles.shiftTime}>
                  {formatShiftTime(s.start_time)} – {formatShiftTime(s.end_time)}
                </Text>
                {s.user && (
                  <Text style={styles.shiftUser}>
                    {s.user.name} {s.user.surname}
                  </Text>
                )}
              </Card>
            ))
          )}
        </>
      )}

      {activeTab === 'bildirimler' && (
        <>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          {notifications.length === 0 ? (
            <Card><Text style={styles.placeholder}>Henüz bildirim yok.</Text></Card>
          ) : (
            notifications.map((n) => (
              <Card key={n.id} style={styles.notifCard}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifMessage}>{n.message}</Text>
                <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleString('tr-TR')}</Text>
              </Card>
            ))
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
  shiftCard: { marginBottom: spacing.sm },
  shiftDate: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  shiftTime: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  shiftUser: { fontSize: 12, color: colors.accent, marginTop: 4 },
  notifCard: { marginBottom: spacing.sm },
  notifTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  notifMessage: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  notifTime: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
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
