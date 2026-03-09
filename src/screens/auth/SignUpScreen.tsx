import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Input } from '../../components';
import { colors, borderRadius, spacing, typography } from '../../utils/theme';
import { signUpWithEmail } from '../../services/auth';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
};

export function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [worksAtCafe, setWorksAtCafe] = useState<boolean | null>(null);
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
        worksAtCafe ?? false
      );
      if (data?.user) {
        if (data.session) {
          if (worksAtCafe) {
            navigation.navigate('JoinTeam');
          }
          // else: auth state will switch to Main
        } else {
          setError('');
          Alert.alert(
            'E-postanızı onaylayın',
            'Kayıt başarılı. Giriş yapabilmek için e-posta adresinize gelen onay linkine tıklayın.',
            [{ text: 'Tamam', onPress: () => navigation.navigate('Login') }]
          );
        }
      }
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number };
      let message = err?.message ?? 'Kayıt oluşturulamadı.';
      if (message.includes('already registered') || message.includes('already exists')) {
        message = 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
        navigation.navigate('Login');
      } else if (message.includes('rate limit') || message.includes('email')) {
        message = 'Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin veya Supabase Dashboard\'da e-posta onayını kapatın.';
      }
      setError(message);
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Image source={require('../../../assets/logo.png')} style={[styles.logoImage, { tintColor: colors.accent }]} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Kayıt Ol</Text>
          <Text style={styles.subtitle}>Double Shot ailesine katıl</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Ad"
            value={name}
            onChangeText={setName}
            placeholder="Adınız"
          />
          <Input
            label="Soyad"
            value={surname}
            onChangeText={setSurname}
            placeholder="Soyadınız"
          />
          <Input
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Şifre (min. 6 karakter)"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Text style={styles.question}>Şu an bir kafede çalışıyor musunuz?</Text>
          <View style={styles.radioRow}>
            <Button
              title="Evet"
              onPress={() => setWorksAtCafe(true)}
              variant={worksAtCafe === true ? 'primary' : 'outline'}
              style={styles.radioBtn}
            />
            <Button
              title="Hayır"
              onPress={() => setWorksAtCafe(false)}
              variant={worksAtCafe === false ? 'primary' : 'outline'}
              style={styles.radioBtn}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button
            title="Kayıt Ol"
            onPress={handleSignUp}
            loading={loading}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Button
            title="Zaten hesabım var"
            onPress={() => navigation.navigate('Login')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: 42,
    height: 42,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    marginBottom: spacing.lg,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  question: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  radioBtn: {
    flex: 1,
  },
  errorText: {
    ...typography.caption,
    color: '#FCA5A5',
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  footer: {
    alignItems: 'center',
  },
});
