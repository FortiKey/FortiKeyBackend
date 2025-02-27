const { logEvent } = require('../controllers/analyticsController');


// Middleware to log rate limit exceeded events
const logRateLimitExceeded = (req, res, next) => {
  // Log the rate limit event
  logEvent({
    businessId: req.userId, // May be undefined for unauthenticated requests
    eventType: 'rate_limit_exceeded',
    success: false,
    details: {
      endpoint: req.originalUrl,
      method: req.method
    }
  }, req);
  // Continue with the request
  if (typeof next === 'function') {
    next();
}};

module.exports = {
  logRateLimitExceeded
};