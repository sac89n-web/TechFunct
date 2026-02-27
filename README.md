# Market Analytics - Institutional Trading Dashboard

A production-grade market analytics web application providing real-time market intelligence, technical analysis, and momentum scanning capabilities powered by Zerodha Kite Connect API.

## 🎯 Features

- **NIFTY Heatmap Dashboard** - Visual representation of index constituents with color-coded performance
- **Momentum Scanner** - Real-time momentum scoring and signal generation
- **Stock Research & Analyzer** - Deep technical analysis with composite scoring
- **Live Market Feed** - WebSocket-based real-time market data
- **Historical Data Analytics** - Multi-timeframe historical data storage
- **Auto Technical Indicator Engine** - Automated calculation of SMA, RSI, Bollinger Bands, etc.

## 🏗️ Architecture

```
React TypeScript UI (Port 3000)
        │
        ▼
.NET Core API Layer (Port 5000)
        │
        ├── Indicator Engine
        ├── Market Analytics Engine
        ├── Kite Connect Integration
        └── Cache Layer
        │
        ▼
SQL Server Database
        │
        ▼
Kite Connect (REST + WebSocket)
```

## 📋 Prerequisites

- .NET 8.0 SDK
- Node.js 18+ and npm
- PostgreSQL 14+
- Zerodha Kite Connect API credentials

## 🚀 Setup Instructions

### 1. Database Setup (PostgreSQL)

**Install PostgreSQL:**
- Download from https://www.postgresql.org/download/
- Default credentials: username=`postgres`, password=`postgres`

**Create Database & Tables:**

**Windows:**
```bash
cd backend\Database
setup.bat
```

**Linux/Mac:**
```bash
cd backend/Database
chmod +x setup.sh
./setup.sh
```

**Manual Setup:**
```bash
psql -U postgres -f backend/Database/PostgreSQL_Schema.sql
```

### 2. Backend Configuration

Edit `backend/MarketAnalytics.API/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=marketanalytics;Username=postgres;Password=postgres"
  },
  "Kite": {
    "ApiKey": "YOUR_KITE_API_KEY",
    "ApiSecret": "YOUR_KITE_API_SECRET"
  }
}
```

### 3. Backend Build & Run

```bash
cd backend
dotnet restore
dotnet build
cd MarketAnalytics.API
dotnet run
```

Backend will start on `http://localhost:5000`

### 4. Frontend Setup & Run

```bash
cd frontend
npm install
npm run dev
```

Frontend will start on `http://localhost:3000`

## 🔐 Kite Connect Authentication Flow

### Step 1: Get Login URL
```bash
GET http://localhost:5000/api/auth/login-url
```

Response:
```json
{
  "loginUrl": "https://kite.zerodha.com/connect/login?v=3&api_key=YOUR_KEY"
}
```

### Step 2: User Login
- Open the `loginUrl` in browser
- Login with Zerodha credentials
- You'll be redirected with `request_token` parameter

### Step 3: Generate Session
```bash
POST http://localhost:5000/api/auth/session
Content-Type: application/json

{
  "requestToken": "RECEIVED_REQUEST_TOKEN"
}
```

Response:
```json
{
  "accessToken": "...",
  "publicToken": "...",
  "userId": "..."
}
```

The access token is automatically stored and valid for the trading day.

## 📡 API Endpoints

### Market APIs

**Get Heatmap**
```
GET /api/market/heatmap?index=NIFTY50
```

**Get Momentum Scanner**
```
GET /api/market/momentum?index=NIFTY50
```

**Get Market Breadth**
```
GET /api/market/breadth?index=NIFTY50
```

### Stock Analysis

**Analyze Stock**
```
GET /api/stock/analyze?symbol=RELIANCE
```

Response includes:
- Current price and moving averages
- RSI, Bollinger Bands
- Golden/Death cross detection
- Composite score (0-100)
- Trade signal (BUY/HOLD/AVOID)
- Targets and stop loss
- Risk/Reward ratio

