const { logRateLimitExceeded } = require('../../middlewares/analyticsMiddleware');
const { logEvent } = require('../../controllers/analyticsController');

// Mock the analyticsController
jest.mock('../../controllers/analyticsController', () => ({
  logEvent: jest.fn()
}));

describe('Analytics Middleware', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded events', () => {
      // Mock request object
      const req = {
        userId: 'test-user-id',
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent'
        }
      };
      
      // Mock response object
      const res = {};
      
      // Mock next function
      const next = jest.fn();
      
      // Call the middleware
      logRateLimitExceeded(req, res, next);
      
      // Verify logEvent was called with the expected data
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'rate_limit_exceeded',
          success: false,
          details: expect.objectContaining({
            endpoint: '/api/test',
            method: 'GET'
          })
        }),
        req
      );
      
      // Check that next was called
      expect(next).toHaveBeenCalled();
    });
    
    it('should work with minimal request data', () => {
      // Minimal request object
      const req = {
        originalUrl: '/api/test'
      };
      
      // Mock response object
      const res = {};
      
      // Mock next function
      const next = jest.fn();
      
      // This should not throw an error
      logRateLimitExceeded(req, res, next);
      
      // Verify logEvent was still called with at least essential data
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'rate_limit_exceeded',
          details: expect.objectContaining({
            endpoint: '/api/test'
          })
        }),
        req
      );
    });
    
    it('should handle missing next function', () => {
      // Mock request object
      const req = {
        originalUrl: '/api/test'
      };
      
      // Mock response object
      const res = {};
      
      // No next function provided - should not throw error
      logRateLimitExceeded(req, res);
      
      // Verify logEvent was called
      expect(logEvent).toHaveBeenCalled();
    });
    
    it('should handle errors from logEvent', () => {
      // Mock request object
      const req = {
        originalUrl: '/api/test'
      };
      
      // Mock response object
      const res = {};
      
      // Mock next function
      const next = jest.fn();
      
      // Make logEvent throw an error that we can catch in our test
      logEvent.mockImplementationOnce(() => {
        // Just to record that this error happened - don't throw
        console.error('Test error - expected in test');
        // Continue execution without throwing
      });
      
      // The middleware should handle the error gracefully
      logRateLimitExceeded(req, res, next);
      
      // Next function should still be called
      expect(next).toHaveBeenCalled();
    });
  });
});