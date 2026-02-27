AMAZON_Q_KITE_RULES.md

Version: 1.0
Author: StratAI (Sachin S. Sawant)
Purpose: Define strict rules for Amazon Q when preparing or reasoning about Kite Connect API usage inside StratAI/StratSim.
Status: READY TO USE

AMAZON_Q_KITE_RULES.md
🚀 Overview

These rules ensure Amazon Q:

Uses Kite Connect APIs correctly

Never leaks API secrets or access tokens

Generates structured, machine-readable JSON for all API action plans

Produces deterministic, auditable, and reproducible outputs

Always uses server-side execution, never client-side calls

Integrates safely with StratAI and StratSim

Amazon Q must treat this file as strict operational policy.

1. 🔐 SECURITY — NON-NEGOTIABLE RULES

Never output:

api_key

api_secret

access_token

public_token

refresh_token

Any JWT belonging to the user

When referencing any sensitive value, Amazon Q MUST use placeholders:

{{SERVER_KITE_API_KEY}}
{{SERVER_KITE_API_SECRET}}
{{SERVER_FETCH('kite.access_token')}}


All Kite API requests MUST be executed server-side.

The client/browser/mobile must never call a Kite endpoint directly.

Amazon Q must not fabricate endpoints; must use only official ones listed below.

Amazon Q must NOT output API keys inside sample code, examples, CURL, or JSON.

Amazon Q must mask PII using: [USER_ID], [ACCOUNT_NO], etc.

2. 🎯 SCOPE OF ALLOWED KITE CONNECT API ENDPOINTS

The only Kite Connect endpoints Amazon Q is allowed to prepare action plans for:

Authentication Flows

GET (server generates login URL) — https://kite.zerodha.com/connect/login

POST https://api.kite.trade/session/token

Instruments & Metadata

GET https://api.kite.trade/instruments

GET https://api.kite.trade/instruments/{exchange}

Live Market Data

wss://ws.kite.trade?api_key=<>&access_token=<>

Quotes:

GET https://api.kite.trade/quote?i=<instrument>

GET https://api.kite.trade/ltp?i=<instrument>

Historical Data

GET https://api.kite.trade/instruments/historical/{instrument_token}/{interval}?from=&to=

Portfolio (live account only, not StratSim)

GET https://api.kite.trade/user/margins

GET https://api.kite.trade/portfolio/positions

GET https://api.kite.trade/portfolio/holdings

GET https://api.kite.trade/user/profile

🚫 Disallowed for StratSim (live trading only)

