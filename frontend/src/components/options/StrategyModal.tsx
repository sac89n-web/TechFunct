import React, { useState } from 'react';
import type { OptionStrategy, OptionLeg, RiskScenario } from '../../types/options';
import MiniPayoffGraph from './MiniPayoffGraph';

interface StrategyModalProps {
  strategy: OptionStrategy;
  onClose: () => void;
}

type Tab = 'overview' | 'legs' | 'greeks' | 'scenarios' | 'scores';

const fmt  = (n: number, d = 4) => n.toFixed(d);
const fmt2 = (n: number)        => n.toFixed(2);
const fmtK = (n: number) => {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (Math.abs(n) >= 1_000)   return `₹${(n / 1_000).toFixed(2)}K`;
  return `₹${n.toFixed(2)}`;
};
const pctOrDash = (n: number | null) => n == null ? '—' : `${(n * 100).toFixed(1)}%`;

const StrategyModal: React.FC<StrategyModalProps> = ({ strategy: s, onClose }) => {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        {/* Title bar */}
        <div style={titleBarStyle}>
          <div>
            <span style={{ color: '#64748b', marginRight: 8, fontSize: 13 }}>#{s.rank}</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#f1f5f9' }}>{s.name}</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b' }}>{s.strategyType}</span>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Tabs */}
        <div style={tabBarStyle}>
          {(['overview', 'legs', 'greeks', 'scenarios', 'scores'] as Tab[]).map(t => (
            <button key={t} style={tabBtnStyle(t === tab)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={contentStyle}>
          {tab === 'overview'   && <OverviewTab s={s} />}
          {tab === 'legs'       && <LegsTab legs={s.legs} />}
          {tab === 'greeks'     && <GreeksTab s={s} />}
          {tab === 'scenarios'  && <ScenariosTab scenarios={s.riskScenarios} />}
          {tab === 'scores'     && <ScoresTab s={s} />}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Overview ───────────────────────────────────────────────────────────
const OverviewTab: React.FC<{ s: OptionStrategy }> = ({ s }) => (
  <div>
    <p style={{ color: '#94a3b8', marginBottom: 16 }}>{s.analysisSummary}</p>

    <div style={twoColStyle}>
      <InfoRow label="Bias"         value={s.bias} />
      <InfoRow label="Risk Level"   value={s.riskLevel} />
      <InfoRow label="IV Condition" value={s.ivCondition} />
      <InfoRow label="Liquidity"    value={s.liquidityStatus} />
      <InfoRow label="Confidence"   value={`${(s.confidence * 100).toFixed(0)}%`} />
      <InfoRow label="DTE"          value={s.legs[0]?.expiry ?? '—'} />
    </div>

    <div style={kpiRowStyle}>
      <KPI label="Max Profit" value={s.isMaxProfitUnlimited ? 'Unlimited' : fmtK(s.maxProfit)} color="#22c55e" />
      <KPI label="Max Loss"   value={s.isMaxLossUnlimited   ? 'Unlimited' : fmtK(s.maxLoss)}   color="#ef4444" />
      <KPI label="R:R"        value={fmt2(s.riskReward)} />
      <KPI label="ROI"        value={`${fmt2(s.expectedROI)}%`} />
      <KPI label="Margin"     value={fmtK(s.marginRequired)} />
    </div>

    {s.breakEvens.length > 0 && (
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10 }}>
        Breakevens: {s.breakEvens.map(be => `₹${be.toLocaleString('en-IN')}`).join(' / ')}
      </div>
    )}

    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
      {s.strikeSelectionLogic}
    </div>

    <MiniPayoffGraph data={s.payoffCurve} width={560} height={140} />
  </div>
);

// ─── Tab: Legs ───────────────────────────────────────────────────────────────
const LegsTab: React.FC<{ legs: OptionLeg[] }> = ({ legs }) => (
  <table style={tableStyle}>
    <thead>
      <tr>
        {['Action','Type','Strike','Expiry','LTP','Bid','Ask','Spread','IV','OI','Lots','Symbol'].map(h => (
          <th key={h} style={thStyle}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {legs.map((leg, i) => (
        <tr key={i}>
          <td style={tdStyle(leg.action === 'BUY' ? '#22c55e' : '#ef4444')}>{leg.action}</td>
          <td style={tdStyle()}>{leg.optionType}</td>
          <td style={tdStyle()}>₹{leg.strike.toLocaleString('en-IN')}</td>
          <td style={tdStyle()}>{leg.expiry}</td>
          <td style={tdStyle()}>₹{leg.entryPrice.toFixed(2)}</td>
          <td style={tdStyle()}>₹{leg.bid.toFixed(2)}</td>
          <td style={tdStyle()}>₹{leg.ask.toFixed(2)}</td>
          <td style={tdStyle()}>₹{leg.bidAskSpread.toFixed(2)}</td>
          <td style={tdStyle()}>{leg.ivUnavailable ? '—' : `${((leg.iv ?? 0) * 100).toFixed(1)}%`}</td>
          <td style={tdStyle()}>{leg.oi.toLocaleString()}</td>
          <td style={tdStyle()}>{leg.lots}</td>
          <td style={{ ...tdStyle(), fontSize: 11, color: '#64748b' }}>{leg.tradingSymbol}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Tab: Greeks ─────────────────────────────────────────────────────────────
const GreeksTab: React.FC<{ s: OptionStrategy }> = ({ s }) => (
  <div>
    <h4 style={sectionHeadStyle}>Net Portfolio Greeks</h4>
    <div style={kpiRowStyle}>
      <KPI label="Δ Delta" value={fmt2(s.netGreeks.delta)} />
      <KPI label="Γ Gamma" value={fmt(s.netGreeks.gamma)} />
      <KPI label="Θ Theta" value={fmt2(s.netGreeks.theta)} color={s.netGreeks.theta < 0 ? '#ef4444' : '#22c55e'} />
      <KPI label="ν Vega"  value={fmt2(s.netGreeks.vega)} />
    </div>
    <h4 style={sectionHeadStyle}>Per Leg Greeks</h4>
    <table style={tableStyle}>
      <thead>
        <tr>
          {['Leg','Action','Strike','Delta','Gamma','Theta','Vega'].map(h => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {s.legs.map((leg, i) => (
          <tr key={i}>
            <td style={tdStyle()}>{i + 1}</td>
            <td style={tdStyle(leg.action === 'BUY' ? '#22c55e' : '#ef4444')}>{leg.action}</td>
            <td style={tdStyle()}>₹{leg.strike.toLocaleString('en-IN')} {leg.optionType}</td>
            <td style={tdStyle()}>{fmt2(leg.greeks.delta)}</td>
            <td style={tdStyle()}>{fmt(leg.greeks.gamma)}</td>
            <td style={tdStyle(leg.greeks.theta < 0 ? '#ef4444' : '#22c55e')}>{fmt2(leg.greeks.theta)}</td>
            <td style={tdStyle()}>{fmt2(leg.greeks.vega)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Tab: Scenarios ──────────────────────────────────────────────────────────
const ScenariosTab: React.FC<{ scenarios: RiskScenario[] }> = ({ scenarios }) => (
  <table style={tableStyle}>
    <thead>
      <tr>
        {['Scenario','Move','IV Change','P&L'].map(h => (
          <th key={h} style={thStyle}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {scenarios.map((sc, i) => (
        <tr key={i}>
          <td style={tdStyle()}>{sc.label}</td>
          <td style={tdStyle(sc.underlyingMove > 0 ? '#22c55e' : sc.underlyingMove < 0 ? '#ef4444' : '#94a3b8')}>
            {sc.underlyingMove > 0 ? '+' : ''}{(sc.underlyingMove * 100).toFixed(1)}%
          </td>
          <td style={tdStyle()}>
            {sc.ivChange > 0 ? '+' : ''}{(sc.ivChange * 100).toFixed(0)}%
          </td>
          <td style={tdStyle(sc.pnL >= 0 ? '#22c55e' : '#ef4444')}>
            {fmtK(sc.pnL)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ─── Tab: Scores ─────────────────────────────────────────────────────────────
const ScoresTab: React.FC<{ s: OptionStrategy }> = ({ s }) => {
  const fs = s.factorScores;
  const scores = [
    { label: 'Trend Alignment', value: fs.trendAlignment,  weight: '25%' },
    { label: 'IV Suitability',  value: fs.ivSuitability,   weight: '20%' },
    { label: 'OI Confirmation', value: fs.oiConfirmation,  weight: '20%' },
    { label: 'Liquidity',       value: fs.liquidityScore,  weight: '15%' },
    { label: 'Risk Efficiency', value: fs.riskEfficiency,  weight: '12%' },
    { label: 'Greek Stability', value: fs.greekStability,  weight: '8%'  },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>Total Score: </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>
          {(fs.totalScore * 100).toFixed(1)}
        </span>
        <span style={{ color: '#64748b' }}>/100</span>
      </div>
      {scores.map(sc => (
        <div key={sc.label} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#e2e8f0' }}>{sc.label}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {(sc.value * 100).toFixed(0)} / 100 &nbsp;·&nbsp; {sc.weight}
            </span>
          </div>
          <div style={{ height: 6, backgroundColor: '#334155', borderRadius: 3 }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              width: `${(sc.value * 100).toFixed(0)}%`,
              backgroundColor: sc.value >= 0.7 ? '#22c55e' : sc.value >= 0.4 ? '#f59e0b' : '#ef4444',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={{ color: '#64748b', fontSize: 12 }}>{label}: </span>
    <span style={{ color: '#e2e8f0', fontSize: 12 }}>{value}</span>
  </div>
);

const KPI: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{
    backgroundColor: '#0f172a', border: '1px solid #334155',
    borderRadius: 8, padding: '10px 14px', textAlign: 'center',
  }}>
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: color || '#f1f5f9' }}>{value}</div>
  </div>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12,
  width: '90vw', maxWidth: 680, maxHeight: '88vh', display: 'flex',
  flexDirection: 'column', overflow: 'hidden',
};

const titleBarStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid #334155',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b',
  fontSize: 18, cursor: 'pointer', padding: '0 4px',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex', gap: 4, padding: '8px 20px',
  borderBottom: '1px solid #334155', overflowX: 'auto',
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#3b82f6' : 'none',
  border: active ? 'none' : '1px solid #334155',
  color: active ? 'white' : '#94a3b8',
  borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const contentStyle: React.CSSProperties = {
  padding: '16px 20px', overflowY: 'auto', flex: 1,
};

const twoColStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginBottom: 16,
};

const kpiRowStyle: React.CSSProperties = {
  display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14,
};

const sectionHeadStyle: React.CSSProperties = {
  color: '#94a3b8', fontSize: 13, marginBottom: 10, marginTop: 16,
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', color: '#64748b',
  borderBottom: '1px solid #334155', whiteSpace: 'nowrap',
};

const tdStyle = (color?: string): React.CSSProperties => ({
  padding: '6px 8px', borderBottom: '1px solid #1e293b',
  color: color || '#e2e8f0', whiteSpace: 'nowrap',
});

export default StrategyModal;
