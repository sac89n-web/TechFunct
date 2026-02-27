import React, { useState, useEffect } from 'react';
import { marketApi } from '../services/api';
import { HeatmapItem, MomentumItem, MarketBreadth } from '../types';
import Heatmap from '../components/Heatmap';
import MomentumGrid from '../components/MomentumGrid';
import BreadthPanel from '../components/BreadthPanel';

const MarketRadar: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState('NIFTY50');
  const [view, setView] = useState<'heatmap' | 'momentum'>('heatmap');
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([]);
  const [momentumData, setMomentumData] = useState<MomentumItem[]>([]);
  const [breadthData, setBreadthData] = useState<MarketBreadth | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedIndex]);

  const loadData = async () => {
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
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0 }}>Market Radar</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={selectedIndex} 
            onChange={(e) => setSelectedIndex(e.target.value)}
            style={selectStyle}
          >
            <option value="NIFTY50">NIFTY 50</option>
            <option value="NIFTY100">NIFTY 100</option>
          </select>
          <button onClick={loadData} style={buttonStyle} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <span style={{ fontSize: '12px', color: '#6c757d' }}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <BreadthPanel data={breadthData} />

      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            onClick={() => setView('heatmap')} 
            style={{ ...tabButtonStyle, backgroundColor: view === 'heatmap' ? '#007bff' : '#6c757d' }}
          >
            Heatmap
          </button>
          <button 
            onClick={() => setView('momentum')} 
            style={{ ...tabButtonStyle, backgroundColor: view === 'momentum' ? '#007bff' : '#6c757d' }}
          >
            Momentum Scanner
          </button>
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

const headerStyle: React.CSSProperties = {
  backgroundColor: '#343a40',
  color: 'white',
  padding: '20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #ced4da',
  fontSize: '14px'
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px'
};

const tabButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold'
};

export default MarketRadar;
