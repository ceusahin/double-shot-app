import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ComponentType } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../utils/theme';

/** Üst stack header ile scroll içeriği arasında, header'a temas ettirmeyen silikleşme yüksekliği. */
export const MAIN_TAB_TOP_SCRIM_HEIGHT = spacing.md;

/**
 * Ana sekme içeriği için sarmalayıcı. Üstte header altına yapışık silikleşme scrim'i var;
 * alttaki dock üstü silikleşme MainTabs içinde tabBarOverlay'in üstüne yerleştiriliyor
 * (buraya değil), çünkü oradan dock konumuna göre kesin hizalama yapabiliyoruz.
 */
export function withTabTransition<P extends object>(Screen: ComponentType<P>) {
  return function TabScreenWithTransition(props: P) {
    return (
      <View style={styles.container}>
        <View style={styles.screenFill}>
          <Screen {...props} />
        </View>
        <View
          style={[styles.topScrim, { height: MAIN_TAB_TOP_SCRIM_HEIGHT }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[colors.bgDark, 'rgba(10, 10, 10, 0)']}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  screenFill: {
    flex: 1,
  },
  topScrim: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
