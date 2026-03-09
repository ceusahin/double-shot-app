import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { useAuthStore } from '../store/authStore';
import { useNotificationModal } from '../context/NotificationModalContext';
import { navigationRef } from '../navigation/RootNavigator';
import { colors, spacing } from '../utils/theme';

interface HeaderRightWithNotifProps {
  /** Sol tarafta zilden sonra, profilden önce gösterilecek (örn. "Ekibe davet et") */
  extraRight?: React.ReactNode;
}

export function HeaderRightWithNotif({ extraRight }: HeaderRightWithNotifProps) {
  const { openNotificationModal } = useNotificationModal();
  const user = useAuthStore((s) => s.user);
  const displayName = user ? [user.name, user.surname].filter(Boolean).join(' ') || user.email : '';

  const goToProfile = () => {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('Main', { screen: 'Profile' });
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={openNotificationModal} style={styles.iconBtn} hitSlop={12}>
        <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
      </Pressable>
      {extraRight}
      <Pressable onPress={goToProfile} style={styles.profileBtn} hitSlop={12}>
        {user?.profile_photo ? (
          <Avatar source={user.profile_photo} name={displayName} size={44} />
        ) : (
          <Ionicons name="person-outline" size={26} color={colors.textSecondary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  iconBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
