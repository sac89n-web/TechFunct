import React, { useState, useEffect, useCallback } from 'react';
import { strategiesApi } from '../services/api';
import { StrategyRanking, StrategyFactor } from '../types';

const INDICES = [
  { value: 'NIFTY50',      label: 'NIFTY 50' },
  { value: 'NIFTY BANK',   label: 'NIFTY BANK' },
  { value: 'NIFTY IT',     label: 'NIFTY IT' },
  { value: 'NIFTY PHARMA', label: 'NIFTY PHARMA' },
  { value: 'NIFTY AUTO',   label: 'NIFTY AUTO' },
  { value: 'NIFTY FMCG',   label: 'NIFTY FMCG' },
];

const CATEGORIES = ['Trend', 'Momentum', 'Volume', 'Price Action', 'Bollinger Bands', 'SMA Extension', 'Risk/Reward', 'Signal'];

const CAT_COLORS: Record<string, string> = {
  'Trend':           '#2563eb',
  'Momentum':        '#7c3aed',
  'Volume':          '#0891b2',
  'Price Action':    '#059669',
  'Bollinger Bands': '#d97706',
  'SMA Extension':   '#db2777',
  'Risk/Reward':     '#dc2626',
  'Signal':          '#16a34a',
};

const StrategiesDashboard: React.FC = () => {
  const [selectedIndex, setSelectedIndex]   = useState('NIFTY50');
  const [strategies, setStrategies]         = useState<StrategyRanking[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]         = useState<Date | null>(null);
  const [selectedStock, setSelectedStock]   = useState<StrategyRanking | null>(null);
  const [modalCat, setModalCat]             = useState<string>('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await strategiesApi.getTop10(selectedIndex);
      setStrategies(data);
      setLastUpdate(new Date());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load strategies';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedIndex]);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60000);
    return () => clearInterval(id);
  }, [loadData]);

  const signalColor = (signal: string) => {
    if (signal === 'STRONG BUY')        return '#22c55e';
    if (signal === 'BUILDING MOMENTUM') return '#38bdf8';
    if (signal === 'WATCHLIST')         return '#f59e0b';
    if (signal === 'WEAK')              return '#ef4444';
    return '#64748b';
  };

  const scoreGradient = (pct: number) => {
    if (pct >= 75) return '#22c55e';
    if (pct >= 55) return '#38bdf8';
    if (pct >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const tagColor = (tag: string) => {
    const map: Record<string, string> = {
      'Golden Cross Breakout': '#fbbf24',
      'High Momentum':         '#22c55e',
      'Trend Following':       '#38bdf8',
      'Volume Breakout':       '#a78bfa',
      'Trend Continuation':    '#34d399',
      'Momentum Play':         '#60a5fa',
      'Emerging Momentum':     '#fb923c',
      'Watchlist':             '#94a3b8',
    };
    return map[tag] ?? '#94a3b8';
  };

  const filteredFactors = (factors: StrategyFactor[]) =>
    modalCat === 'All' ? factors : factors.filter(f => f.category === modalCat);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>

      {/* Header */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
            Top 10 Automated Trading Strategies
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            47-factor analysis checklist · Ranked by composite score
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={selectedIndex}
            onChange={e => setSelectedIndex(e.target.value)}
            style={{
              padding: '8px 14px', background: '#0f172a', color: '#e2e8f0',
              border: '1px solid #334155', borderRadius: 6, fontSize: 14
            }}
          >
            {INDICES.map(idx => (
              <option key={idx.value} value={idx.value}>{idx.label}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: loading ? '#334155' : '#0f766e',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600
            }}
          >
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
          {lastUpdate && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Score legend */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '10px 24px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Score:</span>
        {[['≥75% Excellent', '#22c55e'], ['55–74% Good', '#38bdf8'], ['40–54% Fair', '#f59e0b'], ['<40% Weak', '#ef4444']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color as string }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          Click any card to see all 47 factor details
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {error && (
          <div style={{
            background: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 8,
            padding: '12px 16px', color: '#fca5a5', marginBottom: 20
          }}>
            {error} — Run "Sync Instruments" in Stock Analyzer first.
          </div>
        )}

        {!loading && strategies.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
            No strategy data. Run Sync Instruments in Stock Analyzer first.
          </div>
        )}

        {/* Strategy Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16
        }}>
          {strategies.map(s => {
            const passed  = s.factors.filter(f => f.passed).length;
            const total   = s.factors.length;
            const color   = scoreGradient(s.scorePercent);

            return (
              <div
                key={s.symbol}
                onClick={() => { setSelectedStock(s); setModalCat('All'); }}
                style={{
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 12, padding: 20, cursor: 'pointer',
                  transition: 'border-color 0.2s, transform 0.15s',
                  position: 'relative', overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = color;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Rank badge */}
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  background: color, color: '#fff',
                  padding: '4px 14px', borderRadius: '0 12px 0 12px',
                  fontSize: 13, fontWeight: 800
                }}>
                  #{s.rank}
                </div>

                {/* Symbol + price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{s.symbol}</div>
                    {s.sector && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.sector}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
                      ₹{s.ltp.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: s.changePercent >= 0 ? '#22c55e' : '#ef4444'
                    }}>
                      {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Strategy tag */}
                <div style={{ marginBottom: 12 }}>
                  <span style={{
                    background: tagColor(s.strategyTag) + '22',
                    color: tagColor(s.strategyTag),
                    border: `1px solid ${tagColor(s.strategyTag)}55`,
                    borderRadius: 20, padding: '3px 12px',
                    fontSize: 11, fontWeight: 700
                  }}>
                    {s.strategyTag}
                  </span>
                </div>

                {/* Score bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      Factors: {passed}/{total} passed
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>
                      {s.scorePercent.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#334155', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${s.scorePercent}%`, height: '100%',
                      background: color, borderRadius: 4,
                      transition: 'width 0.5s'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 10, color: '#64748b' }}>
                    <span>Score: {s.totalScore}/{s.maxScore} pts</span>
                  </div>
                </div>

                {/* Key metrics row */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {s.rsi != null && (
                    <MetricChip
                      label="RSI"
                      value={s.rsi.toFixed(1)}
                      color={s.rsi > 70 ? '#ef4444' : s.rsi < 30 ? '#22c55e' : '#38bdf8'}
                    />
                  )}
                  {s.volumeRatio != null && (
                    <MetricChip
                      label="Vol"
                      value={`${s.volumeRatio.toFixed(1)}x`}
                      color={s.volumeRatio > 1.5 ? '#f59e0b' : '#64748b'}
                    />
                  )}
                  {s.momentumScore != null && (
                    <MetricChip
                      label="Mom"
                      value={s.momentumScore.toFixed(0)}
                      color={s.momentumScore >= 60 ? '#22c55e' : s.momentumScore >= 40 ? '#f59e0b' : '#ef4444'}
                    />
                  )}
                  {s.sma50Distance != null && (
                    <MetricChip
                      label="vs SMA50"
                      value={`${s.sma50Distance >= 0 ? '+' : ''}${s.sma50Distance.toFixed(1)}%`}
                      color={s.sma50Distance >= 0 ? '#22c55e' : '#ef4444'}
                    />
                  )}
                  {s.goldenCross && (
                    <MetricChip label="Golden X" value="✓" color="#fbbf24" />
                  )}
                </div>

                {/* Signal */}
                <div style={{ marginTop: 12 }}>
                  <span style={{
                    background: signalColor(s.signal) + '22',
                    color: signalColor(s.signal),
                    border: `1px solid ${signalColor(s.signal)}`,
                    borderRadius: 4, padding: '3px 10px',
                    fontSize: 11, fontWeight: 700
                  }}>
                    {s.signal}
                  </span>
                </div>

                {/* Category mini-bars */}
                <div style={{ marginTop: 14 }}>
                  {CATEGORIES.map(cat => {
                    const catFactors = s.factors.filter(f => f.category === cat);
                    const catPassed  = catFactors.filter(f => f.passed).length;
                    const catPct     = catFactors.length > 0 ? (catPassed / catFactors.length) * 100 : 0;
                    const catColor   = CAT_COLORS[cat] ?? '#64748b';
                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: '#64748b', minWidth: 90, textAlign: 'right' }}>{cat}</span>
                        <div style={{ flex: 1, height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${catPct}%`, height: '100%', background: catColor, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#475569', minWidth: 28 }}>{catPassed}/{catFactors.length}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedStock && (
        <FactorModal
          stock={selectedStock}
          modalCat={modalCat}
          setModalCat={setModalCat}
          onClose={() => setSelectedStock(null)}
          filteredFactors={filteredFactors(selectedStock.factors)}
          signalColor={signalColor}
          scoreGradient={scoreGradient}
        />
      )}
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const MetricChip: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    background: color + '22', border: `1px solid ${color}44`,
    borderRadius: 6, padding: '3px 8px', fontSize: 11, color
  }}>
    <span style={{ color: '#64748b' }}>{label}: </span>
    <span style={{ fontWeight: 700 }}>{value}</span>
  </div>
);

interface FactorModalProps {
  stock: StrategyRanking;
  modalCat: string;
  setModalCat: (c: string) => void;
  onClose: () => void;
  filteredFactors: StrategyFactor[];
  signalColor: (s: string) => string;
  scoreGradient: (p: number) => string;
}

const FactorModal: React.FC<FactorModalProps> = ({
  stock, modalCat, setModalCat, onClose, filteredFactors, signalColor, scoreGradient
}) => {
  const color = scoreGradient(stock.scorePercent);
  const cats  = ['All', ...CATEGORIES];

  const catCounts = CATEGORIES.reduce<Record<string, { passed: number; total: number }>>((acc, cat) => {
    const f = stock.factors.filter(x => x.category === cat);
    acc[cat] = { passed: f.filter(x => x.passed).length, total: f.length };
    return acc;
  }, {});

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 16, width: '100%', maxWidth: 820,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: '#0f172a'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>{stock.symbol}</span>
              <span style={{
                background: color + '33', color, border: `1px solid ${color}`,
                borderRadius: 6, padding: '4px 12px', fontSize: 14, fontWeight: 700
              }}>
                #{stock.rank} · {stock.scorePercent.toFixed(0)}%
              </span>
              <span style={{
                background: signalColor(stock.signal) + '22', color: signalColor(stock.signal),
                border: `1px solid ${signalColor(stock.signal)}`,
                borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700
              }}>
                {stock.signal}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
              ₹{stock.ltp.toFixed(2)}
              <span style={{ color: stock.changePercent >= 0 ? '#22c55e' : '#ef4444', marginLeft: 8 }}>
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
              {stock.sector && <span style={{ marginLeft: 12, color: '#64748b' }}>{stock.sector}</span>}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>
              Strategy: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{stock.strategyTag}</span>
              &nbsp;·&nbsp;
              Factors: {stock.factors.filter(f => f.passed).length}/{stock.factors.length} passed
              &nbsp;·&nbsp;
              {stock.totalScore}/{stock.maxScore} pts
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#64748b',
              fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Overall score bar */}
        <div style={{ padding: '12px 24px', background: '#0f172a', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 5, overflow: 'hidden' }}>
            {CATEGORIES.map(cat => {
              const cc    = catCounts[cat];
              const pct   = cc.total > 0 ? (cc.passed / cc.total) * 100 : 0;
              const cw    = (cc.total / stock.factors.length) * 100;
              return (
                <div key={cat} style={{ width: `${cw}%`, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: CAT_COLORS[cat] ?? '#64748b' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <span key={cat} style={{ fontSize: 10, color: CAT_COLORS[cat] ?? '#64748b' }}>
                {cat}: {catCounts[cat].passed}/{catCounts[cat].total}
              </span>
            ))}
          </div>
        </div>

        {/* Category filter tabs */}
        <div style={{
          padding: '10px 24px', borderBottom: '1px solid #1e293b',
          display: 'flex', gap: 6, flexWrap: 'wrap', background: '#0f172a'
        }}>
          {cats.map(cat => (
            <button
              key={cat}
              onClick={() => setModalCat(cat)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none',
                cursor: 'pointer',
                background: modalCat === cat ? (CAT_COLORS[cat] ?? '#2563eb') : '#1e293b',
                color: modalCat === cat ? '#fff' : '#64748b'
              }}
            >
              {cat}
              {cat !== 'All' && (
                <span style={{ marginLeft: 4, opacity: 0.8 }}>
                  {catCounts[cat]?.passed}/{catCounts[cat]?.total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Factors list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 20px' }}>
          {filteredFactors.map((factor, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 0', borderBottom: '1px solid #0f172a'
              }}
            >
              {/* Pass/Fail icon */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: factor.passed ? '#14532d' : '#450a0a',
                color: factor.passed ? '#4ade80' : '#f87171',
                fontSize: 14, fontWeight: 800
              }}>
                {factor.passed ? '✓' : '✗'}
              </div>

              {/* Factor info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{factor.name}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, background: (CAT_COLORS[factor.category] ?? '#64748b') + '22',
                      color: CAT_COLORS[factor.category] ?? '#64748b',
                      border: `1px solid ${(CAT_COLORS[factor.category] ?? '#64748b')}44`,
                      borderRadius: 10, padding: '1px 8px'
                    }}>
                      {factor.category}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: factor.passed ? '#4ade80' : '#f87171'
                    }}>
                      {factor.passed ? `+${factor.points}` : '0'} pts
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{factor.description}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  Value: <span style={{ fontWeight: 600, color: factor.passed ? '#4ade80' : '#f87171' }}>
                    {factor.actualValue}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StrategiesDashboard;
