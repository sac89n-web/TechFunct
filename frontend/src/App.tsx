import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import MarketRadar from './pages/MarketRadar';
import StockAnalyzer from './pages/StockAnalyzer';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh' }}>
        <nav style={navStyle}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'white' }}>Market Analytics</h2>
            <Link to="/" style={linkStyle}>Market Radar</Link>
            <Link to="/analyzer" style={linkStyle}>Stock Analyzer</Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<MarketRadar />} />
          <Route path="/analyzer" element={<StockAnalyzer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

const navStyle: React.CSSProperties = {
  backgroundColor: '#212529',
  padding: '15px 30px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  padding: '8px 16px',
  borderRadius: '4px',
  transition: 'background-color 0.2s'
};

export default App;
