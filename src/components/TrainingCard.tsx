import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { colors, spacing, typography } from '../utils/theme';

interface TrainingCardProps {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  progress?: number; // 0 - 1
  onPress?: () => void;
}

export function TrainingCard({
  title,
  description,
  imageUrl,
  progress = 0,
  onPress,
}: TrainingCardProps) {
  return (
    <Card onPress={onPress}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>☕</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {progress > 0 && (
          <ProgressBar
            progress={progress}
            showLabel={true}
            height={6}
            style={styles.progress}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 120,
    backgroundColor: colors.border,
  },
  placeholderImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 40,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '600',
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  progress: {
    marginTop: spacing.sm,
  },
});
