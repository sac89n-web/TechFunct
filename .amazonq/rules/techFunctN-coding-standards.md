# Rule: TechFunctN – Full-Stack Development & Compliance Standards

## Purpose

Define unified technical, architectural, and security rules for the **TechFunctN v2.3 Automated Trading Application**.
Amazon Q Developer must adhere to these when generating, reviewing, or refactoring code.

---

## 1. Core Principles

* **Production-grade only**: all generated or suggested code must be deployable in live trading environments.
* **No mock, dummy, or placeholder data** anywhere (see Rule 2).
* Maintain **real-time accuracy** and **financial data integrity** at all layers.
* Follow the defined architecture: React → Node.js/Express → PostgreSQL → Kite Connect API.
* Enforce strong typing (TypeScript, Prisma schema types) and clean asynchronous patterns.
* Never break modular separation between Presentation, API, Business Logic, and Data Layer.
* Due to issues, do not simplify anything, try to resolve issues from the root.

---

## 2. 🚫 Prohibited: Dummy / Mock Data

**Dummy, sample, test, or mocked data are strictly banned.**

### Enforcement

* Do **not** create arrays, JSON, or constants with fake instruments, prices, or users.
* Do **not** use strings like `"TestUser"`, `"SampleSymbol"`, `"DemoTrade"`, `"FakeData"`, `"MockPrice"`.
* Do **not** call third-party “mock APIs” or static JSON endpoints to simulate market or ledger data.
* Never ever use simple wor around than solving problems actually. 
* Use only:

  * **Kite Connect sandbox** or
  * **Real sanitized data** from the database or cache.
* Amazon Q must warn:

  > ⚠ Rule Violation – Dummy/Mock data not permitted in TechFunctN. Replace with real API or sanitized dataset.

---

## 3. Frontend (React 18 + TypeScript + Vite)

* Use **functional components + hooks** only.
* Strict TypeScript mode (`"strict": true`) enforced.
* State management: **Zustand** or Redux Toolkit only.
* Styling: **Tailwind CSS** with centralized design tokens.
* Data sources: always via authenticated backend APIs or WebSocket streams.
* No direct calls to external APIs or mock data feeds.
* Animations via **Framer Motion**; no jQuery or inline JS effects.
* All text and labels via i18n constants; no hard-coded UI strings.
* Testing with real API stubs only; never local fakes.

---

## 4. Backend (Node 18 + Express + TypeScript)

* Follow **layered architecture**:
  `routes → controllers → services → repositories → Prisma ORM`.
* All database access through Prisma models.
* No raw queries unless optimized and reviewed.
* API responses always include `success`, `data`, `error`, `timestamp`.
* JWT-based authentication middleware mandatory for `/api/*`.
* Never expose `KITE_API_SECRET`, tokens, or DB credentials.
* Logging via structured logger (Winston / Pino).
* Implement retry & back-off for external API failures.
* Use environment variables (`process.env.*`) – never constants.
* Enable CORS only for approved origins (`127.0.0.1:3000`, prod domain).

---

## 5. Database (PostgreSQL 14 + Prisma)

* Schema managed only via `prisma migrate`.
* Naming conventions:

  * Tables → snake_case (`paper_positions`, `ai_trade_calls`)
  * Columns → snake_case (`instrument_token`)
* All timestamps → `TIMESTAMP WITH TIME ZONE`.
* Use indexes for frequently joined or filtered columns.
* Referential integrity via FKs on all user or instrument relations.
* Never insert mock symbols or invalid tokens.
* Seed data allowed only for enums/config (not trades).

---

## 6. API Standards

* RESTful URLs with versioning: `/api/v1/...`.
* Methods: `GET` for read, `POST` for create, `PUT` for update, `DELETE` for remove.
* Input validation with **Zod** or **express-validator**.
* Pagination required for any response > 100 records.
* Rate-limit per IP and per user token.
* All responses → JSON UTF-8, never HTML.
* Error codes must follow standard HTTP conventions.

---

## 7. AI & Analytics Layer

* AI LTP and Trade Call modules must consume live market feed via WebSocket manager.
* Model results stored in `ai_ltp_predictions`, `option_predictions`, etc.
* Each prediction entry must log: `symbol`, `confidence`, `timestamp`.
* No static or pseudo-random results.
* ML models executed in isolated worker threads.

---

## 8. Security & Compliance

* Follow OAuth 2.0 Kite Connect flow strictly.
* Encrypt tokens (AES-256) and store in `kite_tokens` table.
* JWT expiry ≤ 24 hours; refresh via secure endpoint only.
* Sanitize all inputs to avoid SQL / NoSQL injection.
* Never log access tokens, passwords, or sensitive info.
* Maintain audit log of every trade and portfolio update.
* Mask PAN/Aadhar and personal fields in logs or UI.

