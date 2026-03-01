export const theme = {
  colors: {
    // Backgrounds
    background: '#080D1A',
    surface: '#0D1526',
    card: '#111C30',
    cardElevated: '#172035',
    border: '#1C2B45',
    borderLight: '#243452',

    // Brand
    primary: '#2563EB',
    primaryLight: '#3B82F6',
    primaryDark: '#1D4ED8',

    // Semantic
    success: '#10B981',   // bullish / green
    successBg: '#052E1C',
    danger: '#EF4444',    // bearish / red
    dangerBg: '#2D0C0C',
    warning: '#F59E0B',   // caution / yellow
    warningBg: '#2C1810',
    info: '#06B6D4',

    // Text
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
    textDisabled: '#334155',

    // Chart overlays
    sma20: '#F59E0B',
    sma50: '#2563EB',
    sma200: '#A855F7',
    bbUpper: '#475569',
    bbLower: '#475569',
    rsiLine: '#06B6D4',
    candleUp: '#10B981',
    candleDown: '#EF4444',

    // Options
    callColor: '#10B981',
    putColor: '#EF4444',

    // Bias colors
    bullish: '#10B981',
    bearish: '#EF4444',
    neutral: '#94A3B8',
    volatility: '#F59E0B',

    // Score gradient
    scoreHigh: '#10B981',
    scoreMed: '#F59E0B',
    scoreLow: '#EF4444',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
  },

  typography: {
    // Font sizes
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 34,

    // Font weights (as string for RN)
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 5,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 8,
    },
  },
} as const;

export type Theme = typeof theme;

// Helpers
export const getChangeColor = (change: number) =>
  change > 0 ? theme.colors.success : change < 0 ? theme.colors.danger : theme.colors.textSecondary;

export const getChangeBg = (change: number) =>
  change > 0 ? theme.colors.successBg : change < 0 ? theme.colors.dangerBg : 'transparent';

export const getScoreColor = (score: number) => {
  if (score >= 65) return theme.colors.success;
  if (score >= 40) return theme.colors.warning;
  return theme.colors.danger;
};

export const getBiasColor = (bias: string) => {
  switch (bias?.toUpperCase()) {
    case 'BULLISH': return theme.colors.bullish;
    case 'BEARISH': return theme.colors.bearish;
    case 'VOLATILITY': return theme.colors.volatility;
    default: return theme.colors.neutral;
  }
};
