export const Config = {
  // Production API base – change to http://127.0.0.1:5000 for local dev
  API_BASE_URL: 'https://api.techfunctn.com',

  // SignalR hub paths
  MARKET_HUB_URL: 'https://api.techfunctn.com/hubs/marketdata',
  OPTIONS_HUB_URL: 'https://api.techfunctn.com/hubs/options',

  // Polling intervals (ms)
  INDEX_REFRESH_MS: 30_000,
  HEATMAP_REFRESH_MS: 60_000,
  MOMENTUM_REFRESH_MS: 30_000,

  // Options
  OPTIONS_REFRESH_MS: 30_000,

  // AI Assistant
  AI_ENDPOINT: '/api/ai/assistant',

  // Session storage key
  SESSION_KEY: 'kite_session',
} as const;
