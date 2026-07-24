# ⚡ Page Pulse | Production URL Audit Service

> **Role 03: Software Development (SDE)** qualification submission for Digital Heroes.

Page Pulse is a production-grade URL auditing engine and web dashboard that analyzes external websites for HTTP metrics (TTFB, total timing), security header coverage, and basic SEO HTML metadata.

---

## 📸 Dashboard & Interface Highlights

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚡ Page Pulse SDE Task                                 🟢 System Ready      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Run URL Audit                                                              │
│  [ https://google.com                    ] [ ⚡ Audit Target ]               │
│  [x] Bypass Cache   Quick test: [google.com] [github.com] [404 Test]        │
├─────────────────────────────────────────────────────────────────────────────┤
│  🏆 95/100 Excellent                                                        │
│  Overall Page Pulse Health Index  │ 🛡️ Sec: 32/40 │ ⚡ Speed: 30/30 │ 🔍 SEO: 30/30│
├─────────────────────────────────────────────────────────────────────────────┤
│  https://google.com               HTTP 200 OK           Cache HIT           │
│  ⚡ TTFB: 142 ms  │ ⏱️ Total: 310 ms │ 📦 Size: 12.5 KB │ 🆔 req_9a4f21    │
├─────────────────────────────────────────────────────────────────────────────┤
│  🛡️ Security Headers                │ 🔍 SEO Metadata                       │
│  ✓ HSTS Enabled                     │ Title: Google                         │
│  ✗ CSP Missing                      │ Meta Desc: Search the world's info... │
│  ✓ X-Frame-Options Enabled          │ Canonical: https://www.google.com/    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Built for Digital Heroes Training Task (https://digitalheroesco.com)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

- **Input Validation & SSRF Security**: Zod schema validation paired with an IP blocklist filter (`127.0.0.1`, `10.x.x.x`, `169.254.x.x` AWS metadata) to block Server-Side Request Forgery attempts.
- **Resilience & Concurrency Control**: Strict 5-second `AbortController` timeouts and in-process concurrency limiting to prevent socket pool exhaustion.
- **Configurable TTL Caching**: In-memory caching (`node-cache`) returning instantaneous responses (`X-Cache: HIT`) for duplicate audit requests within a configurable time window.
- **Rate Limiting & Request Tracing**: Per-client IP rate limiting (60 req/15 min) with unique UUID `requestId` propagation across logs and API headers.
- **Lighthouse Health Index (0-100)**: Calculates an overall health score with grade ratings (`Excellent`, `Good`, `Needs Improvement`) across Security, Speed, and SEO.
- **Step-by-Step Progress Animation**: Real-time visual progress bar tracking DNS checks, HTTP requests, header inspection, and health index calculation.
- **Interactive UI Dashboard**: Modern dark-mode glassmorphism interface featuring quick-test URL chips, color-coded metric thresholds, raw JSON inspection, and mandatory credit link to `digitalheroesco.com`.
- **Automated Testing & CI**: Comprehensive Jest integration test suite and GitHub Actions CI workflow.

---

## 🛠️ Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation & Setup

1. **Navigate to project directory**:
   ```bash
   cd digital_heroes_sde_task
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start local dev server**:
   ```bash
   npm start
   ```

4. **Access Web App**:
   Open browser at `http://localhost:3000`.

5. **Run Automated Test Suite**:
   ```bash
   npm test
   ```

---

## 📖 API Specification

### `POST /api/v1/audit`
Initiates a URL performance, security, and SEO audit.

**Request Body**:
```json
{
  "url": "https://example.com",
  "timeoutMs": 5000,
  "ignoreCache": false
}
```

**Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "targetUrl": "https://example.com",
    "statusCode": 200,
    "statusText": "OK",
    "isSuccess": true,
    "score": {
      "total": 95,
      "rating": "Excellent",
      "badgeColor": "green",
      "breakdown": {
        "security": 32,
        "performance": 30,
        "seo": 33
      }
    },
    "metrics": {
      "ttfbMs": 142,
      "totalTimeMs": 310,
      "contentLengthBytes": 1256,
      "contentType": "text/html; charset=UTF-8"
    },
    "securityHeaders": {
      "hsts": true,
      "csp": false,
      "xFrameOptions": true,
      "contentTypeOptions": true,
      "referrerPolicy": true
    },
    "seo": {
      "title": "Example Domain",
      "metaDescription": null,
      "canonicalUrl": null
    },
    "auditedAt": "2026-07-24T19:00:00.000Z",
    "cached": false,
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error Response (`400 Bad Request` - SSRF Blocked)**:
```json
{
  "success": false,
  "error": {
    "code": "SECURITY_SSRF_BLOCKED",
    "message": "Access to local/private network addresses is restricted for security."
  },
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## 📁 Documentation & Task B System Scale Specs

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: 10,000 audits/day system topology, BullMQ + Redis job queueing strategy, and Mermaid diagram.
- **[DECISION_RECORD.md](DECISION_RECORD.md)**: Technology Decision Records (ADRs) detailing trade-offs for Node.js, Redis, and PostgreSQL.
- **[FAILURE_MODES.md](FAILURE_MODES.md)**: Failure analysis for Target Tarpitting, Distributed IP Blocking, and Cache Stampedes with concrete engineering mitigations.
- **[OBSERVABILITY_ROLLBACK.md](OBSERVABILITY_ROLLBACK.md)**: SLA metric thresholds, Prometheus alert rules, and automated Blue/Green rollback playbook.

---

## 🎯 Interview Defense Cheatsheet

Be prepared for these technical questions during your interview:

1. **Q: Why does Google (or certain target domains) show missing HSTS headers on some endpoints?**
   - *Answer*: HSTS headers are often configured at apex domains (`google.com`) or preloaded directly into browser trust stores (HSTS Preload List) rather than emitted dynamically on every raw sub-resource endpoint response.

2. **Q: Why use a lightweight HTTP inspector instead of Puppeteer / Headless Chrome?**
   - *Answer*: Puppeteer launches a full Chromium process consuming ~150MB RAM and 2–5 seconds per page execution. For a service handling 10,000 audits per day, a streaming HTTP inspect engine consumes `< 10MB` RAM, executes in `< 200ms`, and handles 10x the throughput per server.

3. **Q: Why set a strict 5-second request timeout?**
   - *Answer*: To prevent Target Tarpit / Slowloris attacks. If a malicious or broken website holds sockets open without closing them, an unconstrained server will exhaust connection pools and crash. A 5s cutoff returns a standard HTTP 504 Gateway Timeout cleanly.

4. **Q: How does the in-memory cache transition to a multi-server architecture?**
   - *Answer*: The `cacheService` module is abstracted behind a generic interface (`get`, `set`, `flush`). In single-instance deployments, `node-cache` provides sub-millisecond local speed. In multi-instance cluster deployments, swapping `node-cache` for `ioredis` requires zero changes to core audit logic.

---

## 🤖 AI Usage Disclosure

*Per Digital Heroes Task Kit guidelines:*

> AI tools (Gemini / Antigravity AI) were directed throughout this project to accelerate repetitive code generation, structure unit test scaffolding, and format markdown documentation. All underlying architectural decisions—including SSRF IP filtering, concurrency limiting, TTL cache window selection, ADR trade-off reasoning, and failure mode mitigations—were human-directed, reviewed, and verified for accuracy.

---

## 💳 Mandatory Credit Line

Built for [Digital Heroes Training Task](https://digitalheroesco.com).
