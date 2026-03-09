import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getNotificationsForMyTeams } from '../services/notifications';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../utils/theme';

type NotificationModalContextValue = {
  openNotificationModal: () => void;
  closeNotificationModal: () => void;
  currentTeamId: string | null;
  setCurrentTeamId: (id: string | null) => void;
};

const NotificationModalContext = createContext<NotificationModalContextValue | null>(null);

export function useNotificationModal() {
  const ctx = useContext(NotificationModalContext);
  if (!ctx) throw new Error('NotificationModalProvider missing');
  return ctx;
}

export function useCurrentTeamId() {
  const ctx = useContext(NotificationModalContext);
  return ctx ? ctx.currentTeamId : null;
}

export function NotificationModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);

  const openNotificationModal = useCallback(() => setVisible(true), []);
  const closeNotificationModal = useCallback(() => setVisible(false), []);

  const userId = useAuthStore((s) => s.user?.id);
  const { data: notifications = [] } = useQuery({
    queryKey: ['my-teams-notifications', userId],
    queryFn: () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid) return [];
      return getNotificationsForMyTeams(uid);
    },
    enabled: visible && !!userId,
  });

  return (
    <NotificationModalContext.Provider
      value={{
        openNotificationModal,
        closeNotificationModal,
        currentTeamId,
        setCurrentTeamId,
      }}
    >
      {children}
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.notifModalBox]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bildirimler</Text>
              <Pressable onPress={closeNotificationModal} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.notifModalScroll}
              contentContainerStyle={styles.notifModalContent}
              showsVerticalScrollIndicator={false}
            >
              {!userId ? (
                <View style={styles.notifEmpty}>
                  <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.placeholder}>Bildirimleri görmek için giriş yapın.</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.placeholder}>Henüz bildirim yok.</Text>
                </View>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={styles.notifCard}>
                    <Text style={styles.notifTeamLabel}>{n.team_name}</Text>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMessage}>{n.message}</Text>
                    <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleString('tr-TR')}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </NotificationModalContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.glassBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  notifModalBox: { maxHeight: '75%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  notifModalScroll: { maxHeight: 400 },
  notifModalContent: { paddingBottom: spacing.lg },
  notifCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifTeamLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  notifMessage: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  notifTime: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  notifEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  placeholder: { ...typography.body, color: colors.textSecondary },
});
