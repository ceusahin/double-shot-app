import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Button } from '../components';
import { listPermissions, getPermissionsForRoleLevel, setPermissionsForRoleLevel } from '../services/rbac';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPermissionDisplayName } from '../utils/permissionLabels';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { Team } from '../types';
import type { Role, RoleLevel, Permission } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'PermissionAssignment'> };

export function PermissionAssignmentScreen({ route }: Props) {
  const { team, role, roleLevel } = route.params;
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['permissions-list'],
    queryFn: listPermissions,
  });

  const { data: assignedPermissions } = useQuery({
    queryKey: ['role-level-permissions', roleLevel.id],
    queryFn: () => getPermissionsForRoleLevel(roleLevel.id),
  });

  const assigned = assignedPermissions ?? [];
  const assignedIdsKey = assigned.map((p) => p.id).sort().join(',');

  useEffect(() => {
    const list = assignedPermissions ?? [];
    setSelectedIds(new Set(list.map((p) => p.id)));
  }, [roleLevel.id, assignedIdsKey]);

  const toggle = (perm: Permission) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(perm.id)) next.delete(perm.id);
      else next.add(perm.id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(allPermissions.map((p) => p.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleSave = async () => {
    setSaving(true);
    try {
      await setPermissionsForRoleLevel(roleLevel.id, Array.from(selectedIds));
      queryClient.invalidateQueries({ queryKey: ['role-level-permissions', roleLevel.id] });
    } catch (e) {
      // show error
    } finally {
      setSaving(false);
    }
  };

  const allSelected = allPermissions.length > 0 && selectedIds.size === allPermissions.length;
  const noneSelected = selectedIds.size === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{role.name} · {roleLevel.name}</Text>
      <Text style={styles.subtitle}>Bu seviyeye atanacak yetkileri seçin</Text>

      <View style={styles.actions}>
        <Pressable
          onPress={selectAll}
          style={({ pressed }) => [
            styles.actionChip,
            allSelected && styles.actionChipActive,
            pressed && styles.actionChipPressed,
          ]}
        >
          <Ionicons
            name="checkmark-done-circle"
            size={20}
            color={allSelected ? colors.accent : colors.textSecondary}
          />
          <Text style={[styles.actionChipText, allSelected && styles.actionChipTextActive]}>
            Tümünü seç
          </Text>
        </Pressable>
        <Pressable
          onPress={clearAll}
          style={({ pressed }) => [
            styles.actionChip,
            noneSelected && styles.actionChipActive,
            pressed && styles.actionChipPressed,
          ]}
        >
          <Ionicons
            name="close-circle-outline"
            size={20}
            color={noneSelected ? colors.accent : colors.textSecondary}
          />
          <Text style={[styles.actionChipText, noneSelected && styles.actionChipTextActive]}>
            Temizle
          </Text>
        </Pressable>
      </View>

      {allPermissions.map((perm) => (
        <Card
          key={perm.id}
          onPress={() => toggle(perm)}
          style={[styles.permCard, selectedIds.has(perm.id) && styles.permCardSelected]}
        >
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>{getPermissionDisplayName(perm)}</Text>
            {selectedIds.has(perm.id) ? (
              <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
            ) : null}
          </View>
        </Card>
      ))}

      <Button title="Yetkileri kaydet" onPress={handleSave} loading={saving} fullWidth style={styles.saveBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glassBg,
  },
  actionChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  actionChipPressed: { opacity: 0.85 },
  actionChipText: { ...typography.caption, fontFamily: fonts.medium, color: colors.textSecondary },
  actionChipTextActive: { color: colors.accent, fontFamily: fonts.semibold },
  permCard: { marginBottom: spacing.sm },
  permCardSelected: { borderWidth: 2, borderColor: colors.accent },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  permLabel: { ...typography.body, fontFamily: fonts.medium, color: colors.textPrimary, flex: 1 },
  saveBtn: { marginTop: spacing.lg },
});
