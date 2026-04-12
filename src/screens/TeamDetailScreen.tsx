import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, TabBar, Avatar } from '../components';
import { TeamScheduleTableModal } from '../components/TeamScheduleTableModal';
import { useNotificationModal } from '../context/NotificationModalContext';
import { useAuthStore } from '../store/authStore';
import { listMembersWithRoles } from '../services/rbac';
import { supabase } from '../services/supabase';
import { getTeamMembers, createTeamInviteLink, removeMember, getPendingJoinRequestsCountForTeam } from '../services/teams';
import { listTeamMemberFeaturePermissions } from '../services/memberPermissions';
import { TEAM_FEATURE_CARDS } from '../constants/memberFeaturePermissions';
import { navigationRef } from '../navigation/navigationRef';
import { getTeamShifts } from '../services/shifts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import { subscriptionDaysRemaining } from '../utils/subscriptionPeriod';
import {
  getCalendarColumnBusinessKey,
  getTimestampBusinessDateKey,
  getBusinessTodayColumnIndex,
  useBusinessDayClock,
} from '../utils/businessDay';
import { buildOrgRoleByUserId, resolveShiftRoleLabel } from '../utils/shiftRoleLabel';
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
    const key = getCalendarColumnBusinessKey(d);
    byDay[key] = (shifts ?? []).filter((s) => getTimestampBusinessDateKey(s.start_time) === key);
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

function formatWeekDayDateLabel(day: Date): string {
  const wd = WEEKDAY_LABELS[day.getDay()];
  return `${wd}, ${day.getDate()} ${day.toLocaleDateString('tr-TR', { month: 'short' })}`;
}

