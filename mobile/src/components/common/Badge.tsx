import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, getBiasColor } from '../../theme';

interface Props {
  label: string;
  color?: string;
  variant?: 'solid' | 'outline';
  size?: 'sm' | 'md';
}

export default function Badge({ label, color, variant = 'solid', size = 'sm' }: Props) {
  const c = color ?? theme.colors.primary;
  const fontSize = size === 'sm' ? theme.typography.xs : theme.typography.sm;
  const px = size === 'sm' ? theme.spacing.sm : theme.spacing.md;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variant === 'solid' ? c + '22' : 'transparent',
          borderColor: c + '66',
          paddingHorizontal: px,
        },
      ]}>
      <Text style={[styles.text, { color: c, fontSize }]}>{label}</Text>
    </View>
  );
}

export function BiasBadge({ bias }: { bias: string }) {
  return <Badge label={bias} color={getBiasColor(bias)} />;
}

export function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    Low: theme.colors.success,
    Medium: theme.colors.warning,
    High: theme.colors.danger,
  };
  return <Badge label={risk} color={colors[risk] ?? theme.colors.textSecondary} />;
}

export function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    'STRONG BUY': theme.colors.success,
    'BUY': '#34D399',
    'WEAK BUY': '#6EE7B7',
    'NEUTRAL': theme.colors.textSecondary,
    'WEAK SELL': '#FCA5A5',
    'SELL': theme.colors.danger,
    'STRONG SELL': '#B91C1C',
    'BUILDING MOMENTUM': theme.colors.warning,
  };
  return (
    <Badge
      label={signal}
      color={colors[signal?.toUpperCase()] ?? theme.colors.textMuted}
      size="md"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: theme.typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
