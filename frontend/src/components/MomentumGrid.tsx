import React, { useState } from 'react';
import { MomentumItem } from '../types';

interface MomentumGridProps {
  data: MomentumItem[];
}

const MomentumGrid: React.FC<MomentumGridProps> = ({ data }) => {
  const [sortField, setSortField] = useState<keyof MomentumItem>('momentumScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...data].sort((a, b) => {
    const av = (a[sortField] ?? 0) as number;
    const bv = (b[sortField] ?? 0) as number;
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const handleSort = (field: keyof MomentumItem) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const signalBadge = (signal: string) => {
    const color = signal.includes('STRONG') ? '#22c55e'
      : signal.includes('BUILDING') ? '#38bdf8'
      : signal.includes('WATCHLIST') ? '#f59e0b'
      : signal === 'UNKNOWN' ? '#64748b'
      : '#ef4444';
    return (
      <span style={{
        background: color + '22', color, border: `1px solid ${color}`,
        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap'
      }}>
        {signal}
      </span>
    );
  };

  const col = (v?: number | null, pos = true) => {
    if (v == null) return '#94a3b8';
    return v > 0 === pos ? '#22c55e' : '#ef4444';
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#64748b',
    fontWeight: 700, letterSpacing: 0.5, borderBottom: '1px solid #1e293b',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', background: '#0f172a'
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: '#cbd5e1',
    borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap'
  };

  if (data.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
        No momentum data. Run Sync Instruments in Stock Analyzer first.
      </div>
    );
  }

  const sortIcon = (field: keyof MomentumItem) =>
    sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, border: '1px solid #334155', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle} onClick={() => handleSort('symbol')}>Symbol{sortIcon('symbol')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('ltp')}>Price{sortIcon('ltp')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('changePercent')}>Chg%{sortIcon('changePercent')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('rsi')}>RSI{sortIcon('rsi')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('volumeRatio')}>Vol Ratio{sortIcon('volumeRatio')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('sma50Distance')}>vs SMA50{sortIcon('sma50Distance')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('momentumScore')}>Score{sortIcon('momentumScore')}</th>
            <th style={thStyle}>Signal</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr key={item.symbol} style={{ background: i % 2 === 0 ? 'transparent' : '#172033' }}>
              <td style={{ ...tdStyle, color: '#f1f5f9', fontWeight: 700 }}>{item.symbol}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>₹{item.ltp.toFixed(2)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', color: col(item.changePercent) }}>
                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </td>
              <td style={{
                ...tdStyle, textAlign: 'right',
                color: item.rsi == null ? '#64748b' : item.rsi > 70 ? '#ef4444' : item.rsi < 30 ? '#22c55e' : '#cbd5e1'
              }}>
                {item.rsi?.toFixed(1) ?? '-'}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: item.volumeRatio != null && item.volumeRatio > 1.5 ? '#f59e0b' : '#cbd5e1' }}>
                {item.volumeRatio?.toFixed(2) ?? '-'}x
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: col(item.sma50Distance) }}>
                {item.sma50Distance != null
                  ? `${item.sma50Distance >= 0 ? '+' : ''}${item.sma50Distance.toFixed(2)}%`
                  : '-'}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <div style={{ width: 50, height: 5, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(item.momentumScore, 100)}%`, height: '100%', borderRadius: 3,
                      background: item.momentumScore >= 70 ? '#22c55e' : item.momentumScore >= 40 ? '#f59e0b' : '#ef4444'
                    }} />
                  </div>
                  <span style={{ minWidth: 26 }}>{item.momentumScore.toFixed(0)}</span>
                </div>
              </td>
              <td style={tdStyle}>{signalBadge(item.signal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MomentumGrid;
