import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, getChangeColor } from '../../theme';
import type { IndexQuote } from '../../types';

interface Props {
  quote: IndexQuote;
  compact?: boolean;
}

export default function IndexCard({ quote, compact = false }: Props) {
  const changeColor = getChangeColor(quote.changePercent);
  const sign = quote.changePercent >= 0 ? '+' : '';

  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={styles.compactName} numberOfLines={1}>
          {quote.name}
        </Text>
        <Text style={styles.compactPrice}>
          {quote.lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Text>
        <Text style={[styles.compactChange, { color: changeColor }]}>
          {sign}
          {quote.changePercent.toFixed(2)}%
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.name} numberOfLines={1}>
        {quote.name}
      </Text>
      <Text style={styles.price}>
        {quote.lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </Text>
      <View style={styles.changeRow}>
        <Text style={[styles.change, { color: changeColor }]}>
          {sign}
          {quote.change.toFixed(2)}
        </Text>
        <Text style={[styles.changePct, { color: changeColor }]}>
          ({sign}
          {quote.changePercent.toFixed(2)}%)
        </Text>
      </View>
      <View style={styles.ohlcRow}>
        <OHLCItem label="O" value={quote.open} />
        <OHLCItem label="H" value={quote.high} color={theme.colors.success} />
        <OHLCItem label="L" value={quote.low} color={theme.colors.danger} />
        <OHLCItem label="C" value={quote.prevClose} />
      </View>
    </View>
  );
}

function OHLCItem({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.ohlcItem}>
      <Text style={styles.ohlcLabel}>{label}</Text>
      <Text style={[styles.ohlcValue, color ? { color } : null]}>
        {value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  name: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
    marginBottom: 4,
  },
  price: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.xxl,
    fontWeight: theme.typography.bold,
  },
  changeRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  change: { fontSize: theme.typography.base, fontWeight: theme.typography.medium },
  changePct: { fontSize: theme.typography.base },
  ohlcRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  ohlcItem: { flex: 1, alignItems: 'center' },
  ohlcLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    marginBottom: 2,
  },
  ohlcValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
  },
  // Compact
  compact: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    minWidth: 90,
  },
  compactName: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.medium,
    textAlign: 'center',
  },
  compactPrice: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.bold,
    marginTop: 2,
  },
  compactChange: {
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.medium,
  },
});
