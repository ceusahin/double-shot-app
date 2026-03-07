/**
 * DOUBLE SHOT - Tasarım sistemi (kahve paleti)
 */

export const colors = {
  primary: '#6F4E37',
  secondary: '#C4A484',
  background: '#F7F6F4',
  accent: '#2F2F2F',
  white: '#FFFFFF',
  black: '#000000',
  success: '#2D6A4F',
  warning: '#E9C46A',
  error: '#E76F51',
  text: '#2F2F2F',
  textMuted: '#6B6B6B',
  border: '#E5E0D8',
  cardBg: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const LEVEL_ORDER: Record<string, number> = {
  Beginner: 0,
  'Junior Barista': 1,
  Barista: 2,
  'Senior Barista': 3,
  'Head Barista': 4,
};

export const XP_PER_LEVEL = 500; // Her seviye için gereken XP
