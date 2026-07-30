import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Button } from '../../components';
import { useAuthStore } from '../../store/authStore';
import {
  listPlatformStaffUsers,
  findUserByEmail,
  promoteToPlatformAdmin,
  revokePlatformAdmin,
} from '../../services/platformAdmin';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../../utils/theme';
import { themedAlert } from '../../utils/themedAlert';
import type { UserProfile } from '../../types';
import { useMainTabScrollPadding } from '../../hooks/useMainTabScrollPadding';

export function PlatformAdminsScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [emailInput, setEmailInput] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['platform-staff-users'],
    queryFn: listPlatformStaffUsers,
  });

  const isSuper = !!user?.is_super_admin;

  const handleAdd = async () => {
    if (!isSuper) return;
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) {
      themedAlert('E-posta', 'Kayıtlı bir kullanıcının e-postasını girin.');
      return;
    }
    setBusy(true);
    try {
      const found = await findUserByEmail(trimmed);
      if (!found) {
        themedAlert('Bulunamadı', 'Bu e-posta ile kayıtlı kullanıcı yok.');
        return;
      }
      if (found.is_super_admin) {
        themedAlert('Bilgi', 'Bu hesap zaten süper yönetici.');
        return;
      }
      if (found.is_platform_admin) {
        themedAlert('Bilgi', 'Bu kullanıcı zaten yönetici olarak atanmış.');
        return;
      }
      await promoteToPlatformAdmin(found.id);
      setEmailInput('');
      await queryClient.invalidateQueries({ queryKey: ['platform-staff-users'] });
      themedAlert('Tamam', 'Kullanıcı yönetici olarak atandı.');
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = (row: UserProfile) => {
    if (!isSuper) return;
    if (row.is_super_admin) {
      themedAlert('Bilgi', 'Süper yönetici rolü uygulama içinden kaldırılamaz.');
      return;
    }
    if (row.id === user?.id) {
      themedAlert('Bilgi', 'Kendi yöneticilik yetkinizi buradan kaldıramazsınız.');
      return;
    }
    themedAlert(
      'Yetkiyi kaldır',
      `${row.email} kullanıcısının yönetici yetkisini kaldırmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await revokePlatformAdmin(row.id);
              await queryClient.invalidateQueries({ queryKey: ['platform-staff-users'] });
            } catch (e) {
              themedAlert('Hata', e instanceof Error ? e.message : 'İşlem başarısız');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: tabScrollBottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.22)', 'rgba(10, 10, 10, 0.35)', colors.bgDark]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.heroGradient,
          {
            marginHorizontal: -spacing.md,
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.heroIconBadge}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.heroEyebrow}>Platform</Text>
        <Text style={styles.heroTitle}>
          Yönetici <Text style={styles.heroTitleAccent}>hesapları</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Süper yönetici yeni yönetici atayabilir. Bu hesaplar Yönetim sekmesine ve operasyon araçlarına erişir.
        </Text>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Hesaplar yükleniyor…</Text>
        </View>
      ) : (
        <>
          {isSuper ? (
            <View style={styles.panelShell}>
              <View style={styles.panelGoldCap} />
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.1)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={styles.panelInner}>
                <Text style={styles.sectionEyebrow}>Yeni atama</Text>
                <Text style={styles.label}>Kayıtlı kullanıcı e-postası</Text>
                <TextInput
                  style={styles.input}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="ornek@email.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <Button title="Yönetici yap" onPress={handleAdd} loading={busy} fullWidth />
              </View>
            </View>
          ) : null}

          <Text style={styles.listEyebrow}>Mevcut hesaplar</Text>
          {staff.map((row) => {
            const displayName = [row.name, row.surname].filter(Boolean).join(' ') || row.email || '—';
            return (
              <View key={row.id} style={styles.rowPanel}>
                <View style={styles.panelGoldCap} />
                <LinearGradient
                  colors={['rgba(212, 175, 55, 0.06)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <View style={styles.rowPanelInner}>
                  <View style={styles.rowTop}>
                    <Avatar source={row.profile_photo} name={displayName} size={48} style={styles.avatar} />
                    <View style={styles.rowText}>
                      <Text style={styles.name}>
                        {[row.name, row.surname].filter(Boolean).join(' ') || '—'}
                      </Text>
                      <Text style={styles.email}>{row.email}</Text>
                    </View>
                    <View style={styles.badges}>
                      {row.is_super_admin ? <Text style={styles.badgeSuper}>Süper</Text> : null}
                      {row.is_platform_admin ? <Text style={styles.badgeAdmin}>Yönetici</Text> : null}
                    </View>
                  </View>
                  {isSuper && row.is_platform_admin && !row.is_super_admin ? (
                    <Pressable
                      style={({ pressed }) => [styles.revokeBtn, pressed && styles.revokeBtnPressed]}
                      onPress={() => handleRevoke(row)}
                      disabled={busy}
                    >
                      <Text style={styles.revokeText}>Yetkiyi kaldır</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}

          {staff.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} style={styles.emptyIcon} />
              <Text style={styles.empty}>Henüz kayıtlı yönetici yok.</Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { padding: spacing.md, paddingBottom: 0 },
  heroGradient: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTitleAccent: { color: colors.accent },
  heroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: '98%',
  },
  loadingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    ...shadow.sm,
  },
  loadingText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  panelShell: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  panelGoldCap: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  panelInner: { padding: spacing.lg },
  sectionEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  label: { ...typography.small, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontFamily: fonts.regular,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  listEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  rowPanel: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBg,
    overflow: 'hidden',
    ...shadow.md,
  },
  rowPanelInner: { padding: spacing.md },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: { flexShrink: 0 },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...typography.subtitle, color: colors.textPrimary },
  email: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badgeSuper: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  badgeAdmin: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  revokeBtn: { marginTop: spacing.md, alignSelf: 'flex-start', paddingVertical: 6 },
  revokeBtnPressed: { opacity: 0.7 },
  revokeText: { ...typography.small, color: colors.error, fontFamily: fonts.semibold },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyIcon: { marginBottom: spacing.md, opacity: 0.7 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
