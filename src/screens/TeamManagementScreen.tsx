import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers } from '../services/teams';
import { getTeamMembersOnShift } from '../services/shifts';
import {
  ensureOrganizationForTeam,
  listRoles,
  listMembersWithRoles,
  getOrCreateMember,
  deleteRole,
} from '../services/rbac';
import { usePermissions } from '../hooks/usePermissions';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import type { TeamMember } from '../types';
import type { Member } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = {
  route: RouteProp<TeamsStackParamList, 'TeamManagement'>;
};

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamManagement'>;

type MainTabKey = 'employees' | 'roles';
type ShiftTabKey = 'on_shift' | 'off_shift' | 'all';

function formatAssignedRoles(
  memberRoles: { role?: { name: string }; role_level?: { name: string } }[] | undefined
): string {
  if (!memberRoles?.length) return 'Rol atanmamış';
  const first = memberRoles[0];
  const role = first.role?.name ?? '';
  return role || 'Rol atanmamış';
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
    <View style={styles.segmentWrap}>
      {options.map((opt) => {
        const active = value === opt.key;
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
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
            {typeof opt.count === 'number' ? (
              <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
                  {opt.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function MemberCard({
  member,
  assignedRolesText,
  isOnShift,
  isOwner,
  canAssignRoles,
  onAssignRole,
}: {
  member: TeamMember;
  assignedRolesText: string;
  isOnShift: boolean;
  isOwner: boolean;
  canAssignRoles: boolean;
  onAssignRole: () => void;
}) {
  const displayName = member.user
    ? [member.user.name, member.user.surname].filter(Boolean).join(' ') || member.user.email
    : member.user_id;

  return (
    <View style={styles.memberCard}>
      <View style={styles.panelGoldCap} />
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={styles.memberCardInner}>
        <View style={styles.avatarWrap}>
          <Avatar source={member.user?.profile_photo} name={displayName} size={52} />
          {isOnShift ? <View style={styles.onShiftDot} /> : null}
        </View>
        <View style={styles.memberMain}>
          <View style={styles.memberHeaderRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {displayName}
            </Text>
            {isOwner ? (
              <View style={styles.ownerBadge}>
                <Ionicons name="star" size={10} color={colors.bgDark} />
                <Text style={styles.ownerBadgeText}>LİDER</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.memberChipRow}>
            <View style={styles.roleChip}>
              <Ionicons name="briefcase-outline" size={11} color={colors.accent} />
              <Text style={styles.roleChipText} numberOfLines={1}>
                {assignedRolesText}
              </Text>
            </View>
            <View
              style={[
                styles.shiftChip,
                isOnShift ? styles.shiftChipActive : styles.shiftChipInactive,
              ]}
            >
              <View
                style={[
                  styles.shiftChipDot,
                  isOnShift ? styles.shiftChipDotActive : styles.shiftChipDotInactive,
                ]}
              />
              <Text
                style={[
                  styles.shiftChipText,
                  isOnShift ? styles.shiftChipTextActive : styles.shiftChipTextInactive,
                ]}
              >
                {isOnShift ? 'Mesaide' : 'Mesai dışı'}
              </Text>
            </View>
          </View>
        </View>
        {canAssignRoles && !isOwner ? (
          <Pressable
            onPress={onAssignRole}
            style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            hitSlop={6}
            accessibilityLabel="Üye düzenle"
          >
            <Ionicons name="create-outline" size={18} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function TeamManagementScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const navigation = useNavigation<Nav>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTabKey>('employees');
  const [shiftTab, setShiftTab] = useState<ShiftTabKey>('on_shift');

  const isOwner = team.owner_id === user?.id;

  const { data: org } = useQuery({
    queryKey: ['org-for-team', team.id],
    queryFn: async () => {
      if (team.organization_id) return { id: team.organization_id };
      if (!isOwner || !user) return null;
      const o = await ensureOrganizationForTeam(team.id, team.name, user.id);
      return o;
    },
    enabled: !!team.id && !!user,
  });

  const orgId = org?.id ?? team.organization_id ?? null;
  const { has } = usePermissions(orgId);

  useFocusEffect(
    useCallback(() => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['org-roles', orgId] });
        queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', orgId] });
      }
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', team.id] });
    }, [orgId, team.id, queryClient])
  );
  const canManageRoles = isOwner || has('manage_roles');
  const canAssignRoles = isOwner || has('assign_roles');

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });

  const { data: onShiftList = [] } = useQuery({
    queryKey: ['team-members-on-shift', team.id],
    queryFn: () => getTeamMembersOnShift(team.id),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles', orgId],
    queryFn: () => listRoles(orgId!),
    enabled: !!orgId,
  });

  const {
    data: rbacMembersWithRoles = [],
    isPending: rbacMembersPending,
    isFetching: rbacMembersFetching,
  } = useQuery({
    queryKey: ['org-members-with-roles', orgId],
    queryFn: () => listMembersWithRoles(orgId!),
    enabled: !!orgId,
  });

  const rbacRoleLabelsLoading =
    !!orgId &&
    rbacMembersWithRoles.length === 0 &&
    (rbacMembersPending || rbacMembersFetching);

  const onShiftUserIds = useMemo(
    () => new Set(onShiftList.map((x) => x.user_id)),
    [onShiftList]
  );

  const assignedRolesByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of rbacMembersWithRoles) {
      map[m.user_id] = formatAssignedRoles(m.member_roles);
    }
    return map;
  }, [rbacMembersWithRoles]);

  const membersOnShift = useMemo(
    () => members.filter((m) => onShiftUserIds.has(m.user_id)),
    [members, onShiftUserIds]
  );
  const membersOffShift = useMemo(
    () => members.filter((m) => !onShiftUserIds.has(m.user_id)),
    [members, onShiftUserIds]
  );

  const displayedMembers = useMemo(() => {
    if (shiftTab === 'on_shift') return membersOnShift;
    if (shiftTab === 'off_shift') return membersOffShift;
    return members;
  }, [shiftTab, membersOnShift, membersOffShift, members]);

  const handleAssignRole = async (member: TeamMember) => {
    if (!orgId) return;
    let rbacMember: Member | undefined = rbacMembersWithRoles.find((m) => m.user_id === member.user_id);
    if (!rbacMember) {
      try {
        rbacMember = await getOrCreateMember(member.user_id, orgId);
        queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', orgId] });
      } catch (e) {
        themedAlert('Hata', e instanceof Error ? e.message : 'Üye bulunamadı.');
        return;
      }
    }
    navigation.navigate('MemberRole', {
      team,
      member: rbacMember,
      ...(orgId ? { organizationId: orgId } : {}),
    });
  };

  const handleDeleteRole = (role: { id: string; name: string }) => {
    themedAlert(
      'Rolü sil',
      `"${role.name}" rolü silinsin mi? Bu role atanmış yetkiler de kaldırılır.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRole(role.id);
              queryClient.invalidateQueries({ queryKey: ['org-roles', orgId!] });
            } catch (e) {
              themedAlert('Hata', e instanceof Error ? e.message : 'Rol silinemedi.');
            }
          },
        },
      ]
    );
  };

  const handleCreateRole = async () => {
    let resolvedOrgId = orgId;
    if (!resolvedOrgId && isOwner && user?.id) {
      try {
        const o = await ensureOrganizationForTeam(team.id, team.name, user.id);
        resolvedOrgId = o.id;
        queryClient.invalidateQueries({ queryKey: ['org-for-team', team.id] });
      } catch (e) {
        themedAlert('Hata', e instanceof Error ? e.message : 'Organizasyon oluşturulamadı.');
        return;
      }
    }
    if (resolvedOrgId) {
      navigation.navigate('RoleCreation', { team, organizationId: resolvedOrgId });
    } else {
      themedAlert('Hata', 'Organizasyon bilgisi alınamadı. Lütfen tekrar deneyin.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabScrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.22)', 'rgba(10, 10, 10, 0.4)', colors.bgDark]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[
            styles.hero,
            {
              paddingTop: insets.top + spacing.md,
            },
          ]}
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
          <Text style={styles.heroEyebrow}>Ekip Yönetimi</Text>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {team.name}
          </Text>
          <Text style={styles.heroSubtitle}>
            Çalışanlarınızı yönetin, rol ve yetkileri düzenleyin.
          </Text>

          <View style={styles.statsRow}>
            <StatBox icon="people" label="Toplam" value={members.length} />
            <StatBox icon="radio" label="Mesaide" value={membersOnShift.length} accent />
            <StatBox icon="briefcase" label="Rol" value={roles.length} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.mainTabWrap}>
            <SegmentedControl
              options={[
                { key: 'employees' as MainTabKey, label: 'Ekip Listesi' },
                { key: 'roles' as MainTabKey, label: 'Roller' },
              ]}
              value={mainTab}
              onChange={setMainTab}
            />
          </View>

          {mainTab === 'employees' && (
            <>
              <SegmentedControl
                options={[
                  { key: 'on_shift' as ShiftTabKey, label: 'Mesaide', count: membersOnShift.length },
                  { key: 'off_shift' as ShiftTabKey, label: 'İzinli', count: membersOffShift.length },
                  { key: 'all' as ShiftTabKey, label: 'Tümü', count: members.length },
                ]}
                value={shiftTab}
                onChange={setShiftTab}
              />

              {members.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="Henüz ekip üyesi yok"
                  hint='Takım sayfasından "Ekibe davet et" ile davet linki oluşturun.'
                />
              ) : displayedMembers.length === 0 ? (
                <EmptyState
                  icon={
                    shiftTab === 'on_shift' ? 'bed-outline' : shiftTab === 'off_shift' ? 'flash-outline' : 'people-outline'
                  }
                  title={
                    shiftTab === 'on_shift'
                      ? 'Şu an mesaide kimse yok'
                      : shiftTab === 'off_shift'
                        ? 'Mesaide olmayan üye yok'
                        : 'Ekipte üye yok'
                  }
                />
              ) : (
                displayedMembers.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    isOnShift={onShiftUserIds.has(m.user_id)}
                    isOwner={m.user_id === team.owner_id}
                    assignedRolesText={
                      m.user_id === team.owner_id
                        ? 'Ekip Lideri'
                        : rbacRoleLabelsLoading
                          ? 'Yükleniyor…'
                          : (assignedRolesByUserId[m.user_id] ?? 'Rol atanmamış')
                    }
                    canAssignRoles={!!canAssignRoles}
                    onAssignRole={() => handleAssignRole(m)}
                  />
                ))
              )}
            </>
          )}

          {mainTab === 'roles' && (
            <>
              {canManageRoles && (
                <Pressable
                  onPress={() => void handleCreateRole()}
                  style={({ pressed }) => [styles.createCard, pressed && styles.createCardPressed]}
                >
                  <LinearGradient
                    colors={['rgba(212, 175, 55, 0.18)', 'rgba(184, 115, 51, 0.08)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <View style={styles.createCardInner}>
                    <View style={styles.createIconWrap}>
                      <Ionicons name="add" size={28} color={colors.accent} />
                    </View>
                    <View style={styles.createTextWrap}>
                      <Text style={styles.createTitle}>Yeni rol oluştur</Text>
                      <Text style={styles.createHint}>Rol adı, açıklama ve yetkiler ekleyin</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                  </View>
                </Pressable>
              )}

              <Text style={styles.sectionLabel}>
                Mevcut roller {roles.length > 0 ? `(${roles.length})` : ''}
              </Text>

              {roles.length === 0 ? (
                <EmptyState
                  icon="shield-outline"
                  title="Henüz rol yok"
                  hint='"Yeni rol oluştur" ile başlayın ve yetki atayın.'
                />
              ) : (
                roles.map((role) => (
                  <View key={role.id} style={styles.roleCard}>
                    <View style={styles.panelGoldCap} />
                    <LinearGradient
                      colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                      pointerEvents="none"
                    />
                    <View style={styles.roleCardInner}>
                      <View style={styles.roleIconWrap}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
                      </View>
                      <View style={styles.roleContent}>
                        <Text style={styles.roleName}>{role.name}</Text>
                        {role.description ? (
                          <Text style={styles.roleDesc} numberOfLines={2}>
                            {role.description}
                          </Text>
                        ) : (
                          <Text style={styles.roleDescMuted}>Açıklama yok</Text>
                        )}
                      </View>
                      {canManageRoles ? (
                        <Pressable
                          onPress={() => handleDeleteRole(role)}
                          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                          hitSlop={8}
                          accessibilityLabel="Rolü sil"
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatBox({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statBox, accent && styles.statBoxAccent]}>
      <Ionicons
        name={icon}
        size={14}
        color={accent ? colors.accent : colors.textSecondary}
        style={{ marginBottom: 4 }}
      />
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
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={22} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },
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
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statsRow: {
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
  statValueAccent: {
    color: colors.accent,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: spacing.md,
  },
  mainTabWrap: {
    marginBottom: spacing.md,
  },
  segmentWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  segmentItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  segmentItemPressed: { opacity: 0.8 },
  segmentLabel: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  segmentLabelActive: {
    color: colors.accent,
  },
  segmentBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  segmentBadgeActive: {
    backgroundColor: colors.accent,
  },
  segmentBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  segmentBadgeTextActive: {
    color: colors.bgDark,
  },
  panelGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  memberCard: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  memberCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  onShiftDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: colors.glassBg,
  },
  memberMain: { flex: 1, minWidth: 0 },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  memberName: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    flexShrink: 1,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.bgDark,
    letterSpacing: 0.6,
  },
  memberChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    maxWidth: '70%',
  },
  roleChipText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.accent,
    flexShrink: 1,
  },
  shiftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shiftChipActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  shiftChipInactive: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: colors.border,
  },
  shiftChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  shiftChipDotActive: {
    backgroundColor: '#34C759',
  },
  shiftChipDotInactive: {
    backgroundColor: colors.textMuted,
  },
  shiftChipText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  shiftChipTextActive: { color: '#6fc49a' },
  shiftChipTextInactive: { color: colors.textMuted },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  editBtnPressed: { opacity: 0.75 },
  createCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  createCardPressed: { opacity: 0.9 },
  createCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  createIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  createTextWrap: { flex: 1, minWidth: 0 },
  createTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    marginBottom: 2,
  },
  createHint: { ...typography.small, color: colors.textMuted },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  roleCard: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  roleCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  roleContent: { flex: 1, minWidth: 0 },
  roleName: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
  },
  roleDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  roleDescMuted: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239, 68, 68, 0.28)',
  },
  deleteBtnPressed: { opacity: 0.75 },
  emptyPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: spacing.md,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
