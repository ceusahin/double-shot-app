import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { TabBar } from '../components/TabBar';
import { Card, Button, LeaderboardItem } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers } from '../services/teams';
import {
  ensureOrganizationForTeam,
  listRoles,
  listMembers,
} from '../services/rbac';
import { usePermissions } from '../hooks/usePermissions';
import { colors, spacing, typography } from '../utils/theme';
import type { Team } from '../types';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type TabKey = 'overview' | 'roles' | 'members';

type Props = {
  route: RouteProp<TeamsStackParamList, 'TeamManagement'>;
};

type Nav = NativeStackNavigationProp<TeamsStackParamList, 'TeamManagement'>;

export function TeamManagementScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabKey>('overview');

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
  const { has, isLoading: permLoading } = usePermissions(orgId);
  const canManageRoles = isOwner || has('manage_roles');
  const canAssignRoles = isOwner || has('assign_roles');

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['org-roles', orgId],
    queryFn: () => listRoles(orgId!),
    enabled: !!orgId,
  });

  const { data: rbacMembers = [], refetch: refetchRbacMembers } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => listMembers(orgId!),
    enabled: !!orgId,
  });

  const sortedByXp = [...members]
    .filter((m) => m.user)
    .sort((a, b) => (b.user?.experience_points ?? 0) - (a.user?.experience_points ?? 0));

  const tabs = [
    { key: 'overview' as TabKey, label: 'Genel' },
    { key: 'roles' as TabKey, label: 'Roller' },
    { key: 'members' as TabKey, label: 'Üyeler' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.teamName}>{team.name}</Text>
      <Text style={styles.inviteHint}>Üyeleri davet etmek için takım sayfasında sağ üstten "Ekibe davet et" ile süreli link oluşturun.</Text>

      <TabBar tabs={tabs} activeKey={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          <Card style={styles.card}>
            <Button
              title="Vardiya girişi (GPS)"
              onPress={() => navigation.navigate('ShiftCheckIn', { team })}
              variant="primary"
              style={styles.btn}
            />
          </Card>
          {(isOwner || has('create_shift')) && (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Yönetici</Text>
              <Button title="Vardiya planla" onPress={() => {}} variant="outline" style={styles.btn} />
              {(isOwner || has('send_shot_notification')) && (
                <Button title="Shot bildirimi gönder" onPress={() => {}} variant="outline" style={styles.btn} />
              )}
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
                />
              ) : null
            )
          )}
        </>
      )}

      {tab === 'roles' && (
        <>
          {canManageRoles && orgId && (
            <Button
              title="Yeni rol oluştur"
              onPress={() => navigation.navigate('RoleCreation', { team, organizationId: orgId })}
              variant="primary"
              style={styles.btn}
            />
          )}
          {roles.length === 0 ? (
            <Card><Text style={styles.placeholder}>Henüz rol yok. Rol oluşturup seviye ve yetki atayabilirsiniz.</Text></Card>
          ) : (
            roles.map((role) => (
              <Card
                key={role.id}
                onPress={() => canManageRoles && navigation.navigate('RoleLevel', { team, role })}
              >
                <Text style={styles.roleName}>{role.name}</Text>
                {role.description ? (
                  <Text style={styles.roleDesc} numberOfLines={2}>{role.description}</Text>
                ) : null}
              </Card>
            ))
          )}
        </>
      )}

      {tab === 'members' && (
        <>
          {canAssignRoles && (
            <Text style={styles.sectionTitle}>Üyelere rol atayın</Text>
          )}
          {rbacMembers.length === 0 ? (
            <Card><Text style={styles.placeholder}>Üye listesi yükleniyor.</Text></Card>
          ) : (
            rbacMembers.map((m) => {
              const u = m.user as { name?: string; surname?: string; email?: string } | undefined;
              const displayName = u ? [u.name, u.surname].filter(Boolean).join(' ') || u.email : m.user_id;
              return (
                <Card
                  key={m.id}
                  onPress={() => canAssignRoles && navigation.navigate('MemberRole', { team, member: m })}
                >
                  <Text style={styles.memberName}>{displayName}</Text>
                  <Text style={styles.memberStatus}>Rol atamak için dokunun</Text>
                </Card>
              );
            })
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
  inviteHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg },
  cardTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  btn: { marginTop: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: colors.accent, marginBottom: spacing.md },
  placeholder: { ...typography.body, color: colors.textMuted },
  roleName: { ...typography.subtitle, color: colors.text },
  roleDesc: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  memberName: { ...typography.body, fontWeight: '600', color: colors.text },
  memberStatus: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
});
