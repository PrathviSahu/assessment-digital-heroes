const request = require('supertest');
const app = require('../src/server');

describe('Middleware: RateLimiter', () => {
  test('GET /health - health check should bypass rate limiter and return 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /api/v1/cache/stats - should return cache statistics', async () => {
    const res = await request(app).get('/api/v1/cache/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('keys');
  });
});
