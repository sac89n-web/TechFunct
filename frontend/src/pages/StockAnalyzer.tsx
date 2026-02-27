import React, { useState } from 'react';
import { marketApi } from '../services/api';
import { StockAnalysis } from '../types';

const StockAnalyzer: React.FC = () => {
  const [symbol, setSymbol] = useState('');
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!symbol.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const result = await marketApi.analyzeStock(symbol.toUpperCase());
      setAnalysis(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze stock');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const getSignalColor = (signal: string) => {
    if (signal.includes('BUY')) return '#28a745';
    if (signal.includes('HOLD')) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={containerStyle}>
        <h1>Stock Analyzer</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <input
            type="text"
            placeholder="Enter symbol (e.g., RELIANCE)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
            style={inputStyle}
          />
          <button onClick={handleAnalyze} disabled={loading} style={buttonStyle}>
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && <div style={{ color: '#dc3545', marginBottom: '20px' }}>{error}</div>}

        {analysis && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
              <div style={cardStyle}>
                <h3>Price Information</h3>
                <div style={rowStyle}>
                  <span>Current Price:</span>
                  <strong>₹{analysis.currentPrice.toFixed(2)}</strong>
                </div>
                <div style={rowStyle}>
                  <span>SMA 20:</span>
                  <span>₹{analysis.sma20?.toFixed(2) ?? '-'}</span>
                </div>
                <div style={rowStyle}>
                  <span>SMA 50:</span>
                  <span>₹{analysis.sma50?.toFixed(2) ?? '-'}</span>
                </div>
                <div style={rowStyle}>
                  <span>SMA 200:</span>
                  <span>₹{analysis.sma200?.toFixed(2) ?? '-'}</span>
                </div>
              </div>

              <div style={cardStyle}>
                <h3>Technical Indicators</h3>
                <div style={rowStyle}>
                  <span>RSI (14):</span>
                  <span>{analysis.rsi?.toFixed(2) ?? '-'}</span>
                </div>
                <div style={rowStyle}>
                  <span>Golden Cross:</span>
                  <span style={{ color: analysis.goldenCross ? '#28a745' : '#dc3545' }}>
                    {analysis.goldenCross ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={rowStyle}>
                  <span>Death Cross:</span>
                  <span style={{ color: analysis.deathCross ? '#dc3545' : '#28a745' }}>
                    {analysis.deathCross ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={rowStyle}>
                  <span>BB Position:</span>
                  <span>{analysis.bbPosition ?? '-'}</span>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h3>Bollinger Bands</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>Upper</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{analysis.bbUpper?.toFixed(2) ?? '-'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>Middle</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{analysis.bbMiddle?.toFixed(2) ?? '-'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>Lower</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{analysis.bbLower?.toFixed(2) ?? '-'}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginTop: '20px' }}>
              <div style={{ ...cardStyle, backgroundColor: getSignalColor(analysis.tradeSignal), color: 'white' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Trade Signal</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{analysis.tradeSignal}</div>
                <div style={{ fontSize: '18px', marginTop: '10px' }}>
                  Score: {analysis.compositeScore.toFixed(0)}/100
                </div>
              </div>

              <div style={cardStyle}>
                <h3>Targets & Risk</h3>
                <div style={rowStyle}>
                  <span>Target 1:</span>
                  <strong style={{ color: '#28a745' }}>₹{analysis.target1?.toFixed(2) ?? '-'}</strong>
                </div>
                <div style={rowStyle}>
                  <span>Target 2:</span>
                  <strong style={{ color: '#28a745' }}>₹{analysis.target2?.toFixed(2) ?? '-'}</strong>
                </div>
                <div style={rowStyle}>
                  <span>Stop Loss:</span>
                  <strong style={{ color: '#dc3545' }}>₹{analysis.stopLoss?.toFixed(2) ?? '-'}</strong>
                </div>
                <div style={rowStyle}>
                  <span>Risk/Reward:</span>
                  <strong>{analysis.riskReward?.toFixed(2) ?? '-'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  backgroundColor: 'white',
  padding: '30px',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  fontSize: '16px',
  border: '1px solid #ced4da',
  borderRadius: '4px'
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 'bold'
};

const cardStyle: React.CSSProperties = {
  padding: '20px',
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  border: '1px solid #dee2e6'
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid #dee2e6'
};

export default StockAnalyzer;
