import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Input } from '../../components';
import { colors, spacing, typography, fonts } from '../../utils/theme';
import { themedAlert } from '../../utils/themedAlert';
import { signUpWithEmail } from '../../services/auth';
import { getMyRolesSummary } from '../../services/rbac';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import {
  AuthScreenRoot,
  AuthFormCard,
  authFieldContainerStyle,
  authFieldLabelStyle,
  authFieldInputStyle,
} from './AuthChrome';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'SignUp'>;
};

export function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Ad, e-posta ve şifre gerekli.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await signUpWithEmail(
        email.trim(),
        password,
        name.trim(),
        surname.trim(),
        false
      );
      if (data?.user) {
        if (data.session) {
          const uid = data.session.user?.id ?? data.user.id;
          if (uid) {
            await queryClient.prefetchQuery({
              queryKey: ['my-roles', uid],
              queryFn: () => getMyRolesSummary(uid),
            });
          }
        } else {
          setError('');
          themedAlert(
            'E-postanızı onaylayın',
            'Kayıt başarılı. Giriş yapabilmek için e-posta adresinize gelen onay linkine tıklayın.',
            [{ text: 'Tamam', onPress: () => navigation.goBack() }]
          );
        }
      }
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number };
      let message = err?.message ?? 'Kayıt oluşturulamadı.';
      if (message.includes('already registered') || message.includes('already exists')) {
        message = 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
        navigation.goBack();
      } else if (message.includes('rate limit') || message.includes('email')) {
        message =
          'Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin veya Supabase Dashboard\'da e-posta onayını kapatın.';
      }
      setError(message);
      themedAlert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenRoot>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Image
              source={require('../../../public/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>Hesap oluştur</Text>
            <Text style={styles.subtitle}>Ekibio ile ekibini tek yerden yönet.</Text>
          </View>

          <AuthFormCard>
            <Input
              label="Ad"
              labelStyle={authFieldLabelStyle}
              containerStyle={authFieldContainerStyle}
              style={authFieldInputStyle}
              value={name}
              onChangeText={setName}
              placeholder="Adınız"
              placeholderTextColor="rgba(255,255,255,0.28)"
            />
            <Input
              label="Soyad"
              labelStyle={authFieldLabelStyle}
              containerStyle={authFieldContainerStyle}
              style={authFieldInputStyle}
              value={surname}
              onChangeText={setSurname}
              placeholder="Soyadınız"
              placeholderTextColor="rgba(255,255,255,0.28)"
            />
            <Input
              label="E-posta"
              labelStyle={authFieldLabelStyle}
              containerStyle={authFieldContainerStyle}
              style={authFieldInputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@email.com"
              placeholderTextColor="rgba(255,255,255,0.28)"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Şifre"
              labelStyle={authFieldLabelStyle}
              containerStyle={authFieldContainerStyle}
              style={authFieldInputStyle}
              value={password}
              onChangeText={setPassword}
              placeholder="En az 6 karakter"
              placeholderTextColor="rgba(255,255,255,0.28)"
              secureTextEntry
            />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.error} style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title="Kayıt ol"
              onPress={handleSignUp}
              loading={loading}
              fullWidth
              style={styles.primaryBtn}
            />
          </AuthFormCard>

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>Zaten hesabınız var mı? </Text>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Text style={styles.footerLink}>Giriş yapın</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreenRoot>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg + 2,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg + 4,
  },
  logoImage: {
    width: 88,
    height: 88,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorIcon: { marginTop: 1 },
  errorText: {
    ...typography.caption,
    color: '#FCA5A5',
    flex: 1,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: spacing.xs,
    minHeight: 54,
    borderRadius: 16,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl + 6,
  },
  footerMuted: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 15,
  },
  footerLink: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
