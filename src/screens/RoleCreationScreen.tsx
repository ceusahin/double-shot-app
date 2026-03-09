import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Card, Input, Button } from '../components';
import { createRole, ensureOrganizationForTeam } from '../services/rbac';
import { colors, spacing, typography } from '../utils/theme';
import type { Team } from '../types';
import type { Role } from '../types/rbac';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Props = { route: RouteProp<TeamsStackParamList, 'RoleCreation'> };

export function RoleCreationScreen({ route }: Props) {
  const navigation = useNavigation();
  const { team, organizationId: paramOrgId } = route.params;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Rol adı girin.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      let organizationId = paramOrgId;
      if (!organizationId && team.owner_id) {
        const org = await ensureOrganizationForTeam(team.id, team.name, team.owner_id);
        organizationId = org.id;
      }
      if (!organizationId) {
        setError('Organizasyon bilgisi bulunamadı. Lütfen ekip yönetiminden tekrar deneyin.');
        setLoading(false);
        return;
      }
      const role = await createRole(organizationId, name.trim(), description.trim() || undefined);
      Alert.alert('Rol oluşturuldu', 'Şimdi seviye ekleyebilirsiniz.', [
        { text: 'Tamam', onPress: () => navigation.navigate('RoleLevel', { team, role }) },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Rol oluşturulamadı.';
      setError(message);
      Alert.alert('Rol oluşturulamadı', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <Input
          label="Rol adı"
          value={name}
          onChangeText={setName}
          placeholder="Örn: Barista, Garson, Kasa"
        />
        <Input
          label="Açıklama (isteğe bağlı)"
          value={description}
          onChangeText={setDescription}
          placeholder="Kısa açıklama"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Oluştur" onPress={handleCreate} loading={loading} fullWidth />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
});
