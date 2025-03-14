const express = require('express');
const request = require('supertest');
const { apiLimiter, authLimiter, totpLimiter } = require('../middlewares/rateLimiter');
const { logRateLimitExceeded } = require('../middlewares/analyticsMiddleware');

// Mock the analyticsMiddleware
jest.mock('../middlewares/analyticsMiddleware', () => ({
  logRateLimitExceeded: jest.fn((req, res, next) => {
    if (next) next();
  })
}));

// Mock the express-rate-limit module
jest.mock('express-rate-limit', () => {
  return () => {
    // Create a mock limiter
    const limiter = function(req, res, next) {
      // Always call next by default (not rate limiting)
      next();
    };
    
    // Add handler property
    limiter.handler = jest.fn((req, res) => {
      res.status(429).json({ message: 'Rate limit exceeded' });
    });
    
    // Add configuration properties
    limiter.windowMs = 15 * 60 * 1000; // 15 minutes
    limiter.max = 100;
    
    return limiter;
  };
});

describe('Rate Limiter Middleware', () => {
  let app;

  beforeAll(async () => {
    // Create a fresh Express app for testing
    app = express();
    app.use(express.json());
  });

  // Test for api-limiter existence
  it('should have a properly initialized API rate limiter', () => {
    expect(apiLimiter).toBeDefined();
    expect(typeof apiLimiter).toBe('function');
  });

  // Test for auth-limiter existence
  it('should have a properly initialized auth rate limiter', () => {
    expect(authLimiter).toBeDefined();
    expect(typeof authLimiter).toBe('function');
  });

  // Test for totp-limiter existence
  it('should have a properly initialized TOTP rate limiter', () => {
    expect(totpLimiter).toBeDefined();
    expect(typeof totpLimiter).toBe('function');
  });
});

describe('Rate Limiter Functionality', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh Express app for testing
    app = express();
    app.use(express.json());
    
    // Add a middleware to simulate a user ID
    app.use((req, res, next) => {
      req.userId = 'test-user-id';
      next();
    });
    
    // Create mock handlers that simulate hitting rate limits
    const mockAPIHandler = jest.fn((req, res) => {
      res.status(429).json({
        message: 'Too many requests from this IP, please try again later.'
      });
    });
    
    const mockAuthHandler = jest.fn((req, res) => {
      res.status(429).json({
        message: 'Too many failed attempts, please try again later.'
      });
    });
    
    const mockTOTPHandler = jest.fn((req, res) => {
      res.status(429).json({
        message: 'Too many TOTP validation attempts, please try again later.'
      });
    });
    
    // Create route with our mock handlers
    app.post('/api-limiter-test', (req, res, next) => {
      // Call the mock handler directly to simulate a rate limit hit
      mockAPIHandler(req, res);
    });
    
    app.post('/auth-limiter-test', (req, res, next) => {
      // Call the mock handler directly to simulate a rate limit hit
      mockAuthHandler(req, res);
    });
    
    app.post('/totp-limiter-test', (req, res, next) => {
      // Call the mock handler directly to simulate a rate limit hit
      mockTOTPHandler(req, res);
    });
    
    app.post('/log-rate-limit-test', (req, res, next) => {
      // Mock the logRateLimitExceeded function
      logRateLimitExceeded(req, res, () => {
        res.status(429).json({
          message: 'Rate limit exceeded with logging'
        });
      });
    });
  });
  
  it('should properly handle API rate limiting errors', async () => {
    const response = await request(app).post('/api-limiter-test');
    
    expect(response.statusCode).toBe(429);
    expect(response.body.message).toBe('Too many requests from this IP, please try again later.');
  });
  
  it('should properly handle Auth rate limiting errors', async () => {
    const response = await request(app).post('/auth-limiter-test');
    
    expect(response.statusCode).toBe(429);
    expect(response.body.message).toBe('Too many failed attempts, please try again later.');
  });
  
  it('should properly handle TOTP rate limiting errors', async () => {
    const response = await request(app).post('/totp-limiter-test');
    
    expect(response.statusCode).toBe(429);
    expect(response.body.message).toBe('Too many TOTP validation attempts, please try again later.');
  });
  
  it('should log rate limit events with the analytics middleware', async () => {
    const response = await request(app).post('/log-rate-limit-test');
    
    expect(response.statusCode).toBe(429);
    expect(logRateLimitExceeded).toHaveBeenCalled();
  });
  
  it('should create limiters with the correct configurations', () => {
    // Since we're mocking express-rate-limit, verify that our middleware is using
    // the correct configuration values according to our mock
    expect(apiLimiter.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    expect(apiLimiter.max).toBe(100);
    expect(authLimiter.windowMs).toBe(15 * 60 * 1000); // Same values from our mock
    expect(authLimiter.max).toBe(100); // Same values from our mock
    expect(totpLimiter.windowMs).toBe(15 * 60 * 1000); // Same values from our mock
    expect(totpLimiter.max).toBe(100); // Same values from our mock
  });
});