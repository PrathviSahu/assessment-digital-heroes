# Task B: Architectural Decision Records (ADRs)

This document records the key technology choices, trade-offs, and rejected alternatives for the Page Pulse URL audit platform.

---

## ADR 1: Node.js/Express for API & Audit Engine

### Status: Accepted

### Context
We need a runtime and framework to build an automated URL auditing service. The workload consists of accepting user input, parsing metadata, managing caches, and making outbound HTTP calls to third-party target websites.

### Considered Alternatives
1. **Node.js (Express)**
2. **Python (FastAPI / Celery)**
3. **Go (Gin)**

### Decision & Rationale
We selected **Node.js with Express**.

- **I/O-Bound Workload**: URL auditing is overwhelmingly I/O-bound (waiting on network responses from target websites). Node.js's single-threaded, non-blocking event loop handles thousands of concurrent pending network requests natively without heavy OS thread context-switching.
- **Ecosystem & Speed of Delivery**: Express provides a lightweight, battle-tested ecosystem (`express-rate-limit`, `node-cache`, `zod`, `axios`) that allows clean, modular architecture without unneeded framework overhead.

### Rejected Alternatives Rationale
- **Python (FastAPI)**: While FastAPI is excellent for data science APIs, Python's asyncio event loop introduces unnecessary complexity when handling mixed synchronous file operations and asynchronous network calls.
- **Go (Gin)**: Go offers superior CPU performance and low memory consumption. However, for an I/O-bound microservice of this scale (10k audits/day), Node.js provides faster developer iteration speed while easily handling the load.

---

## ADR 2: Redis for In-Memory Caching & Distributed Job Queues

### Status: Accepted

### Context
Repeat audits of identical URLs within a configurable time window must be served instantly without refetching. Additionally, 500-request bursts require an asynchronous job queue.

### Considered Alternatives
1. **Redis Cluster (with BullMQ)**
2. **Memcached + AWS SQS**

### Decision & Rationale
We selected **Redis Cluster with BullMQ**.

- **Unified Infrastructure**: Redis serves dual purposes—as an in-memory key-value cache (with native TTL expiration) and as the backing store for BullMQ job queues.
- **Atomic Operations & Data Structures**: Redis supports atomic increments (for rate limiting) and pub/sub mechanisms.

### Rejected Alternatives Rationale
- **Memcached + AWS SQS**: Memcached lacks native data structures and persistence capabilities. Using Memcached for caching and SQS for queueing would double our operational infrastructure footprint without added benefit.

---

## ADR 3: PostgreSQL for Historical Audit Logging

### Status: Accepted

### Context
We need persistent storage for historical audit records, user reporting, and compliance telemetry.

### Considered Alternatives
1. **PostgreSQL**
2. **MongoDB (Document Store)**

### Decision & Rationale
We selected **PostgreSQL**. Audit records have structured relational metadata (status codes, response times, security header boolean flags, SEO attributes). PostgreSQL provides strong ACID guarantees, JSONB support for raw headers, and easy integration with time-series extensions like TimescaleDB.

### Rejected Alternatives Rationale
- **MongoDB**: Document stores lack rigid schema enforcement out of the box, leading to potential data quality degradation in structured audit logs over time.
