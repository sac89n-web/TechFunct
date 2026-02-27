import React, { useState } from 'react';
import { MomentumItem } from '../types';

interface MomentumGridProps {
  data: MomentumItem[];
}

const MomentumGrid: React.FC<MomentumGridProps> = ({ data }) => {
  const [sortField, setSortField] = useState<keyof MomentumItem>('momentumScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;
    return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleSort = (field: keyof MomentumItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSignalColor = (signal: string) => {
    if (signal.includes('STRONG')) return '#28a745';
    if (signal.includes('BUILDING')) return '#17a2b8';
    if (signal.includes('WATCHLIST')) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div style={{ padding: '20px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={headerStyle} onClick={() => handleSort('symbol')}>Symbol</th>
            <th style={headerStyle} onClick={() => handleSort('ltp')}>LTP</th>
            <th style={headerStyle} onClick={() => handleSort('changePercent')}>Change %</th>
            <th style={headerStyle} onClick={() => handleSort('rsi')}>RSI</th>
            <th style={headerStyle} onClick={() => handleSort('volumeRatio')}>Vol Ratio</th>
            <th style={headerStyle} onClick={() => handleSort('sma50Distance')}>SMA50 Dist</th>
            <th style={headerStyle} onClick={() => handleSort('momentumScore')}>Score</th>
            <th style={headerStyle}>Signal</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr key={item.symbol} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={cellStyle}><strong>{item.symbol}</strong></td>
              <td style={cellStyle}>₹{item.ltp.toFixed(2)}</td>
              <td style={{ ...cellStyle, color: item.changePercent >= 0 ? '#28a745' : '#dc3545' }}>
                {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </td>
              <td style={cellStyle}>{item.rsi?.toFixed(2) ?? '-'}</td>
              <td style={cellStyle}>{item.volumeRatio?.toFixed(2) ?? '-'}</td>
              <td style={cellStyle}>{item.sma50Distance?.toFixed(2) ?? '-'}%</td>
              <td style={cellStyle}><strong>{item.momentumScore.toFixed(0)}</strong></td>
              <td style={{ ...cellStyle, color: getSignalColor(item.signal), fontWeight: 'bold' }}>
                {item.signal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const headerStyle: React.CSSProperties = {
  padding: '12px',
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
  fontWeight: 'bold'
};

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left'
};

export default MomentumGrid;
