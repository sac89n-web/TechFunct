import React, { useState, useEffect, useCallback } from 'react';
import { optionsApi } from '../services/optionsApi';
import type {
  OptionIndex,
  OptionStrategy,
  OptionStrategyRequest,
  OptionsMarketMetrics,
} from '../types/options';
import MarketMetricsBar from '../components/options/MarketMetricsBar';
import StrategyCard     from '../components/options/StrategyCard';
import StrategyModal    from '../components/options/StrategyModal';

// ─── Types ───────────────────────────────────────────────────────────────────

const RISK_LEVELS = ['ALL', 'Low', 'Medium', 'High'] as const;

// ─── Page Component ──────────────────────────────────────────────────────────

const OptionStrategyBuilder: React.FC = () => {
  // Dropdown data
  const [indices,   setIndices]   = useState<OptionIndex[]>([]);
  const [expiries,  setExpiries]  = useState<string[]>([]);

  // Filter state
  const [index,   setIndex]   = useState('NIFTY50');
  const [expiry,  setExpiry]  = useState('');
  const [risk,    setRisk]    = useState<string>('ALL');
  const [topN,    setTopN]    = useState(10);
  const [budget,  setBudget]  = useState(500000);

  // Data state
  const [metrics,     setMetrics]     = useState<OptionsMarketMetrics | null>(null);
  const [strategies,  setStrategies]  = useState<OptionStrategy[]>([]);
  const [selected,    setSelected]    = useState<OptionStrategy | null>(null);

  // Loading / error
  const [loadingExpiries,   setLoadingExpiries]   = useState(false);
  const [loadingMetrics,    setLoadingMetrics]    = useState(false);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [syncing,           setSyncing]           = useState(false);
  const [error,             setError]             = useState<string | null>(null);

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    optionsApi.getIndices().then(setIndices).catch(() => null);
  }, []);

  // Reload expiries + metrics whenever index changes
  useEffect(() => {
    if (!index) return;
    setLoadingExpiries(true);
    setExpiry('');
    setStrategies([]);

    optionsApi
      .getExpiries(index)
      .then(exp => {
        setExpiries(exp);
        setExpiry(exp[0] ?? '');
      })
      .catch(err => setError(err?.response?.data?.error ?? String(err)))
      .finally(() => setLoadingExpiries(false));

    // Load market metrics independently
    setLoadingMetrics(true);
    optionsApi
      .getMetrics(index)
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoadingMetrics(false));
  }, [index]);

  // ─── Strategy fetch ─────────────────────────────────────────────────────────
  const fetchStrategies = useCallback(async () => {
    if (!expiry) return;
    setError(null);
    setLoadingStrategies(true);
    setStrategies([]);

    const req: OptionStrategyRequest = {
      indexName: index,
      expiry,
      topN,
      riskLevel: risk,
      capitalBudget: budget,
    };

    try {
      const results = await optionsApi.getTopStrategies(req);
      setStrategies(results);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error ?? String(err));
    } finally {
      setLoadingStrategies(false);
    }
  }, [index, expiry, topN, risk, budget]);

  // ─── Manual sync ───────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      await optionsApi.syncOptionInstruments();
      // reload expiries after sync
      const exp = await optionsApi.getExpiries(index);
      setExpiries(exp);
      if (exp.length > 0 && !exp.includes(expiry)) setExpiry(exp[0]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error ?? String(err));
    } finally {
      setSyncing(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Option Strategy Builder</h1>
          <p style={subtitleStyle}>
            Server-ranked strategies using live Kite option chain data, Greeks &amp; IV analytics.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={syncBtnStyle}
          title="Sync NFO/BFO option instruments from Kite"
        >
          {syncing ? 'Syncing…' : '⟳ Sync Instruments'}
        </button>
      </div>

      {/* Market Metrics Bar */}
      {loadingMetrics ? (
        <div style={skeletonStyle} />
      ) : metrics ? (
        <MarketMetricsBar metrics={metrics} />
      ) : null}

      {/* Filter Panel */}
      <div style={filterPanelStyle}>
        {/* Index */}
        <FilterGroup label="Index">
          <select value={index} onChange={e => setIndex(e.target.value)} style={selectStyle}>
            {indices.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </FilterGroup>

        {/* Expiry */}
        <FilterGroup label="Expiry">
          <select
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            style={selectStyle}
            disabled={loadingExpiries}
          >
            {loadingExpiries
              ? <option>Loading…</option>
              : expiries.map(e => <option key={e} value={e}>{e}</option>)
            }
          </select>
        </FilterGroup>

        {/* Risk */}
        <FilterGroup label="Risk Level">
          <div style={chipGroupStyle}>
            {RISK_LEVELS.map(r => (
              <button
                key={r}
                style={chipBtnStyle(r === risk)}
                onClick={() => setRisk(r)}
              >{r}</button>
            ))}
          </div>
        </FilterGroup>

        {/* Top N */}
        <FilterGroup label={`Top N: ${topN}`}>
          <input
            type="range" min={3} max={15} step={1} value={topN}
            onChange={e => setTopN(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6' }}
          />
        </FilterGroup>

        {/* Budget */}
        <FilterGroup label={`Budget: ₹${(budget / 100000).toFixed(1)}L`}>
          <input
            type="range" min={100000} max={2000000} step={50000} value={budget}
            onChange={e => setBudget(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6' }}
          />
        </FilterGroup>

        {/* Generate button */}
        <button
          onClick={fetchStrategies}
          disabled={loadingStrategies || !expiry}
          style={generateBtnStyle}
        >
          {loadingStrategies ? 'Generating…' : 'Generate Strategies'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={errorBoxStyle}>
          <strong>Error: </strong>{error}
        </div>
      )}

      {/* Strategy Grid */}
      {loadingStrategies ? (
        <div style={loadingGridStyle}>
          {[...Array(topN > 6 ? 6 : topN)].map((_, i) => (
            <div key={i} style={skeletonCardStyle} />
          ))}
        </div>
      ) : strategies.length > 0 ? (
        <>
          <div style={gridHeaderStyle}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              {strategies.length} strategies generated for {index} — {expiry}
            </span>
          </div>
          <div style={gridStyle}>
            {strategies.map(s => (
              <StrategyCard key={s.strategyId} strategy={s} onClick={setSelected} />
            ))}
          </div>
        </>
      ) : !loadingStrategies && !error && strategies.length === 0 && expiry ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Select filters above and click <strong style={{ color: '#3b82f6' }}>Generate Strategies</strong> to begin.
          </div>
          {expiries.length === 0 && (
            <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 13 }}>
              No expiries found — click <strong>⟳ Sync Instruments</strong> to populate NFO data.
            </div>
          )}
        </div>
      ) : null}

      {/* Detail Modal */}
      {selected && (
        <StrategyModal strategy={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

// ─── Sub-component ───────────────────────────────────────────────────────────
const FilterGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </label>
    {children}
  </div>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#0f172a',
  color: '#f1f5f9',
  padding: '24px 28px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '20px',
};

const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9',
};

const subtitleStyle: React.CSSProperties = {
  margin: '4px 0 0', fontSize: 13, color: '#64748b',
};

const syncBtnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8,
  backgroundColor: 'transparent', color: '#94a3b8',
  border: '1px solid #475569', cursor: 'pointer', fontSize: 13,
};

const filterPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  alignItems: 'flex-end',
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: '16px',
};

const selectStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  color: '#e2e8f0',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  minWidth: 140,
};

const chipGroupStyle: React.CSSProperties = {
  display: 'flex', gap: 4,
};

const chipBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
  border: active ? 'none' : '1px solid #334155',
  backgroundColor: active ? '#3b82f6' : 'transparent',
  color: active ? 'white' : '#94a3b8',
});

const generateBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  padding: '8px 20px', borderRadius: 8,
  backgroundColor: '#3b82f6', color: 'white',
  border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  minWidth: 160,
};

const errorBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#fca5a5',
  borderRadius: 8,
  padding: '10px 14px',
  marginBottom: 16,
  fontSize: 13,
};

const gridHeaderStyle: React.CSSProperties = {
  marginBottom: 12,
};

const gridStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
};

const loadingGridStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
};

const skeletonStyle: React.CSSProperties = {
  height: 60,
  backgroundColor: '#1e293b',
  borderRadius: 8,
  marginBottom: 16,
  animation: 'pulse 1.5s ease-in-out infinite',
};

const skeletonCardStyle: React.CSSProperties = {
  width: 300,
  height: 240,
  backgroundColor: '#1e293b',
  borderRadius: 10,
  border: '1px solid #334155',
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 0',
};

export default OptionStrategyBuilder;
