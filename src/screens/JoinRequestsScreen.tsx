import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card } from '../components';
import { listPendingJoinRequests, respondToJoinRequest } from '../services/teams';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { TeamJoinRequest } from '../types';
import type { MainStackParamList } from '../navigation/MainStack';

type Nav = StackNavigationProp<MainStackParamList, 'JoinRequests'>;

export function JoinRequestsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<{ params?: MainStackParamList['JoinRequests'] }>();
  const queryClient = useQueryClient();
  const teamId = route.params?.teamId;
  const queryKey = useMemo(() => ['join-requests', teamId ?? 'all'] as const, [teamId]);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const { data: requests = [], isPending, isFetching, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => listPendingJoinRequests(teamId),
    refetchOnMount: 'always',
  });

  /** Buton için: RefreshControl.refreshing ile bağlama — sistem beyaz overlay/spinner gösterebiliyor. */
  const isRefetching = isFetching && !isPending;

  const refetchJoinRequests = useCallback(() => {
    return queryClient.refetchQueries({
      queryKey: [...queryKey],
      exact: true,
      type: 'active',
    });
  }, [queryClient, queryKey]);

  const refreshJoinRequests = useCallback(() => void refetchJoinRequests(), [refetchJoinRequests]);

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await refetchJoinRequests();
    } finally {
      setPullRefreshing(false);
    }
  }, [refetchJoinRequests]);

  useFocusEffect(
    useCallback(() => {
      void refetchJoinRequests();
    }, [refetchJoinRequests])
  );

  const resolveMutation = useMutation({
    mutationFn: async (vars: { requestId: string; approve: boolean; teamId: string }) =>
      respondToJoinRequest(vars.requestId, vars.approve),
    onSuccess: async (_d, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['join-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['join-requests-count'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['my-teams'] }),
        queryClient.invalidateQueries({ queryKey: ['team-members', vars.teamId] }),
        queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', vars.teamId] }),
        queryClient.invalidateQueries({ queryKey: ['org-members-with-roles'] }),
      ]);
    },
    onError: (e) => {
      Alert.alert('Hata', e instanceof Error ? e.message : 'İstek güncellenemedi.');
    },
  });

  const openProfile = (request: TeamJoinRequest) => {
    navigation.navigate('JoinRequestProfile', { request });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={pullRefreshing}
          onRefresh={() => void onPullRefresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.bgDark}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, styles.titleFlex]} numberOfLines={2}>
          Katılma İstekleri
        </Text>
        <Pressable
          onPress={() => void refreshJoinRequests()}
          style={({ pressed }) => [styles.refreshBtn, pressed && styles.refreshBtnPressed]}
          hitSlop={12}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Ionicons name="refresh" size={16} color={colors.black} />
          )}
          <Text style={styles.refreshText}>Yenile</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Davet linkiyle gelen üyeleri inceleyip onaylayın veya reddedin.</Text>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Katılma istekleri yüklenemedi: {error instanceof Error ? error.message : 'Bilinmeyen hata'}
          </Text>
        </Card>
      ) : requests.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>Bekleyen katılma isteği yok.</Text>
        </Card>
      ) : (
        requests.map((request) => {
          const fullName = [
            request.requester?.name || request.requester_name,
            request.requester?.surname || request.requester_surname,
          ]
            .filter(Boolean)
            .join(' ');
          const requesterEmail = request.requester?.email || request.requester_email || '-';
          return (
            <Card key={request.id} style={styles.card}>
              <Pressable onPress={() => openProfile(request)} style={styles.rowTop}>
                <Avatar
                  source={
                    request.requester?.profile_photo || request.requester_profile_photo || undefined
                  }
                  name={fullName || requesterEmail || 'Uye'}
                  size={40}
                />
                <View style={styles.userMeta}>
                  <Text style={styles.nameText}>{fullName || requesterEmail || 'Isimsiz kullanici'}</Text>
                  <Text style={styles.emailText}>{requesterEmail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() =>
                    resolveMutation.mutate({
                      requestId: request.id,
                      approve: false,
                      teamId: request.team_id,
                    })
                  }
                  style={[styles.actionBtn, styles.rejectBtn]}
                >
                  <Text style={styles.rejectText}>Reddet</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    resolveMutation.mutate({
                      requestId: request.id,
                      approve: true,
                      teamId: request.team_id,
                    })
                  }
                  style={[styles.actionBtn, styles.approveBtn]}
                >
                  <Text style={styles.approveText}>Onayla</Text>
                </Pressable>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  titleFlex: { flex: 1, flexShrink: 1, marginRight: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexShrink: 0,
  },
  refreshBtnPressed: { opacity: 0.85 },
  refreshText: { ...typography.small, color: colors.black, fontFamily: fonts.semibold },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyCard: { paddingVertical: spacing.lg },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  card: { marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userMeta: { flex: 1 },
  nameText: { ...typography.body, color: colors.textPrimary, fontFamily: fonts.semibold },
  emailText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  actionRow: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  approveBtn: { backgroundColor: colors.accent },
  rejectText: { ...typography.small, color: colors.textPrimary, fontFamily: fonts.semibold },
  approveText: { ...typography.small, color: colors.black, fontFamily: fonts.semibold },
});