function isSameWeekMonday(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function TeamSubscriptionBanner({ teamName, endsAtIso }: { teamName: string; endsAtIso: string }) {
  const daysLeft = subscriptionDaysRemaining(endsAtIso);
  const endLabel = new Date(endsAtIso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const expired = daysLeft !== null && daysLeft < 0;
  const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 10;

  return (
    <View
      style={[
        styles.subBanner,
        urgent && styles.subBannerUrgent,
        expired && styles.subBannerExpired,
      ]}
    >
      <Ionicons
        name={expired ? 'alert-circle' : 'time-outline'}
        size={22}
        color={expired ? colors.error : urgent ? colors.accent : colors.textSecondary}
      />
      <View style={styles.subBannerTextWrap}>
        <Text style={styles.subBannerTitle}>Paket süresi</Text>
        {expired ? (
          <Text style={styles.subBannerBody}>
            "{teamName}" paket süresi {endLabel} tarihinde sona erdi. Yenileme için destek ile iletişime geçin.
          </Text>
        ) : urgent ? (
          <Text style={styles.subBannerBody}>
            Aboneliğinize yaklaşık <Text style={styles.subBannerStrong}>{daysLeft} gün</Text> kaldı (bitiş{' '}
            {endLabel}). Yakında bir bildirim de alacaksınız.
          </Text>
        ) : (
          <Text style={styles.subBannerBody}>
            Bitiş tarihi: <Text style={styles.subBannerStrong}>{endLabel}</Text>
            {daysLeft !== null ? ` · ${daysLeft} gün kaldı` : null}
          </Text>
        )}
      </View>
    </View>
  );
}

export function TeamDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { team } = route.params;
  const { businessDateKey } = useBusinessDayClock();
  const user = useAuthStore((s) => s.user);
  const isManager = team.role === 'MANAGER' || team.owner_id === user?.id;
  const [activeTab, setActiveTab] = useState<TeamTabKey>('genel');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getCurrentWeekMonday());
  const [teamScheduleDayIndex, setTeamScheduleDayIndex] = useState(() => {
    const mon = getCurrentWeekMonday();
    const days = getDaysForWeek(mon);
    const idx = getBusinessTodayColumnIndex(days, new Date());
    return idx >= 0 ? idx : 0;
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteDurationMinutes, setInviteDurationMinutes] = useState(60);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [myShiftsSectionOpen, setMyShiftsSectionOpen] = useState(true);
  const [teamScheduleFullscreenOpen, setTeamScheduleFullscreenOpen] = useState(false);
  const queryClient = useQueryClient();
  const { setCurrentTeamId } = useNotificationModal();

  useEffect(() => {
    setCurrentTeamId(team.id);
    return () => setCurrentTeamId(null);
  }, [team.id, setCurrentTeamId]);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', team.id] });
      queryClient.invalidateQueries({ queryKey: ['join-requests-count', team.id] });
      queryClient.invalidateQueries({ queryKey: ['team-member-feature-permissions', team.id] });
      if (team.organization_id) {
        queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', team.organization_id] });
      }
    }, [queryClient, team.id, team.organization_id])
  );

  useEffect(() => {
    const channel = supabase
      .channel(`team_members:${team.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${team.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
          queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', team.id] });
          queryClient.invalidateQueries({ queryKey: ['join-requests-count', team.id] });
          queryClient.invalidateQueries({ queryKey: ['team-member-feature-permissions', team.id] });
          if (team.organization_id) {
            queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', team.organization_id] });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, team.id, team.organization_id]);

  const { data: joinRequestCount = 0 } = useQuery({
    queryKey: ['join-requests-count', team.id],
    queryFn: () => getPendingJoinRequestsCountForTeam(team.id),
    enabled: isManager,
    refetchInterval: 10000,
  });

  const goToJoinRequests = () => {
    if (navigationRef.isReady()) {
      (navigationRef as { navigate: (name: string, params?: object) => void }).navigate('Main', {
        screen: 'JoinRequests',
        params: { teamId: team.id },
      });
    }
  };

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
              queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
              queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', team.id] });
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
  const { data: memberFeaturePermissions = [] } = useQuery({
    queryKey: ['team-member-feature-permissions', team.id],
    queryFn: () => listTeamMemberFeaturePermissions(team.id),
    enabled: !isManager,
  });

  const memberAllowedFeatureKeys = React.useMemo(() => {
    if (isManager || !user?.id) return new Set<string>();
    return new Set(
      memberFeaturePermissions
        .filter((row) => row.user_id === user.id)
        .map((row) => row.feature_key)
    );
  }, [isManager, memberFeaturePermissions, user?.id]);

  const visibleManagerCards = React.useMemo(() => {
    if (isManager) return TEAM_FEATURE_CARDS;
    return TEAM_FEATURE_CARDS.filter((card) => memberAllowedFeatureKeys.has(card.key));
  }, [isManager, memberAllowedFeatureKeys]);

  const organizationId = team.organization_id ?? undefined;
  const { data: orgMembersWithRoles = [] } = useQuery({
    queryKey: ['org-members-with-roles', organizationId],
    queryFn: () => listMembersWithRoles(organizationId!),
    enabled: !!organizationId,
  });

  const rbacRoleByUserId = React.useMemo(
    () => buildOrgRoleByUserId(orgMembersWithRoles),
    [orgMembersWithRoles]
  );

  const selectedWeekDays = React.useMemo(() => getDaysForWeek(selectedWeekStart), [selectedWeekStart]);
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['team-shifts', team.id, selectedWeekStart.toISOString()],
    queryFn: () => getTeamShifts(team.id, selectedWeekStart),
    enabled: activeTab === 'vardiya' || teamScheduleFullscreenOpen,
  });
  const shiftsByDay = React.useMemo(
    () =>
      getShiftsByDay(shifts as (Shift & { user?: { name?: string; surname?: string } })[], selectedWeekDays),
    [shifts, selectedWeekDays]
  );

  const myShiftsThisWeek = React.useMemo(() => {
    const uid = user?.id;
    if (!uid) return [] as (Shift & { user?: { name?: string; surname?: string } })[];
    return (shifts as (Shift & { user?: { name?: string; surname?: string } })[])
      .filter((s) => s.user_id === uid)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [shifts, user?.id]);

  /** Bu hafta vardiya atanmamış gün sayısı (OFF; resmi izin anlamına gelmez). */
  const myWeekOffGunSayisi = React.useMemo(() => {
    const withShift = new Set(
      myShiftsThisWeek.map((s) => getTimestampBusinessDateKey(s.start_time))
    );
    return Math.max(0, 7 - withShift.size);
  }, [myShiftsThisWeek]);

  useEffect(() => {
    const days = getDaysForWeek(selectedWeekStart);
    const currentMon = getCurrentWeekMonday();
    if (isSameWeekMonday(selectedWeekStart, currentMon)) {
      const idx = getBusinessTodayColumnIndex(days, new Date());
      setTeamScheduleDayIndex(idx >= 0 ? idx : 0);
    } else {
      setTeamScheduleDayIndex(0);
    }
  }, [selectedWeekStart]);

  const openManagerCard = (key: (typeof TEAM_FEATURE_CARDS)[number]['key']) => {
    if (key === 'team_management') {
      void queryClient.prefetchQuery({
        queryKey: ['team-members', team.id],
        queryFn: () => getTeamMembers(team.id),
      });
      const oid = team.organization_id;
      if (oid) {
        void queryClient.prefetchQuery({
          queryKey: ['org-members-with-roles', oid],
          queryFn: () => listMembersWithRoles(oid),
        });
      }
      navigation.navigate('TeamManagement', { team });
      return;
    }
    if (key === 'shift_management') {
      navigation.navigate('ShiftManagement', { team });
      return;
    }
    if (key === 'timesheet_management') {
      navigation.navigate('Timesheet', { team });
      return;
    }
    if (key === 'shift_location_management') {
      navigation.navigate('ShiftLocationManagement', { team });
      return;
    }
    if (key === 'shortage_list') {
      navigation.navigate('ShortageList', { team });
      return;
    }
    if (key === 'shot_notification') {
      navigation.navigate('ShotNotification', { team });
      return;
    }
    navigation.navigate('InventoryManagement', { team });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, !isManager && styles.contentMember]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.teamHeaderRow}>
        <View style={styles.teamTitleGroup}>
          {isManager && (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.inlineBackBtn, pressed && styles.inlineBackBtnPressed]}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
          )}
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
        </View>
        {isManager ? (
          <View style={styles.managerHeaderActions}>
            <Pressable
              onPress={goToJoinRequests}
              style={({ pressed }) => [styles.joinInboxBtn, pressed && styles.joinInboxBtnPressed]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Katılma istekleri"
            >
              <View>
                <Ionicons name="mail-outline" size={22} color={colors.textPrimary} />
                {joinRequestCount > 0 && (
                  <View style={styles.joinInboxBadge}>
                    <Text style={styles.joinInboxBadgeText}>
                      {joinRequestCount > 99 ? '99+' : joinRequestCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleLeaveTeam}
            disabled={leaveLoading}
            style={({ pressed }) => [
              styles.leaveChip,
              pressed && styles.leaveChipPressed,
              leaveLoading && styles.leaveChipDisabled,
            ]}
          >
            <Ionicons name="exit-outline" size={16} color={colors.error} />
            <Text style={styles.leaveChipText}>
              {leaveLoading ? 'Çıkılıyor…' : 'Ekipten Ayrıl'}
            </Text>
          </Pressable>
        )}
      </View>

      <TabBar tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      {isManager && team.subscription_ends_at ? (
        <TeamSubscriptionBanner teamName={team.name} endsAtIso={team.subscription_ends_at} />
      ) : null}

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
              <Text style={styles.shiftCheckInTitle}>Vardiya ve mola girişi</Text>
              <Text style={styles.shiftCheckInSubtitle}>Konumunuzla mesai başlatın</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>
          {isManager && (
            <Pressable
              onPress={() => navigation.navigate('ShiftDetail', { team })}
              style={({ pressed }) => [styles.shiftDetailCard, pressed && styles.shiftDetailCardPressed]}
            >
              <View style={styles.shiftDetailIconWrap}>
                <Ionicons name="analytics-outline" size={24} color={colors.black} />
              </View>
              <View style={styles.shiftDetailText}>
                <Text style={styles.shiftDetailTitle}>Vardiya detayı</Text>
                <Text style={styles.shiftDetailSubtitle}>Canlı vardiya ve mola performansı</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.accent} />
            </Pressable>
          )}
          {!isManager && (
            <Pressable
              onPress={() => navigation.navigate('ShiftDetail', { team })}
              style={({ pressed }) => [styles.shiftDetailCard, pressed && styles.shiftDetailCardPressed]}
            >
              <View style={styles.shiftDetailIconWrap}>
                <Ionicons name="person-circle-outline" size={24} color={colors.black} />
              </View>
              <View style={styles.shiftDetailText}>
                <Text style={styles.shiftDetailTitle}>Vardiya detaylarım</Text>
                <Text style={styles.shiftDetailSubtitle}>Kendi giriş, çıkış ve mola özetin</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.accent} />
            </Pressable>
          )}

          {(isManager || visibleManagerCards.length > 0) && (
            <View style={styles.managerSection}>
              <View style={styles.managerSectionHeaderRow}>
                <Text style={styles.managerSectionTitle}>{isManager ? 'Yönetici' : 'Yetkili Araçlar'}</Text>
                {isManager ? (
                  <Pressable
                    onPress={() => {
                      setShowInviteModal(true);
                      setInviteLink(null);
                    }}
                    style={({ pressed }) => [
                      styles.managerInviteBtn,
                      pressed && styles.managerInviteBtnPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Ekibe davet linki oluştur"
                  >
                    <Ionicons name="person-add-outline" size={18} color={colors.black} />
                    <Text style={styles.managerInviteBtnText}>Ekibe davet et</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.managerGrid}>
                {visibleManagerCards.map((card) => (
                  <Pressable
                    key={card.key}
                    style={({ pressed }) => (pressed ? [styles.managerCard, styles.managerCardPressed] : [styles.managerCard])}
                    onPress={() => openManagerCard(card.key)}
                  >
                    <View style={styles.managerCardIconWrap}>
                      <Ionicons name={card.icon as never} size={26} color={colors.accent} />
                    </View>
                    <Text style={styles.managerCardTitle}>{card.title}</Text>
                    <Text style={styles.managerCardSubtitle}>{card.subtitle}</Text>
                  </Pressable>
                ))}
                {isManager ? (
                  <Pressable
                    style={({ pressed }) => (pressed ? [styles.managerCard, styles.managerCardPressed] : [styles.managerCard])}
                    onPress={() => navigation.navigate('MemberPermissions', { team })}
                  >
                    <View style={styles.managerCardIconWrap}>
                      <Ionicons name="shield-checkmark-outline" size={26} color={colors.accent} />
                    </View>
                    <Text style={styles.managerCardTitle}>Üye İzinleri</Text>
                    <Text style={styles.managerCardSubtitle}>Kart erişimlerini yönet</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Ekip listesi</Text>
          {members.length === 0 ? (
            <Card><Text style={styles.placeholder}>Henüz üye yok.</Text></Card>
          ) : (
            members.map((m) => {
              const displayName = m.user ? [m.user.name, m.user.surname].filter(Boolean).join(' ') || m.user.email || 'Üye' : 'Üye';
              const roleLabel =
                m.user_id === team.owner_id
                  ? 'Ekip Lideri'
                  : (rbacRoleByUserId[m.user_id] ??
                    'Rol atanmamış');
              return (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [styles.memberRow, pressed && styles.memberRowPressed]}
                  onPress={() => m.user && navigation.navigate('MemberProfile', { user: m.user })}
                >
                  <Avatar source={m.user?.profile_photo} name={displayName} size={44} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.memberRole}>{roleLabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              );
            })
          )}
        </>
      )}

      {activeTab === 'vardiya' && (
        <>

          <View style={styles.myShiftsCollapsibleWrap}>
            <Pressable
              onPress={() => setMyShiftsSectionOpen((o) => !o)}
              style={({ pressed }) => [
                styles.myShiftsSectionHeader,
                pressed && styles.myShiftsSectionHeaderPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: myShiftsSectionOpen }}
              accessibilityLabel="Bu hafta sizin vardiyalarınız"
            >
              <View style={styles.myShiftsSectionHeaderText}>
                <Text style={styles.myShiftsSectionTitle}>Bu hafta sizin vardiyalarınız</Text>
                {shiftsLoading ? (
                  <Text style={styles.myShiftsSectionSummary}>Yükleniyor…</Text>
                ) : (
                  <Text style={styles.myShiftsSectionSummary}>
                    {myShiftsThisWeek.length === 0
                      ? '7 gün listelenir · Bu hafta vardiya yok'
                      : `${myShiftsThisWeek.length} vardiya · ${myWeekOffGunSayisi} günde OFF`}
                  </Text>
                )}
              </View>
              <Ionicons
                name={myShiftsSectionOpen ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
            {myShiftsSectionOpen ? (
              <Card padded={false} style={styles.vardiyaMyCardOpen}>
                {shiftsLoading ? (
                  <Text style={styles.placeholder}>Yükleniyor…</Text>
                ) : (
                  <>
                    <Text style={styles.myWeekListHint}>
                      Haftanın her günü listelenir. Vardiya atanmamış günler OFF gösterilir (resmi izin değildir).
                      Bugünün iş günü vurgulanır.
                    </Text>
                    {selectedWeekDays.map((day) => {
                      const colKey = getCalendarColumnBusinessKey(day);
                      const dayShifts = myShiftsThisWeek.filter(
                        (s) => getTimestampBusinessDateKey(s.start_time) === colKey
                      );
                      const isBizToday = colKey === businessDateKey;
                      const isOff = dayShifts.length === 0;
                      return (
                        <View
                          key={colKey}
                          style={[
                            styles.myWeekDayRow,
                            isBizToday && styles.myWeekDayRowToday,
                            isOff && !isBizToday && styles.myWeekDayRowOff,
                          ]}
                        >
                          <View style={styles.myWeekDayRowTop}>
                            <Text
                              style={[
                                styles.myWeekDayTitle,
                                isBizToday && styles.myWeekDayTitleToday,
                              ]}
                            >
                              {formatWeekDayDateLabel(day)}
                            </Text>
                            <View style={styles.myWeekDayBadges}>
                              {isBizToday ? (
                                <View style={styles.myWeekTodayBadge}>
                                  <Text style={styles.myWeekTodayBadgeText}>Bugün</Text>
                                </View>
                              ) : null}
                              {isOff ? (
                                <View style={styles.myWeekOffBadge}>
                                  <Text style={styles.myWeekOffBadgeText}>OFF</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          {!isOff ? (
                            <View style={styles.myWeekShiftsWrap}>
                              {dayShifts.map((st, si) => (
                                <View
                                  key={st.id}
                                  style={[styles.myWeekShiftBlock, si > 0 && styles.myWeekShiftBlockDivider]}
                                >
                                  <Text style={styles.myWeekShiftTime}>
                                    {formatShiftTime(st.start_time)} – {formatShiftTime(st.end_time)}
                                  </Text>
                                  <View style={styles.myShiftRolePill}>
                                    <Text style={styles.myShiftRoleText}>
                                      {resolveShiftRoleLabel(
                                        st.user_id,
                                        team.owner_id,
                                        members,
                                        st.role,
                                        rbacRoleByUserId[st.user_id]
                                      )}
                                    </Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          ) : isBizToday ? (
                            <Text style={styles.myWeekOffTodayCaption}>
                              Bugün size atanmış vardiya yok (OFF).
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </>
                )}
              </Card>
            ) : null}
          </View>

          <View style={styles.teamScheduleSectionHeader}>
            <Text style={styles.vardiyaSectionLabel}>Ekip programı</Text>
            <Pressable
              onPress={() => setTeamScheduleFullscreenOpen(true)}
              style={({ pressed }) => [styles.scheduleExpandBtn, pressed && styles.scheduleExpandBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Programı genişlet, yatay tam ekran"
            >
              <Text style={styles.scheduleExpandLabel}>Tam ekrana geç</Text>
              <Ionicons name="expand-outline" size={18} color={colors.accent} />
            </Pressable>
          </View>
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
            <Text style={styles.thisWeekChipText}>Bu haftaya dön</Text>
          </Pressable>

          {shiftsLoading ? (
            <Card style={styles.teamDayPanel}>
              <Text style={styles.placeholder}>Yükleniyor…</Text>
            </Card>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayChipRow}
              >
                {selectedWeekDays.map((day, i) => {
                  const colKey = getCalendarColumnBusinessKey(day);
                  const isSel = i === teamScheduleDayIndex;
                  const isTodayChip = colKey === businessDateKey;
                  const count = (shiftsByDay[colKey] ?? []).length;
                  return (
                    <Pressable
                      key={colKey}
                      onPress={() => setTeamScheduleDayIndex(i)}
                      style={[
                        styles.dayChip,
                        isSel && styles.dayChipSelected,
                        isTodayChip && !isSel && styles.dayChipTodayOutline,
                      ]}
                    >
                      <Text
                        style={[styles.dayChipWeekLabel, isSel && styles.dayChipWeekLabelSelected]}
                      >
                        {WEEKDAY_LABELS[day.getDay()]}
                      </Text>
                      <Text style={[styles.dayChipDateNum, isSel && styles.dayChipDateNumSelected]}>
                        {day.getDate()}
                      </Text>
                      {count > 0 ? <View style={styles.dayChipHasShiftDot} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {(() => {
                const day = selectedWeekDays[teamScheduleDayIndex];
                if (!day) return null;
                const colKey = getCalendarColumnBusinessKey(day);
                const panelShifts = shiftsByDay[colKey] ?? [];
                const longLabel = day.toLocaleDateString('tr-TR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                });
                const isPanelToday = colKey === businessDateKey;
                return (
                  <Card style={[styles.teamDayPanel, isPanelToday ? styles.teamDayPanelToday : false]}>
                    <View style={styles.teamDayPanelHeader}>
                      <Text style={styles.teamDayPanelTitle}>{longLabel}</Text>
                      {isPanelToday ? (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Bugün</Text>
                        </View>
                      ) : null}
                    </View>
                    {panelShifts.length === 0 ? (
                      <Text style={styles.teamDayEmpty}>OFF — bu güne atanmış vardiya kaydı yok.</Text>
                    ) : (
                      panelShifts.map((s) => (
                        <View key={s.id} style={styles.shiftRow}>
                          <View style={styles.shiftRowDot} />
                          <View style={styles.shiftRowContent}>
                            <View style={styles.shiftRowNameRow}>
                              <Text style={styles.shiftRowName}>
                                {s.user
                                  ? `${s.user.name ?? ''} ${s.user.surname ?? ''}`.trim() || 'Üye'
                                  : 'Üye'}
                              </Text>
                              <View style={styles.shiftRoleBadge}>
                                <Text style={styles.shiftRoleBadgeText}>
                                  {resolveShiftRoleLabel(
                                    s.user_id,
                                    team.owner_id,
                                    members,
                                    s.role,
                                    rbacRoleByUserId[s.user_id]
                                  )}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.shiftRowTime}>
                              {formatShiftTime(s.start_time)} – {formatShiftTime(s.end_time)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </Card>
                );
              })()}
            </>
          )}
        </>
      )}

      <TeamScheduleTableModal
        visible={teamScheduleFullscreenOpen}
        onClose={() => setTeamScheduleFullscreenOpen(false)}
        teamId={team.id}
        teamName={team.name}
        teamOwnerId={team.owner_id}
        organizationId={team.organization_id}
        weekRangeLabel={weekRangeLabel(selectedWeekStart)}
        weekDays={selectedWeekDays}
        shifts={shifts as (Shift & { user?: { name?: string; surname?: string } })[]}
        members={members}
        businessDateKey={businessDateKey}
        shiftsLoading={shiftsLoading}
        canEditSchedule={isManager}
        onPrevWeek={() => {
          const d = new Date(selectedWeekStart);
          d.setDate(d.getDate() - 7);
          setSelectedWeekStart(d);
        }}
        onNextWeek={() => {
          const d = new Date(selectedWeekStart);
          d.setDate(d.getDate() + 7);
          setSelectedWeekStart(d);
        }}
        onThisWeek={() => setSelectedWeekStart(getCurrentWeekMonday())}
      />

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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  contentMember: { paddingTop: spacing.md },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  teamTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  inlineBackBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBackBtnPressed: { opacity: 0.75 },
  teamName: { ...typography.title, color: colors.accent, flex: 1, minWidth: 0 },
  managerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  joinInboxBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  joinInboxBtnPressed: { opacity: 0.75 },
  joinInboxBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinInboxBadgeText: {
    fontSize: 9,
    lineHeight: 11,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  leaveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  leaveChipPressed: { opacity: 0.85 },
  leaveChipDisabled: { opacity: 0.6 },
  leaveChipText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
  inviteCode: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  btn: { marginTop: spacing.sm },
  managerSection: { marginBottom: spacing.lg },
  managerSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
  managerSectionTitle: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
    minWidth: 0,
  },
  managerInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  managerInviteBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  managerInviteBtnText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.black,
    letterSpacing: 0.2,
  },
  managerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  managerCard: {
    width: '48%',
    minWidth: 0,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerCardPressed: { opacity: 0.88 },
  managerCardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '18',
    marginBottom: spacing.sm,
  },
  managerCardTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  managerCardSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
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
  shiftDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    backgroundColor: colors.accent + '0F',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '4D',
    gap: spacing.md,
  },
  shiftDetailCardPressed: { opacity: 0.9 },
  shiftDetailIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftDetailText: { flex: 1, minWidth: 0 },
  shiftDetailTitle: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  shiftDetailSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.md },
  placeholder: { ...typography.body, color: colors.textSecondary },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  memberRowPressed: { opacity: 0.9 },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.accent,
    marginTop: 2,
  },
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
  vardiyaManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  vardiyaManageRowPressed: { opacity: 0.9 },
  vardiyaManageIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vardiyaManageText: { flex: 1, minWidth: 0 },
  vardiyaManageTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  vardiyaManageSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  vardiyaSectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 0,
  },
  teamScheduleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  scheduleExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '10',
  },
  scheduleExpandBtnPressed: { opacity: 0.85 },
  /** vardiyaSectionLabel ile aynı tipografi; renk eski ikon rengi (accent) */
  scheduleExpandLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 0,
  },
  myShiftsCollapsibleWrap: {
    marginBottom: spacing.lg,
  },
  myShiftsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  myShiftsSectionHeaderPressed: { opacity: 0.85 },
  myShiftsSectionHeaderText: { flex: 1, minWidth: 0 },
  myShiftsSectionTitle: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  myShiftsSectionSummary: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
  },
  vardiyaMyCardOpen: {
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  myWeekListHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  myWeekDayRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  myWeekDayRowToday: {
    borderLeftColor: colors.accent,
    backgroundColor: colors.accent + '10',
    borderColor: colors.accent + '40',
  },
  myWeekDayRowOff: {
    borderLeftColor: 'rgba(148, 163, 184, 0.85)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  myWeekDayRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  myWeekDayTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    minWidth: 0,
  },
  myWeekDayTitleToday: {
    color: colors.accent,
  },
  myWeekDayBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    maxWidth: '48%',
  },
  myWeekTodayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  myWeekTodayBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.bgDark,
  },
  myWeekOffBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  myWeekOffBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  myWeekShiftsWrap: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  myWeekShiftBlock: {
    paddingTop: spacing.xs,
  },
  myWeekShiftBlockDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  myWeekShiftTime: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  myWeekOffTodayCaption: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  myShiftRolePill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '35',
  },
  myShiftRoleText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.accent,
  },
  dayChipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayChip: {
    minWidth: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dayChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '18',
  },
  dayChipTodayOutline: {
    borderColor: colors.accent + '55',
  },
  dayChipWeekLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  dayChipWeekLabelSelected: {
    color: colors.accent,
    fontFamily: fonts.semibold,
  },
  dayChipDateNum: {
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  dayChipDateNumSelected: { color: colors.accent },
  dayChipHasShiftDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
    marginTop: 6,
  },
  teamDayPanel: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  teamDayPanelToday: {
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '06',
  },
  teamDayPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  teamDayPanelTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  teamDayEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
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
  shiftCard: { marginBottom: spacing.sm },
  subBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  subBannerUrgent: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  subBannerExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  subBannerTextWrap: { flex: 1, minWidth: 0 },
  subBannerTitle: {
    ...typography.small,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  subBannerBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  subBannerStrong: { color: colors.textPrimary, fontFamily: fonts.semibold },
  shiftDate: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  shiftTime: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  shiftUser: { fontSize: 12, color: colors.accent, marginTop: 4 },
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
