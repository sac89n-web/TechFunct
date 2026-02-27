RULES_TECHFUNCTN.md — techFunctN — Full-Stack Architecture & Coding Standards

Purpose: single source of truth for engineering rules, API usage, security, and non-functional expectations for TechFunctN.
Status: ready to commit.
NOTE (mandatory): Do not use dummy/mock data anywhere in any code path that can reach production/test systems or be used for analytics/back-testing unless that usage is explicitly scoped, isolated, and flagged with secure feature flags and separate test datasets. (See the Enforcement section.)

Table of contents

Scope & audience

High-level principles

Coding / architecture standards (full-stack)

Data rules (critical)

Kite Connect API — required usage & endpoints (for AI trading & LTP calculators)

AI strategy engine: data inputs & endpoints required

Security, credentials & secrets handling

Observability & job logging (SQL + app level)

Performance & rate limits (how to behave)

Tests, CI, and deployment rules

Enforcement, reviewers & exceptions

1. Scope & audience

Applies to all engineers (frontend, backend, data, infra, QA) delivering TechFunctN modules: market data, strategy engine, option chain LTP calculators, order execution, portfolio, back-office integrations.

2. High-level principles

Safety-first for real money operations — explicitly separate sandbox/test mode from production.

Reliable, auditable, and reproducible pipelines for any data used by AI/automations.

Use canonical data sources; prefer live, streamed market data for LTP and historical authoritative sources for backtests.

All production integrations require documented contracts (endpoints, expected schemas, auth, throttling).

No use of dummy/mock data in production data paths. (See Section 4.)

Never ever use simple wor around than solving problems actually. 

3. Coding / architecture standards (full-stack)

Backend: APIs must be RESTful or gRPC, follow OpenAPI v3, validate inputs using JSON schema, and return consistent error codes.

Frontend: React + TypeScript, follow component library and accessibility standards. Use Tailwind utility classes for layout.

Data layer: centralized schema registry. Store raw market feeds in append-only tables, separate derived tables for business logic.

Services: each bounded context must have health checks, metrics, and structured logs (JSON).

Transactions: any money movement or ledger write must be idempotent and audit-logged.

4. Data rules (CRITICAL)

Do not use dummy/mock data anywhere where the code can be used in production or used for analytics/back-testing unless it is:

strictly isolated in a test namespace, OR

behind a feature flag and uses clearly separated test accounts, AND

documented in the PR with reviewer sign-off.

Persist raw market data (LTP/quotes/trades) for at least 30 days; keep aggregated/historical per compliance needs.

Persist audit trails for order placements/cancels/modify for minimum 2 years (or as regulatory requirements demand).

All data transformations must be reversible / reproducible; store transformation scripts in the repo.

5. Kite Connect API — proper usage & endpoints

This section lists the Kite Connect REST & WS endpoints and recommended usage patterns required to build AI-powered automated trading strategies and an advanced option chain LTP calculator. Use the official Kite Connect docs as the source of truth. 
kite.trade
+1

5.1 Authentication & session flow (mandatory)

Login / Authorization: browser-based login redirect flow for user authorization. Use the official connect/login URL to obtain request_token.

Example pattern (browser redirect): https://kite.zerodha.com/connect/login?v=3&api_key=<API_KEY> — after login the broker returns a request_token. 
kite.trade

Session / Access token: exchange request_token + api_secret -> call session endpoint to obtain short-lived access_token and public_token (depends on library). Keep access tokens per user, encrypted at rest.

Always validate token expiry before calls and refresh via full login if expired.

Secure handling: treat API key + secret + user access tokens as secrets. Store in vault; never hardcode.

5.2 Core REST endpoints (load-bearing list)

Use these endpoints to build an AI trading & LTP calculator pipeline. (Paths shown are logical resources — implementation details (query parameters, exact path forms) MUST follow official docs and client libraries.) Key endpoints include:

Instruments list

GET /instruments — full instruments list (usually offered as a CSV). Use to build symbol ↔ instrument_token mapping (instrument_token is required by many data endpoints). Cache locally and refresh daily. 
kite.trade

LTP / Quote

GET /quote/ltp?i=<exchange:instrument_token> — get current LTP for one or many instrument tokens (used by LTP calculator, option chain real-time LTP). Ensure batching where supported. 
kite.trade

OHLC / Quote OHLC

