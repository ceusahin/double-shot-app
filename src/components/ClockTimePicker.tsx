import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, fonts } from '../utils/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

type Props = {
  value: string;
  onChange: (timeStr: string) => void;
  onClose: () => void;
};

function parseValue(s: string): { hour: number; minute: number } {
  const [h = 0, m = 0] = s.split(':').map(Number);
  return { hour: h, minute: m };
}

export function ClockTimePicker({ value, onChange, onClose }: Props) {
  const { hour: initHour, minute: initMinute } = parseValue(value);
  const [hour, setHour] = useState(initHour);
  const [minute, setMinute] = useState(initMinute);
  const [step, setStep] = useState<'hour' | 'minute'>('hour');

  const commit = (h: number, m: number) => {
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    onClose();
  };

  const handleHourSelect = (h: number) => {
    setHour(h);
    setStep('minute');
  };

  const handleMinuteSelect = (m: number) => {
    setMinute(m);
    commit(hour, m);
  };

  return (
    <View style={styles.container}>
      {step === 'hour' && (
        <>
          <Text style={styles.stepTitle}>Saat seçin</Text>
          <Text style={styles.stepHint}>0–23 arası saat</Text>
          <View style={styles.hourGrid}>
            {HOURS.map((h) => (
              <Pressable
                key={h}
                style={[styles.hourChip, hour === h && styles.hourChipActive]}
                onPress={() => handleHourSelect(h)}
              >
                <Text style={[styles.hourChipText, hour === h && styles.hourChipTextActive]}>
                  {String(h).padStart(2, '0')}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {step === 'minute' && (
        <View style={styles.minuteSection}>
          <Text style={styles.stepTitle}>Dakika seçin</Text>
          <Text style={styles.selectedHour}>{hour} saat</Text>
          <View style={styles.minuteChips}>
            {MINUTES.map((m) => (
              <Pressable
                key={m}
                style={[styles.minuteChip, minute === m && styles.minuteChipActive]}
                onPress={() => handleMinuteSelect(m)}
              >
                <Text style={[styles.minuteChipText, minute === m && styles.minuteChipTextActive]}>
                  {String(m).padStart(2, '0')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.backBtn} onPress={() => setStep('hour')}>
            <Text style={styles.backBtnText}>← Saati değiştir</Text>
          </Pressable>
        </View>
      )}
      <Pressable style={styles.cancelBtn} onPress={onClose}>
        <Text style={styles.cancelBtnText}>İptal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  stepTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 280,
  },
  hourChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '25',
  },
  hourChipText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  hourChipTextActive: {
    color: colors.accent,
  },
  minuteSection: {
    alignItems: 'center',
  },
  selectedHour: {
    ...typography.caption,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  minuteChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  minuteChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
  },
  minuteChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '25',
  },
  minuteChipText: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  minuteChipTextActive: {
    color: colors.accent,
  },
  backBtn: { marginBottom: spacing.sm },
  backBtnText: { fontSize: 14, color: colors.accent, fontFamily: fonts.medium },
  cancelBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelBtnText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
