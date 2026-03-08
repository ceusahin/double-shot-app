import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Card, Button } from '../components';
import { getMyTeams } from '../services/teams';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Nav = NativeStackNavigationProp<TeamsStackParamList, 'TeamsList'>;

export function TeamsScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['my-teams', userId],
    queryFn: () => getMyTeams(userId!),
    enabled: !!userId,
  });

  // Barista (tek takım, owner değil): doğrudan o takım sayfasına git
  useEffect(() => {
    if (isLoading || teams.length !== 1) return;
    const team = teams[0];
    if (team.role === 'MANAGER') return;
    navigation.replace('TeamDetail', { team });
  }, [isLoading, teams, navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Takımlarım</Text>

      {isLoading ? (
        <Card><Text style={styles.placeholder}>Yükleniyor…</Text></Card>
      ) : teams.length === 0 ? (
        <Card>
          <Text style={styles.placeholder}>
            Henüz bir takıma katılmadınız. Yöneticinizden davet linki alın veya takım oluşturun.
          </Text>
          <Button
            title="Davet linki ile katıl"
            onPress={() => navigation.navigate('JoinTeam', {})}
            variant="outline"
            style={styles.btn}
          />
          <Button
            title="Takım oluştur"
            onPress={() => navigation.navigate('CreateTeam')}
            variant="primary"
            style={styles.btn}
          />
        </Card>
      ) : (
        <>
          {teams.map((team) => (
            <Pressable
              key={team.id}
              onPress={() => navigation.navigate('TeamDetail', { team })}
            >
              <Card style={styles.teamCard}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamRole}>{team.role === 'MANAGER' ? 'Yönetici' : 'Barista'}</Text>
              </Card>
            </Pressable>
          ))}
          <Button
            title="Takıma katıl"
            onPress={() => navigation.navigate('JoinTeam')}
            variant="outline"
            style={styles.btn}
          />
          <Button
            title="Takım oluştur"
            onPress={() => navigation.navigate('CreateTeam')}
            variant="ghost"
            style={styles.btn}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  btn: {
    marginTop: spacing.sm,
  },
  teamCard: {
    marginBottom: spacing.sm,
  },
  teamName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  teamRole: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
  },
});
