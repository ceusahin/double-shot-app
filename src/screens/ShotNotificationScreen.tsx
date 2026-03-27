import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Card, Input, Button, Avatar } from '../components';
import { useAuthStore } from '../store/authStore';
import { getTeamMembers } from '../services/teams';
import { getTeamMembersOnShift } from '../services/shifts';
import { supabase } from '../services/supabase';
import { sendExpoPush } from '../services/pushNotifications';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';

type RouteProps = RouteProp<TeamsStackParamList, 'ShotNotification'>;

type Audience = 'on_shift' | 'all' | 'single_member';

export function ShotNotificationScreen() {
  const route = useRoute<RouteProps>();
  const { team } = route.params;
  const user = useAuthStore((s) => s.user);

  const [audience, setAudience] = useState<Audience>('on_shift');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [audienceRowWidth, setAudienceRowWidth] = useState(0);
  const audienceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(audienceAnim, {
      toValue: audience === 'all' ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [audience, audienceAnim]);

  const isManager = useMemo(
    () => team.role === 'MANAGER' || team.owner_id === user?.id,
    [team.role, team.owner_id, user?.id]
  );

  const { data: allMembers = [] } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => getTeamMembers(team.id),
  });

  const { data: onShiftMembers = [] } = useQuery({
    queryKey: ['team-members-on-shift', team.id],
    queryFn: () => getTeamMembersOnShift(team.id),
  });

  const targetUserIds = useMemo(() => {
    if (audience === 'on_shift') {
      return onShiftMembers.map((m) => m.user_id);
    }
    if (audience === 'single_member') {
      return selectedMemberId ? [selectedMemberId] : [];
    }
    return allMembers.map((m) => m.user_id);
  }, [audience, onShiftMembers, allMembers, selectedMemberId]);

  const memberOptions = useMemo(
    () =>
      allMembers
        .filter((m) => m.user_id !== user?.id)
        .map((m) => ({
          id: m.user_id,
          label: [m.user?.name, m.user?.surname].filter(Boolean).join(' ').trim() || 'Ekip üyesi',
          photo: m.user?.profile_photo ?? null,
        })),
    [allMembers, user?.id]
  );

  const selectedMemberLabel = useMemo(
    () => memberOptions.find((m) => m.id === selectedMemberId)?.label ?? null,
    [memberOptions, selectedMemberId]
  );

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      Alert.alert('Uyarı', 'Lütfen gönderilecek metni yazın.');
      return;
    }
    if (!isManager) {
      Alert.alert('Yetki yok', 'Shot bildirimi sadece ekip lideri veya yönetici tarafından gönderilebilir.');
      return;
    }
    if (targetUserIds.length === 0) {
      if (audience === 'single_member') {
        Alert.alert('Uyarı', 'Lütfen bildirim gönderilecek ekip üyesini seçin.');
        return;
      }
      Alert.alert('Uyarı', 'Seçili kriterlere uyan ekip üyesi bulunamadı.');
      return;
    }
    setSending(true);
    try {
      const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('*')
        .in('user_id', targetUserIds);
      if (error) {
        throw new Error(error.message ?? 'Push tokenlar alınamadı');
      }
      const uniqueTokens = Array.from(
        new Set((tokens ?? []).map((t: any) => t.token as string).filter(Boolean))
      );
      if (uniqueTokens.length === 0) {
        Alert.alert('Uyarı', 'Hedef kullanıcılar için kayıtlı bildirim tokenı bulunamadı.');
        setSending(false);
        return;
      }

      await Promise.allSettled(
        uniqueTokens.map((token) =>
          sendExpoPush(token, `${team.name} – Shot`, text)
        )
      );
      Alert.alert('Gönderildi', 'Shot bildirimi ekibe iletildi.');
      setMessage('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bildirim gönderilemedi.';
      Alert.alert('Hata', msg);
    } finally {
      setSending(false);
    }
  };

  const segmentCount = 2;
  const totalGap = spacing.sm * (segmentCount - 1);
  const indicatorWidth = audienceRowWidth > 0 ? (audienceRowWidth - totalGap) / segmentCount : 0;
  const translateX = audienceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth + spacing.sm],
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Shot <Text style={styles.titleAccent}>Bildirim</Text>
      </Text>
      <Text style={styles.subtitle}>
        Ekip lideri, ekip üyelerine tek seferlik bilgilendirme mesajı gönderebilir.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Hedef kitle</Text>
        <Text style={styles.sectionCaption}>
          Bildirimin kimlere gideceğini seçin.
        </Text>

        <View
          style={styles.audienceRow}
          onLayout={(e) => setAudienceRowWidth(e.nativeEvent.layout.width)}
        >
          {indicatorWidth > 0 && audience !== 'single_member' && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.audienceActiveIndicator,
                {
                  width: indicatorWidth,
                  transform: [{ translateX }],
                },
              ]}
            />
          )}
          <Pressable
            onPress={() => setAudience('on_shift')}
            style={({ pressed }) => [
              styles.audienceChip,
              pressed && styles.audienceChipPressed,
            ]}
          >
            <Ionicons
              name="flash-outline"
              size={18}
              color={audience === 'on_shift' ? colors.black : colors.accent}
            />
            <Text
              style={[
                styles.audienceChipText,
                audience === 'on_shift' && styles.audienceChipTextActive,
              ]}
            >
              Sadece mesaide olanlar
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setAudience('all')}
            style={({ pressed }) => [
              styles.audienceChip,
              pressed && styles.audienceChipPressed,
            ]}
          >
            <Ionicons
              name="people-circle-outline"
              size={18}
              color={audience === 'all' ? colors.black : colors.accent}
            />
            <Text
              style={[
                styles.audienceChipText,
                audience === 'all' && styles.audienceChipTextActive,
              ]}
            >
              Tüm ekip üyeleri
            </Text>
          </Pressable>

        </View>
        <View style={styles.audienceRowSingle}>
          <Pressable
            onPress={() => setAudience('single_member')}
            style={({ pressed }) => [
              styles.singleAudienceChip,
              audience === 'single_member' && styles.singleAudienceChipActive,
              pressed && styles.audienceChipPressed,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={audience === 'single_member' ? colors.black : colors.accent}
            />
            <Text
              style={[
                styles.audienceChipText,
                audience === 'single_member' && styles.audienceChipTextActive,
              ]}
            >
              Belirli bir üye
            </Text>
          </Pressable>
        </View>

        {audience === 'single_member' && (
          <View style={styles.singleMemberSection}>
            <Text style={styles.singleMemberTitle}>Ekip üyesi seçin</Text>
            <View style={styles.memberPickerRow}>
              {memberOptions.map((member) => {
                const active = selectedMemberId === member.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => setSelectedMemberId(member.id)}
                    style={({ pressed }) => [
                      styles.memberChip,
                      active && styles.memberChipActive,
                      pressed && styles.audienceChipPressed,
                    ]}
                  >
                    <View style={[styles.memberAvatarWrap, active && styles.memberAvatarWrapActive]}>
                      <Avatar source={member.photo} name={member.label} size={36} />
                    </View>
                    <View style={styles.memberMeta}>
                      <Text
                        style={[styles.memberChipText, active && styles.memberChipTextActive]}
                        numberOfLines={1}
                      >
                        {member.label}
                      </Text>
                    </View>
                    {active && (
                      <View style={styles.memberChipCheck}>
                        <Ionicons name="checkmark" size={14} color={colors.black} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Input
          label="Shot metni"
          placeholder="Örn: Öğle rush’ında double shot kullanmayı unutmayın."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
        />

        <Button
          title="Bildirim gönder"
          fullWidth
          onPress={handleSend}
          loading={sending}
          style={styles.sendButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: 4 },
  titleAccent: { color: colors.accent },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  audienceRow: {
    position: 'relative',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audienceActiveIndicator: {
    position: 'absolute',
    left: 2,
    top: 2,
    bottom: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  audienceChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'transparent',
  },
  audienceRowSingle: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  singleAudienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  singleAudienceChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  audienceChipPressed: {
    opacity: 0.9,
  },
  audienceChipText: {
    ...typography.small,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  audienceChipTextActive: {
    color: colors.black,
  },
  sendButton: {
    marginTop: spacing.md,
  },
  singleMemberSection: {
    marginBottom: spacing.sm,
  },
  singleMemberTitle: {
    ...typography.small,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontFamily: fonts.medium,
  },
  memberPickerRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  memberChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245, 197, 24, 0.18)',
  },
  memberAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  memberAvatarWrapActive: {
    borderColor: colors.accent,
  },
  memberMeta: {
    flex: 1,
    minWidth: 0,
  },
  memberChipText: {
    ...typography.small,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
  memberChipTextActive: {
    color: colors.accent,
  },
  memberChipCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  singleMemberHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});

