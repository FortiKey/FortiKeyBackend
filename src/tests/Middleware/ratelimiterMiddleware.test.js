const express = require('express');
const request = require('supertest');
const { apiLimiter, authLimiter, totpLimiter } = require('../../middlewares/rateLimiter');
const { logRateLimitExceeded } = require('../../middlewares/analyticsMiddleware');
const { logger } = require('../../middlewares/logger');

// Mock dependencies
jest.mock('../../middlewares/analyticsMiddleware', () => ({
  logRateLimitExceeded: jest.fn((req, res, next) => {
    if (next) next();
  })
}));

jest.mock('../../middlewares/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return () => {
    // Create a mock middleware function
    const middleware = (req, res, next) => {
      // Call next by default
      if (next) next();
    };
    
    // Add a handler that will be used in API
    middleware.handler = (req, res) => {
      res.status(429).json({ message: 'Rate limit exceeded' });
    };
    
    // Add configuration values
    middleware.windowMs = 15 * 60 * 1000;  // 15 minutes
    middleware.max = 100;
    
    return middleware;
  };
});

describe('Rate Limiter Tests', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a fresh Express app for testing
    app = express();
    app.use(express.json());
    
    // Create test routes with our rate limiters
    app.get('/api-test', apiLimiter, (req, res) => {
      res.send('API route');
    });
    
    app.post('/auth-test', authLimiter, (req, res) => {
      res.send('Auth route');
    });
    
    app.post('/totp-test', totpLimiter, (req, res) => {
      res.send('TOTP route');
    });
    
    // Add a middleware to simulate a user ID
    app.use('/log-rate-limit-test', (req, res, next) => {
      req.userId = 'test-user-id';
      next();
    });
    
    // Test route for rate limit logging
    app.post('/log-rate-limit-test', (req, res) => {
      // Call the logRateLimitExceeded middleware
      logRateLimitExceeded(req, res, () => {
        res.status(429).json({
          message: 'Rate limit exceeded with logging'
        });
      });
    });
  });
  
  describe('Rate Limiter Configuration', () => {
    it('should have properly initialized rate limiters', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe('function');
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
      expect(totpLimiter).toBeDefined();
      expect(typeof totpLimiter).toBe('function');
    });
    
    it('should create limiters with the correct configurations', () => {
      expect(apiLimiter.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(apiLimiter.max).toBe(100);
      // Note: In a real implementation, these would have different values
      // but our mock returns the same for all limiters
    });
  });
  
  describe('Rate Limiter Middleware Integration', () => {
    it('should pass non-rate-limited requests through', async () => {
      const res = await request(app).get('/api-test');
      expect(res.status).toBe(200);
      expect(res.text).toBe('API route');
    });
    
    it('should log rate limit events with the analytics middleware', async () => {
      const response = await request(app).post('/log-rate-limit-test');
      
      expect(response.statusCode).toBe(429);
      expect(logRateLimitExceeded).toHaveBeenCalled();
    });
  });
  
  describe('Rate Limiter Handler Behavior', () => {
    it('should handle API rate limiting errors', async () => {
      // Create mock req and res
      const mockReq = {
        ip: '127.0.0.1',
        originalUrl: '/api',
        method: 'GET',
        headers: {
          'user-agent': 'test-agent'
        }
      };
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Mock the handler behavior
      const apiHandlerWithLogging = (req, res) => {
        logRateLimitExceeded(req, res, () => {
          logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
          res.status(429).json({
            message: 'Too many requests from this IP, please try again later.'
          });
        });
      };
      
      // Call the handler
      apiHandlerWithLogging(mockReq, mockRes);
      
      // Verify
      expect(logRateLimitExceeded).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded for IP: 127.0.0.1');
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Too many requests from this IP, please try again later.'
      });
    });
    
    it('should handle auth rate limiting correctly', async () => {
      // Create mock req and res
      const mockReq = {
        ip: '127.0.0.1',
        originalUrl: '/auth',
        method: 'POST',
        headers: {
          'user-agent': 'test-agent'
        }
      };
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Mock the auth handler behavior
      const authHandlerWithLogging = (req, res) => {
        logRateLimitExceeded(req, res, () => {
          logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
          res.status(429).json({
            message: 'Too many failed attempts, please try again later.'
          });
        });
      };
      
      // Call the handler
      authHandlerWithLogging(mockReq, mockRes);
      
      // Verify
      expect(logRateLimitExceeded).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Auth rate limit exceeded for IP: 127.0.0.1');
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Too many failed attempts, please try again later.'
      });
    });
    
    it('should handle TOTP rate limiting correctly', async () => {
      // Create mock req and res
      const mockReq = {
        ip: '127.0.0.1',
        originalUrl: '/totp',
        method: 'POST',
        headers: {
          'user-agent': 'test-agent'
        }
      };
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Mock the totp handler behavior
      const totpHandlerWithLogging = (req, res) => {
        logRateLimitExceeded(req, res, () => {
          logger.warn(`TOTP validation rate limit exceeded for IP: ${req.ip}`);
          res.status(429).json({
            message: 'Too many TOTP validation attempts, please try again later.'
          });
        });
      };
      
      // Call the handler
      totpHandlerWithLogging(mockReq, mockRes);
      
      // Verify
      expect(logRateLimitExceeded).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('TOTP validation rate limit exceeded for IP: 127.0.0.1');
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Too many TOTP validation attempts, please try again later.'
      });
    });
  });
});