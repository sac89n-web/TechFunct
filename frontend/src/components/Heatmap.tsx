import React from 'react';
import { HeatmapItem } from '../types';

interface HeatmapProps {
  data: HeatmapItem[];
}

const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  const getColor = (colorCode: string) => {
    const colors: Record<string, string> = {
      DarkGreen: '#006400',
      Green: '#28a745',
      Neutral: '#6c757d',
      Orange: '#fd7e14',
      Red: '#dc3545'
    };
    return colors[colorCode] || '#6c757d';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', padding: '20px' }}>
      {data.map((item) => (
        <div
          key={item.symbol}
          style={{
            backgroundColor: getColor(item.colorCode),
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.symbol}</div>
          <div style={{ fontSize: '16px', margin: '5px 0' }}>₹{item.ltp.toFixed(2)}</div>
          <div style={{ fontSize: '14px' }}>{item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%</div>
          {item.sector && <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>{item.sector}</div>}
        </div>
      ))}
    </div>
  );
};

export default Heatmap;
