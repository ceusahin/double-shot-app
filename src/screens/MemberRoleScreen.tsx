import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button } from '../components';
import {
  listRoles,
  listRoleLevels,
  createRoleLevel,
  getMemberRoles,
  assignMemberRole,
  removeMemberRole,
} from '../services/rbac';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { removeMember, syncTeamMemberRoleWithRbac } from '../services/teams';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { Team } from '../types';
import type { Member, Role } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'MemberRole'> };
type Nav = StackNavigationProp<TeamsStackParamList>;

export function MemberRoleScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { team, member, organizationId: organizationIdParam } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const organizationId = organizationIdParam ?? team.organization_id ?? undefined;

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles', organizationId],
    queryFn: () => listRoles(organizationId!),
    enabled: !!organizationId,
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['role-levels', selectedRoleId],
    queryFn: () => listRoleLevels(selectedRoleId!),
    enabled: !!selectedRoleId,
  });

  const { data: currentRoles = [] } = useQuery({
    queryKey: ['member-roles', member.id],
    queryFn: () => getMemberRoles(member.id),
  });

  const displayName = member.user
    ? [member.user.name, member.user.surname].filter(Boolean).join(' ') ||
      (member.user as { email?: string }).email
    : member.user_id;
  const isTeamOwner = member.user_id === team.owner_id;

  const handleAssign = async () => {
    if (!selectedRoleId || !user) return;
    setSaving(true);
    try {
      let roleLevelId = levels[0]?.id;
      if (!roleLevelId) {
        const created = await createRoleLevel(selectedRoleId, 'Temel', 0);
        roleLevelId = created.id;
      }
      for (const mr of currentRoles) {
        await removeMemberRole(mr.id);
      }
      await assignMemberRole(member.id, selectedRoleId, roleLevelId, user.id);
      await syncTeamMemberRoleWithRbac(team.id, member.user_id);
      queryClient.invalidateQueries({ queryKey: ['member-roles', member.id] });
      queryClient.invalidateQueries({ queryKey: ['org-members-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['role-levels', selectedRoleId] });
      queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
      queryClient.invalidateQueries({ queryKey: ['my-teams', member.user_id] });
      setSelectedRoleId(null);
      Alert.alert('Rol atandı', 'Üyenin yetkileri güncellendi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Rol atanamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRole = (memberRoleId: string) => {
    Alert.alert('Rolü kaldır', 'Bu rol kaldırılsın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemberRole(memberRoleId);
            await syncTeamMemberRoleWithRbac(team.id, member.user_id);
            queryClient.invalidateQueries({ queryKey: ['member-roles', member.id] });
            queryClient.invalidateQueries({ queryKey: ['org-members-with-roles'] });
            queryClient.invalidateQueries({ queryKey: ['team-members', team.id] });
            queryClient.invalidateQueries({ queryKey: ['my-teams', member.user_id] });
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Kaldırılamadı.');
          }
        },
      },
    ]);
  };

  const handleRemoveFromTeam = () => {
    const displayName = member.user
      ? [member.user.name, member.user.surname].filter(Boolean).join(' ') || (member.user as { email?: string }).email || 'Üye'
      : 'Üye';
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
              queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', team.id] });
              queryClient.invalidateQueries({ queryKey: ['org-members-with-roles'] });
              queryClient.invalidateQueries({ queryKey: ['my-teams', member.user_id] });
              navigation.goBack();
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Üye ekipten çıkarılamadı.');
            }
          },
        },
      ]
    );
  };

  if (!organizationId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Organizasyon bilgisi bulunamadı.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.memberName}>{displayName}</Text>
        <Text style={styles.subtitle}>Üyeye rol atayın.</Text>
      </View>

      {/* Mevcut roller */}
      <Text style={styles.sectionTitle}>Mevcut roller</Text>
      {isTeamOwner ? (
        <Card style={styles.currentRoleCard}>
          <View style={styles.currentRoleRow}>
            <View style={styles.currentRoleInfo}>
              <Text style={styles.currentRoleName}>Ekip Lideri</Text>
              <Text style={styles.currentRoleHint}>Varsayılan sahip rolü</Text>
            </View>
          </View>
        </Card>
      ) : currentRoles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="ribbon-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>Henüz rol atanmamış</Text>
          <Text style={styles.emptyHint}>Aşağıdan rol seçip atayın.</Text>
        </View>
      ) : (
        currentRoles.slice(0, 1).map((mr) => {
          const displayLabel = mr.role?.name || 'Rol';
          return (
          <Card key={mr.id} style={styles.currentRoleCard}>
            <View style={styles.currentRoleRow}>
              <View style={styles.currentRoleInfo}>
                <Text style={styles.currentRoleName}>{displayLabel}</Text>
              </View>
              <Pressable
                onPress={() => handleRemoveRole(mr.id)}
                style={({ pressed }) => [styles.removeRoleBtn, pressed && styles.removeRoleBtnPressed]}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          </Card>
          );
        })
      )}

      {/* Yeni rol ata */}
      {!isTeamOwner && (
        <>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Yeni rol ata</Text>
          <Text style={styles.hint}>
            {currentRoles.length > 0
              ? 'Yeni rol atandığında mevcut rol kaldırılır.'
              : 'Rolü seçip "Rolü ata"ya basın.'}
          </Text>

          <Text style={styles.stepLabel}>1. Rol seçin</Text>
          {roles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Henüz rol tanımı yok.</Text>
              <Text style={styles.emptyHint}>Ekip yönetimi → Roller’den rol oluşturun.</Text>
            </View>
          ) : (
            <View style={styles.roleList}>
              {roles.map((role) => (
                <Pressable
                  key={role.id}
                  onPress={() => {
                    setSelectedRoleId(role.id);
                  }}
                  style={[
                    styles.roleItem,
                    selectedRoleId === role.id && styles.roleItemSelected,
                  ]}
                >
                  <View style={styles.roleItemContent}>
                    <Text
                      style={[
                        styles.roleItemText,
                        selectedRoleId === role.id && styles.roleItemTextSelected,
                      ]}
                    >
                      {role.name}
                    </Text>
                    {role.description ? (
                      <Text style={styles.roleItemDesc} numberOfLines={2}>
                        {role.description}
                      </Text>
                    ) : null}
                  </View>
                  {selectedRoleId === role.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {selectedRoleId && (
            <>
              <Button
                title="Rolü ata"
                onPress={handleAssign}
                loading={saving}
                variant="primary"
                fullWidth
                style={styles.assignBtn}
              />
            </>
          )}
        </>
      )}

      {member.user_id !== team.owner_id && (
        <Pressable
          onPress={handleRemoveFromTeam}
          style={({ pressed }) => [styles.removeMemberBtn, pressed && styles.removeMemberBtnPressed]}
        >
          <Ionicons name="person-remove-outline" size={18} color={colors.error} />
          <Text style={styles.removeMemberBtnText}>Üyeyi ekipten çıkar</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  errorText: { ...typography.body, color: colors.error, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  memberName: {
    ...typography.title,
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  sectionTitleSpaced: { marginTop: spacing.lg },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  stepLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  emptyHint: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  currentRoleCard: { marginBottom: spacing.sm },
  currentRoleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentRoleInfo: { flex: 1, minWidth: 0 },
  currentRoleName: { ...typography.body, fontFamily: fonts.semibold, color: colors.textPrimary },
  currentRoleHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  removeRoleBtn: { padding: spacing.sm },
  removeRoleBtnPressed: { opacity: 0.7 },
  roleList: { marginBottom: spacing.md },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.sm,
  },
  roleItemSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '12' },
  roleItemContent: { flex: 1, minWidth: 0 },
  roleItemText: { ...typography.body, color: colors.textPrimary },
  roleItemTextSelected: { fontFamily: fonts.semibold, color: colors.accent },
  roleItemDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  assignBtn: { marginTop: spacing.sm },
  removeMemberBtn: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.error + '55',
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  removeMemberBtnPressed: { opacity: 0.85 },
  removeMemberBtnText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
});
