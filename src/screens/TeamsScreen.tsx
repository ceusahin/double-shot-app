import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import { Card, Button } from '../components';
import { getMyTeams } from '../services/teams';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamsList'>;

/** Çalışan: tek ekip, MANAGER değil → liste gösterme, doğrudan takım sayfasına git */
function isWorkerSingleTeam(teams: { role?: string }[], isLoading: boolean): boolean {
  return !isLoading && teams.length === 1 && teams[0].role !== 'MANAGER';
}

export function TeamsScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['my-teams', userId],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getMyTeams(uid);
    },
    enabled: !!userId,
  });

  const workerSingleTeam = isWorkerSingleTeam(teams, isLoading);

  // Çalışan (tek takım): doğrudan takım sayfasına git, "Ekiplerim" listesini gösterme
  useEffect(() => {
    if (!workerSingleTeam) return;
    navigation.replace('TeamDetail', { team: teams[0] });
  }, [workerSingleTeam, teams, navigation]);

  // Veri yokken veya çalışan tek ekipte: "Ekiplerim" listesini gösterme (çalışan direkt takım sayfasına gidecek)
  if (isLoading || workerSingleTeam) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Takımlarım</Text>

      {teams.length === 0 ? (
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
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