GET /quote/ohlc?i=<exchange:instrument_token> — current OHLC snapshot.

Historical / Candle data

GET /instruments/historical/{instrument_token}/{interval}?from=YYYY-MM-DD&to=YYYY-MM-DD — fetch candles (1m, 3m, 5m, 15m, 1d, 1w etc.) — required for backtesting, features for AI models, and option chain analytics. Cache at appropriate resolutions. 
kite.trade

Order management

POST /orders/regular — place an order (params: tradingsymbol/instrument_token, quantity, order_type, transaction_type (BUY/SELL), product, price, trigger_price etc.)

PUT /orders/<order_id> — modify an order

DELETE /orders/<order_id> — cancel an order

GET /orders — orderbook (all orders)

GET /orders/<order_id> — order status

Important: follow idempotency and client request sequencing. Respect per-user order throttles. 
kite.trade

Orderbook / Trades

GET /orders (orderbook) and GET /trades — required to reconcile strategy executions and P&L.

Margins / Profile / Holdings / Positions

GET /user/margins — margin info (useful for risk checks in automated strategies).

GET /portfolio/holdings — holdings.

GET /portfolio/positions — positions (day, net).

Use these before sending orders (risk control). 
kite.trade

Instruments metadata / Option chain

Use GET /instruments and instrument metadata to derive option chain (strike, expiry, instrument_token). For option chain LTP, combine instrument list + quote/ltp calls per option instrument_token.

GTT (If supported & required)

APIs for Good Till Trigger (GTT) to create conditional automated triggers — if your design uses GTT, include calls to create/update/delete GTT. Verify availability & limits.

Webhooks / WebSocket

WebSocket streaming for LTP & ticks: use the official WebSocket URL and token to subscribe to instrument tokens — wss://ws.kite.trade?api_key=<API_KEY>&access_token=<ACCESS_TOKEN> (see official docs for exact connection flow and sub protocols). Use WS for sub-second updates for LTP calculators and strategy signals. 
kite.trade
+1

Authoritative docs: Always cross-check parameter names, payload shapes and exact endpoints against the official Kite Connect documentation and official SDKs (Python / Node / .NET). 
kite.trade

5.3 Usage patterns & best practices

Batch LTP / Quote calls: prefer multi-instrument LTP queries if supported to reduce roundtrips.

Caching & TTL: push LTP updates into an in-memory cache (Redis) with TTL measured in seconds for UI; persist raw tick streams into append-only storage for analytics/backtests.

Backtest data: use historical candle endpoints, avoid using scraped or unreliable sources. Persist raw historical payloads used for model training.

Rate limit awareness: implement exponential backoff and circuit breaking on 429/503 responses. Do not busy-loop on rate-limited endpoints. 
kite.trade

6. AI strategy engine — data inputs & required endpoints

For AI-powered strategy builder and advanced option chain LTP calculator you must integrate the following data sources/endpoints:

Symbol master / instruments — GET /instruments (daily refresh) — to generate option chain tokens (strike/expiry). 
kite.trade

Real-time ticks / LTP — WebSocket subscription to many instrument_tokens OR batched GET /quote/ltp for sets of instruments (option strikes). Use WS for low latency signals. 
kite.trade

Historical candles — GET /instruments/historical/{instrument_token}/{interval} for features, vol surface modeling, and training data. 
kite.trade

Order APIs — Place/modify/cancel orders with robust error handling (idempotency, retries, reconciliation). 
kite.trade

Positions & margins — GET /portfolio/positions, GET /user/margins to compute leverage, risk checks, and position sizing. 
kite.trade

Corporate actions / corporate data — if required for derivatives modeling, maintain separate ingesters.

Risk / compliance — all trade signals must go through a Risk API that verifies order size, margin, concentration, and cooling-off rules before execution.

Data pipeline:

Raw ingestion (WS/csv) -> raw store (append only) -> feature store (aggregations) -> model inference service -> signal queue -> risk checks -> order executor -> reconciler.

7. Security, credentials & secrets handling

API Key / Secret: store in a secrets manager (HashiCorp Vault / AWS Secrets Manager / Azure KeyVault), not in code or config repos.

Per-user access tokens: encrypted in the database using a vault key and rotate periodically.

Network: TLS only for all endpoints. For webhook endpoints, validate HMAC signatures.

