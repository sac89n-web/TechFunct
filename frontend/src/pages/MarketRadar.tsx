import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marketApi } from '../services/api';
import { HeatmapItem, MomentumItem, MarketBreadth, IndexQuote } from '../types';
import Heatmap from '../components/Heatmap';
import MomentumGrid from '../components/MomentumGrid';
import BreadthPanel from '../components/BreadthPanel';

const INDICES = [
  { value: 'NIFTY50',      label: 'NIFTY 50' },
  { value: 'NIFTY BANK',   label: 'NIFTY BANK' },
  { value: 'NIFTY IT',     label: 'NIFTY IT' },
  { value: 'NIFTY PHARMA', label: 'NIFTY PHARMA' },
  { value: 'NIFTY AUTO',   label: 'NIFTY AUTO' },
  { value: 'NIFTY FMCG',   label: 'NIFTY FMCG' },
];

const MarketRadar: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState('NIFTY50');
  const [view, setView]                   = useState<'heatmap' | 'momentum'>('heatmap');
  const [heatmapData, setHeatmapData]     = useState<HeatmapItem[]>([]);
  const [momentumData, setMomentumData]   = useState<MomentumItem[]>([]);
  const [breadthData, setBreadthData]     = useState<MarketBreadth | null>(null);
  const [indexQuotes, setIndexQuotes]     = useState<IndexQuote[]>([]);
  const [loading, setLoading]             = useState(false);
  const [lastUpdate, setLastUpdate]       = useState<Date>(new Date());

  // Load index quotes independently (once on mount + every 60s)
  const loadIndexQuotes = useCallback(async () => {
    try {
      const quotes = await marketApi.getIndexQuotes();
      setIndexQuotes(quotes);
    } catch {
      // silently fail — quotes bar just shows zeros
    }
  }, []);

  useEffect(() => {
    loadIndexQuotes();
    const id = setInterval(loadIndexQuotes, 60000);
    return () => clearInterval(id);
  }, [loadIndexQuotes]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [heatmap, momentum, breadth] = await Promise.all([
        marketApi.getHeatmap(selectedIndex),
        marketApi.getMomentum(selectedIndex),
        marketApi.getBreadth(selectedIndex)
      ]);
      setHeatmapData(heatmap);
      setMomentumData(momentum);
      setBreadthData(breadth);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load market data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedIndex]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>

      {/* ── Index Ticker Bar ─────────────────────────────────────────────── */}
      <IndexTickerBar quotes={indexQuotes} />

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>Market Radar</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(e.target.value)}
            style={{
              padding: '8px 14px', background: '#0f172a', color: '#e2e8f0',
              border: '1px solid #334155', borderRadius: 6, fontSize: 14, minWidth: 150
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
              padding: '8px 16px', background: loading ? '#334155' : '#0f766e',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Breadth Panel */}
      <BreadthPanel data={breadthData} />

      {/* View tabs */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['heatmap', 'momentum'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 6,
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: view === v ? '#2563eb' : '#1e293b',
                color: view === v ? '#fff' : '#94a3b8'
              }}
            >
              {v === 'heatmap' ? 'Heatmap' : 'Momentum Scanner'}
            </button>
          ))}
        </div>

        {view === 'heatmap' ? (
          <Heatmap data={heatmapData} />
        ) : (
          <MomentumGrid data={momentumData} />
        )}
      </div>
    </div>
  );
};

// ── Index Ticker Bar ──────────────────────────────────────────────────────────

interface TickerBarProps {
  quotes: IndexQuote[];
}

const IndexTickerBar: React.FC<TickerBarProps> = ({ quotes }) => {
  const [hoveredIdx, setHoveredIdx] = useState<string | null>(null);

  const hasData = quotes.some(q => q.lastPrice > 0);

  return (
    <div style={{
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      overflowX: 'auto',
    }}>
      <div style={{
        display: 'flex',
        width: '100%',
        minWidth: 0,
      }}>
        {quotes.map((q, i) => {
          const isUp      = q.changePercent >= 0;
          const color     = q.lastPrice === 0 ? '#475569' : isUp ? '#22c55e' : '#ef4444';
          const isHovered = hoveredIdx === q.kiteSymbol;

          return (
            <div
              key={q.kiteSymbol}
              onMouseEnter={() => setHoveredIdx(q.kiteSymbol)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 12px',
                borderRight: i < quotes.length - 1 ? '1px solid #1e293b' : 'none',
                cursor: 'default',
                background: isHovered ? '#1e293b' : 'transparent',
                transition: 'background 0.15s',
                position: 'relative',
                minWidth: 100,
                overflow: 'hidden',
              }}
            >
              {/* Index name */}
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {q.name}
              </span>

              {/* Current value */}
              <span style={{
                fontSize: 15, fontWeight: 800, color: '#f1f5f9',
                lineHeight: 1.3, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {q.lastPrice > 0
                  ? q.lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                  : '—'}
              </span>

              {/* Change + % */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                {q.lastPrice > 0 ? (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color,
                    background: color + '22', borderRadius: 3, padding: '1px 6px',
                    whiteSpace: 'nowrap', display: 'inline-block'
                  }}>
                    {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{q.changePercent.toFixed(2)}%
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#334155' }}>No data</span>
                )}
              </div>

              {/* Tooltip on hover: OHLC */}
              {isHovered && q.lastPrice > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50,
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 8, padding: '10px 14px', minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
                    {q.name}
                  </div>
                  {[
                    ['Open',      q.open],
                    ['High',      q.high],
                    ['Low',       q.low],
                    ['Prev Close',q.prevClose],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                      <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>
                        {(val as number).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading placeholder */}
        {!hasData && quotes.length === 0 && (
          <div style={{ padding: '10px 24px', fontSize: 12, color: '#475569' }}>
            Loading index data...
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketRadar;
