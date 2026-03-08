import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Card, Button } from '../components';
import {
  listRoles,
  listRoleLevels,
  getMemberRoles,
  assignMemberRole,
  updateMemberRole,
  removeMemberRole,
} from '../services/rbac';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import type { Team } from '../types';
import type { Member, Role, RoleLevel } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'MemberRole'> };

export function MemberRoleScreen({ route }: Props) {
  const { team, member } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const organizationId = team.organization_id!;

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles', organizationId],
    queryFn: () => listRoles(organizationId),
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
    ? [member.user.name, member.user.surname].filter(Boolean).join(' ') || (member.user as { email?: string }).email
    : member.user_id;

  const handleAssign = async () => {
    if (!selectedRoleId || !selectedLevelId || !user) return;
    setSaving(true);
    try {
      await assignMemberRole(member.id, selectedRoleId, selectedLevelId, user.id);
      queryClient.invalidateQueries({ queryKey: ['member-roles', member.id] });
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
            queryClient.invalidateQueries({ queryKey: ['member-roles', member.id] });
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Kaldırılamadı.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.memberName}>{displayName}</Text>
      <Text style={styles.sectionTitle}>Mevcut roller</Text>
      {currentRoles.length === 0 ? (
        <Text style={styles.placeholder}>Henüz rol atanmamış. Aşağıdan rol ve seviye seçin.</Text>
      ) : (
        currentRoles.map((mr) => (
          <Card key={mr.id} style={styles.roleCard}>
            <Text style={styles.roleText}>{mr.role?.name} → {mr.role_level?.name}</Text>
            <Button title="Kaldır" onPress={() => handleRemoveRole(mr.id)} variant="ghost" style={styles.smallBtn} />
          </Card>
        ))
      )}

      <Text style={styles.sectionTitle}>Rol ata</Text>
      <Text style={styles.hint}>Rol seçin, sonra seviye seçip "Ata"ya basın.</Text>

      {roles.map((role) => (
        <Card
          key={role.id}
          onPress={() => { setSelectedRoleId(role.id); setSelectedLevelId(null); }}
          style={selectedRoleId === role.id ? styles.selectedCard : undefined}
        >
          <Text style={styles.roleName}>{role.name}</Text>
        </Card>
      ))}

      {selectedRoleId && levels.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Seviye seçin</Text>
          {levels.map((level) => (
            <Card
              key={level.id}
              onPress={() => setSelectedLevelId(level.id)}
              style={selectedLevelId === level.id ? styles.selectedCard : undefined}
            >
              <Text style={styles.levelName}>{level.name}</Text>
            </Card>
          ))}
          <Button
            title="Rolü ata"
            onPress={handleAssign}
            loading={saving}
            disabled={!selectedLevelId}
            fullWidth
            style={styles.assignBtn}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  memberName: { ...typography.title, color: colors.primary, marginBottom: spacing.md },
  sectionTitle: { ...typography.subtitle, color: colors.accent, marginBottom: spacing.sm },
  placeholder: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  roleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  roleText: { ...typography.body, color: colors.text },
  smallBtn: { marginTop: 0 },
  roleName: { ...typography.body, fontWeight: '600' },
  levelName: { ...typography.body },
  selectedCard: { borderWidth: 2, borderColor: colors.primary },
  assignBtn: { marginTop: spacing.lg },
});
