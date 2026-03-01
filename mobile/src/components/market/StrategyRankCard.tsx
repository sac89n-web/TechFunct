import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { theme, getChangeColor, getScoreColor } from '../../theme';
import ScoreGauge from '../common/ScoreGauge';
import { SignalBadge } from '../common/Badge';
import type { StrategyRanking } from '../../types';

interface Props {
  item: StrategyRanking;
}

export default function StrategyRankCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = getScoreColor(item.scorePercent);
  const changeColor = getChangeColor(item.changePercent);
  const sign = item.changePercent >= 0 ? '+' : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{item.rank}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          {item.sector && <Text style={styles.sector}>{item.sector}</Text>}
        </View>
        <View style={styles.headerRight}>
          <ScoreGauge score={item.scorePercent} size={56} />
        </View>
      </View>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={styles.price}>
          ₹{item.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </Text>
        <Text style={[styles.change, { color: changeColor }]}>
          {sign}{item.changePercent.toFixed(2)}%
        </Text>
        <SignalBadge signal={item.signal} />
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        {item.rsi != null && (
          <MetricChip label="RSI" value={item.rsi.toFixed(1)} color={theme.colors.info} />
        )}
        {item.volumeRatio != null && (
          <MetricChip
            label="Vol"
            value={`${item.volumeRatio.toFixed(1)}x`}
            color={theme.colors.warning}
          />
        )}
        {item.sma50Distance != null && (
          <MetricChip
            label="SMA50"
            value={`${item.sma50Distance >= 0 ? '+' : ''}${item.sma50Distance.toFixed(1)}%`}
            color={item.sma50Distance >= 0 ? theme.colors.success : theme.colors.danger}
          />
        )}
        {item.goldenCross && (
          <MetricChip label="Golden✦" value="" color="#F59E0B" />
        )}
      </View>

      {/* Strategy tag */}
      <View style={styles.strategyTag}>
        <Text style={styles.strategyTagText}>{item.strategyTag}</Text>
      </View>

      {/* Expanded: targets + factors */}
      {expanded && (
        <View style={styles.expanded}>
          <TargetRow item={item} />
          <FactorList factors={item.factors.filter(f => f.passed).slice(0, 6)} />
        </View>
      )}

      <Text style={styles.expandHint}>{expanded ? '▲ less' : '▼ details'}</Text>
    </TouchableOpacity>
  );
}

function MetricChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color + '44', backgroundColor: color + '11' }]}>
      <Text style={[styles.chipLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      {value ? <Text style={[styles.chipValue, { color }]}>{value}</Text> : null}
    </View>
  );
}

function TargetRow({ item }: { item: StrategyRanking }) {
  return (
    <View style={styles.targetRow}>
      {item.stopLoss && (
        <View style={styles.targetItem}>
          <Text style={styles.targetLabel}>SL</Text>
          <Text style={[styles.targetValue, { color: theme.colors.danger }]}>
            ₹{item.stopLoss.toFixed(0)}
          </Text>
        </View>
      )}
      {item.target1 && (
        <View style={styles.targetItem}>
          <Text style={styles.targetLabel}>T1</Text>
          <Text style={[styles.targetValue, { color: theme.colors.success }]}>
            ₹{item.target1.toFixed(0)}
          </Text>
        </View>
      )}
      {item.target2 && (
        <View style={styles.targetItem}>
          <Text style={styles.targetLabel}>T2</Text>
          <Text style={[styles.targetValue, { color: theme.colors.success }]}>
            ₹{item.target2.toFixed(0)}
          </Text>
        </View>
      )}
      {item.riskReward && (
        <View style={styles.targetItem}>
          <Text style={styles.targetLabel}>R:R</Text>
          <Text style={[styles.targetValue, { color: theme.colors.info }]}>
            {item.riskReward.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

function FactorList({ factors }: { factors: StrategyRanking['factors'] }) {
  return (
    <View style={styles.factorList}>
      <Text style={styles.factorTitle}>Key Factors</Text>
      {factors.map((f, i) => (
        <View key={i} style={styles.factorRow}>
          <Text style={styles.factorDot}>✓</Text>
          <Text style={styles.factorName}>{f.name}</Text>
          <Text style={styles.factorValue}>{f.actualValue}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '22',
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  headerInfo: { flex: 1 },
  symbol: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
  },
  sector: { color: theme.colors.textMuted, fontSize: theme.typography.xs, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  price: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.xl,
    fontWeight: theme.typography.bold,
  },
  change: { fontSize: theme.typography.base, fontWeight: theme.typography.medium },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipLabel: { fontSize: theme.typography.xs },
  chipValue: { fontSize: theme.typography.xs, fontWeight: '600' },
  strategyTag: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  strategyTagText: {
    color: theme.colors.primaryLight,
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.semibold,
  },
  expandHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  expanded: { marginTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  targetRow: { flexDirection: 'row', gap: theme.spacing.xl, flexWrap: 'wrap', marginBottom: theme.spacing.md },
  targetItem: { alignItems: 'center' },
  targetLabel: { color: theme.colors.textMuted, fontSize: theme.typography.xs },
  targetValue: { fontSize: theme.typography.base, fontWeight: theme.typography.semibold },
  factorList: {},
  factorTitle: { color: theme.colors.textSecondary, fontSize: theme.typography.sm, fontWeight: '600', marginBottom: 6 },
  factorRow: { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'flex-start' },
  factorDot: { color: theme.colors.success, fontSize: 12 },
  factorName: { flex: 1, color: theme.colors.textSecondary, fontSize: theme.typography.sm },
  factorValue: { color: theme.colors.textMuted, fontSize: theme.typography.sm },
});
