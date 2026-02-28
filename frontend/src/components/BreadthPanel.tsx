import React from 'react';
import { MarketBreadth } from '../types';

interface BreadthPanelProps {
  data: MarketBreadth | null;
}

const BreadthPanel: React.FC<BreadthPanelProps> = ({ data }) => {
  if (!data) {
    return (
      <div style={{ padding: '16px 24px', color: '#475569', fontSize: 13 }}>
        Loading breadth data...
      </div>
    );
  }

  const total = data.advances + data.declines + data.unchanged;
  const advPct = total > 0 ? (data.advances / total) * 100 : 0;
  const decPct = total > 0 ? (data.declines / total) * 100 : 0;
  const unchPct = total > 0 ? (data.unchanged / total) * 100 : 0;

  return (
    <div style={{
      background: '#1e293b', borderBottom: '1px solid #334155',
      padding: '16px 24px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap'
    }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={statStyle}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Advances</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{data.advances}</span>
          <span style={{ fontSize: 11, color: '#22c55e' }}>{advPct.toFixed(1)}%</span>
        </div>
        <div style={statStyle}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Declines</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{data.declines}</span>
          <span style={{ fontSize: 11, color: '#ef4444' }}>{decPct.toFixed(1)}%</span>
        </div>
        <div style={statStyle}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unchanged</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#94a3b8' }}>{data.unchanged}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{unchPct.toFixed(1)}%</span>
        </div>
        <div style={statStyle}>
          <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>A/D Ratio</span>
          <span style={{
            fontSize: 22, fontWeight: 700,
            color: data.advanceDeclineRatio >= 1 ? '#22c55e' : '#ef4444'
          }}>
            {data.advanceDeclineRatio.toFixed(2)}
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>adv/dec</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ height: 10, display: 'flex', borderRadius: 5, overflow: 'hidden', background: '#334155' }}>
          <div style={{ width: `${advPct}%`, background: '#22c55e', transition: 'width 0.5s' }} />
          <div style={{ width: `${unchPct}%`, background: '#475569', transition: 'width 0.5s' }} />
          <div style={{ width: `${decPct}%`, background: '#ef4444', transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#64748b' }}>
          <span style={{ color: '#22c55e' }}>▲ {data.advances} Up</span>
          <span style={{ color: '#ef4444' }}>▼ {data.declines} Down</span>
        </div>
      </div>
    </div>
  );
};

const statStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  minWidth: 70
};

export default BreadthPanel;
