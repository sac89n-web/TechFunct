import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

type LoginState = 'idle' | 'loading' | 'error' | 'cancelled';

const Login: React.FC = () => {
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'auth_failed') {
      setLoginState('error');
      setErrorMessage('Authentication failed. Please try again.');
    } else if (error === 'no_token') {
      setLoginState('cancelled');
      setErrorMessage('Login was cancelled or no token received.');
    }
  }, [searchParams]);

  const handleLogin = () => {
    setLoginState('loading');
    window.location.href = 'http://127.0.0.1:5000/api/auth/login';
  };

  const handleRetry = () => {
    setLoginState('idle');
    setErrorMessage('');
    window.history.replaceState({}, '', '/login');
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={logoStyle}>MA</div>
            <h1 style={titleStyle}>Market Analytics</h1>
            <p style={subtitleStyle}>Institutional Trading Dashboard</p>
          </div>

          {loginState === 'loading' && (
            <div style={{ textAlign: 'center' }}>
              <div style={spinnerStyle} />
              <p style={{ ...subtitleStyle, marginTop: '12px' }}>Connecting to Kite...</p>
            </div>
          )}

          {(loginState === 'error' || loginState === 'cancelled') && (
            <div style={errorBoxStyle}>
              <p style={errorTextStyle}>{errorMessage}</p>
              <button onClick={handleRetry} style={retryButtonStyle}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#dc2626')}>
                Reconnect to Kite
              </button>
            </div>
          )}

          {loginState === 'idle' && (
            <button
              onClick={handleLogin}
              style={loginButtonStyle}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
            >
              Login with Kite
            </button>
          )}

          <p style={footerTextStyle}>
            Powered by Zerodha Kite Connect
          </p>
        </div>
      </div>
    </>
  );
};

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f172a',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  padding: '48px 40px',
  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
  border: '1px solid #334155',
};

const logoStyle: React.CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: '12px',
  backgroundColor: '#2563eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 20px',
  fontSize: '20px',
  fontWeight: 700,
  color: 'white',
  letterSpacing: '1px',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '28px',
  fontWeight: 700,
  color: '#f1f5f9',
  letterSpacing: '-0.5px',
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  color: '#94a3b8',
};

const spinnerStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  border: '3px solid #334155',
  borderTopColor: '#2563eb',
  animation: 'spin 0.8s linear infinite',
  margin: '0 auto',
};

const errorBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(220, 38, 38, 0.1)',
  border: '1px solid rgba(220, 38, 38, 0.3)',
  borderRadius: '8px',
  padding: '16px',
};

const errorTextStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: '14px',
  color: '#fca5a5',
};

const retryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  backgroundColor: '#dc2626',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
};

const loginButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  letterSpacing: '0.3px',
};

const footerTextStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '12px',
  color: '#475569',
  marginTop: '24px',
  marginBottom: 0,
};

export default Login;
