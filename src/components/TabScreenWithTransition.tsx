import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { colors } from '../utils/theme';

const DURATION = 280;
const SLIDE_FRACTION = 0.22;

/**
 * Tab sekmesi odaklandığında içerik aşağıdan yukarı kayarak gelir.
 * useNativeDriver: true ile native thread'de çalışır (daha akıcı).
 */
function getSlideOffset() {
  const { height } = Dimensions.get('window');
  return Math.round(height * SLIDE_FRACTION);
}

const easeOut = Easing.bezier(0.33, 1, 0.68, 1);

export function withTabTransition<P extends object>(Screen: ComponentType<P>) {
  return function TabScreenWithTransition(props: P) {
    const isFocused = useIsFocused();
    const slideOffset = useMemo(() => getSlideOffset(), []);
    const translateY = useRef(new Animated.Value(slideOffset)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: isFocused ? 0 : slideOffset,
          duration: DURATION,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: isFocused ? 1 : 0,
          duration: DURATION,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]).start();
    }, [isFocused, translateY, opacity, slideOffset]);

    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Screen {...props} />
      </Animated.View>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
});
