# Task B: Observability, Metrics & Rollback Playbook

This document defines the monitoring metrics, SLA alert thresholds, and automated deployment rollback procedure for the Page Pulse system.

---

## 1. Key Performance Indicators (SLA Metrics)

We track system health across four golden signals:

| Metric | Measurement Unit | SLA Target | Warning Threshold | Critical Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **P95 Latency (Cache HIT)** | Milliseconds | `< 20ms` | `> 50ms` | `> 100ms` |
| **P95 Latency (Cache MISS)** | Seconds | `< 2.5s` | `> 4.0s` | `> 5.0s` |
| **5xx Error Rate** | Percentage | `< 0.5%` | `> 1.0%` | `> 2.5%` |
| **Queue Lag / Depth** | Pending Jobs | `< 50` | `> 200` | `> 500` |
| **Active Worker Saturation** | Percentage | `< 70%` | `> 85%` | `> 95%` |

---

## 2. Prometheus Alerting Rules

```yaml
groups:
  - name: page_pulse_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100 > 2.5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx Error Rate Detected (> 2.5%)"
          description: "API server 5xx error rate has exceeded 2.5% over the last 2 minutes."

      - alert: QueueBacklogHigh
        expr: bullmq_queue_depth{queue="audit_jobs"} > 500
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Audit Queue Backlog High"
          description: "Pending job queue depth has exceeded 500 items."
```

---

## 3. Deployment & Rollback Playbook

To ensure zero-downtime deployments and rapid recovery from bad releases:

### A. Deployment Pattern: Blue/Green Strategy
1. **Green Environment Spin-up**: Deploy new application code to an isolated Green environment.
2. **Automated Health Probes**: Execute automated synthetic health checks (`GET /health`) against Green.
3. **Traffic Shift**: Route 10% of ALB traffic to Green. Monitor error rates for 5 minutes.
4. **Full Cutover**: If clean, route 100% traffic to Green and decommission Blue.

### B. Automated Rollback Trigger & Execution
- **Rollback Criteria**: If 5xx error rate exceeds 2.0% or `/health` check fails twice within 60 seconds of traffic shift.
- **Rollback Execution**:
  1. Instantly shift ALB target group back 100% to Blue.
  2. Terminate Green instances.
  3. Emit PagerDuty notification to on-call engineering team with deployment commit SHA and failure log trace.
  4. Mean Time to Rollback (MTTR): **< 30 seconds**.
