import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Card, TrainingCard } from '../components';
import { useAuthStore } from '../store/authStore';
import { getLatestTip } from '../services/tips';
import { colors, spacing, typography } from '../utils/theme';

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const parentNav = navigation.getParent?.();
  const { data: tip } = useQuery({
    queryKey: ['tip'],
    queryFn: getLatestTip,
  });

  const goToRecipes = () => navigation.navigate('Recipes');
  const goToTraining = () => navigation.navigate('Training');
  const goToEquipment = () => parentNav?.navigate('Equipment');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greetingLabel}>
        Hoş Geldin, <Text style={styles.greetingAccent}>{user?.name ?? 'Barista'}</Text>
      </Text>

      <Card style={styles.levelCard} padded>
        <Text style={styles.levelLabel}>Güncel Seviyeniz</Text>
        <Text style={styles.levelValue}>{user?.level ?? 'Beginner'}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      <View style={styles.quickGrid}>
        <Card style={styles.quickCard} onPress={goToRecipes}>
          <Text style={styles.cardTitle}>Tarifler</Text>
          <Text style={styles.placeholder}>Global tarif rehberi</Text>
        </Card>
        <Card style={styles.quickCard} onPress={goToTraining}>
          <Text style={styles.cardTitle}>Eğitim</Text>
          <Text style={styles.placeholder}>Akademi modülü</Text>
        </Card>
      </View>

      <Card style={[styles.card, styles.equipmentCard]} onPress={goToEquipment}>
        <Text style={styles.cardTitle}>Makine & Ekipman Rehberi</Text>
        <Text style={styles.placeholder}>Arıza tespiti ve işletme bakımları</Text>
      </Card>

      <Text style={styles.sectionTitle}>Bugünün İpucu</Text>
      <Card style={[styles.card, styles.tipCard]}>
        <Text style={styles.placeholder}>
          {tip?.body ?? 'Mükemmel bir espresso shot için extraction (demleme) süresi ortalama 25–30 saniye arasında olmalıdır.'}
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Bugünkü vardiyan</Text>
      <Card style={styles.card}>
        <Text style={styles.placeholder}>
          Henüz atanmış vardiya yok. Takımınıza katılıp vardiya planına bakın.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Eğitimler</Text>
      <TrainingCard
        title="Espresso Temelleri"
        description="Espresso makinesi ve çekim ayarları"
        progress={0}
        onPress={() => {}}
      />
      <View style={styles.spacer} />
    </ScrollView>
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
  greeting: {
    marginBottom: spacing.lg,
  },
  greetingLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  greetingText: {
    ...typography.title,
    color: colors.textPrimary,
  },
  greetingAccent: { color: colors.accent },
  levelCard: {
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  levelLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelValue: {
    fontSize: 24,
    color: colors.accent,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  placeholder: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickCard: {
    minWidth: '47%',
    flex: 1,
  },
  equipmentCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  tipCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  spacer: {
    height: spacing.xl,
  },
});
