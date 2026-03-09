import React, { useState, useLayoutEffect, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Card, Button, ProgressBar, Input } from '../components';
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
import { getTrainingProgress, getGlobalTrainings } from '../services/training';
import { colors, spacing, typography, fonts, XP_PER_LEVEL, LEVEL_ORDER } from '../utils/theme';

const MIN_PASSWORD_LENGTH = 6;

type SettingsView = 'main' | 'account-menu' | 'personal' | 'email' | 'password';

export function ProfileScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [photoLoading, setPhotoLoading] = useState(false);

  // Kişisel bilgiler (ad, soyad)
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState('');

  // Mail
  const [email, setEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Şifre
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setShowSettingsModal(true)} style={styles.headerSettingsBtn} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const { data: roleSummaries = [] } = useQuery({
    queryKey: ['my-roles', user?.id],
    queryFn: () => getMyRolesSummary(user!.id),
    enabled: !!user?.id,
  });

  const { data: progressList = [] } = useQuery({
    queryKey: ['training-progress', user?.id],
    queryFn: () => getTrainingProgress(user!.id),
    enabled: !!user?.id,
  });

  const { data: trainingsList = [] } = useQuery({
    queryKey: ['global-trainings'],
    queryFn: getGlobalTrainings,
  });

  const badges = useMemo(() => {
    const completed = progressList.filter((p) => p.completed);
    return completed.map((p) => {
      const training = trainingsList.find((t) => t.id === p.training_id);
      return { id: p.id, title: training?.title ?? 'Eğitim', score: p.score };
    });
  }, [progressList, trainingsList]);

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

  const handleSavePersonal = async () => {
    setPersonalError('');
    const trimmedName = name.trim();
    const trimmedSurname = surname.trim();
    setPersonalSaving(true);
    try {
      await updateProfile(user.id, { name: trimmedName, surname: trimmedSurname });
      const updated = await getProfile(user.id);
      if (updated) setUser(updated);
      Alert.alert('Kaydedildi', 'Kişisel bilgileriniz güncellendi.');
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
      Alert.alert('Kaydedildi', 'E-posta adresiniz güncellendi.');
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
      Alert.alert('Şifre değişti', 'Yeni şifrenizle giriş yapabilirsiniz.');
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
        : settingsView === 'personal'
          ? 'Kişisel bilgileri güncelle'
          : settingsView === 'email'
            ? 'Mail güncelle'
            : 'Şifre değiştir';

  const showBack = settingsView !== 'main';

  const displayName = [user.name, user.surname].filter(Boolean).join(' ') || user.email;
  const xpInLevel = user.experience_points % XP_PER_LEVEL;
  const progress = xpInLevel / XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInLevel;
  const levelOrderKeys = Object.keys(LEVEL_ORDER);
  const currentLevelIndex = levelOrderKeys.indexOf(user.level);
  const isMaxLevel = currentLevelIndex >= levelOrderKeys.length - 1;

  const pickAndUploadPhoto = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Profil fotoğrafı eklemek için galeri erişimine izin verin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    setPhotoLoading(true);
    try {
      const asset = result.assets[0];
      const url = await uploadProfilePhoto(user.id, asset.uri, asset.base64 ?? undefined);
      const updated = await getProfile(user.id);
      if (updated) setUser(updated);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Fotoğraf yüklenemedi', message);
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={pickAndUploadPhoto}
            disabled={photoLoading}
            style={styles.avatarPressable}
          >
            <Avatar
              source={user.profile_photo}
              name={displayName}
              size={88}
              style={styles.avatarWrap}
            />
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={20} color={colors.bgDark} />
            </View>
            {photoLoading && (
              <View style={styles.avatarLoading}>
                <Text style={styles.avatarLoadingText}>Yükleniyor…</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.level}>{user.level}</Text>
          <ProgressBar
            progress={progress}
            label={`${user.experience_points} XP`}
            showLabel
            style={styles.progress}
          />
          <Text style={styles.xpToNext}>
            {isMaxLevel
              ? 'Maksimum seviye'
              : `Sonraki seviyeye ${xpToNextLevel} puan kaldı`}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{user.experience_points}</Text>
            <Text style={styles.statLabel}>Puan</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Eğitim</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Pratik</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Kazanılan Rozetler</Text>
        {badges.length === 0 ? (
          <Card style={styles.badgesCard}>
            <View style={styles.badgesEmpty}>
              <Ionicons name="ribbon-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.badgesEmptyText}>Henüz kazanılan rozet yok</Text>
              <Text style={styles.badgesEmptyHint}>Tamamlanan eğitimler burada görünecek.</Text>
            </View>
          </Card>
        ) : (
          <View style={styles.badgesGrid}>
            {badges.map((b) => (
              <Card key={b.id} style={styles.badgeCard}>
                <View style={styles.badgeIconWrap}>
                  <Ionicons name="ribbon" size={28} color={colors.accent} />
                </View>
                <Text style={styles.badgeTitle} numberOfLines={2}>{b.title}</Text>
                {b.score != null && (
                  <Text style={styles.badgeScore}>{b.score} puan</Text>
                )}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              {showBack ? (
                <Pressable onPress={() => setSettingsView(settingsView === 'account-menu' ? 'main' : 'account-menu')} hitSlop={12}>
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
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
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
    right: 0,
    bottom: 0,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoadingText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  name: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  level: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
  },
  progress: {
    marginTop: spacing.md,
    width: 200,
  },
  xpToNext: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  badgesCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
  },
  badgesEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  badgesEmptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  badgesEmptyHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badgeCard: {
    width: '48%',
    minWidth: 140,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  badgeIconWrap: {
    marginBottom: spacing.xs,
  },
  badgeTitle: {
    ...typography.small,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  badgeScore: {
    ...typography.small,
    color: colors.accent,
    marginTop: 2,
  },
  headerSettingsBtn: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    maxHeight: '80%',
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
    maxHeight: 380,
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
    borderColor: 'rgba(255, 50, 50, 0.3)',
    marginTop: spacing.sm,
  },
  logoutText: { color: '#ff6b6b' },
});
