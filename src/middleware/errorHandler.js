const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, {
    requestId: req.requestId,
    stack: err.stack
  });

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' && statusCode === 500 
        ? 'An unexpected error occurred on the server.' 
        : err.message
    },
    requestId: req.requestId
  });
};

module.exports = errorHandler;
