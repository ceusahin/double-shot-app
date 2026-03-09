/**
 * DOUBLE SHOT - Tasarım (double-shot-main ile uyumlu)
 * Koyu tema, altın vurgu, cam panel hissi
 */

export const colors = {
  // Ana palet (double-shot-main)
  bgDark: '#0A0A0A',
  surface: '#161618',
  surfaceLight: '#2C2C2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A5',
  accent: '#D4AF37',
  accentHover: '#E8C65F',
  copper: '#B87333',
  border: 'rgba(255, 255, 255, 0.08)',
  glassBg: 'rgba(22, 22, 24, 0.92)',
  glassBorder: 'rgba(255, 255, 255, 0.05)',
  // Eski isimlerle uyumluluk
  primary: '#D4AF37',
  secondary: '#2C2C2E',
  background: '#0A0A0A',
  accentDark: '#2F2F2F',
  white: '#FFFFFF',
  black: '#000000',
  success: '#2D6A4F',
  warning: '#E9C46A',
  error: '#EF4444',
  text: '#FFFFFF',
  textMuted: '#A0A0A5',
  cardBg: '#161618',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Uygulama genelinde geçiş animasyon süresi (ms) – tab ve stack geçişleri aynı hızda */
export const TRANSITION_DURATION = 380;

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  full: 9999,
} as const;

/** Outfit font ailesi – tüm metinler sans-serif Outfit kullanır */
export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

export const typography = {
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: fonts.semibold,
  },
  body: {
    fontSize: 18,
    fontFamily: fonts.regular,
  },
  caption: {
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  small: {
    fontSize: 14,
    fontFamily: fonts.regular,
  },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
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

export const XP_PER_LEVEL = 500;