Least privilege: microservices running order execution must have minimal network access and require an explicit human approval step if the environment is flagged as manual-approval mode.

8. Observability & job logging (SQL + app level)

All automated jobs (SQL stored procedures that run periodic batch calculations) must:

Emit clearly structured job logs to both DB job history (table JobRunLog) and to centralized logging (ELK/CloudWatch).

Use a unique RunId GUID per run; StartTime, EndTime, Phase, Message, IsError, and any retry counts.

Avoid long-running open transactions while logging; commit log rows frequently to avoid locking and to make state visible in job history.

Stored procedure usp_JobLog must be non-blocking (simple insert with TRY/CATCH) and must not RETURN early without logging completion. Example schema required: JobRunLog(RunId uniqueidentifier, ProcName nvarchar(...), Phase nvarchar(...), Message nvarchar(...), IsError bit, HostName, LoginName, CreatedAt datetime). (This project already uses such a table — keep inserts idempotent or use ON DUPLICATE semantics if your PK collides).

SQL logging best practice: log minimal data inside the DB (IDs, phases, error codes); include rich payloads in centralized logs (to avoid nvarchar(4k) truncation issues). Use WITH NOWAIT severity 10 for progress messages if needed.

9. Performance & rate limits

Respect external API rate limits (Kite Connect rate limits are per API key and per user for some operations) — implement request throttlers and global token buckets. 
kite.trade

For heavy calculations (e.g., daily reconciliation over many clients), use incremental processing / partitioned date ranges and run in parallel worker batches rather than a single monolithic run. Use table partitioning for very large tables (see internal doc on partitioning).

Cache instrument metadata and static mappings locally. For LTP heavy loads use WebSockets not frequent REST polls.

10. Tests, CI, and deployments

Unit tests for business logic, integration tests against a sandbox Kite Connect account. Sandbox datasets must be seeded from sanitized production exports (no PII), and clearly labelled.

Integration test checklist for trading flows: order placement → partial filling → cancel → position update → reconciliation.

Canary deploys for any service that executes orders; disable automatic execution in canary unless explicit permission.

11. Enforcement, reviewers & exceptions

All PRs touching trading, order flows, market data ingestion, or DB stored procs that affect ledgers must have at least 2 reviewers: one Domain SME (Trading/backoffice) and one Security/Infra reviewer.

Exceptions to "no dummy/mock data" require written approval from Tech Lead + Compliance and must be timeboxed and auditable.

Appendix — Quick reference: Essential Kite Connect endpoints (summary)

Quick list meant for developer onboarding. Consult the official docs for exact paths, parameters and SDKs. 
kite.trade
+1

Authentication: https://kite.zerodha.com/connect/login?v=3&api_key=<API_KEY> → exchange request_token at session endpoint. 
kite.trade

Instruments (master): GET /instruments (CSV) — daily refresh for option chain mapping. 
kite.trade

LTP / Quote: GET /quote/ltp?i=<exchange:instrument_token>[,<...>] — current LTP for instruments. 
kite.trade

Quote OHLC: GET /quote/ohlc?i=<instrument_token> — current OHLC snapshot. 
kite.trade

Historical candles: GET /instruments/historical/{instrument_token}/{interval}?from=YYYY-MM-DD&to=YYYY-MM-DD — candle data for modeling/backtests. 
kite.trade

Orders: POST /orders/regular, PUT /orders/{order_id}, DELETE /orders/{order_id}, GET /orders, GET /orders/{order_id}. 
kite.trade

Orderbook/trades: GET /orders, GET /trades. 
kite.trade

Portfolio / positions / holdings / margins: GET /portfolio/positions, GET /portfolio/holdings, GET /user/margins. 
kite.trade

WebSocket for ticks: official WS URL + access token (check docs for exact connection handshake). Use WS for real-time LTP and tick streaming. 
kite.trade
+1

Minimal checklist before committing code that calls Kite Connect

 Secrets stored in vault, not repo.

 All endpoint calls use official SDKs where possible; otherwise wrap REST calls in an API client that implements retry, backoff, and metrics.

 Token expiry and re-login behavior implemented.

 Rate limiter in place and tested.

 WebSocket reconnect/backfill strategy implemented (persist incoming ticks and reconcile gaps on reconnect).

 Integration tests in sandbox; smoke tests pass.

 Reviewer sign-offs from Trading SME and Security.