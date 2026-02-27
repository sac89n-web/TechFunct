# TechFunctN_LLM_POLICY_MASTER.md
### Version 1.0 — Complete Rulebook  
### Purpose: This file governs Amazon Q behavior across ALL TechFunctN modules.

---

# 1. GLOBAL LAWS (APPLY TO ALL)

### 1.1 No Mock or Dummy Data  
Amazon Q must ONLY use real:

- LTP  
- OHLC  
- Tick stream  
- Option Chain (OI, IV, LTP, Greeks)  
- Server-provided signals  

No invented candles or data.

---

### 1.2 Structured JSON Required  
All actionable outputs must use:

```json
{
  "task_id":"",
  "module":"",
  "operation":"",
  "payload":{},
  "validations":[],
  "server_actions":[],
  "explainability":{}
}
```

---

### 1.3 No Secrets  
NEVER output:

- api_secret  
- access_token  
- api_key  
- Any JWT  

Use placeholders:
```
{{SERVER_KITE_API_KEY}}
{{SERVER_FETCH('kite.access_token')}}
```

---

# 2. MODULE RULES

---

## 2.1 StratSim Rules
Amazon Q must:

- Follow deterministic fill logic  
- Never generate hypothetical ticks  
- Return structured plans  
- Avoid real order placement  
- Follow seed-based reproducibility  

For each StratSim output:

- include explainability: which tick triggered fill  
- add all validations  
- no hallucinated prices  

---

## 2.2 AI LTP Calculator Rules
Amazon Q MUST:

- Use only real server LTP  
- Produce momentum reasoning  
- Provide safe warnings  
- Avoid directional predictions  
- NEVER guess LTP or OHLC  

---

## 2.3 Options Chain Calculator Rules

1. Use exact option chain provided  
2. Extract:
   - Max Pain  
   - PCR  
   - OI Build-Up  
   - IV Shift  
   - Reversal zones  
3. No made-up Greeks or IV  

---

## 2.4 Market Watch Rules
- Use real streaming ticks  
- Detect anomalies ONLY in provided ticks  
- Suggest:
  - Momentum
  - Volume shock
  - VWAP deviation  
- No self-generated prices  

---

## 2.5 Research Engine Rules
- Use actual OHLC/Indicator data  
- Provide:
  - Trend
  - Momentum
  - Volatility  
  - Risk notes  
- No future price prediction  

---

# 3. COMPLIANCE RESTRICTIONS

### Amazon Q MUST NOT:
❌ Predict future prices  
❌ Guarantee profit  
❌ Recommend naked leverage  
❌ Fabricate option chain rows  
❌ Invent candles or quotes  
❌ Output real trading calls inside StratSim  
❌ Output live Kite trade payloads without server validation  

---

# 4. ERROR HANDLING STANDARDS

- Use safe human language  
- Never expose internal traces  
- Always provide corrective suggestion  

Example:

```json
{
  "error":"invalid_range",
  "message":"Invalid date range. Ensure 'from' < 'to' and within available historical coverage."
}
```

---

# END OF FILE
TechFunctN_LLM_POLICY_MASTER.md
