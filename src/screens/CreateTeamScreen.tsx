import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Card } from '../components';
import { useAuthStore } from '../store/authStore';
import { createTeam } from '../services/teams';
import { colors, spacing, typography } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Nav = StackNavigationProp<TeamsStackParamList, 'CreateTeam'>;

export function CreateTeamScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!user || !name.trim()) {
      setError('Takım adı girin.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const team = await createTeam(user.id, name.trim());
      queryClient.invalidateQueries({ queryKey: ['my-teams', user.id] });
      Alert.alert('Takım oluşturuldu', 'Üyeleri davet etmek için takım sayfasında sağ üstten "Ekibe davet et" ile süreli link oluşturun.', [
        { text: 'Tamam', onPress: () => navigation.replace('TeamManagement', { team: { ...team, role: 'MANAGER' } }) },
      ]);
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string };
      const msg = err?.message ?? err?.details ?? 'Takım oluşturulamadı.';
      if (__DEV__) console.warn('createTeam error:', e);
      setError(msg);
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <Input
          label="Takım adı"
          value={name}
          onChangeText={setName}
          placeholder="Örn: Merkez Şube"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Oluştur" onPress={handleCreate} loading={loading} fullWidth />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
