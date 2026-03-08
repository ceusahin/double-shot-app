import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Card, Input, Button } from '../components';
import { listRoleLevels, createRoleLevel, deleteRoleLevel } from '../services/rbac';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '../utils/theme';
import type { Team } from '../types';
import type { Role, RoleLevel } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'RoleLevel'> };

export function RoleLevelScreen({ route }: Props) {
  const navigation = useNavigation();
  const { team, role } = route.params;
  const queryClient = useQueryClient();
  const [newLevelName, setNewLevelName] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: levels = [], refetch } = useQuery({
    queryKey: ['role-levels', role.id],
    queryFn: () => listRoleLevels(role.id),
  });

  const handleAddLevel = async () => {
    if (!newLevelName.trim()) return;
    setLoading(true);
    try {
      await createRoleLevel(role.id, newLevelName.trim(), levels.length);
      setNewLevelName('');
      queryClient.invalidateQueries({ queryKey: ['role-levels', role.id] });
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Seviye eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLevel = (level: RoleLevel) => {
    Alert.alert('Seviyeyi sil', `"${level.name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoleLevel(level.id);
            queryClient.invalidateQueries({ queryKey: ['role-levels', role.id] });
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : 'Silinemedi.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.roleName}>{role.name}</Text>
      <Text style={styles.sectionTitle}>Seviyeler (örn: Junior, Senior, Head)</Text>

      {levels.map((level) => (
        <Card key={level.id} style={styles.levelCard}>
          <View style={styles.levelRow}>
            <Text style={styles.levelName}>{level.name}</Text>
            <Button
              title="Yetkiler"
              onPress={() => navigation.navigate('PermissionAssignment', { team, role, roleLevel: level })}
              variant="outline"
              style={styles.smallBtn}
            />
            <Button
              title="Sil"
              onPress={() => handleDeleteLevel(level)}
              variant="ghost"
              style={styles.smallBtn}
            />
          </View>
        </Card>
      ))}

      <View style={styles.addRow}>
        <Input
          label="Yeni seviye adı"
          value={newLevelName}
          onChangeText={setNewLevelName}
          placeholder="Örn: Junior Barista"
        />
        <Button title="Seviye ekle" onPress={handleAddLevel} loading={loading} fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  roleName: { ...typography.title, color: colors.primary, marginBottom: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: colors.accent, marginBottom: spacing.md },
  levelCard: { marginBottom: spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  levelName: { ...typography.body, fontWeight: '600', flex: 1 },
  smallBtn: { marginTop: 0 },
  addRow: { marginTop: spacing.lg },
});
