const NodeCache = require('node-cache');

class CacheService {
  constructor(defaultTTLSeconds = 300) {
    this.cache = new NodeCache({
      stdTTL: defaultTTLSeconds,
      checkperiod: 60,
      useClones: false
    });
    this.defaultTTL = defaultTTLSeconds;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttlSeconds = this.defaultTTL) {
    return this.cache.set(key, value, ttlSeconds);
  }

  del(key) {
    return this.cache.del(key);
  }

  flush() {
    return this.cache.flushAll();
  }

  getStats() {
    return {
      keys: this.cache.keys().length,
      stats: this.cache.getStats(),
      ttlWindowSeconds: this.defaultTTL
    };
  }

  setTTL(seconds) {
    this.defaultTTL = seconds;
  }
}

module.exports = new CacheService();
