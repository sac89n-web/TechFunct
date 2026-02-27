import React from 'react';
import { MarketBreadth } from '../types';

interface BreadthPanelProps {
  data: MarketBreadth | null;
}

const BreadthPanel: React.FC<BreadthPanelProps> = ({ data }) => {
  if (!data) return <div style={containerStyle}>Loading breadth data...</div>;

  const total = data.advances + data.declines + data.unchanged;
  const advancePercent = (data.advances / total) * 100;
  const declinePercent = (data.declines / total) * 100;

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: '0 0 15px 0' }}>Market Breadth - {data.indexName}</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
        <div style={statBoxStyle}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>Advances</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{data.advances}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>Declines</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>{data.declines}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>Unchanged</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>{data.unchanged}</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: '14px', color: '#6c757d' }}>A/D Ratio</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
            {data.advanceDeclineRatio.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ height: '30px', display: 'flex', borderRadius: '5px', overflow: 'hidden' }}>
        <div style={{ width: `${advancePercent}%`, backgroundColor: '#28a745' }}></div>
        <div style={{ width: `${declinePercent}%`, backgroundColor: '#dc3545' }}></div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '14px' }}>
        <span style={{ color: '#28a745' }}>Advances: {advancePercent.toFixed(1)}%</span>
        <span style={{ color: '#dc3545' }}>Declines: {declinePercent.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '20px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  margin: '20px'
};

const statBoxStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '15px',
  backgroundColor: '#f8f9fa',
  borderRadius: '5px'
};

export default BreadthPanel;
