import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography, borderRadius, fonts, shadow } from '../../utils/theme';
import type { TeamsStackParamList } from '../../navigation/TeamsStack';
import { useMainTabScrollPadding } from '../../hooks/useMainTabScrollPadding';

type Nav = StackNavigationProp<TeamsStackParamList, 'ManagementHome'>;

const MENU: {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  target: 'PlatformAdmins' | 'TeamsList' | 'AllMembers';
}[] = [
  {
    key: 'admins',
    title: 'Yönetici hesapları',
    subtitle: 'Uygulama içi yönetici ekle veya kaldır',
    icon: 'shield-checkmark-outline',
    target: 'PlatformAdmins',
  },
  {
    key: 'members',
    title: 'Tüm üyeler',
    subtitle: 'Kayıtlı kullanıcılar; profil için dokunun',
    icon: 'person-outline',
    target: 'AllMembers',
  },
  {
    key: 'teams',
    title: 'Tüm Ekipler',
    subtitle: 'Takım listesi ve ekip detayı',
    icon: 'people-outline',
    target: 'TeamsList',
  },
];

export function ManagementHomeScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollBottomPad = useMainTabScrollPadding();
  const navigation = useNavigation<Nav>();

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
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
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
          <Ionicons name="settings-outline" size={22} color={colors.accent} />
        </View>
        <Text style={styles.heroEyebrow}>Platform</Text>
        <Text style={styles.heroTitle}>
          Yönetim <Text style={styles.heroTitleAccent}>merkezi</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Operasyon ve yönetici araçlarına buradan erişin; ekipler ve üyeler tek akışta.
        </Text>
      </LinearGradient>

      {MENU.map((item) => (
        <View key={item.key} style={styles.menuPanel}>
          <View style={styles.panelGoldCap} />
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.07)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <Pressable
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            onPress={() => {
              if (item.target === 'TeamsList') navigation.navigate('TeamsList');
              else if (item.target === 'AllMembers') navigation.navigate('AllMembers');
              else navigation.navigate('PlatformAdmins');
            }}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={24} color={colors.accent} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>
      ))}
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
  menuPanel: {
    marginBottom: spacing.sm,
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  menuRowPressed: { opacity: 0.9 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  textWrap: { flex: 1, minWidth: 0 },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: fonts.semibold,
  },
  cardSubtitle: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  chevronWrap: {
    opacity: 0.9,
  },
});