## 🔄 Background Services

### Token Refresh Service
- Runs daily before market open
- Invalidates expired tokens
- Requires user re-authentication

### Market Data Sync Service
- Runs every 5 minutes during market hours
- Syncs instrument data
- Calculates technical indicators
- Updates momentum scores
- Pushes real-time updates via SignalR

## 📊 Technical Indicators

### Calculated Automatically:
- **SMA** (20, 50, 200 periods)
- **RSI** (14 periods)
- **Bollinger Bands** (20 period, 2 std dev)
- **Volume Ratio** (20 period average)
- **Distance from Averages** (%)
- **Golden/Death Cross** detection

### Momentum Score (0-100):
| Factor | Weight |
|--------|--------|
| Price > SMA20 | 15 |
| Price > SMA50 | 20 |
| RSI Trend | 15 |
| Volume Spike | 20 |
| Breakout Proximity | 15 |
| Sector Strength | 15 |

### Signal Classification:
- **Score > 75** → STRONG BUY
- **60-75** → BUILDING MOMENTUM
- **40-60** → WATCHLIST
- **< 40** → WEAK

## 🎨 Frontend Pages

### Market Radar (`/`)
- Index selector (NIFTY50, NIFTY100)
- Market breadth panel
- Heatmap view with color-coded tiles
- Momentum scanner grid
- Auto-refresh every 5 seconds

### Stock Analyzer (`/analyzer`)
- Symbol search
- Comprehensive technical analysis
- Visual indicators display
- Trade signal with composite score
- Target and risk calculations

## 🔧 Performance Optimizations

- **In-memory caching** using ConcurrentDictionary
- **Batch indicator calculation** for 500+ stocks
- **Async processing** throughout
- **Background hosted services** for scheduled tasks
- **SignalR** for real-time push updates
- **Database indexing** on critical columns

## 📦 Project Structure

```
backend/
├── MarketAnalytics.Core/          # Domain models, DTOs, interfaces
├── MarketAnalytics.Infrastructure/ # Services, data access, cache
├── MarketAnalytics.API/           # Controllers, hubs, background services
└── Database/                      # SQL schema scripts

frontend/
├── src/
│   ├── components/               # Reusable UI components
│   ├── pages/                    # Route pages
│   ├── services/                 # API client
│   └── types/                    # TypeScript definitions
```

## 🔒 Security Features

- API secret never exposed to frontend
- Encrypted token storage
- Token expiry validation
- Automatic reconnection on WebSocket failure
- CORS configuration for production

## 📈 Data Flow

1. **Kite Connect** → Historical data sync (daily)
2. **WebSocket** → Live ticks → Memory cache
3. **Indicator Engine** → Batch calculation → Database
4. **Analytics Service** → Aggregation → API response
5. **SignalR Hub** → Real-time push → React UI

## 🛠️ Development

### Backend Testing
```bash
cd backend/MarketAnalytics.API
dotnet watch run
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Build for Production
```bash
# Backend
cd backend
dotnet publish -c Release

# Frontend
cd frontend
npm run build
```

## 📝 Notes

- Access token valid for 1 trading day only
- Instrument master should be synced daily
- Historical data sync recommended before market open
- WebSocket connection requires active access token
- NIFTY50 constituents are hardcoded (update as needed)

## 🎯 Target Performance

- NIFTY100 scan: < 3 seconds
- API response time: < 500ms
- Real-time update latency: < 100ms
- Indicator calculation: Batch 500 stocks in < 5 seconds

## 📞 Support

For Kite Connect API issues, refer to:
- [Kite Connect Documentation](https://kite.trade/docs/connect/v3/)
- [API Forum](https://kite.trade/forum/)

## ⚖️ License

This is a demonstration project. Ensure compliance with Zerodha's API terms of service.