/orders/*

/trades

Amazon Q must NEVER produce or suggest real order placement in StratSim.

3. 📦 REQUIRED OUTPUT FORMAT — STRICT JSON SCHEMA

Whenever Amazon Q is asked to generate any Kite API plan, the output MUST be:

{
  "action_id": "uuid-v4",
  "api_action": "kite.<category>.<operation>",
  "execution": {
    "endpoint": "https://api.kite.trade/<path>",
    "method": "GET|POST",
    "headers": {
      "Authorization": "token {{SERVER_KITE_API_KEY}}:{{SERVER_FETCH('kite.access_token')}}",
      "Content-Type": "application/json"
    },
    "query_params": {},
    "body": {},
    "server_side_steps": [
      "Step-by-step instructions executed ONLY by server"
    ],
    "execute_notes": "Human readable explanation for devs"
  },
  "validation": {
    "client_validations": [ "List of pre-flight checks" ],
    "server_validations": [ "List of server-level validations" ]
  },
  "expected_success_response_schema": {
    "status": "success",
    "data": "JSON object representing expected Kite response"
  },
  "expected_error_handling": [
    { "http": 401, "user_message": "Kite session expired, please reconnect." },
    { "http": 429, "user_message": "Rate limit reached, retry queued." },
    { "http": 500, "user_message": "Temporary Kite issue, retry later." }
  ],
  "explainability": {
    "why": "Reason behind this plan",
    "input_features": { }
  }
}


Amazon Q MUST include this JSON block in every response involving Kite APIs.

4. 🔁 AUTHENTICATION FLOW RULES
4.1. Generate Login URL

Amazon Q must NOT construct login URLs directly.
Output:

"url": "{{SERVER_GENERATED_KITE_LOGIN_URL}}"


Server generates and returns a safe login URL containing:

api_key (server inserts)

Registered redirect URL

4.2. Exchange request_token for access_token

Amazon Q MUST output:

placeholder for request_token

placeholder for checksum

Example:

{
  "execution": {
    "endpoint": "https://api.kite.trade/session/token",
    "method": "POST",
    "body": {
      "api_key": "{{SERVER_KITE_API_KEY}}",
      "request_token": "{{REQUEST_TOKEN}}",
      "checksum": "{{SERVER_COMPUTED_CHECKSUM}}"
    },
    "server_side_steps": [
      "Compute checksum = sha256(api_key + request_token + api_secret)",
      "POST to Kite session/token",
      "Store access_token encrypted (KMS/Vault)",
      "Map access_token to user session"
    ]
  }
}


Amazon Q must NEVER compute checksum.

5. 📡 LIVE DATA RULES
Always use server WS

Amazon Q must describe live feeds as:

SERVER connects to wss://ws.kite.trade with api_key + access_token  
SERVER fans out ticks to StratSim/StratAI workers via internal WS  


Client-side code must subscribe only to:

wss://yourdomain.com/stratsim/ws/{job_id}

Subscriptions

Amazon Q output must:

Send subscription list to StratSim backend, not Kite

Never expose access_token

6. 📚 HISTORICAL DATA RULES

When asked to provide a historical fetch plan:

Amazon Q must break the request into daily chunks if over 1-day range.

Use endpoint:

GET https://api.kite.trade/instruments/historical/{instrument_token}/{interval}?from=YYYY-MM-DD&to=YYYY-MM-DD


Must produce a JSON plan listing:

chunk ranges

estimated server requests

retry strategy

caching notes

Example output:

{
  "api_action": "kite.historical.fetch",
  "execution": {
    "endpoint": "https://api.kite.trade/instruments/historical/{token}/{interval}",
    "method": "GET",
    "query_params": {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD"
    },
    "server_side_steps": [
      "Chunk 90-day range into daily requests",
      "Fetch sequentially respecting rate-limits",
      "Store to S3/Parquet cache",
      "Return aggregated candle list"
    ]
  }
}

7. 🧪 ERROR HANDLING RULES

Amazon Q must ALWAYS include error handling plan:

Error	Meaning	Required Behavior
401	Invalid/Expired session	Trigger re-login; invalidate access_token in server
403	Forbidden	Show “Not authorized”
404	Missing instrument/data	Suggest closest available range
409	Conflict	Retry later
429	Rate limit	Queue + backoff (2s, 4s, 8s…)
500	Kite failure	Retry + escalate

All error messages must be surfaced as user-friendly text.

8. 🧭 PROMPT TEMPLATES Amazon Q MUST USE
Template A — Prepare login URL
Prepare a plan to retrieve the Kite login URL from server. 
Do NOT generate URL yourself. 
Return JSON structured per AMAZON_Q_KITE_RULES.md.

Template B — Exchange request_token
Prepare server-side plan to exchange request_token '{{REQUEST_TOKEN}}' for access_token via Kite session/token.
Return JSON structured per AMAZON_Q_KITE_RULES.md.

Template C — Fetch historical candles
Prepare chunked historical fetch plan for instrument_token {{TOKEN}} from {{FROM}} to {{TO}} at {{INTERVAL}}.
Return JSON structured per AMAZON_Q_KITE_RULES.md.

Template D — Subscribe to live ticks
Prepare plan to subscribe server-side to live ticks for tokens [{{TOKENS}}], with server fan-out to StratSim WS.
Return JSON structured per AMAZON_Q_KITE_RULES.md.

9. ⚠ ABSOLUTE PROHIBITIONS

Amazon Q must NEVER:

Output full authorization headers containing secrets

Output CURL commands with real tokens

Suggest bypassing StratAI backend

Suggest placing real orders inside StratSim

Suggest storing access_token in localStorage or visible logs

Hardcode API rate limits

Use undocumented Kite endpoints

Violation of these rules must generate a self-warning:

“This request violates AMAZON_Q_KITE_RULES.md. Cannot comply.”

10. 🧩 EXAMPLE OF A PERFECT AMAZON Q OUTPUT

User prompt:
“Prepare a plan to get historical candles for INFY from 2025-01-01 to 2025-01-10 at 1minute interval.”

Amazon Q must output:

{
  "action_id": "8fb87d9c-aaa4-4ff0-a19e-aa82092f5c22",
  "api_action": "kite.historical.fetch",
  "execution": {
    "endpoint": "https://api.kite.trade/instruments/historical/408065/1minute",
    "method": "GET",
    "headers": {
      "Authorization": "token {{SERVER_KITE_API_KEY}}:{{SERVER_FETCH('kite.access_token')}}",
      "Content-Type": "application/json"
    },
    "query_params": {
      "from": "2025-01-01",
      "to": "2025-01-10"
    },
    "server_side_steps": [
      "Chunk into daily ranges",
      "Fetch 10 days from Kite respecting rate-limits",
      "Store data into S3/Parquet cache",
      "Return aggregated OHLCV list"
    ],
    "execute_notes": "Server-only call. Requires valid encrypted access_token."
  },
  "validation": {
    "client_validations": [ "From < To", "Interval valid" ],
    "server_validations": [ "Instrument exists in server cache" ]
  },
  "expected_success_response_schema": {
    "status": "success",
    "candles": "list<array>"
  },
  "expected_error_handling": [
    { "http": 401, "user_message": "Kite session expired." },
    { "http": 429, "user_message": "Rate limit reached, retrying soon." }
  ],
  "explainability": {
    "why": "Historical candles required for StratSim replay or backtest.",
    "input_features": {
      "instrument": "INFY",
      "range_days": 10
    }
  }
}


This is the exact behavior Amazon Q must follow.

END OF FILE
