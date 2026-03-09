import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Avatar, TabBar } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers, removeMember } from '../services/teams';
import { getTeamMembersOnShift } from '../services/shifts';
import {
  ensureOrganizationForTeam,
  listRoles,
  listMembersWithRoles,
  getOrCreateMember,
  deleteRole,
  listPermissions,
} from '../services/rbac';
import { usePermissions } from '../hooks/usePermissions';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { getPermissionDisplayName } from '../utils/permissionLabels';
import type { Team, TeamMember } from '../types';
import type { Member } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = {
  route: RouteProp<TeamsStackParamList, 'TeamManagement'>;
};

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamManagement'>;

type MainTabKey = 'employees' | 'roles';
type ShiftTabKey = 'on_shift' | 'off_shift';
type RolesTabKey = 'roller' | 'yetkiler';

/** Tek rol: "Seviye Rol" (örn. Senior Barista). Max 1 rol gösterilir. */
function formatAssignedRoles(
  memberRoles: { role?: { name: string }; role_level?: { name: string } }[] | undefined
): string {
  if (!memberRoles?.length) return 'Rol atanmamış';
  const first = memberRoles[0];
  const level = first.role_level?.name ?? '';
  const role = first.role?.name ?? '';
  const parts = [level, role].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Rol atanmamış';
}

