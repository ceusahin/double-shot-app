import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography } from '../utils/theme';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onComplete());
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete, fadeOut]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <View style={styles.top} />
      <View style={styles.center}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>☕</Text>
        </View>
        <Text style={styles.title}>
          Double<Text style={styles.titleAccent}>Shot</Text>
        </Text>
        <Text style={styles.subtitle}>KAHVEYE DAİR HER ŞEY</Text>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.produced}>produced by baes.</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgDark,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  top: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    gap: 16,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  logoEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 36,
    letterSpacing: -1,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  titleAccent: {
    color: colors.accent,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  produced: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    opacity: 0.7,
  },
});
