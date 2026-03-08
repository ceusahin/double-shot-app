import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Input } from '../../components';
import { useAuthStore } from '../../store/authStore';
import { joinTeamByInviteToken } from '../../services/teams';
import { colors, spacing, typography } from '../../utils/theme';

function extractToken(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = t.match(uuidRegex);
  return match ? match[0] : (t.length >= 36 ? t : null);
}

export function JoinTeamScreen() {
  const [linkOrToken, setLinkOrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = useAuthStore((s) => s.user);

  const handleJoin = async () => {
    const token = extractToken(linkOrToken);
    if (!user || !token) {
      setError('Yöneticinizden aldığınız davet linkini yapıştırın.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const team = await joinTeamByInviteToken(token);
      Alert.alert('Takıma katıldınız', team.name, [{ text: 'Tamam' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geçersiz veya süresi dolmuş davet linki.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Takıma Katıl</Text>
        <Text style={styles.subtitle}>
          Yöneticinizden aldığınız davet linkini yapıştırın (süre sınırlı link)
        </Text>
      </View>
      <View style={styles.form}>
        <Input
          label="Davet linki"
          value={linkOrToken}
          onChangeText={setLinkOrToken}
          placeholder="doubleshot://invite/... veya linki yapıştırın"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button title="Katıl" onPress={handleJoin} loading={loading} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    padding: spacing.lg,
    paddingTop: 60,
  },
  header: { marginBottom: spacing.xl },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { marginBottom: spacing.lg },
  errorText: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
});