function MemberRow({
  member,
  assignedRolesText,
  isOwner,
  canAssignRoles,
  onAssignRole,
  onRemove,
}: {
  member: TeamMember;
  assignedRolesText: string;
  isOwner: boolean;
  canAssignRoles: boolean;
  onAssignRole: () => void;
  onRemove: () => void;
}) {
  const displayName =
    member.user
      ? [member.user.name, member.user.surname].filter(Boolean).join(' ') || member.user.email
      : member.user_id;

  return (
    <Card style={styles.memberCard} padded elevated>
      <View style={styles.memberRow}>
        <Avatar
          source={member.user?.profile_photo}
          name={displayName}
          size={52}
        />
        <View style={styles.memberMain}>
          <Text style={styles.memberName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.assignedRoles} numberOfLines={2}>
            {assignedRolesText}
          </Text>
        </View>
        <View style={styles.actionsRow}>
          {canAssignRoles && (
            <Pressable
              onPress={onAssignRole}
              style={({ pressed }) => [styles.editIconBtn, pressed && styles.editIconBtnPressed]}
              hitSlop={6}
              accessibilityLabel="Rol ve yetki düzenle"
            >
              <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
          {!isOwner && (
            <Pressable
              onPress={onRemove}
              style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
              accessibilityLabel="Ekipten çıkar"
            >
              <Text style={styles.removeBtnText}>Çıkar</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
}

export function TeamManagementScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTabKey>('employees');
  const [shiftTab, setShiftTab] = useState<ShiftTabKey>('on_shift');
  const [rolesTab, setRolesTab] = useState<RolesTabKey>('roller');

  const isOwner = team.owner_id === user?.id;
  const organizationId = team.organization_id ?? undefined;

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
      }
    }, [orgId, queryClient])
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

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: listPermissions,
    enabled: mainTab === 'roles' && rolesTab === 'yetkiler',
  });

  const { data: rbacMembersWithRoles = [] } = useQuery({
    queryKey: ['org-members-with-roles', orgId],
    queryFn: () => listMembersWithRoles(orgId!),
    enabled: !!orgId,
  });

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

  const displayedMembers = shiftTab === 'on_shift' ? membersOnShift : membersOffShift;

  const handleAssignRole = async (member: TeamMember) => {
    if (!orgId) return;
    let rbacMember: Member | undefined = rbacMembersWithRoles.find((m) => m.user_id === member.user_id);
    if (!rbacMember) {
      try {
        rbacMember = await getOrCreateMember(member.user_id, orgId);
        queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', orgId] });
      } catch (e) {
        Alert.alert('Hata', e instanceof Error ? e.message : 'Üye bulunamadı.');
        return;
      }
    }
    navigation.navigate('MemberRole', { team, member: rbacMember });
  };

  const handleDeleteRole = (role: { id: string; name: string }) => {
    Alert.alert(
      'Rolü sil',
      `"${role.name}" rolü silinsin mi? Bu role atanmış seviyeler ve yetkiler de kaldırılır.`,
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
              Alert.alert('Hata', e instanceof Error ? e.message : 'Rol silinemedi.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (member: TeamMember) => {
    const displayName = member.user
      ? [member.user.name, member.user.surname].filter(Boolean).join(' ') || member.user.email
      : 'Bu üye';
    Alert.alert(
      'Ekipten çıkar',
      `"${displayName}" ekipten çıkarılsın mı? Bu işlem geri alınamaz.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(team.id, member.user_id);
              queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
              queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', orgId!] });
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Üye çıkarılamadı.');
            }
          },
        },
      ]
    );
  };

  const mainTabs = [
    { key: 'employees' as MainTabKey, label: 'Çalışan Listesi' },
    { key: 'roles' as MainTabKey, label: 'Rol ve Yetkiler' },
  ];

  const rolesSubTabs = [
    { key: 'roller' as RolesTabKey, label: 'Roller' },
    { key: 'yetkiler' as RolesTabKey, label: 'Yetkiler' },
  ];

  const shiftTabs = [
    { key: 'on_shift' as ShiftTabKey, label: `Mesaide (${membersOnShift.length})` },
    { key: 'off_shift' as ShiftTabKey, label: `Mesaide değil (${membersOffShift.length})` },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.teamName}>{team.name}</Text>
      <Text style={styles.sectionSubtitle}>
        Çalışanları yönetin, roller ve yetkileri düzenleyin.
      </Text>

      <TabBar tabs={mainTabs} activeKey={mainTab} onChange={setMainTab} variant="primary" />

      {mainTab === 'employees' && (
        <>
          <TabBar tabs={shiftTabs} activeKey={shiftTab} onChange={setShiftTab} />

          {members.length === 0 ? (
            <Card>
              <Text style={styles.placeholder}>
                Henüz ekip üyesi yok. Takım sayfasından "Ekibe davet et" ile davet linki oluşturun.
              </Text>
            </Card>
          ) : displayedMembers.length === 0 ? (
            <Card>
              <Text style={styles.placeholder}>
                {shiftTab === 'on_shift'
                  ? 'Şu an mesaide kimse yok.'
                  : 'Mesaide olmayan üye yok.'}
              </Text>
            </Card>
          ) : (
            displayedMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                assignedRolesText={
                  m.user_id === team.owner_id
                    ? 'Ekip Lideri'
                    : (assignedRolesByUserId[m.user_id] ?? 'Rol atanmamış')
                }
                isOwner={m.user_id === team.owner_id}
                canAssignRoles={!!canAssignRoles}
                onAssignRole={() => handleAssignRole(m)}
                onRemove={() => handleRemoveMember(m)}
              />
            ))
          )}
        </>
      )}

      {mainTab === 'roles' && (
        <>
          <TabBar tabs={rolesSubTabs} activeKey={rolesTab} onChange={setRolesTab} />

          {rolesTab === 'roller' && (
            <>
              {canManageRoles && (
                <Pressable
                  onPress={async () => {
                    let resolvedOrgId = orgId;
                    if (!resolvedOrgId && isOwner && user?.id) {
                      try {
                        const o = await ensureOrganizationForTeam(team.id, team.name, user.id);
                        resolvedOrgId = o.id;
                        queryClient.invalidateQueries({ queryKey: ['org-for-team', team.id] });
                      } catch (e) {
                        Alert.alert('Hata', e instanceof Error ? e.message : 'Organizasyon oluşturulamadı.');
                        return;
                      }
                    }
                    if (resolvedOrgId) {
                      navigation.navigate('RoleCreation', { team, organizationId: resolvedOrgId });
                    } else {
                      Alert.alert('Hata', 'Organizasyon bilgisi alınamadı. Lütfen tekrar deneyin.');
                    }
                  }}
                  style={({ pressed }) => [styles.addRoleCard, pressed && styles.addRoleCardPressed]}
                >
                  <View style={styles.addRoleCardInner}>
                    <View style={styles.addRoleIconWrap}>
                      <Ionicons name="add" size={24} color={colors.accent} />
                    </View>
                    <View style={styles.addRoleCardText}>
                      <Text style={styles.addRoleCardTitle}>Yeni rol oluştur</Text>
                      <Text style={styles.addRoleCardHint}>Rol adı ve seviye ekleyin</Text>
                    </View>
                  </View>
                </Pressable>
              )}
              <Text style={styles.rolesSectionLabel}>Mevcut roller</Text>
              {roles.length === 0 ? (
                <Card>
                  <Text style={styles.placeholder}>
                    Henüz rol yok. "Rol ekle" ile yeni rol oluşturup seviye ve yetki atayabilirsiniz.
                  </Text>
                </Card>
              ) : (
                roles.map((role) => (
                  <Card
                    key={role.id}
                    style={styles.roleCard}
                    onPress={() => canManageRoles && navigation.navigate('RoleLevel', { team, role })}
                  >
                    <View style={styles.roleCardInner}>
                      <View style={styles.roleCardContent}>
                        <Text style={styles.roleName}>{role.name}</Text>
                        {role.description ? (
                          <Text style={styles.roleDesc} numberOfLines={2}>
                            {role.description}
                          </Text>
                        ) : null}
                      </View>
                      {canManageRoles && (
                        <Pressable
                          onPress={() => handleDeleteRole(role)}
                          style={({ pressed }) => [styles.roleDeleteBtn, pressed && styles.roleDeleteBtnPressed]}
                          hitSlop={8}
                          accessibilityLabel="Rolü sil"
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </Pressable>
                      )}
                    </View>
                  </Card>
                ))
              )}
            </>
          )}

          {rolesTab === 'yetkiler' && (
            <>
              <Text style={styles.permissionsIntro}>
                Aşağıdaki yetkiler rol seviyelerine atanabilir. Rol düzenlerken seviye seçip yetkileri atayın.
              </Text>
              {permissions.length === 0 ? (
                <Card>
                  <Text style={styles.placeholder}>Yetki listesi yükleniyor.</Text>
                </Card>
              ) : (
                permissions.map((p) => (
                  <Card key={p.id} style={styles.permissionCard}>
                    <Text style={styles.permissionLabel}>{getPermissionDisplayName(p)}</Text>
                  </Card>
                ))
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  teamName: { ...typography.title, color: colors.primary, marginBottom: spacing.xs },
  sectionSubtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  sectionTitle: { ...typography.subtitle, color: colors.accent, marginBottom: spacing.md },
  memberCard: { marginBottom: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberMain: { flex: 1, minWidth: 0, justifyContent: 'center' },
  memberName: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  assignedRoles: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconBtnPressed: { opacity: 0.6 },
  removeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
  },
  removeBtnPressed: { opacity: 0.85 },
  removeBtnText: { fontSize: 13, fontWeight: '600', color: colors.error },
  btn: { marginBottom: spacing.sm },
  placeholder: { ...typography.body, color: colors.textMuted },
  addRoleCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  addRoleCardPressed: { opacity: 0.9 },
  addRoleCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  addRoleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRoleCardText: { flex: 1, minWidth: 0 },
  addRoleCardTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  addRoleCardHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rolesSectionLabel: { ...typography.subtitle, color: colors.textSecondary, marginBottom: spacing.sm },
  roleCard: { marginBottom: spacing.sm },
  roleCardInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roleCardContent: { flex: 1, minWidth: 0 },
  roleName: { ...typography.subtitle, color: colors.text },
  roleDesc: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  roleDeleteBtn: { padding: spacing.sm },
  roleDeleteBtnPressed: { opacity: 0.7 },
  permissionsIntro: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  permissionCard: { marginBottom: spacing.sm },
  permissionLabel: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
});
