const { logger } = require('../middlewares/logger');

describe('Logger', () => {
  it('should have proper log levels', () => {
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should log messages without throwing errors', () => {
    // These shouldn't throw errors
    expect(() => {
      logger.info('Test info message');
      logger.warn('Test warning message');
      logger.error('Test error message');
    }).not.toThrow();
  });

  it('should log objects', () => {
    expect(() => {
      logger.info({ key: 'value' });
    }).not.toThrow();
  });
});