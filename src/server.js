const express = require('express');
const path = require('path');
const logger = require('./utils/logger');
const { validateAuditRequest } = require('./middleware/validator');
const apiRateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { performUrlAudit, getConcurrencyStats } = require('./services/auditService');
const cacheService = require('./services/cacheService');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiter behind load balancers
app.set('trust proxy', 1);

// Standard JSON middleware
app.use(express.json({ limit: '1mb' }));

// Static files for frontend dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use(logger.requestLogger);

// --- API ROUTES ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Digital Heroes Page Pulse',
    timestamp: new Date().toISOString(),
    concurrency: getConcurrencyStats(),
    cache: cacheService.getStats()
  });
});

// Primary Audit API Endpoint
app.post('/api/v1/audit', apiRateLimiter, validateAuditRequest, async (req, res, next) => {
  try {
    const auditData = await performUrlAudit({
      ...req.validatedData,
      requestId: req.requestId
    });

    if (auditData.cached) {
      res.setHeader('X-Cache', 'HIT');
    } else {
      res.setHeader('X-Cache', 'MISS');
    }

    res.status(200).json({
      success: true,
      data: auditData,
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// Cache Stats & Control Endpoint
app.get('/api/v1/cache/stats', (req, res) => {
  res.status(200).json({
    success: true,
    data: cacheService.getStats()
  });
});

app.post('/api/v1/cache/flush', (req, res) => {
  cacheService.flush();
  res.status(200).json({
    success: true,
    message: 'Audit cache successfully flushed.',
    requestId: req.requestId
  });
});

// Configure cache TTL window
app.post('/api/v1/cache/config', (req, res) => {
  const { ttlSeconds } = req.body;
  if (!ttlSeconds || typeof ttlSeconds !== 'number' || ttlSeconds < 10) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TTL', message: 'ttlSeconds must be a number >= 10' }
    });
  }
  cacheService.setTTL(ttlSeconds);
  res.status(200).json({
    success: true,
    message: `Default cache TTL window updated to ${ttlSeconds} seconds.`,
    data: cacheService.getStats()
  });
});

// Centralized error handler
app.use(errorHandler);

// Only listen if executed directly (supports supertest integration)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Digital Heroes Page Pulse audit service running on http://localhost:${PORT}`);
  });
}

module.exports = app;
