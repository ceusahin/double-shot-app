import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LOGIN_SESSION_PREFS_KEY, type LoginSessionPrefs } from '../../auth/loginSessionPrefs';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors, spacing, typography, fonts } from '../../utils/theme';
import { themedAlert } from '../../utils/themedAlert';
import { signInWithEmail, signInWithGoogle } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { getMyRolesSummary } from '../../services/rbac';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import {
  AuthScreenRoot,
  AuthFormCard,
  AuthDivider,
  authFieldContainerStyle,
  authFieldLabelStyle,
  authFieldInputStyle,
} from './AuthChrome';

const DEFAULT_LOGIN_SLOGAN = 'Ekip, shot, günlük ritim.';

function mapLoginError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.toLowerCase();
  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return 'E-posta henüz onaylanmamış. Gelen kutunuzdaki onay bağlantısına tıklayın, ardından tekrar giriş yapın. (Geliştirme için Supabase Dashboard → Authentication → Providers → “Confirm email” kapatılabilir.)';
  }
  if (
    m.includes('invalid login') ||
    m.includes('invalid credentials') ||
    m.includes('invalid_grant')
  ) {
    return 'E-posta veya şifre hatalı. Kayıt olduysanız şifreyi ve e-posta onayını kontrol edin.';
  }
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'Google girişi henüz açık değil. Supabase Dashboard → Authentication → Providers → Google’ı etkinleştirin.';
  }
  if (m.includes('redirect') && m.includes('not allowed')) {
    return 'Redirect URL izin listesinde değil. Supabase → Authentication → URL Configuration’a ekleyin.';
  }
  return raw || 'Giriş yapılamadı.';
}

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Login'>;
};

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** Kapalıyken uygulama yeniden açıldığında oturum silinir; çoğu kullanıcı için açık bırakın. */
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [subtitleText, setSubtitleText] = useState(DEFAULT_LOGIN_SLOGAN);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOGIN_SESSION_PREFS_KEY);
        if (!alive || !raw) return;
        const prefs = JSON.parse(raw) as LoginSessionPrefs;
        if (typeof prefs.rememberMe === 'boolean') {
          setKeepSignedIn(prefs.rememberMe);
        }
        if (prefs.rememberMe && prefs.greetingName?.trim()) {
          setSubtitleText(`Tekrar hoş geldin, ${prefs.greetingName.trim()}.`);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli.');
      return;
    }
    setError('');
    setLoading(true);
    const emailTrim = email.trim();
    const tentativeGreeting = emailTrim.split('@')[0] || 'Merhaba';
    try {
      try {
        await AsyncStorage.setItem(
          LOGIN_SESSION_PREFS_KEY,
          JSON.stringify({
            rememberMe: keepSignedIn,
            greetingName: tentativeGreeting,
          } satisfies LoginSessionPrefs)
        );
      } catch {
        /* ignore */
      }

      await signInWithEmail(emailTrim, password);
      await persistGreetingFromSession(tentativeGreeting);
    } catch (e: unknown) {
      const message = mapLoginError(e);
      setError(message);
      themedAlert('Giriş yapılamadı', message);
    } finally {
      setLoading(false);
    }
  };

  const persistGreetingFromSession = async (tentativeGreeting: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (session?.user) {
      const meta = session.user.user_metadata ?? {};
      const fullName =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        '';
      const given =
        typeof meta.given_name === 'string' ? meta.given_name.trim() : '';
      const firstName = given || (fullName ? fullName.split(/\s+/)[0] : '');
      const greetingName =
        firstName ||
        (session.user.email?.split('@')[0]?.trim() ?? '') ||
        tentativeGreeting;
      try {
        await AsyncStorage.setItem(
          LOGIN_SESSION_PREFS_KEY,
          JSON.stringify({
            rememberMe: keepSignedIn,
            greetingName: greetingName || 'Merhaba',
          } satisfies LoginSessionPrefs)
        );
      } catch {
        /* ignore */
      }
    }
    if (uid) {
      await queryClient.prefetchQuery({
        queryKey: ['my-roles', uid],
        queryFn: () => getMyRolesSummary(uid),
      });
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      try {
        await AsyncStorage.setItem(
          LOGIN_SESSION_PREFS_KEY,
          JSON.stringify({
            rememberMe: keepSignedIn,
            greetingName: 'Merhaba',
          } satisfies LoginSessionPrefs)
        );
      } catch {
        /* ignore */
      }

      const result = await signInWithGoogle();
      if (result.cancelled) {
        themedAlert('Google girişi', 'Giriş iptal edildi.');
        return;
      }
      await persistGreetingFromSession('Merhaba');
    } catch (e: unknown) {
      const message = mapLoginError(e);
      setError(message);
      themedAlert('Google ile giriş yapılamadı', message);
    } finally {
      setGoogleLoading(false);
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
            <Text style={styles.brand}>
              Ekib<Text style={styles.brandAccent}>io</Text>
            </Text>
            <Text style={styles.tagline}>{subtitleText}</Text>
          </View>

          <AuthFormCard>
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
              autoCorrect={false}
            />
            <Input
              label="Şifre"
              labelStyle={authFieldLabelStyle}
              containerStyle={authFieldContainerStyle}
              style={authFieldInputStyle}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.28)"
              secureTextEntry
            />

            <Pressable
              onPress={() => setKeepSignedIn((v) => !v)}
              style={({ pressed }) => [styles.rememberWrap, pressed && styles.rememberPressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: keepSignedIn }}
              accessibilityLabel="Oturumu açık tut"
            >
              <View style={[styles.rememberTrack, keepSignedIn && styles.rememberTrackOn]}>
                <View style={[styles.rememberKnob, keepSignedIn && styles.rememberKnobOn]} />
              </View>
              <Text style={styles.rememberText}>Oturumu açık tut</Text>
            </Pressable>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.error} style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title="Giriş yap"
              onPress={handleLogin}
              loading={loading}
              disabled={googleLoading}
              fullWidth
              style={styles.primaryBtn}
            />

            <AuthDivider />

            <Pressable
              onPress={handleGoogleLogin}
              disabled={googleLoading || loading}
              style={({ pressed }) => [
                styles.googleBtn,
                pressed && !googleLoading && styles.googleBtnPressed,
                (googleLoading || loading) && styles.googleBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Google ile giriş"
              accessibilityState={{ busy: googleLoading, disabled: googleLoading || loading }}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
                  <Text style={styles.googleBtnText}>Google ile devam et</Text>
                </>
              )}
            </Pressable>
          </AuthFormCard>

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>Hesabınız yok mu? </Text>
            <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={12}>
              <Text style={styles.footerLink}>Kayıt olun</Text>
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
    marginBottom: spacing.xl + 4,
  },
  logoImage: {
    width: 108,
    height: 108,
    marginBottom: spacing.md + 2,
  },
  brand: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: spacing.sm,
  },
  brandAccent: {
    color: colors.accent,
  },
  tagline: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  rememberPressed: { opacity: 0.88 },
  rememberTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  rememberTrackOn: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  rememberKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignSelf: 'flex-start',
  },
  rememberKnobOn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
  },
  rememberText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: fonts.medium,
    fontSize: 14,
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
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + 2,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  googleBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl + 4,
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
