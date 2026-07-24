# Task B: Architecture & Scaling Design (10,000 Audits / Day)

This document specifies the system architecture required to handle **10,000 daily audits** with burst loads of up to **500 concurrent requests** while upholding customer-facing SLA response times.

---

## 1. System Topology & Component Diagram

The production architecture decouples synchronous API reception from asynchronous URL auditing using an event-driven worker pool model.

```mermaid
flowchart TD
    subgraph Client Layer
        User[Client Browser / API Consumer]
    end

    subgraph Edge & Routing Layer
        DNS[Route53 DNS]
        ALB[AWS Application Load Balancer]
        WAF[AWS WAF / Rate Limiter]
    end

    subgraph Stateless Web Tier (Node.js API Nodes)
        API1[Express API Node 1]
        API2[Express API Node 2]
    end

    subgraph Caching & State Layer
        RedisCache[(Redis Cache Cluster - In-Memory TTL)]
        RedisQueue[(Redis / BullMQ Job Queue)]
    end

    subgraph Asynchronous Worker Tier
        Worker1[Audit Worker 1]
        Worker2[Audit Worker 2]
        Worker3[Audit Worker N]
    end

    subgraph Data Persistence Tier
        DB[(PostgreSQL Primary - Audit History)]
    end

    User --> DNS --> ALB --> WAF
    WAF --> API1 & API2
    API1 & API2 <--> RedisCache
    API1 & API2 -- Push Job --> RedisQueue
    RedisQueue -- Consume Job --> Worker1 & Worker2 & Worker3
    Worker1 & Worker2 & Worker3 -- Outbound HTTP Audit --> ExternalWeb[External Target Websites]
    Worker1 & Worker2 & Worker3 -- Save Audit Result --> RedisCache & DB
```

---

## 2. Component Breakdown & Data Flow

### A. Client & Edge Layer
- **AWS WAF**: Blocks malicious payloads, SQL injection, and enforces global IP rate limits before requests hit application servers.
- **Application Load Balancer (ALB)**: Distributes incoming traffic across auto-scaling stateless API nodes in private subnets.

### B. Stateless API Gateway Tier (Node.js / Express)
- Handles authentication, request validation (Zod), and cache lookup.
- **Cache Hit Flow**: If the requested URL audit exists in **Redis Cache**, the response is returned immediately in `< 10ms`.
- **Cache Miss / Burst Flow**: Instead of blocking the HTTP thread during a 500-request burst, the API node places an audit job into the **BullMQ Redis Queue** and returns an HTTP `202 Accepted` response with a polling `jobId` or Webhook callback.

### C. Asynchronous Worker Cluster (BullMQ Workers)
- Dedicated worker processes pull jobs from the queue with controlled concurrency.
- Workers execute outbound target HTTP audits using connection pooling (`http.Agent` with `keepAlive: true`).
- Results are saved to **Redis Cache** (for fast API retrieval) and written asynchronously to **PostgreSQL** for historical reporting.

---

## 3. Queueing Strategy for 500-Request Bursts

To handle sudden spikes of 500 concurrent audit requests without crashing socket pools or overloading memory:

1. **Queue Buffer**: BullMQ uses Redis `LIST` / `STREAM` data structures. Bursts fill the queue instantly without blocking CPU event loops.
2. **Worker Auto-Scaling**: Worker node counts scale dynamically based on `QueueDepth` metric triggers (e.g., scale up if queue depth > 100).
3. **Concurrency Throttling**: Each worker process caps active outbound connections to 20, keeping global concurrent outbound requests capped below target ISP thresholds.
