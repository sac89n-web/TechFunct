# TechFunctN_LLM_ARCHITECTURE_GUIDE.md
### Version 1.0 — StratAI + StratSim + Kite Connect Integration
### Author: Sachin S. Sawant

---

# 1. PURPOSE
This document defines the complete LLM architecture for the TechFunctN application — spanning:

- StratSim (simulation engine)
- AI LTP Calculator
- Options Chain LTP Calculator
- Market Watch (live streaming)
- Research Insights
- Kite Connect real-time data
- Safety layer for all AI responses
- Amazon Q orchestration

This acts as the “LLM Brain Architecture” for your entire platform.

---

# 2. HIGH-LEVEL LLM ARCHITECTURE

```
                 ┌─────────────────────────────┐
                 │        TechFunctN UI        │
                 └───────▲───────────▲─────────┘
                         │           │
                         │           │ user prompt
                  UI Events       LLM requests
                         │           │
            ┌────────────┴───────────┴───────────┐
            │          Amazon Q Layer             │
            └────────────▲──────────▲────────────┘
                         │          │
                         │          │
            ┌────────────┴──┐   ┌───┴────────────────┐
            │ RULE ENGINE   │   │  TEMPLATE ENGINE    │
            │ (Master Rules)│   │ (TechFunctN Prompt) │
            └──────▲────────┘   └────▲────────────────┘
                   │                 │
                   │ validated plan  │
                   │                 │
            ┌──────┴─────────────────┴───────┐
            │    EXECUTION ORCHESTRATOR      │
            └──────▲──────────▲──────────────┘
                   │          │
                   │          │
            ┌──────┴────┐   ┌─┴───────────────────┐
            │StratSim WS│   │Kite Connect Integrator│
            └──────▲────┘   └───────────▲──────────┘
                   │                    │
                   │                    │
    ┌──────────────┴───────────┐   ┌────┴──────────────┐
    │ Historical Data Service   │   │ Live Market Stream │
    └──────────────────────────┘   └────────────────────┘
```

---

# 3. KEY PRINCIPLES

### 3.1 No Dummy / Mock Data  
LLM **must rely only** on:

- Real tick data from server
- Real option chain data from server
- Real historical candles from server
- Data returned by internal endpoints

NEVER generate price, IV, OI, or Greeks.

---

### 3.2 Server-side Execution Only  
LLM outputs **plans**, not executed code.

Server executes:

- Kite authentication  
- Tick subscription  
- Historical fetch  
- Strategy backtests  
- Order previews (in StratSim)  

---

### 3.3 Mandatory Structured JSON  
All LLM actionable outputs must return:

```json
{
  "task_id":"uuid",
  "module":"techfunctn",
  "operation":"...",
  "payload":{},
  "validations":[],
  "server_actions":[],
  "explainability":{}
}
```

---

# 4. MODULE ARCHITECTURE

## 4.1 StratSim Integration
Amazon Q supports:

- Job creation
- Order previews
- Replay planning
- Fill logic explanations

StratSim controls:

- Deterministic fills
- Slippage models
- Reproducibility

---

## 4.2 AI LTP Calculator
Direct integration with:

- Kite LTP
- MarketWatch data
- Real-time tick analysis

AI does:

- Momentum reasoning
- Spread reasoning
- Risk warnings

---

## 4.3 Options Chain LTP Calculator
Amazon Q operates on:

- Entire option chain array
- No invented rows
- IV, OI, LTP from server only

AI does:

- Support/resistance extraction
- PCR reasoning
- Reversal detection
- Volatility analysis

---

## 4.4 Research Engine
Provides:

- Indicator-based summaries
- Multi-timeframe fusion
- Risk-based scoring
- Strategy hints

No predictions beyond data-driven reasoning.

---

# 5. DATA FLOW OVERVIEW

```
User → Amazon Q → Rules Engine → Execution Orchestrator → 
    → (StratSim / LTP / OptionChain / MarketWatch / Research) 
    → Response → User
```

---

# END OF FILE
TechFunctN_LLM_ARCHITECTURE_GUIDE.md
