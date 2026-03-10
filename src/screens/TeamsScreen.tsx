import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input } from '../components';
import { getMyTeams, updateTeamName, closeTeam } from '../services/teams';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';
import type { TeamsStackParamList } from '../navigation/TeamsStack';
import type { Team } from '../types';
import Ionicons from '@expo/vector-icons/Ionicons';

type Nav = StackNavigationProp<TeamsStackParamList, 'TeamsList'>;

/** Çalışan: tek ekip, MANAGER değil → liste gösterme, doğrudan takım sayfasına git */
function isWorkerSingleTeam(teams: { role?: string }[], isLoading: boolean): boolean {
  return !isLoading && teams.length === 1 && teams[0].role !== 'MANAGER';
}

type TeamWithRole = Team & { role: string };

export function TeamsScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
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

  const [editTeam, setEditTeam] = useState<TeamWithRole | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const canEditTeam = (team: TeamWithRole) =>
    team.role === 'MANAGER' || team.owner_id === userId;

  const workerSingleTeam = isWorkerSingleTeam(teams, isLoading);

  const openEditModal = (team: TeamWithRole) => {
    setEditTeam(team);
    setEditName(team.name);
  };

  const handleSaveName = async () => {
    if (!editTeam || !editName.trim()) return;
    setSaving(true);
    try {
      await updateTeamName(editTeam.id, editName.trim());
      queryClient.invalidateQueries({ queryKey: ['my-teams', userId] });
      setEditTeam(null);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Ekip adı güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseTeam = () => {
    if (!editTeam) return;
    Alert.alert(
      'Ekibi sil',
      `"${editTeam.name}" ekibini silmek istediğinize emin misiniz? Ekip listeden kaldırılır.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ekibi sil',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await closeTeam(editTeam.id);
              queryClient.invalidateQueries({ queryKey: ['my-teams', userId] });
              setEditTeam(null);
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Ekip kapatılamadı.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

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
        <Card style={styles.emptyCard}>
          <Text style={styles.placeholder}>
            Henüz bir takıma katılmadınız. Yöneticinizden davet linki alın veya takım oluşturun.
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => (pressed ? [styles.actionCard, styles.actionCardJoin, styles.actionCardPressed] : [styles.actionCard, styles.actionCardJoin])}
              onPress={() => navigation.navigate('JoinTeam', {})}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="link-outline" size={26} color={colors.accent} />
              </View>
              <Text style={styles.actionTitle}>Takıma katıl</Text>
              <Text style={styles.actionSubtitle}>Davet linki ile</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => (pressed ? [styles.actionCard, styles.actionCardCreate, styles.actionCardPressed] : [styles.actionCard, styles.actionCardCreate])}
              onPress={() => navigation.navigate('CreateTeam')}
            >
              <View style={[styles.actionIconWrap, styles.actionIconWrapPrimary]}>
                <Ionicons name="add-circle-outline" size={26} color={colors.bgDark} />
              </View>
              <Text style={styles.actionTitle}>Takım oluştur</Text>
              <Text style={styles.actionSubtitle}>Yeni ekip kur</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <>
          {teams.map((team) => (
            <Card key={team.id} style={styles.teamCard}>
              <Pressable
                style={styles.teamCardMain}
                onPress={() => navigation.navigate('TeamDetail', { team })}
              >
                <View style={styles.teamCardTextWrap}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamRole}>{team.role === 'MANAGER' ? 'Yönetici' : 'Barista'}</Text>
                </View>
                {canEditTeam(team) && (
                  <Pressable
                    style={({ pressed }) => [styles.teamEditBtn, pressed && styles.teamEditBtnPressed]}
                    onPress={() => openEditModal(team)}
                    hitSlop={12}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.accent} />
                  </Pressable>
                )}
              </Pressable>
            </Card>
          ))}
          <View style={styles.actionsSection}>
            <Text style={styles.actionsSectionTitle}>Hızlı işlemler</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => (pressed ? [styles.actionCard, styles.actionCardJoin, styles.actionCardPressed] : [styles.actionCard, styles.actionCardJoin])}
                onPress={() => navigation.navigate('JoinTeam', {})}
              >
                <View style={styles.actionIconWrap}>
                  <Ionicons name="link-outline" size={24} color={colors.accent} />
                </View>
                <Text style={styles.actionTitle}>Takıma katıl</Text>
                <Text style={styles.actionSubtitle}>Davet linki ile</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => (pressed ? [styles.actionCard, styles.actionCardCreate, styles.actionCardPressed] : [styles.actionCard, styles.actionCardCreate])}
                onPress={() => navigation.navigate('CreateTeam')}
              >
                <View style={[styles.actionIconWrap, styles.actionIconWrapPrimary]}>
                  <Ionicons name="add-circle-outline" size={24} color={colors.bgDark} />
                </View>
                <Text style={styles.actionTitle}>Takım oluştur</Text>
                <Text style={styles.actionSubtitle}>Yeni ekip kur</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      <Modal visible={!!editTeam} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ekip düzenle</Text>
              <Pressable
                onPress={() => setEditTeam(null)}
                style={styles.modalCloseBtn}
                hitSlop={16}
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            {editTeam && (
              <>
                <Input
                  label="Ekip adı"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Ekip adını girin"
                  autoCapitalize="words"
                />
                <Button
                  title="Ekip adını güncelle"
                  onPress={handleSaveName}
                  loading={saving}
                  fullWidth
                  style={styles.modalBtn}
                />
                <View style={styles.modalDivider} />
                <Button
                  title="Ekibi sil"
                  onPress={handleCloseTeam}
                  variant="outline"
                  fullWidth
                  disabled={saving}
                  style={StyleSheet.flatten([styles.modalBtn, styles.closeTeamBtn])}
                  textStyle={styles.closeTeamBtnText}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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
    marginBottom: spacing.lg,
  },
  emptyCard: {
    marginBottom: spacing.md,
  },
  actionsSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionsSectionTitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  actionCardJoin: {
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '0C',
  },
  actionCardCreate: {
    borderColor: colors.accent + '60',
    backgroundColor: colors.accent + '18',
  },
  actionCardPressed: {
    opacity: 0.88,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '18',
    marginBottom: spacing.sm,
  },
  actionIconWrapPrimary: {
    backgroundColor: colors.accent,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  btn: {
    marginTop: spacing.sm,
  },
  teamCard: {
    marginBottom: spacing.sm,
  },
  teamCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCardTextWrap: {
    flex: 1,
    minWidth: 0,
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
  teamEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '35',
    marginLeft: spacing.sm,
  },
  teamEditBtnPressed: {
    opacity: 0.85,
    backgroundColor: colors.accent + '22',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: spacing.sm,
  },
  modalClose: {
    fontSize: 22,
    color: colors.textSecondary,
  },
  modalBtn: {
    marginTop: spacing.md,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  closeTeamBtn: {
    borderColor: colors.error + '60',
    backgroundColor: colors.error + '10',
  },
  closeTeamBtnText: {
    color: colors.error,
  },
});
