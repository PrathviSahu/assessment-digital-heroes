const request = require('supertest');
const app = require('../src/server');
const cacheService = require('../src/services/cacheService');

describe('API Endpoint: /api/v1/audit', () => {
  beforeEach(() => {
    cacheService.flush();
  });

  test('POST /api/v1/audit - should successfully audit a valid public URL', async () => {
    const res = await request(app)
      .post('/api/v1/audit')
      .send({ url: 'https://example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.targetUrl).toBe('https://example.com');
    expect(res.body.data).toHaveProperty('metrics');
    expect(res.body.data.metrics).toHaveProperty('ttfbMs');
    expect(res.body.data).toHaveProperty('securityHeaders');
    expect(res.body.data).toHaveProperty('seo');
    expect(res.body).toHaveProperty('requestId');
    expect(res.headers['x-cache']).toBe('MISS');
  });

  test('POST /api/v1/audit - should return cached result on second request', async () => {
    // First request - Cache MISS
    await request(app)
      .post('/api/v1/audit')
      .send({ url: 'https://example.com' });

    // Second request - Cache HIT
    const res = await request(app)
      .post('/api/v1/audit')
      .send({ url: 'https://example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.cached).toBe(true);
    expect(res.headers['x-cache']).toBe('HIT');
  });

  test('POST /api/v1/audit - should reject invalid URL format (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/v1/audit')
      .send({ url: 'not-a-valid-url' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  test('POST /api/v1/audit - should block SSRF attempts to localhost (400 Security Block)', async () => {
    const res = await request(app)
      .post('/api/v1/audit')
      .send({ url: 'http://localhost:3000' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SECURITY_SSRF_BLOCKED');
  });
});
