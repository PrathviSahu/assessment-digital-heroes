const axios = require('axios');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

// Simple semaphore for concurrency control
class ConcurrencyLimiter {
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
    this.queue = [];
  }

  async run(fn) {
    if (this.activeCount >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  getStats() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}

const limiter = new ConcurrencyLimiter(10);

const performUrlAudit = async ({ url, timeoutMs = 5000, ignoreCache = false, requestId }) => {
  const cacheKey = `audit:${url}`;

  // 1. Check cache unless explicitly ignored
  if (!ignoreCache) {
    const cachedResult = cacheService.get(cacheKey);
    if (cachedResult) {
      logger.info(`Cache HIT for target: ${url}`, { requestId });
      return {
        ...cachedResult,
        cached: true,
        requestId
      };
    }
  }

  logger.info(`Cache MISS - initiating live audit for: ${url}`, { requestId });

  // 2. Perform live audit wrapped inside concurrency limiter
  return await limiter.run(async () => {
    const startTime = Date.now();
    let ttfb = null;

    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'DigitalHeroes-PagePulse-Auditor/1.0 (+https://digitalheroesco.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        validateStatus: () => true, // Capture all HTTP status codes without throwing
        onDownloadProgress: (progressEvent) => {
          if (!ttfb) {
            ttfb = Date.now() - startTime;
          }
        }
      });

      const totalTimeMs = Date.now() - startTime;
      const headers = response.headers || {};
      const bodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');

      // Analyze security headers
      const securityHeaders = {
        hsts: !!headers['strict-transport-security'],
        csp: !!headers['content-security-policy'],
        xFrameOptions: !!headers['x-frame-options'],
        contentTypeOptions: !!headers['x-content-type-options'],
        referrerPolicy: !!headers['referrer-policy']
      };

      // Extract basic HTML SEO metadata
      let title = null;
      let metaDescription = null;
      let canonicalUrl = null;

      if (typeof response.data === 'string') {
        const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        const metaMatch = bodyText.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (metaMatch) metaDescription = metaMatch[1].trim();

        const canonicalMatch = bodyText.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
        if (canonicalMatch) canonicalUrl = canonicalMatch[1].trim();
      }

      const auditResult = {
        targetUrl: url,
        statusCode: response.status,
        statusText: response.statusText,
        isSuccess: response.status >= 200 && response.status < 400,
        metrics: {
          ttfbMs: ttfb || totalTimeMs,
          totalTimeMs,
          contentLengthBytes: Buffer.byteLength(bodyText, 'utf8'),
          contentType: headers['content-type'] || 'unknown'
        },
        securityHeaders,
        seo: {
          title,
          metaDescription,
          canonicalUrl
        },
        auditedAt: new Date().toISOString(),
        cached: false
      };

      // 3. Store result in cache
      cacheService.set(cacheKey, auditResult);

      return {
        ...auditResult,
        requestId
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        logger.warn(`Audit timeout reached (${timeoutMs}ms) for ${url}`, { requestId });
        const errObj = new Error(`Request to target URL timed out after ${timeoutMs}ms.`);
        errObj.code = 'AUDIT_TIMEOUT';
        errObj.status = 504;
        throw errObj;
      }

      logger.error(`Audit failed for ${url}: ${error.message}`, { requestId, durationMs });
      const errObj = new Error(`Failed to audit target URL: ${error.message}`);
      errObj.code = 'AUDIT_FETCH_FAILED';
      errObj.status = 502;
      throw errObj;
    }
  });
};

module.exports = {
  performUrlAudit,
  getConcurrencyStats: () => limiter.getStats()
};
