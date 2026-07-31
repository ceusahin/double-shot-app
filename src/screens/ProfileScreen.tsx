import React, { useState, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Button, Input } from '../components';
import { AuthScreenRoot, AuthFormCard } from './auth/AuthChrome';
import { useAuthStore } from '../store/authStore';
import {
  signOut,
  getProfile,
  uploadProfilePhoto,
  updateProfile,
  updateAuthEmail,
  updatePassword,
} from '../services/auth';
import { getMyRolesSummary } from '../services/rbac';
import { isPlatformStaff, sumQuotaBalances } from '../services/platformAdmin';
import { useDefaultTeam } from '../hooks/useDefaultTeam';
import { colors, spacing, typography, fonts, borderRadius } from '../utils/theme';
import { themedAlert } from '../utils/themedAlert';

const MIN_PASSWORD_LENGTH = 6;
const PROFILE_PHOTO_PICKER_QUALITY = 0.72;

type SettingsView = 'main' | 'account-menu' | 'app-settings' | 'personal' | 'email' | 'password';

export function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const staff = isPlatformStaff(user);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [defaultTeamSaving, setDefaultTeamSaving] = useState(false);

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState('');

  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const {
    teams: defaultTeams,
    defaultTeamId,
    setDefaultTeamId,
    isLoading: defaultTeamLoading,
  } = useDefaultTeam();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setShowSettingsModal(true)} style={styles.headerSettingsBtn} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const {
    data: roleData,
    isPending: rolesPending,
  } = useQuery({
    queryKey: ['my-roles', user?.id],
    queryFn: () => getMyRolesSummary(user!.id),
    enabled: !!user?.id,
  });
  const roleSummaries = roleData ?? [];
  const rolesStatLoading = !!user?.id && rolesPending && roleSummaries.length === 0;
  const myTeams = defaultTeams;

  useEffect(() => {
    if (showSettingsModal && user) {
      setSettingsView('main');
      setEmail(user.email ?? '');
      setName(user.name ?? '');
      setSurname(user.surname ?? '');
      setPersonalError('');
      setEmailError('');
      setPasswordError('');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    }
  }, [showSettingsModal, user]);

  if (!user) return null;

  const quotaTotal = staff ? null : sumQuotaBalances(user);

  const handleSavePersonal = async () => {
    setPersonalError('');
    const trimmedName = name.trim();
    const trimmedSurname = surname.trim();
    setPersonalSaving(true);
    try {
      await updateProfile(user.id, { name: trimmedName, surname: trimmedSurname });
      const updated = await getProfile(user.id);
      if (updated) setUser(updated);
      themedAlert('Kaydedildi', 'Kişisel bilgileriniz güncellendi.');
    } catch (e) {
      setPersonalError(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('E-posta gerekli.');
      return;
    }
    setEmailSaving(true);
    try {
      await updateAuthEmail(trimmedEmail);
      await updateProfile(user.id, { email: trimmedEmail });
      const updated = await getProfile(user.id);
      if (updated) setUser(updated);
      themedAlert('Kaydedildi', 'E-posta adresiniz güncellendi.');
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword.trim()) {
      setPasswordError('Mevcut şifre girin.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('Yeni şifreler eşleşmiyor.');
      return;
    }
    setPasswordSaving(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      themedAlert('Şifre değişti', 'Yeni şifrenizle giriş yapabilirsiniz.');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Şifre değiştirilemedi.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const closeModal = () => {
    setShowSettingsModal(false);
    setSettingsView('main');
  };

  const modalTitle =
    settingsView === 'main'
      ? 'Ayarlar'
      : settingsView === 'account-menu'
        ? 'Hesap Ayarları'
        : settingsView === 'app-settings'
          ? 'Uygulama ayarları'
          : settingsView === 'personal'
            ? 'Kişisel bilgileri güncelle'
            : settingsView === 'email'
              ? 'Mail güncelle'
              : 'Şifre değiştir';

  const showBack = settingsView !== 'main';

  const displayName = [user.name, user.surname].filter(Boolean).join(' ') || user.email;

  const pickAndUploadPhoto = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      themedAlert('İzin gerekli', 'Profil fotoğrafı eklemek için galeri erişimine izin verin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: PROFILE_PHOTO_PICKER_QUALITY,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoLoading(true);
    try {
      const asset = result.assets[0];
      await uploadProfilePhoto(user.id, asset.uri);
      const updated = await getProfile(user.id);
      if (updated) setUser(updated);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      themedAlert('Fotoğraf yüklenemedi', message);
    } finally {
      setPhotoLoading(false);
    }
  };

  const goBackInModal = () => {
    if (settingsView === 'account-menu' || settingsView === 'app-settings') {
      setSettingsView('main');
    } else if (settingsView === 'personal' || settingsView === 'email' || settingsView === 'password') {
      setSettingsView('account-menu');
    }
  };

  const handleSelectDefaultTeam = async (teamId: string) => {
    if (teamId === defaultTeamId || defaultTeamSaving) return;
    setDefaultTeamSaving(true);
    try {
      await setDefaultTeamId(teamId);
    } catch (e) {
      themedAlert('Hata', e instanceof Error ? e.message : 'Varsayılan ekip kaydedilemedi.');
    } finally {
      setDefaultTeamSaving(false);
    }
  };

  return (
    <>
      <AuthScreenRoot>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>Hesabım</Text>

          <View style={styles.heroBlock}>
            <Pressable onPress={pickAndUploadPhoto} disabled={photoLoading} style={styles.avatarPressable}>
              <Avatar
                source={user.profile_photo}
                name={displayName}
                size={96}
                style={styles.avatarWrap}
              />
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={18} color={colors.bgDark} />
              </View>
              {photoLoading && (
                <View style={styles.avatarLoading}>
                  <Text style={styles.avatarLoadingText}>Yükleniyor…</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.nameGroup}>
              <Text style={styles.nameLine}>{displayName}</Text>
            </View>

            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={17} color={colors.textMuted} />
              <Text style={styles.emailText} numberOfLines={2}>
                {user.email}
              </Text>
            </View>
            {user.created_at ? (
              <Text style={styles.memberSince}>
                Üyelik{' '}
                {new Date(user.created_at).toLocaleDateString('tr-TR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            ) : null}
          </View>

          <AuthFormCard style={styles.metricsCard}>
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Text style={styles.metricsCardTitle}>Özet</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricCell}>
                {rolesStatLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.metricValue}>{roleSummaries.length}</Text>
                )}
                <Text style={styles.metricLabel}>Aktif rol</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>{myTeams.length}</Text>
                <Text style={styles.metricLabel}>Ekip üyeliği</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>{staff ? '—' : quotaTotal ?? 0}</Text>
                <Text style={styles.metricLabel}>{staff ? 'Kota' : 'Kalan kota'}</Text>
              </View>
            </View>
            {staff ? (
              <Text style={styles.metricsHint}>Platform hesabında ekip kotası uygulanmaz.</Text>
            ) : null}
          </AuthFormCard>

          <Text style={styles.footerHint}>
            Ayarlar menüsünden e-posta, şifre ve kişisel bilgilerinizi güncelleyebilirsiniz.
          </Text>
        </ScrollView>
      </AuthScreenRoot>

      <Modal visible={showSettingsModal} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              {showBack ? (
                <Pressable onPress={goBackInModal} hitSlop={12}>
                  <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
              ) : (
                <View style={styles.modalHeaderBackPlaceholder} />
              )}
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Pressable onPress={closeModal} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            {settingsView === 'main' && (
              <View style={styles.settingsMainButtons}>
                <Button
                  title="Hesap Ayarları"
                  onPress={() => setSettingsView('account-menu')}
                  variant="outline"
                  fullWidth
                  style={styles.settingsMainBtn}
                />
                <Button
                  title="Uygulama ayarları"
                  onPress={() => setSettingsView('app-settings')}
                  variant="outline"
                  fullWidth
                  style={styles.settingsMainBtn}
                />
                <Button
                  title="Çıkış"
                  onPress={() => {
                    closeModal();
                    signOut();
                  }}
                  variant="outline"
                  fullWidth
                  style={[styles.settingsMainBtn, styles.logoutBtn]}
                  textStyle={styles.logoutText}
                />
              </View>
            )}

            {settingsView === 'app-settings' && (
              <ScrollView
                style={styles.appSettingsScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.appSettingsSectionLabel}>Varsayılan ekip</Text>
                <Text style={styles.appSettingsHint}>
                  Ana sayfada gösterilecek ekibi seçin. Tek ekibe üyeyseniz otomatik olarak o ekip
                  kullanılır.
                </Text>
                {defaultTeamLoading ? (
                  <ActivityIndicator color={colors.accent} style={styles.appSettingsLoading} />
                ) : myTeams.length === 0 ? (
                  <Text style={styles.appSettingsEmpty}>Henüz bir ekibe üye değilsiniz.</Text>
                ) : (
                  <View style={styles.teamPickerList}>
                    {myTeams.map((team) => {
                      const selected = team.id === defaultTeamId;
                      const locked = myTeams.length === 1;
                      return (
                        <Pressable
                          key={team.id}
                          onPress={() => handleSelectDefaultTeam(team.id)}
                          disabled={locked || defaultTeamSaving}
                          style={({ pressed }) => [
                            styles.teamPickerRow,
                            selected && styles.teamPickerRowSelected,
                            pressed && !locked && styles.teamPickerRowPressed,
                          ]}
                        >
                          <View style={styles.teamPickerIconWrap}>
                            <Ionicons
                              name="people-outline"
                              size={18}
                              color={selected ? colors.accent : colors.textMuted}
                            />
                          </View>
                          <View style={styles.teamPickerTextCol}>
                            <Text
                              style={[
                                styles.teamPickerName,
                                selected && styles.teamPickerNameSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {team.name}
                            </Text>
                            {locked ? (
                              <Text style={styles.teamPickerMeta}>Tek ekip · otomatik seçili</Text>
                            ) : selected ? (
                              <Text style={styles.teamPickerMeta}>Ana sayfada gösteriliyor</Text>
                            ) : null}
                          </View>
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                          ) : (
                            <View style={styles.teamPickerRadio} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            )}

            {settingsView === 'account-menu' && (
              <View style={styles.settingsMainButtons}>
                <Button
                  title="Kişisel bilgileri güncelle"
                  onPress={() => setSettingsView('personal')}
                  variant="outline"
                  fullWidth
                  style={styles.settingsMainBtn}
                />
                <Button
                  title="Mail güncelle"
                  onPress={() => setSettingsView('email')}
                  variant="outline"
                  fullWidth
                  style={styles.settingsMainBtn}
                />
                <Button
                  title="Şifre değiştir"
                  onPress={() => setSettingsView('password')}
                  variant="outline"
                  fullWidth
                  style={styles.settingsMainBtn}
                />
              </View>
            )}

            {(settingsView === 'personal' || settingsView === 'email' || settingsView === 'password') && (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.settingsFormWrap}
              >
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {settingsView === 'personal' && (
                    <>
                      <Input
                        label="Ad"
                        value={name}
                        onChangeText={setName}
                        containerStyle={styles.settingsInput}
                      />
                      <Input
                        label="Soyad"
                        value={surname}
                        onChangeText={setSurname}
                        containerStyle={styles.settingsInput}
                      />
                      {personalError ? <Text style={styles.formError}>{personalError}</Text> : null}
                      <Button
                        title="Güncelle"
                        onPress={handleSavePersonal}
                        disabled={personalSaving}
                        fullWidth
                        style={styles.settingsUpdateBtn}
                      />
                    </>
                  )}
                  {settingsView === 'email' && (
                    <>
                      <Input
                        label="E-posta"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        containerStyle={styles.settingsInput}
                      />
                      {emailError ? <Text style={styles.formError}>{emailError}</Text> : null}
                      <Button
                        title="Güncelle"
                        onPress={handleSaveEmail}
                        disabled={emailSaving}
                        fullWidth
                        style={styles.settingsUpdateBtn}
                      />
                    </>
                  )}
                  {settingsView === 'password' && (
                    <>
                      <Input
                        label="Mevcut şifre"
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        containerStyle={styles.settingsInput}
                      />
                      <Input
                        label="Yeni şifre"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        placeholder={`En az ${MIN_PASSWORD_LENGTH} karakter`}
                        containerStyle={styles.settingsInput}
                      />
                      <Input
                        label="Yeni şifre (tekrar)"
                        value={newPasswordConfirm}
                        onChangeText={setNewPasswordConfirm}
                        secureTextEntry
                        containerStyle={styles.settingsInput}
                      />
                      {passwordError ? <Text style={styles.formError}>{passwordError}</Text> : null}
                      <Button
                        title="Güncelle"
                        onPress={handleChangePassword}
                        disabled={passwordSaving}
                        fullWidth
                        style={styles.settingsUpdateBtn}
                      />
                    </>
                  )}
                </ScrollView>
              </KeyboardAvoidingView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
  },
  kicker: {
    ...typography.small,
    color: colors.accent,
    fontFamily: fonts.semibold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heroLead: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarPressable: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  avatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDark,
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoadingText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
  nameGroup: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nameLine: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  emailText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'center',
  },
  memberSince: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  metricsCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  metricsCardTitle: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  metricLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  metricsHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  headerSettingsBtn: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalHeaderBackPlaceholder: {
    width: 24,
    height: 24,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  settingsMainButtons: {
    gap: spacing.md,
  },
  settingsMainBtn: {
    marginBottom: 0,
  },
  settingsFormWrap: {
    maxHeight: 400,
  },
  settingsInput: {
    marginBottom: spacing.sm,
  },
  settingsUpdateBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  formError: {
    ...typography.small,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  logoutBtn: {
    borderColor: 'rgba(255, 80, 80, 0.35)',
    marginTop: spacing.sm,
  },
  logoutText: { color: '#ff8a8a' },
  appSettingsScroll: {
    maxHeight: 420,
  },
  appSettingsSectionLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  appSettingsHint: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  appSettingsLoading: {
    marginVertical: spacing.lg,
  },
  appSettingsEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  teamPickerList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  teamPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  teamPickerRowSelected: {
    borderColor: 'rgba(212, 175, 55, 0.45)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  teamPickerRowPressed: {
    opacity: 0.88,
  },
  teamPickerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamPickerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  teamPickerName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  teamPickerNameSelected: {
    color: colors.textPrimary,
  },
  teamPickerMeta: {
    ...typography.small,
    color: colors.accent,
    marginTop: 2,
  },
  teamPickerRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
