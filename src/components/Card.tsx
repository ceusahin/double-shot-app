import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { colors, borderRadius, shadow, spacing } from '../utils/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
  elevated = true,
}: CardProps) {
  const cardStyle = [
    styles.card,
    padded && styles.padded,
    elevated && shadow.md,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[...cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.95,
  },
});
