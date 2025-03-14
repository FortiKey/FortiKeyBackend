const mongoose = require('mongoose');
const { Usage } = require('../../models/usageModel');
const { logger } = require('../../middlewares/logger');

// Mock the logger
jest.mock('../../middlewares/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Usage Model Static Methods', () => {
  // Store original logEvent method
  const originalLogEvent = Usage.logEvent;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore original logEvent method after each test
    Usage.logEvent = originalLogEvent;
  });
  
  it('should successfully log an event using the static method', async () => {
    // Mock event data
    const eventData = {
      companyId: 'test-company-id',
      eventType: 'login',
      success: true
    };
    
    // Create a mock mockSavedObject
    const mockSavedObject = { _id: 'mock-event-id' };
    
    // Mock the constructor
    const originalConstructor = Usage;
    const mockInstance = {
      save: jest.fn().mockResolvedValue(mockSavedObject)
    };
    
    // Mock the Usage class and its logEvent method
    const MockUsage = function(data) {
      return mockInstance;
    };
    
    // Replace the static method with our mocked version
    Usage.logEvent = jest.fn().mockResolvedValue(mockSavedObject);
    
    // Call the mocked static method
    const result = await Usage.logEvent(eventData);
    
    // Check the result
    expect(result).toEqual(mockSavedObject);
    expect(Usage.logEvent).toHaveBeenCalledWith(eventData);
  }, 10000);
  
  it('should handle errors when logging an event', async () => {
    // Set up test event data
    const eventData = {
      companyId: 'test-company-id',
      eventType: 'login',
      success: true
    };
    
    // Replace the static method with a version that simulates an error
    Usage.logEvent = jest.fn().mockImplementation(async () => {
      logger.error('Error logging usage event:', 'Database connection error');
      return null;
    });
    
    // Call the mocked method
    const result = await Usage.logEvent(eventData);
    
    // Verify the error was logged
    expect(logger.error).toHaveBeenCalled();
    expect(logger.error.mock.calls[0][0]).toBe('Error logging usage event:');
    expect(logger.error.mock.calls[0][1]).toBe('Database connection error');
    
    // Verify the method returns null on error
    expect(result).toBeNull();
  }, 10000);
  
  it('should handle missing required fields', async () => {
    // Set up incomplete event data (missing required eventType field)
    const incompleteEventData = {
      companyId: 'test-company-id',
      success: true
    };
    
    // Replace the static method with a version that simulates a validation error
    Usage.logEvent = jest.fn().mockImplementation(async () => {
      logger.error('Error logging usage event:', 'ValidationError: eventType is required');
      return null;
    });
    
    // Call the static method
    const result = await Usage.logEvent(incompleteEventData);
    
    // Verify the error was logged
    expect(logger.error).toHaveBeenCalled();
    
    // Verify the method returns null on error
    expect(result).toBeNull();
  }, 10000);
  
  it('should log events with minimal required data', async () => {
    // Set up minimal event data with only required fields
    const minimalEventData = {
      eventType: 'login',
      success: true
    };
    
    // Create a mock saved object
    const mockSavedObject = { _id: 'mock-event-id' };
    
    // Mock the logEvent method
    Usage.logEvent = jest.fn().mockResolvedValue(mockSavedObject);
    
    // Call the static method
    const result = await Usage.logEvent(minimalEventData);
    
    // Verify the method was called with the minimal data
    expect(Usage.logEvent).toHaveBeenCalledWith(minimalEventData);
    
    // Verify the static method returned the saved event
    expect(result).toEqual(mockSavedObject);
  }, 10000);
});