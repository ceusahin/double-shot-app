import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { colors, spacing, typography } from '../utils/theme';

const CLOCK_SIZE = Math.min(Dimensions.get('window').width - spacing.lg * 2, 280);
const CENTER = CLOCK_SIZE / 2;
const RADIUS = (CLOCK_SIZE / 2) - 28;
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

  const positions = HOURS.map((h) => {
    const angle = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return {
      hour: h,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    };
  });

  return (
    <View style={styles.container}>
      <View style={[styles.clockFace, { width: CLOCK_SIZE, height: CLOCK_SIZE }]}>
        <View style={styles.clockRing} />
        {step === 'hour' && (
          <>
            {positions.map(({ hour: h, x, y }) => (
              <Pressable
                key={h}
                style={[
                  styles.clockDot,
                  {
                    left: x - 18,
                    top: y - 18,
                    backgroundColor: hour === h ? colors.accent : colors.surfaceLight,
                  },
                ]}
                onPress={() => handleHourSelect(h)}
              >
                <Text style={[styles.clockDotText, hour === h && styles.clockDotTextActive]}>{h}</Text>
              </Pressable>
            ))}
            <Text style={styles.stepHint}>Saat seçin (0–23)</Text>
          </>
        )}
        {step === 'minute' && (
          <View style={styles.minuteRow}>
            <Text style={styles.selectedHour}>{hour} saat</Text>
            <Text style={styles.stepHint}>Dakika seçin</Text>
            <View style={styles.minuteChips}>
              {MINUTES.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.minuteChip, minute === m && styles.minuteChipActive]}
                  onPress={() => handleMinuteSelect(m)}
                >
                  <Text style={[styles.minuteChipText, minute === m && styles.minuteChipTextActive]}>
                    :{String(m).padStart(2, '0')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.backBtn} onPress={() => setStep('hour')}>
              <Text style={styles.backBtnText}>← Saati değiştir</Text>
            </Pressable>
          </View>
        )}
      </View>
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
  },
  clockFace: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockRing: {
    position: 'absolute',
    width: CLOCK_SIZE - 24,
    height: CLOCK_SIZE - 24,
    borderRadius: (CLOCK_SIZE - 24) / 2,
    borderWidth: 3,
    borderColor: colors.border,
    top: 12,
    left: 12,
  },
  clockDot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockDotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  clockDotTextActive: {
    color: colors.bgDark,
  },
  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  selectedHour: {
    ...typography.subtitle,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  minuteRow: {
    alignItems: 'center',
  },
  minuteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  minuteChip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 72,
    alignItems: 'center',
  },
  minuteChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  minuteChipText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  minuteChipTextActive: {
    color: colors.accent,
  },
  backBtn: { marginTop: spacing.md },
  backBtnText: { fontSize: 14, color: colors.accent },
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
