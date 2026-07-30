import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card } from '../components';
import { getTeamMembers } from '../services/teams';
import {
  listTeamMemberFeaturePermissions,
  setTeamMemberFeaturePermission,
} from '../services/memberPermissions';
import {
  TEAM_FEATURE_CARDS,
  type TeamMemberFeatureKey,
} from '../constants/memberFeaturePermissions';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';
import { useMainTabScrollPadding } from '../hooks/useMainTabScrollPadding';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'MemberPermissions'> };

export function MemberPermissionsScreen({ route }: Props) {
  const tabScrollBottomPad = useMainTabScrollPadding();
  const { team } = route.params;
  const queryClient = useQueryClient();
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['team-member-feature-permissions', team.id],
    queryFn: () => listTeamMemberFeaturePermissions(team.id),
  });

  const editableMembers = useMemo(
    () =>
      members.filter((m) => m.role !== 'MANAGER' && m.user_id !== team.owner_id),
    [members, team.owner_id]
  );

  const permissionSetByUser = useMemo(() => {
    const map = new Map<string, Set<TeamMemberFeatureKey>>();
    for (const row of permissions) {
      if (!map.has(row.user_id)) map.set(row.user_id, new Set<TeamMemberFeatureKey>());
      map.get(row.user_id)?.add(row.feature_key);
    }
    return map;
  }, [permissions]);

  const updatePermissionMutation = useMutation({
    mutationFn: ({
      userId,
      featureKey,
      allowed,
    }: {
      userId: string;
      featureKey: TeamMemberFeatureKey;
      allowed: boolean;
    }) => setTeamMemberFeaturePermission(team.id, userId, featureKey, allowed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-feature-permissions', team.id] });
    },
    onError: (err: unknown) => {
      themedAlert('Hata', err instanceof Error ? err.message : 'İzin güncellenemedi.');
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabScrollBottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Üye İzinleri</Text>
      <Text style={styles.sectionSubtitle}>
        Bu alandan ekip üyelerinin "Yönetici" kartları içinden hangi sayfalara erişebileceğini açıp kapatabilirsiniz.
      </Text>

      {editableMembers.length === 0 ? (
        <Card>
          <Text style={styles.placeholder}>İzin yönetimi için uygun üye bulunamadı.</Text>
        </Card>
      ) : (
        editableMembers.map((member) => {
          const displayName = member.user
            ? [member.user.name, member.user.surname].filter(Boolean).join(' ') || 'Üye'
            : 'Üye';
          const enabledSet = permissionSetByUser.get(member.user_id) ?? new Set<TeamMemberFeatureKey>();
          const isExpanded = expandedUserIds[member.user_id] ?? false;

          return (
            <Card key={member.id} style={styles.memberCard}>
              <Pressable
                style={({ pressed }) => [styles.memberHeader, pressed && styles.memberHeaderPressed]}
                onPress={() =>
                  setExpandedUserIds((prev) => ({
                    ...prev,
                    [member.user_id]: !(prev[member.user_id] ?? false),
                  }))
                }
              >
                <Avatar
                  source={member.user?.profile_photo ?? null}
                  name={displayName}
                  size={40}
                  style={styles.avatar}
                />
                <View style={styles.memberHeaderTextWrap}>
                  <Text style={styles.memberName}>{displayName}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {isExpanded ? (
                <View style={styles.permissionsWrap}>
                  {TEAM_FEATURE_CARDS.map((feature) => {
                    const enabled = enabledSet.has(feature.key);
                    return (
                      <Pressable
                        key={`${member.id}-${feature.key}`}
                        style={({ pressed }) => [
                          styles.permissionRow,
                          enabled && styles.permissionRowEnabled,
                          pressed && styles.permissionRowPressed,
                        ]}
                        onPress={() =>
                          updatePermissionMutation.mutate({
                            userId: member.user_id,
                            featureKey: feature.key,
                            allowed: !enabled,
                          })
                        }
                        disabled={updatePermissionMutation.isPending}
                      >
                        <View style={styles.permissionRowTextWrap}>
                          <Text style={[styles.permissionRowTitle, enabled && styles.permissionRowTitleEnabled]}>
                            {feature.title}
                          </Text>
                          <Text style={styles.permissionRowSubtitle}>{feature.subtitle}</Text>
                        </View>
                        <View style={[styles.permissionBadge, enabled && styles.permissionBadgeEnabled]}>
                          <Ionicons
                            name={enabled ? 'checkmark' : 'close'}
                            size={12}
                            color={enabled ? colors.black : colors.textSecondary}
                          />
                          <Text style={[styles.permissionBadgeText, enabled && styles.permissionBadgeTextEnabled]}>
                            {enabled ? 'Açık' : 'Kapalı'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
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
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: 0, gap: spacing.md },
  sectionTitle: { ...typography.title, color: colors.accent },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  placeholder: { ...typography.body, color: colors.textSecondary },
  memberCard: { marginBottom: spacing.md },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberHeaderPressed: { opacity: 0.85 },
  avatar: { borderWidth: 1, borderColor: colors.border },
  memberHeaderTextWrap: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textPrimary },
  memberMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  permissionsWrap: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  permissionRow: {
    width: '48%',
    minHeight: 104,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  permissionRowEnabled: {
    borderColor: colors.accent + '55',
    backgroundColor: colors.accent + '12',
  },
  permissionRowPressed: { opacity: 0.88 },
  permissionRowTextWrap: { flex: 1, minWidth: 0 },
  permissionRowTitle: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.semibold },
  permissionRowTitleEnabled: { color: colors.accent },
  permissionRowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDark,
    alignSelf: 'flex-start',
  },
  permissionBadgeEnabled: {
    borderColor: colors.accent + '66',
    backgroundColor: colors.accent,
  },
  permissionBadgeText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.medium },
  permissionBadgeTextEnabled: { color: colors.black, fontFamily: fonts.semibold },
});
