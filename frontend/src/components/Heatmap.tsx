import React from 'react';
import { HeatmapItem } from '../types';

interface HeatmapProps {
  data: HeatmapItem[];
}

const COLOR_MAP: Record<string, { bg: string; text: string; label: string; range: string }> = {
  DarkGreen: { bg: '#166534', text: '#bbf7d0', label: 'Strong Up',  range: '> +2%'  },
  Green:     { bg: '#15803d', text: '#dcfce7', label: 'Up',          range: '+1% to +2%' },
  Neutral:   { bg: '#334155', text: '#cbd5e1', label: 'Flat',        range: '-1% to +1%' },
  Orange:    { bg: '#92400e', text: '#fef3c7', label: 'Down',        range: '-2% to -1%' },
  Red:       { bg: '#7f1d1d', text: '#fee2e2', label: 'Strong Down', range: '< -2%'  },
};

const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
        No heatmap data. Run Sync Instruments in Stock Analyzer first.
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 0 16px', flexWrap: 'wrap' }}>
        {Object.entries(COLOR_MAP).map(([key, { bg, text, label, range }]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1e293b', borderRadius: 6, padding: '4px 10px', border: '1px solid #334155'
          }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${text}` }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>({range})</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 8
      }}>
        {data.map((item) => {
          const theme = COLOR_MAP[item.colorCode] ?? COLOR_MAP.Neutral;
          return (
            <div
              key={item.symbol}
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                padding: '12px 10px',
                borderRadius: 8,
                textAlign: 'center',
                cursor: 'pointer',
                border: `1px solid ${theme.text}22`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>{item.symbol}</div>
              <div style={{ fontSize: 15, margin: '4px 0', fontWeight: 600 }}>
                ₹{item.ltp.toFixed(2)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </div>
              {item.sector && (
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{item.sector}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Heatmap;
