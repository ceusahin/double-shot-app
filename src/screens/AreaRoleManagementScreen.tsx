import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Card, Button } from '../components';
import { ensureOrganizationForTeam, listRoles } from '../services/rbac';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'AreaRoleManagement'> };

export function AreaRoleManagementScreen({ route }: Props) {
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);
  const isOwner = team.owner_id === user?.id;

  const { data: org } = useQuery({
    queryKey: ['org-for-team', team.id],
    queryFn: async () => {
      if (team.organization_id) return { id: team.organization_id };
      if (!isOwner || !user) return null;
      return ensureOrganizationForTeam(team.id, team.name, user.id);
    },
    enabled: !!team.id && !!user,
  });

  const orgId = org?.id ?? team.organization_id ?? null;
  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles', orgId],
    queryFn: () => listRoles(orgId!),
    enabled: !!orgId,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Alanlar</Text>
      <Text style={styles.hint}>
        İşyerinizdeki alanlar (mutfak, bar, garsonluk vb.) ve bu alanlara ait roller burada yönetilir.
      </Text>
      <Card style={styles.card}>
        <Text style={styles.placeholder}>
          Alan tanımlama özelliği yakında eklenecek. Şu an aşağıda organizasyonunuzdaki roller listeleniyor; alan–rol eşlemesi sonraki güncellemede gelecek.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Mevcut roller</Text>
      {roles.length === 0 ? (
        <Card>
          <Text style={styles.placeholder}>Henüz rol tanımlanmamış. Ekip Yönetimi → Roller sekmesinden rol oluşturabilirsiniz.</Text>
        </Card>
      ) : (
        roles.map((role) => (
          <Card key={role.id} style={styles.roleCard}>
            <Text style={styles.roleName}>{role.name}</Text>
            {role.description ? (
              <Text style={styles.roleDesc} numberOfLines={2}>{role.description}</Text>
            ) : null}
          </Card>
        ))
      )}

      <Text style={styles.footerHint}>
        Örnek: Bar alanı → Bar şefi, Junior barista. Mutfak alanı → Mutfak sorumlusu. Bu yapı bir sonraki sürümde eklenecek.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  card: { marginBottom: spacing.lg },
  placeholder: { ...typography.body, color: colors.textSecondary },
  roleCard: { marginBottom: spacing.sm },
  roleName: { ...typography.subtitle, color: colors.textPrimary },
  roleDesc: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  footerHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg },
});
