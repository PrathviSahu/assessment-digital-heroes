# Task B: Failure Mode Analysis & Mitigations

At a scale of **10,000 audits per day** with unpredictable target website behavior, system resilience is critical. This document analyzes the 3 most probable failure modes and defines concrete engineering mitigations for each.

---

## Failure Mode 1: Target Site Tarpitting / Slowloris Behavior

### Description
A user requests an audit for a malicious or broken target URL that deliberately holds network connections open without sending data (or sends data at 1 byte/second). Without protections, socket pools fill up, worker threads stall, and the audit engine exhausts memory.

### Impact
Worker thread starvation, memory exhaustion, and cascading failure across all pending audits.

### Concrete Mitigations
1. **Strict AbortController Timeout**: Every outbound audit request uses an HTTP client timeout signal (`AbortController` set to 5,000ms max).
2. **Byte Stream Inspection**: Enforce a minimum read throughput threshold (e.g. at least 1 KB/sec). If read speed drops below threshold, destroy the socket immediately.
3. **Isolated Worker Pools**: Isolate worker processes so that slow audits do not block fast audits.

---

## Failure Mode 2: Distributed IP Blocking / WAF Rate Limiting by Target Sites

### Description
Auditing popular domains (e.g., e-commerce stores, Cloudflare-protected sites) repeatedly from fixed cloud server IPs (AWS EC2) causes target Web Application Firewalls (WAFs) to flag our auditor IP as a bot and return HTTP `403 Forbidden` or `429 Too Many Requests`.

### Impact
Audit inaccuracy, false negative reports for clients, and IP reputation degradation.

### Concrete Mitigations
1. **User-Agent & Header Compliance**: Outbound audit requests carry transparent, non-spoofed User-Agent headers identifying the service with contact links (`DigitalHeroes-PagePulse-Auditor/1.0 (+https://digitalheroesco.com)`).
2. **Egress Proxy Pool Rotation**: Route outbound audit requests through a rotating proxy pool across multiple residential IP ranges.
3. **Exponential Backoff & Jitter**: Implement intelligent retry logic with random jitter for transient 429/503 status codes.

---

## Failure Mode 3: Cache Stampede (Thundering Herd Problem)

### Description
When a high-traffic URL's cache entry expires (e.g. `https://google.com`), 100 concurrent incoming requests for that exact URL hit the system simultaneously. All 100 requests observe a Cache MISS and trigger 100 identical outbound HTTP audits to the same target domain.

### Impact
Duplicated server work, wasted network bandwidth, and potential target IP blocking.

### Concrete Mitigations
1. **Mutex Lock / Singleflight Pattern**: When a cache MISS occurs for a key `audit:url`, acquire an in-memory lock for that key. Subsequent requests for the same URL wait for the first request to resolve rather than initiating duplicate audits.
2. **Probabilistic Early Expiration (XFetch)**: Re-calculate and refresh cache entries in the background slightly before they expire based on access frequency.
