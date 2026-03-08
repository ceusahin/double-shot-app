import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card } from '../components';
import { colors, spacing, typography } from '../utils/theme';

export function ForumScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Topluluk</Text>
      <Card>
        <Text style={styles.placeholder}>
          Global ve takım forumu burada. Soru sorun, teknikleri paylaşın.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  placeholder: {
    ...typography.body,
    color: colors.textMuted,
  },
});
