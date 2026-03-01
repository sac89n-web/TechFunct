import React from 'react';
import type { OptionsMarketMetrics } from '../../types/options';

interface MarketMetricsBarProps {
  metrics: OptionsMarketMetrics;
}

const fmt = (n: number | null, decimals = 2) =>
  n == null ? '—' : n.toFixed(decimals);

const pct = (n: number | null) =>
  n == null ? '—' : `${n.toFixed(1)}%`;

const ivConditionColor = (cond: string) => {
  if (cond === 'IV_HIGH')   return '#f97316';
  if (cond === 'IV_LOW')    return '#3b82f6';
  if (cond === 'IV_NORMAL') return '#22c55e';
  return '#94a3b8';
};

const pcrColor = (pcr: number) => {
  if (pcr > 1.3) return '#22c55e';
  if (pcr < 0.7) return '#ef4444';
  return '#f59e0b';
};

const MarketMetricsBar: React.FC<MarketMetricsBarProps> = ({ metrics }) => (
  <div style={barStyle}>
    <MetricChip label="Spot" value={`₹${metrics.underlyingLTP.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
    <MetricChip label="ATM Strike" value={`₹${metrics.atmStrike.toLocaleString('en-IN')}`} />
    <MetricChip
      label="ATM IV"
      value={pct(metrics.atmIV)}
      valueColor={ivConditionColor(metrics.ivCondition)}
    />
    <MetricChip
      label="IV Percentile"
      value={pct(metrics.ivPercentile)}
      valueColor={ivConditionColor(metrics.ivCondition)}
    />
    <MetricChip
      label="PCR"
      value={fmt(metrics.pcr)}
      valueColor={pcrColor(metrics.pcr)}
    />
    <MetricChip label="Max Pain" value={`₹${metrics.maxPain.toLocaleString('en-IN')}`} />
    <MetricChip label="IV Skew" value={pct(metrics.ivSkew)} />
    <MetricChip label="DTE" value={`${metrics.dte}d`} />
    <div style={ivBadgeStyle(metrics.ivCondition)}>
      {metrics.ivCondition.replace('_', ' ')}
    </div>
  </div>
);

const MetricChip: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label, value, valueColor,
}) => (
  <div style={chipStyle}>
    <span style={chipLabelStyle}>{label}</span>
    <span style={{ ...chipValueStyle, color: valueColor || '#f1f5f9' }}>{value}</span>
  </div>
);

const barStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px 14px',
  marginBottom: '16px',
};

const chipStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: '72px',
  padding: '4px 10px',
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  border: '1px solid #334155',
};

const chipLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '2px',
};

const chipValueStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
};

const ivBadgeStyle = (cond: string): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  backgroundColor: `${ivConditionColor(cond)}22`,
  color: ivConditionColor(cond),
  border: `1px solid ${ivConditionColor(cond)}44`,
});

export default MarketMetricsBar;
