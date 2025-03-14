const { logRateLimitExceeded } = require('../middlewares/analyticsMiddleware');

describe('Analytics Middleware', () => {
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
      
      // Check that next was called
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle missing next function', () => {
      // Mock request object
      const req = {
        originalUrl: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent'
        }
      };
      
      // Mock response object
      const res = {};
      
      // No next function provided
      
      // This should not throw an error
      expect(() => {
        logRateLimitExceeded(req, res);
      }).not.toThrow();
    });
  });
});