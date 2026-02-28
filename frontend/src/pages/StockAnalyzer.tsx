import React, { useState } from 'react';
import { marketApi, instrumentApi } from '../services/api';
import { StockAnalysis } from '../types';

const INDICES = [
  { value: 'NIFTY50',      label: 'NIFTY 50' },
  { value: 'NIFTY BANK',   label: 'NIFTY BANK' },
  { value: 'NIFTY IT',     label: 'NIFTY IT' },
  { value: 'NIFTY PHARMA', label: 'NIFTY PHARMA' },
  { value: 'NIFTY AUTO',   label: 'NIFTY AUTO' },
  { value: 'NIFTY FMCG',   label: 'NIFTY FMCG' },
];

type SortKey = 'symbol' | 'changePercent' | 'compositeScore' | 'rsi';

const StockAnalyzer: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState('NIFTY50');
  const [results, setResults]             = useState<StockAnalysis[]>([]);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [syncing, setSyncing]             = useState(false);
  const [error, setError]                 = useState('');
  const [syncMsg, setSyncMsg]             = useState('');
  const [sortKey, setSortKey]             = useState<SortKey>('compositeScore');
  const [sortAsc, setSortAsc]             = useState(false);

  const handleScanIndex = async () => {
    setLoading(true);
    setError('');
    setExpandedSymbol(null);
    try {
      const data = await marketApi.analyzeIndex(selectedIndex);
      setResults(data);
      if (data.length === 0) setError('No data found. Try syncing instruments first.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to scan index');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncInstruments = async () => {
    setSyncing(true);
    setSyncMsg('');
    setError('');
    try {
      const res = await instrumentApi.syncInstruments();
      setSyncMsg(res.message);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'symbol'); }
  };

  const sorted = [...results].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0;
    if (sortKey === 'symbol')         { av = a.symbol;           bv = b.symbol; }
    else if (sortKey === 'changePercent')  { av = a.changePercent ?? 0;  bv = b.changePercent ?? 0; }
    else if (sortKey === 'compositeScore') { av = a.compositeScore;      bv = b.compositeScore; }
    else if (sortKey === 'rsi')            { av = a.rsi ?? 0;            bv = b.rsi ?? 0; }
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const getSignalBadge = (signal: string) => {
    const color = signal.includes('BUY') ? '#22c55e' : signal.includes('HOLD') ? '#f59e0b' : '#ef4444';
    return (
      <span style={{
        background: color + '22', color, border: `1px solid ${color}`,
        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5
      }}>
        {signal}
      </span>
    );
  };

  const pct = (v?: number) => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const pr  = (v?: number) => v == null ? '-' : `₹${v.toFixed(2)}`;
  const col = (v?: number, pos = true) => {
    if (v == null) return '#94a3b8';
    return v > 0 === pos ? '#22c55e' : '#ef4444';
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: 11,
    color: '#64748b', fontWeight: 600, letterSpacing: 0.5,
    borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap', cursor: 'pointer',
    userSelect: 'none', background: '#0f172a'
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: 12, color: '#cbd5e1',
    borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap'
  };

  const TOTAL_COLS = 12;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '24px', color: '#e2e8f0' }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>Stock Analyzer</h2>
        <button
          onClick={handleSyncInstruments}
          disabled={syncing}
          style={{
            padding: '8px 16px', background: syncing ? '#334155' : '#0f766e',
            color: '#fff', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600
          }}
        >
          {syncing ? 'Syncing...' : 'Sync Instruments'}
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select
          value={selectedIndex}
          onChange={e => setSelectedIndex(e.target.value)}
          style={{
            padding: '10px 14px', background: '#1e293b', color: '#e2e8f0',
            border: '1px solid #334155', borderRadius: 6, fontSize: 14, minWidth: 160
          }}
        >
          {INDICES.map(idx => (
            <option key={idx.value} value={idx.value}>{idx.label}</option>
          ))}
        </select>
        <button
          onClick={handleScanIndex}
          disabled={loading}
          style={{
            padding: '10px 24px', background: loading ? '#334155' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 700
          }}
        >
          {loading ? 'Scanning...' : 'Scan Index'}
        </button>
        {results.length > 0 && (
          <span style={{ color: '#64748b', fontSize: 13 }}>{results.length} stocks · click a row to expand</span>
        )}
      </div>

      {/* Messages */}
      {syncMsg && (
        <div style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
          {syncMsg}
        </div>
      )}
      {error && (
        <div style={{ background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Results grid */}
      {sorted.length > 0 && (
        <div style={{ background: '#1e293b', borderRadius: 8, border: '1px solid #334155', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36, cursor: 'default' }}>#</th>
                <th style={thStyle} onClick={() => handleSort('symbol')}>
                  Symbol {sortKey === 'symbol' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('changePercent')}>
                  Chg% {sortKey === 'changePercent' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={thStyle}>Signal</th>
                <th style={{ ...thStyle, minWidth: 120 }} onClick={() => handleSort('compositeScore')}>
                  Score {sortKey === 'compositeScore' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('rsi')}>
                  RSI {sortKey === 'rsi' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }}>vs SMA20</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>vs SMA50</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Target</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Stop Loss</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>R:R</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const vsSma20   = s.sma20 && s.currentPrice ? ((s.currentPrice - s.sma20) / s.sma20) * 100 : undefined;
                const vsSma50   = s.sma50 && s.currentPrice ? ((s.currentPrice - s.sma50) / s.sma50) * 100 : undefined;
                const isExpanded = expandedSymbol === s.symbol;
                const rowBg     = isExpanded ? '#0f2d4a' : i % 2 === 0 ? 'transparent' : '#172033';

                return (
                  <React.Fragment key={s.symbol}>
                    {/* ── Data row ── */}
                    <tr
                      onClick={() => setExpandedSymbol(isExpanded ? null : s.symbol)}
                      style={{ cursor: 'pointer', background: rowBg }}
                      onMouseEnter={e => {
                        if (!isExpanded)
                          (e.currentTarget as HTMLTableRowElement).style.background = '#1e3a5f';
                      }}
                      onMouseLeave={e => {
                        if (!isExpanded)
                          (e.currentTarget as HTMLTableRowElement).style.background = rowBg;
                      }}
                    >
                      <td style={{ ...tdStyle, color: '#475569', textAlign: 'center' }}>
                        <span style={{ marginRight: 4, fontSize: 10, color: '#334155' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        {i + 1}
                      </td>
                      <td style={{ ...tdStyle, color: '#f1f5f9', fontWeight: 600 }}>{s.symbol}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{pr(s.currentPrice)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: col(s.changePercent) }}>
                        {pct(s.changePercent)}
                      </td>
                      <td style={tdStyle}>{getSignalBadge(s.tradeSignal)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(s.compositeScore, 100)}%`, height: '100%', borderRadius: 3,
                              background: s.compositeScore >= 70 ? '#22c55e' : s.compositeScore >= 40 ? '#f59e0b' : '#ef4444'
                            }} />
                          </div>
                          <span style={{ minWidth: 30, textAlign: 'right', fontSize: 11 }}>{s.compositeScore.toFixed(0)}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: s.rsi == null ? '#64748b' : s.rsi > 70 ? '#ef4444' : s.rsi < 30 ? '#22c55e' : '#cbd5e1' }}>
                        {s.rsi?.toFixed(1) ?? '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: col(vsSma20) }}>
                        {vsSma20 == null ? '-' : `${vsSma20 >= 0 ? '+' : ''}${vsSma20.toFixed(1)}%`}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: col(vsSma50) }}>
                        {vsSma50 == null ? '-' : `${vsSma50 >= 0 ? '+' : ''}${vsSma50.toFixed(1)}%`}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e' }}>{pr(s.target1)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444' }}>{pr(s.stopLoss)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{s.riskReward?.toFixed(2) ?? '-'}</td>
                    </tr>

                    {/* ── Inline detail row ── */}
                    {isExpanded && (
                      <tr style={{ background: '#0a1628' }}>
                        <td colSpan={TOTAL_COLS} style={{ padding: 0, borderBottom: '2px solid #2563eb' }}>
                          <div style={{ padding: '16px 20px' }}>

                            {/* Detail header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{s.symbol}</span>
                              {getSignalBadge(s.tradeSignal)}
                              <span style={{ fontSize: 13, color: col(s.changePercent) }}>
                                {pr(s.currentPrice)} ({pct(s.changePercent)})
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', cursor: 'pointer' }}
                                onClick={e => { e.stopPropagation(); setExpandedSymbol(null); }}>
                                ✕ Close
                              </span>
                            </div>

                            {/* Metrics grid */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                              gap: 8
                            }}>
                              {[
                                { label: 'Price',       value: pr(s.currentPrice),                   color: '#e2e8f0' },
                                { label: 'Change %',    value: pct(s.changePercent),                  color: col(s.changePercent) },
                                { label: 'Score',       value: `${s.compositeScore.toFixed(0)}/100`,  color: s.compositeScore >= 70 ? '#22c55e' : s.compositeScore >= 40 ? '#f59e0b' : '#ef4444' },
                                { label: 'RSI (14)',    value: s.rsi?.toFixed(2) ?? '-',              color: s.rsi == null ? '#94a3b8' : s.rsi > 70 ? '#ef4444' : s.rsi < 30 ? '#22c55e' : '#e2e8f0' },
                                { label: 'SMA 20',      value: pr(s.sma20),                           color: '#e2e8f0' },
                                { label: 'SMA 50',      value: pr(s.sma50),                           color: '#e2e8f0' },
                                { label: 'SMA 200',     value: pr(s.sma200),                          color: '#e2e8f0' },
                                { label: 'BB Position', value: s.bbPosition ?? '-',                   color: '#94a3b8' },
                                { label: 'BB Upper',    value: pr(s.bbUpper),                         color: '#e2e8f0' },
                                { label: 'BB Middle',   value: pr(s.bbMiddle),                        color: '#e2e8f0' },
                                { label: 'BB Lower',    value: pr(s.bbLower),                         color: '#e2e8f0' },
                                { label: 'Golden Cross',value: s.goldenCross ? '✓ Yes' : '✗ No',      color: s.goldenCross ? '#22c55e' : '#ef4444' },
                                { label: 'Target 1',    value: pr(s.target1),                         color: '#22c55e' },
                                { label: 'Target 2',    value: pr(s.target2),                         color: '#4ade80' },
                                { label: 'Stop Loss',   value: pr(s.stopLoss),                        color: '#ef4444' },
                                { label: 'Risk : Reward', value: s.riskReward?.toFixed(2) ?? '-',    color: (s.riskReward ?? 0) >= 1.5 ? '#22c55e' : '#f59e0b' },
                              ].map(({ label, value, color }) => (
                                <div key={label} style={{
                                  background: '#1e293b', borderRadius: 6,
                                  padding: '10px 12px', border: '1px solid #334155'
                                }}>
                                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {label}
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color }}>
                                    {value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div style={{ textAlign: 'center', color: '#475569', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16 }}>Select an index and click <strong style={{ color: '#94a3b8' }}>Scan Index</strong> to analyze stocks</div>
          <div style={{ fontSize: 13, marginTop: 8, color: '#334155' }}>If no data appears, use <strong style={{ color: '#94a3b8' }}>Sync Instruments</strong> first</div>
        </div>
      )}
    </div>
  );
};

export default StockAnalyzer;
