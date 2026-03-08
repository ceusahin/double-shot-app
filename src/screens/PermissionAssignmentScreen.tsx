import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Card, Button } from '../components';
import { listPermissions, getPermissionsForRoleLevel, setPermissionsForRoleLevel } from '../services/rbac';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '../utils/theme';
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

  const { data: assigned = [] } = useQuery({
    queryKey: ['role-level-permissions', roleLevel.id],
    queryFn: () => getPermissionsForRoleLevel(roleLevel.id),
  });

  useEffect(() => {
    setSelectedIds(new Set(assigned.map((p) => p.id)));
  }, [assigned]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{role.name} → {roleLevel.name}</Text>
      <Text style={styles.subtitle}>Bu seviyeye atanacak yetkileri seçin (açıklama için dokunun)</Text>

      <View style={styles.actions}>
        <Button title="Tümünü seç" onPress={selectAll} variant="ghost" style={styles.smallBtn} />
        <Button title="Temizle" onPress={clearAll} variant="ghost" style={styles.smallBtn} />
      </View>

      {allPermissions.map((perm) => (
        <Card
          key={perm.id}
          onPress={() => toggle(perm)}
          style={[styles.permCard, selectedIds.has(perm.id) && styles.permCardSelected]}
        >
          <View style={styles.permRow}>
            <Text style={styles.permKey}>{perm.key}</Text>
            <Text style={styles.permCheck}>{selectedIds.has(perm.id) ? '✓' : ''}</Text>
          </View>
          {perm.description ? (
            <Text style={styles.permDesc}>{perm.description}</Text>
          ) : null}
        </Card>
      ))}

      <Button title="Yetkileri kaydet" onPress={handleSave} loading={saving} fullWidth style={styles.saveBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  smallBtn: { flex: 1 },
  permCard: { marginBottom: spacing.sm },
  permCardSelected: { borderWidth: 2, borderColor: colors.primary },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  permKey: { ...typography.body, fontWeight: '600', color: colors.text },
  permCheck: { ...typography.subtitle, color: colors.primary },
  permDesc: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  saveBtn: { marginTop: spacing.lg },
});
