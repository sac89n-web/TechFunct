import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useSearchParams } from 'react-router-dom';
import MarketRadar from './pages/MarketRadar';
import StockAnalyzer from './pages/StockAnalyzer';
import StrategiesDashboard from './pages/StrategiesDashboard';
import OptionStrategyBuilder from './pages/OptionStrategyBuilder';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';
import { authApi } from './services/api';

// Inner component — inside BrowserRouter so it can use router hooks
const AppRoutes: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      window.location.href = '/login';
    }
  };

  if (isLoading) {
    return (
      <>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={loadingContainerStyle}>
          <div style={loadingSpinnerStyle} />
        </div>
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {isAuthenticated && (
        <nav style={navStyle}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'white' }}>Market Analytics</h2>
            <Link to="/" style={linkStyle}>Market Radar</Link>
            <Link to="/analyzer" style={linkStyle}>Stock Analyzer</Link>
            <Link to="/strategies" style={linkStyle}>Top 10 Strategies</Link>
            <Link to="/options" style={linkStyle}>Option Strategies</Link>
          </div>
          <button onClick={handleLogout} style={logoutButtonStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            Logout
          </button>
        </nav>
      )}

      <Routes>
        {/* Public route */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={isAuthenticated ? <MarketRadar /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/analyzer"
          element={isAuthenticated ? <StockAnalyzer /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/strategies"
          element={isAuthenticated ? <StrategiesDashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/options"
          element={isAuthenticated ? <OptionStrategyBuilder /> : <Navigate to="/login" replace />}
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

// Root component — also handles the ?auth=success redirect after Kite callback
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

const navStyle: React.CSSProperties = {
  backgroundColor: '#212529',
  padding: '15px 30px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const linkStyle: React.CSSProperties = {
  color: 'white',
  textDecoration: 'none',
  padding: '8px 16px',
  borderRadius: '4px',
  transition: 'background-color 0.2s',
};

const logoutButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#cbd5e1',
  border: '1px solid #475569',
  padding: '7px 16px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

const loadingContainerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f172a',
};

const loadingSpinnerStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: '4px solid #334155',
  borderTopColor: '#2563eb',
  animation: 'spin 0.8s linear infinite',
};

export default App;
