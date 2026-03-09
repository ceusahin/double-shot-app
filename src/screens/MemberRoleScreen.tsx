import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button } from '../components';
import {
  listRoles,
  listRoleLevels,
  getMemberRoles,
  assignMemberRole,
  removeMemberRole,
} from '../services/rbac';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { Team } from '../types';
import type { Member, Role, RoleLevel } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'MemberRole'> };

export function MemberRoleScreen({ route }: Props) {
  const { team, member } = route.params;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const organizationId = team.organization_id ?? undefined;

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
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

  const handleAssign = async () => {
    if (!selectedRoleId || !selectedLevelId || !user) return;
    setSaving(true);
    try {
      for (const mr of currentRoles) {
        await removeMemberRole(mr.id);
      }
      await assignMemberRole(member.id, selectedRoleId, selectedLevelId, user.id);
      queryClient.invalidateQueries({ queryKey: ['member-roles', member.id] });
      queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', organizationId] });
      setSelectedRoleId(null);
      setSelectedLevelId(null);
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
            queryClient.invalidateQueries({ queryKey: ['org-members-with-roles', organizationId] });
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Kaldırılamadı.');
          }
        },
      },
    ]);
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
        <Text style={styles.subtitle}>Üyeye rol ve seviye atayın.</Text>
      </View>

      {/* Mevcut roller */}
      <Text style={styles.sectionTitle}>Mevcut roller</Text>
      {currentRoles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="ribbon-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>Henüz rol atanmamış</Text>
          <Text style={styles.emptyHint}>Aşağıdan rol ve seviye seçip atayın.</Text>
        </View>
      ) : (
        currentRoles.slice(0, 1).map((mr) => {
          const displayLabel = [mr.role_level?.name, mr.role?.name].filter(Boolean).join(' ') || 'Rol';
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
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Yeni rol ata</Text>
      <Text style={styles.hint}>
        {currentRoles.length > 0
          ? 'Yeni rol atandığında mevcut rol kaldırılır.'
          : 'Önce rol, sonra seviye seçin ve "Rolü ata"ya basın.'}
      </Text>

      <Text style={styles.stepLabel}>1. Rol seçin</Text>
      {roles.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Henüz rol tanımı yok.</Text>
          <Text style={styles.emptyHint}>Ekip yönetimi → Rol ve Yetkiler’den rol oluşturun.</Text>
        </View>
      ) : (
        <View style={styles.roleList}>
          {roles.map((role) => (
            <Pressable
              key={role.id}
              onPress={() => {
                setSelectedRoleId(role.id);
                setSelectedLevelId(null);
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

      {selectedRoleId && levels.length > 0 && (
        <>
          <Text style={styles.stepLabel}>2. Seviye seçin</Text>
          <View style={styles.levelList}>
            {levels.map((level) => (
              <Pressable
                key={level.id}
                onPress={() => setSelectedLevelId(level.id)}
                style={[
                  styles.levelItem,
                  selectedLevelId === level.id && styles.levelItemSelected,
                ]}
              >
                <Text
                  style={[
                    styles.levelItemText,
                    selectedLevelId === level.id && styles.levelItemTextSelected,
                  ]}
                >
                  {level.name}
                </Text>
                {selectedLevelId === level.id && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
          <Button
            title="Rolü ata"
            onPress={handleAssign}
            loading={saving}
            disabled={!selectedLevelId}
            variant="primary"
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
  levelList: { marginBottom: spacing.md },
  levelItem: {
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
  levelItemSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '12' },
  levelItemText: { ...typography.body, color: colors.textPrimary },
  levelItemTextSelected: { fontFamily: fonts.semibold, color: colors.accent },
  assignBtn: { marginTop: spacing.sm },
});
