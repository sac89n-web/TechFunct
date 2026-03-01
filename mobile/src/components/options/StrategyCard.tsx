import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme, getBiasColor } from '../../theme';
import { BiasBadge, RiskBadge } from '../common/Badge';
import PayoffGraph from '../charts/PayoffGraph';
import type { OptionStrategy } from '../../types';

interface Props {
  strategy: OptionStrategy;
  onPress?: () => void;
}

export default function OptionStrategyCard({ strategy: s, onPress }: Props) {
  const biasColor = getBiasColor(s.bias);
  const confPct = Math.round(s.confidence);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Rank badge */}
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{s.rank}</Text>
      </View>

      {/* Title row */}
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.type}>{s.strategyType}</Text>
        </View>
        <View style={styles.badges}>
          <BiasBadge bias={s.bias} />
          <RiskBadge risk={s.riskLevel} />
        </View>
      </View>

      {/* Confidence bar */}
      <View style={styles.confRow}>
        <Text style={styles.confLabel}>Confidence</Text>
        <View style={styles.confTrack}>
          <View
            style={[
              styles.confFill,
              { width: `${confPct}%` as any, backgroundColor: biasColor },
            ]}
          />
        </View>
        <Text style={[styles.confValue, { color: biasColor }]}>{confPct}%</Text>
      </View>

      {/* Mini payoff */}
      {s.payoffCurve.length > 1 && (
        <View style={styles.payoff}>
          <PayoffGraph data={s.payoffCurve} width={300} height={80} />
        </View>
      )}

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <MetricItem
          label="Max Profit"
          value={s.isMaxProfitUnlimited ? '∞' : `₹${s.maxProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          color={theme.colors.success}
        />
        <MetricItem
          label="Max Loss"
          value={s.isMaxLossUnlimited ? '∞' : `₹${s.maxLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          color={theme.colors.danger}
        />
        <MetricItem
          label="R:R"
          value={s.riskReward > 0 ? s.riskReward.toFixed(2) : 'N/A'}
          color={theme.colors.info}
        />
        <MetricItem
          label="ROI"
          value={`${s.expectedROI.toFixed(1)}%`}
          color={theme.colors.warning}
        />
      </View>

      {/* Legs chips */}
      <View style={styles.legsRow}>
        {s.legs.map((leg, i) => (
          <View
            key={i}
            style={[
              styles.legChip,
              {
                borderColor:
                  leg.optionType === 'CALL' ? theme.colors.success + '55' : theme.colors.danger + '55',
                backgroundColor:
                  leg.optionType === 'CALL' ? theme.colors.success + '11' : theme.colors.danger + '11',
              },
            ]}>
            <Text
              style={[
                styles.legText,
                {
                  color:
                    leg.action === 'BUY' ? theme.colors.success : theme.colors.danger,
                },
              ]}>
              {leg.action} {leg.strike} {leg.optionType}
            </Text>
          </View>
        ))}
      </View>

      {/* IV condition tag */}
      <Text style={styles.ivTag}>IV: {s.ivCondition}</Text>
    </TouchableOpacity>
  );
}

function MetricItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
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
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: theme.colors.primary + '22',
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
  },
  rankText: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.sm },
  name: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
  },
  type: { color: theme.colors.textMuted, fontSize: theme.typography.sm, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center', marginLeft: 8 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm },
  confLabel: { color: theme.colors.textMuted, fontSize: theme.typography.xs, width: 72 },
  confTrack: { flex: 1, height: 4, backgroundColor: theme.colors.border, borderRadius: 2 },
  confFill: { height: 4, borderRadius: 2 },
  confValue: { fontSize: theme.typography.xs, fontWeight: '600', width: 34, textAlign: 'right' },
  payoff: { marginVertical: theme.spacing.sm, alignSelf: 'center' },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  metric: { alignItems: 'center', flex: 1 },
  metricLabel: { color: theme.colors.textMuted, fontSize: 10, marginBottom: 2 },
  metricValue: { fontSize: theme.typography.sm, fontWeight: '600' },
  legsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm },
  legChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  legText: { fontSize: theme.typography.xs, fontWeight: '600' },
  ivTag: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.xs,
  },
});
