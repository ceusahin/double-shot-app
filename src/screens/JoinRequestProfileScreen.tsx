import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card } from '../components';
import { respondToJoinRequest } from '../services/teams';
import { colors, spacing, typography, fonts } from '../utils/theme';
import type { MainStackParamList } from '../navigation/MainStack';

type Nav = StackNavigationProp<MainStackParamList, 'JoinRequestProfile'>;

export function JoinRequestProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<{ params: MainStackParamList['JoinRequestProfile'] }>();
  const { request } = route.params;
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async (approve: boolean) => respondToJoinRequest(request.id, approve),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['join-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['join-requests-count'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['my-teams'] }),
        queryClient.invalidateQueries({ queryKey: ['team-members', request.team_id] }),
        queryClient.invalidateQueries({ queryKey: ['team-members-on-shift', request.team_id] }),
        queryClient.invalidateQueries({ queryKey: ['org-members-with-roles'] }),
      ]);
      navigation.goBack();
    },
    onError: (e) => Alert.alert('Hata', e instanceof Error ? e.message : 'İstek güncellenemedi.'),
  });

  const fullName = [
    request.requester?.name || request.requester_name,
    request.requester?.surname || request.requester_surname,
  ]
    .filter(Boolean)
    .join(' ');
  const requesterEmail = request.requester?.email || request.requester_email || '-';

  return (
    <View style={styles.container}>
      <Card>
        <View style={styles.topRow}>
          <Avatar
            source={
              request.requester?.profile_photo || request.requester_profile_photo || undefined
            }
            name={fullName || requesterEmail || 'Uye'}
            size={56}
          />
          <View style={styles.meta}>
            <Text style={styles.name}>{fullName || requesterEmail || 'Isimsiz kullanici'}</Text>
            <Text style={styles.email}>{requesterEmail}</Text>
            <Text style={styles.team}>Ekip: {request.teams?.name ?? '-'}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Istek tarihi: {new Date(request.created_at).toLocaleString('tr-TR')}
          </Text>
        </View>
      </Card>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => resolveMutation.mutate(false)}
          style={[styles.actionBtn, styles.rejectBtn]}
          disabled={resolveMutation.isPending}
        >
          <Text style={styles.rejectText}>Reddet</Text>
        </Pressable>
        <Pressable
          onPress={() => resolveMutation.mutate(true)}
          style={[styles.actionBtn, styles.approveBtn]}
          disabled={resolveMutation.isPending}
        >
          <Text style={styles.approveText}>{resolveMutation.isPending ? 'Isleniyor...' : 'Onayla ve ekibe al'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark, padding: spacing.md },
  topRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  meta: { flex: 1 },
  name: { ...typography.subtitle, color: colors.textPrimary, fontFamily: fonts.semibold },
  email: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  team: { ...typography.caption, color: colors.accent, marginTop: 4 },
  infoCard: { marginTop: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  infoText: { ...typography.caption, color: colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: spacing.sm, alignItems: 'center' },
  rejectBtn: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  approveBtn: { backgroundColor: colors.accent },
  rejectText: { ...typography.small, color: colors.textPrimary, fontFamily: fonts.semibold },
  approveText: { ...typography.small, color: colors.black, fontFamily: fonts.semibold },
});
