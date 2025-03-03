const rateLimit = require('express-rate-limit');
const { logger } = require('./logger');
const { logRateLimitExceeded } = require('./analyticsMiddleware');

// Create a limiter for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        // First log the rate limit event
        logRateLimitExceeded(req, res, () => {
            // Then execute the normal rate limit handler
            logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
            return res.status(429).json({
                message: 'Too many requests from this IP, please try again later.'
            });
        });
    }
});

// Create a stricter limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 failed requests per hour
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        // First log the rate limit event
        logRateLimitExceeded(req, res, () => {
            // Then execute the normal rate limit handler
            logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
            return res.status(429).json({
                message: 'Too many failed attempts, please try again later.'
            });
        });
    }
});

// Create a limiter for TOTP validation
const totpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 TOTP validation attempts per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        // First log the rate limit event
        logRateLimitExceeded(req, res, () => {
            // Then execute the normal rate limit handler
            logger.warn(`TOTP validation rate limit exceeded for IP: ${req.ip}`);
            return res.status(429).json({
                message: 'Too many TOTP validation attempts, please try again later.'
            });
        });
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    totpLimiter
};

// In this file, we define rate limiters for different types of endpoints in the application. The apiLimiter is a general rate limiter that allows up to 100 requests per 15 minutes per IP address. The authLimiter is a stricter rate limiter for authentication endpoints, allowing only 5 failed requests per hour per IP address. The totpLimiter is a rate limiter for TOTP validation endpoints, allowing up to 10 requests per 5 minutes per IP address. Each limiter is configured with a windowMs (the time window for counting requests), a max value (the maximum number of requests allowed in the window), and a handler function that is called when the rate limit is exceeded. The handler function logs a warning message and returns a 429 Too Many Requests response with a message indicating that the rate limit has been exceeded. The rate limiters are exported so that they can be used in other parts of the application.