import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '../components';
import { useAuthStore } from '../store/authStore';
import { joinTeamByInviteToken } from '../services/teams';
import { colors, spacing, typography } from '../utils/theme';

/** Link veya URL'den token çıkar (doubleshot://invite/UUID veya https://.../invite/UUID) */
function extractTokenFromInput(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = t.match(uuidRegex);
  if (match) return match[0];
  if (t.length >= 36) return t;
  return null;
}

export function JoinTeamInAppScreen() {
  const navigation = useNavigation();
  const route = useRoute<{ params?: { token?: string } }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [linkOrToken, setLinkOrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tokenFromParams = route.params?.token;

  useEffect(() => {
    if (tokenFromParams && user) {
      setError('');
      setLoading(true);
      joinTeamByInviteToken(tokenFromParams)
        .then((team) => {
          queryClient.invalidateQueries({ queryKey: ['my-teams', user.id] });
          Alert.alert('Takıma katıldınız', team.name, [
            { text: 'Tamam', onPress: () => navigation.goBack() },
          ]);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Geçersiz davet linki.'))
        .finally(() => setLoading(false));
    }
  }, [tokenFromParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async () => {
    const token = extractTokenFromInput(linkOrToken);
    if (!user || !token) {
      setError('Davet linkini yapıştırın veya linke tıklayarak uygulamayı açın.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const team = await joinTeamByInviteToken(token);
      queryClient.invalidateQueries({ queryKey: ['my-teams', user.id] });
      Alert.alert('Takıma katıldınız', team.name, [
        { text: 'Tamam', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geçersiz veya süresi dolmuş davet linki.');
    } finally {
      setLoading(false);
    }
  };

  if (tokenFromParams && user) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Davet linki işleniyor…</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? null : <Button title="Takıma katıl sayfasına dön" onPress={() => navigation.goBack()} variant="ghost" />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Yöneticinizden aldığınız davet linkini buraya yapıştırın veya linke tıklayarak uygulamayı açın. Linkler süre sınırlıdır.
      </Text>
      <Input
        label="Davet linki"
        value={linkOrToken}
        onChangeText={setLinkOrToken}
        placeholder="doubleshot://invite/... veya linki yapıştırın"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Katıl" onPress={handleJoin} loading={loading} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
