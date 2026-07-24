const cacheService = require('../src/services/cacheService');

describe('Service: CacheService', () => {
  beforeEach(() => {
    cacheService.flush();
  });

  test('should set and retrieve item from cache', () => {
    const key = 'audit:https://test.com';
    const data = { statusCode: 200, title: 'Test' };

    cacheService.set(key, data, 10);
    const retrieved = cacheService.get(key);

    expect(retrieved).toEqual(data);
  });

  test('should return undefined for missing cache key', () => {
    const retrieved = cacheService.get('non_existent_key');
    expect(retrieved).toBeUndefined();
  });

  test('should flush all keys successfully', () => {
    cacheService.set('key1', 'value1');
    cacheService.set('key2', 'value2');
    
    expect(cacheService.getStats().keys).toBe(2);
    
    cacheService.flush();
    expect(cacheService.getStats().keys).toBe(0);
  });
});
