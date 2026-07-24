const { v4: uuidv4 } = require('uuid');

const formatLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  return JSON.stringify({
    timestamp,
    level: level.toUpperCase(),
    message,
    requestId: meta.requestId || 'N/A',
    ...meta
  });
};

const logger = {
  info: (message, meta) => console.log(formatLog('info', message, meta)),
  warn: (message, meta) => console.warn(formatLog('warn', message, meta)),
  error: (message, meta) => console.error(formatLog('error', message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatLog('debug', message, meta));
    }
  },
  requestLogger: (req, res, next) => {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    
    const startTime = Date.now();
    logger.info(`Incoming ${req.method} ${req.originalUrl}`, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info(`Completed ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
        requestId: req.requestId,
        statusCode: res.statusCode,
        durationMs: duration
      });
    });

    next();
  }
};

module.exports = logger;
