import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  registerThemedAlertHost,
  unregisterThemedAlertHost,
  type ThemedAlertButton,
  type ThemedAlertPayload,
} from '../utils/themedAlert';
import { colors, spacing, typography, borderRadius, fonts } from '../utils/theme';

/**
 * Kök navigator ile birlikte render edilir; themedAlert() bu host üzerinden gösterilir.
 */
export function ThemedAlertHost() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - spacing.md * 2, 400);
  const [payload, setPayload] = useState<ThemedAlertPayload | null>(null);

  useEffect(() => {
    registerThemedAlertHost(setPayload);
    return () => unregisterThemedAlertHost();
  }, []);

  const close = useCallback(() => {
    setPayload(null);
  }, []);

  const handleBackdrop = useCallback(() => {
    if (!payload || payload.cancelable === false) return;
    const cancelBtn = payload.buttons.find((b) => b.style === 'cancel');
    if (cancelBtn) {
      cancelBtn.onPress?.();
    }
    close();
  }, [payload, close]);

  const handleButton = useCallback(
    (btn: ThemedAlertButton) => {
      btn.onPress?.();
      close();
    },
    [close]
  );

  if (!payload) return null;

  const { title, message, buttons } = payload;
  const twoCol = buttons.length === 2;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (payload.cancelable !== false) handleBackdrop();
      }}
    >
      <Pressable style={styles.backdrop} onPress={handleBackdrop}>
        <Pressable style={[styles.sheet, { maxWidth: maxW, marginBottom: insets.bottom + spacing.md }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.sheetInner}
          >
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>
          <View style={[styles.actions, twoCol && styles.actionsRow]}>
            {buttons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <Pressable
                  key={`${btn.text}-${i}`}
                  onPress={() => handleButton(btn)}
                  style={({ pressed }) => [
                    styles.btn,
                    twoCol && styles.btnHalf,
                    isDestructive && styles.btnDestructive,
                    isCancel && styles.btnCancel,
                    !isDestructive && !isCancel && styles.btnPrimary,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isDestructive && styles.btnTextDestructive,
                      isCancel && styles.btnTextCancel,
                      !isDestructive && !isCancel && styles.btnTextPrimary,
                    ]}
                    numberOfLines={2}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  sheet: {
    width: '100%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  sheetInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 26,
  },
  actions: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  btn: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnHalf: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnCancel: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDestructive: {
    backgroundColor: colors.error + '18',
    borderWidth: 1,
    borderColor: colors.error + '55',
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  btnTextPrimary: {
    color: colors.black,
  },
  btnTextCancel: {
    color: colors.textSecondary,
  },
  btnTextDestructive: {
    color: colors.error,
  },
});
