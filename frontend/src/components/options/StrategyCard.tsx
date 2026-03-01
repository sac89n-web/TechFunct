import React from 'react';
import type { OptionStrategy } from '../../types/options';
import MiniPayoffGraph from './MiniPayoffGraph';

interface StrategyCardProps {
  strategy: OptionStrategy;
  onClick: (s: OptionStrategy) => void;
}

const biasColor = (bias: string) => {
  if (bias === 'BULLISH')     return '#22c55e';
  if (bias === 'BEARISH')     return '#ef4444';
  if (bias === 'NEUTRAL')     return '#3b82f6';
  if (bias === 'VOLATILITY')  return '#a855f7';
  return '#94a3b8';
};

const riskColor = (r: string) => {
  if (r === 'Low')    return '#22c55e';
  if (r === 'Medium') return '#f59e0b';
  if (r === 'High')   return '#ef4444';
  return '#94a3b8';
};

const fmt2 = (n: number) => n.toFixed(2);
const fmtK = (n: number) => {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy: s, onClick }) => (
  <div style={cardStyle} onClick={() => onClick(s)}
    onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}>

    {/* Header */}
    <div style={headerStyle}>
      <div>
        <span style={rankStyle}>#{s.rank}</span>
        <span style={nameStyle}>{s.name}</span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <Badge label={s.bias}      color={biasColor(s.bias)} />
        <Badge label={s.riskLevel} color={riskColor(s.riskLevel)} />
      </div>
    </div>

    {/* Confidence bar */}
    <div style={confBarBgStyle}>
      <div style={{ ...confBarFillStyle, width: `${(s.confidence * 100).toFixed(0)}%` }} />
    </div>
    <div style={confLabelStyle}>Confidence: {(s.confidence * 100).toFixed(0)}%</div>

    {/* Payoff chart */}
    <div style={{ margin: '8px 0' }}>
      <MiniPayoffGraph data={s.payoffCurve} width={264} height={72} />
    </div>

    {/* Key metrics */}
    <div style={metricsRowStyle}>
      <Metric
        label="Max Profit"
        value={s.isMaxProfitUnlimited ? 'Unlimited' : fmtK(s.maxProfit)}
        color="#22c55e"
      />
      <Metric
        label="Max Loss"
        value={s.isMaxLossUnlimited ? 'Unlimited' : fmtK(s.maxLoss)}
        color="#ef4444"
      />
      <Metric label="R:R"       value={fmt2(s.riskReward)} />
      <Metric label="ROI"       value={`${fmt2(s.expectedROI)}%`} />
      <Metric label="Margin"    value={fmtK(s.marginRequired)} />
    </div>

    {/* Breakevens */}
    {s.breakEvens.length > 0 && (
      <div style={beStyle}>
        BE: {s.breakEvens.map(be => `₹${be.toLocaleString('en-IN')}`).join(' / ')}
      </div>
    )}

    {/* Legs summary */}
    <div style={legsStyle}>
      {s.legs.map((leg, i) => (
        <span key={i} style={legChipStyle(leg.action)}>
          {leg.action === 'BUY' ? '▲' : '▼'} {leg.optionType} {leg.strike}
        </span>
      ))}
    </div>

    {/* IV condition tag */}
    {s.ivCondition && (
      <div style={ivTagStyle}>{s.ivCondition}</div>
    )}
  </div>
);

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
    background: `${color}22`, color, border: `1px solid ${color}44`,
  }}>{label}</span>
);

const Metric: React.FC<{ label: string; value: string; color?: string }> = ({
  label, value, color,
}) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{label}</div>
    <div style={{ fontSize: '12px', fontWeight: 600, color: color || '#e2e8f0' }}>{value}</div>
  </div>
);

const cardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '10px',
  padding: '14px 16px',
  cursor: 'pointer',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  minWidth: '280px',
  maxWidth: '320px',
  flexShrink: 0,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
};

const rankStyle: React.CSSProperties = {
  fontSize: '11px', color: '#64748b', marginRight: '6px',
};

const nameStyle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: '#f1f5f9',
};

const confBarBgStyle: React.CSSProperties = {
  height: '3px', backgroundColor: '#334155', borderRadius: '2px', marginBottom: '4px',
};

const confBarFillStyle: React.CSSProperties = {
  height: '100%', backgroundColor: '#3b82f6', borderRadius: '2px',
  transition: 'width 0.4s ease',
};

const confLabelStyle: React.CSSProperties = {
  fontSize: '10px', color: '#64748b', marginBottom: '4px',
};

const metricsRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginTop: '8px',
};

const beStyle: React.CSSProperties = {
  fontSize: '11px', color: '#94a3b8', marginTop: '6px',
};

const legsStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px',
};

const legChipStyle = (action: string): React.CSSProperties => ({
  fontSize: '10px', padding: '2px 7px', borderRadius: '8px',
  background: action === 'BUY' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
  color: action === 'BUY' ? '#22c55e' : '#ef4444',
  border: `1px solid ${action === 'BUY' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
});

const ivTagStyle: React.CSSProperties = {
  fontSize: '10px', color: '#64748b', marginTop: '8px',
  borderTop: '1px solid #1e293b', paddingTop: '6px',
};

export default StrategyCard;