---

## 9. Deployment & DevOps

* Environment variables must exist in `.env.example` (template only).
* CI/CD pipelines build frontend and backend separately.
* Docker compose for multi-container deployments (Postgres + Redis + API + Web + Nginx).
* Logs streamed to central collector (Elastic / CloudWatch).
* No manual schema changes on production DB.
* Backups scheduled daily; test restores monthly.

---

## 10. Performance Rules

* Cache frequently used instruments and quotes in Redis only – never local arrays.
* Avoid O(N²) loops in services; prefer bulk queries or aggregation.
* Use WebSocket ping-pong to monitor latency (< 200 ms expected).
* Optimize front-end re-renders with React.memo and lazy loading.

---

## 11. Logging & Monitoring

* Log structure: `timestamp`, `module`, `level`, `userId`, `message`, `durationMs`.
* Levels: `debug`, `info`, `warn`, `error`, `fatal`.
* API latency > 1 s → warn.
* Failed Kite Connect calls > 3 → alert.
* Store audit entries in `audit_logs` table with user context.

---

## 12. Role-Based Access Control

| Role        | Permissions                                       |
| ----------- | ------------------------------------------------- |
| **Admin**   | Full system access, user and audit management     |
| **Trader**  | Execute trades, manage portfolio, view AI signals |
| **Analyst** | Research tools, read-only strategies and data     |
| **Guest**   | Demo mode only; no real orders                    |

---

## 13. Documentation & Versioning

* Every module folder contains `README.html` explaining APIs, config, and tests.
* Version tags follow SemVer (e.g., v2.3.1).
* Keep `CHANGELOG.md` updated with features and fixes.
* All API contracts documented in OpenAPI (Swagger).
* Whatever Documents you will create, create them in html.

---

## 14. Priority

| Level        | Meaning                                     |
| ------------ | ------------------------------------------- |
| **Critical** | No mock data / Security / Data integrity    |
| **High**     | Architecture / Error handling / Performance |
| **Medium**   | Code style / Naming / UI conventions        |

---

## 15. Error-Handling Policy

* Uncaught errors → 500 JSON response with trace id.
* Validation errors → 422 with field details.
* All promises wrapped in try/catch with centralized error logger.

---

## 16. Enforcement Statement

Amazon Q must validate all code suggestions against these rules.
If any rule is breached (especially mock data usage, security violations, or non-typed code), Amazon Q must respond:

> ⚠ Rule Violation: Your suggestion does not comply with TechFunctN standards. Please correct before continuing.

---

## 17. Kite Connect Integration Rules

Authentication

Always implement the full OAuth 2.0 authorization code flow.

Never expose api_key or api_secret in client code or logs.

Token refresh handled server-side only; store encrypted tokens in kite_tokens.

Tokens must be AES-256–encrypted, decrypted in-memory only for live API calls.

API Usage

All endpoints must be accessed through the official SDK (kiteconnect NPM package) or HTTP client using the base URL https://api.kite.trade.

Each request must include valid Authorization: token api_key:access_token header.

Retry logic: exponential back-off (max 3 attempts, 1 → 2 → 4 s) for transient 5xx errors.

Respect rate limits (maximum 3 requests/second and 200 requests/minute per user).

Handle 429 Too Many Requests gracefully; pause and retry after 15 s.

WebSocket Feed

Use the Kite Ticker stream for live LTP and order updates.

Reconnect automatically if no heartbeat for > 30 s.

Validate incoming JSON for schema and timestamp drift < 2 s.

Push messages into the internal event bus (Redis or Kafka), not directly to UI.

Data Integrity

All instruments must match official instruments.csv daily file.

Store received ticks only in time-series tables (market_ticks, ltp_history).

No random or synthetic tick generation allowed.

Error & Alerting

On any 4xx error, log: userId, endpoint, status, error_message, request_id.

On repeated 401 responses, revoke token and notify user for re-auth.

All Kite API errors propagated through centralized error handler.

Testing & Sandbox

Use the Kite Connect Sandbox for QA.

No hardcoded responses or stub JSON files.

Sandbox and Production endpoints clearly separated by environment variables.

Security

Enforce HTTPS and validate TLS certificate.

Prevent cross-domain calls from client apps.

Rotate API keys every 6 months and log rotations in audit_logs.

Compliance

All order, trade, and position data must comply with SEBI retention and audit norms.

Retain logs and API responses for 7 years or as required by regulation.

---

*Last Updated: Nov 2025*
*Author: Sachin Shantaram Sawant*
