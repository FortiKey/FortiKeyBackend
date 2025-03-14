const { getAllCompanyUsers, getCompanyUserDetails, deleteUserAsAdmin } = require('../../controllers/adminController');
const User = require('../../models/userModel');
const TOTPSecret = require('../../models/totpSecretModel');
const { Usage } = require('../../models/usageModel');
const { logger } = require('../../middlewares/logger');
const mongoose = require('mongoose');

// Mock the models and logger
jest.mock('../../models/userModel');
jest.mock('../../models/totpSecretModel');
jest.mock('../../models/usageModel');
jest.mock('../../middlewares/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock mongoose Types.ObjectId
mongoose.Types = {
  ObjectId: jest.fn(id => id)
};

describe('Admin Controller Unit Tests', () => {
  let mockReq, mockRes;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request/response
    mockReq = {
      query: {},
      params: {},
      userId: 'admin-user-id'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Default mocks for User.find
    User.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { _id: 'user1', company: 'Company 1', email: 'user1@example.com' },
        { _id: 'user2', company: 'Company 2', email: 'user2@example.com' }
      ])
    });
    
    // Default mock for User.countDocuments
    User.countDocuments = jest.fn().mockResolvedValue(2);
  });
  
  describe('getAllCompanyUsers', () => {
    it('should get all company users with pagination', async () => {
      await getAllCompanyUsers(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          users: expect.any(Array),
          pagination: expect.objectContaining({
            total: 2,
            page: 1
          })
        })
      );
    });
    
    it('should handle search parameter', async () => {
      mockReq.query.search = 'test';
      
      await getAllCompanyUsers(mockReq, mockRes);
      
      expect(User.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.any(Array)
        })
      );
    });
    
    it('should handle sort parameters', async () => {
      mockReq.query.sortBy = 'company';
      mockReq.query.order = 'desc';
      
      await getAllCompanyUsers(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
    
    it('should handle database errors', async () => {
      // Make User.find throw an error
      User.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await getAllCompanyUsers(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
  
  describe('getCompanyUserDetails', () => {
    beforeEach(() => {
      // Set up the params
      mockReq.params = { userId: 'user1' };
      
      // Create a proper mock user object
      const mockUser = {
        _id: 'user1',
        company: 'Company 1',
        email: 'user1@example.com'
      };
      
      // Set up User.findById to properly chain with select
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(mockUser)
      });
      
      // Mock TOTPSecret.countDocuments
      TOTPSecret.countDocuments = jest.fn().mockResolvedValue(3);
      
      // Set up Usage.aggregate
      Usage.aggregate = jest.fn().mockResolvedValue([
        { _id: 'login', count: 5 },
        { _id: 'totp_validation', count: 10 }
      ]);
    });

    it('should get detailed info for a specific user', async () => {
      await getCompanyUserDetails(mockReq, mockRes);
      
      expect(User.findById).toHaveBeenCalledWith('user1');
      expect(TOTPSecret.countDocuments).toHaveBeenCalled();
      expect(Usage.aggregate).toHaveBeenCalled();
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.any(Object),
          totpCount: expect.any(Number),
          usageStats: expect.any(Array)
        })
      );
    });
    
    it('should handle user not found', async () => {
      // Override the mock for this specific test
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(null) 
      });
      
      await getCompanyUserDetails(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not found')
        })
      );
    });
    
    it('should handle database errors', async () => {
      // Make User.findById throw a normal error
      User.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await getCompanyUserDetails(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
    
    it('should handle CastError (invalid ID format)', async () => {
      // Create a CastError but don't throw it directly
      const castError = new Error('Cast error');
      castError.name = 'CastError';
      
      // Make findById throw the CastError
      User.findById = jest.fn().mockImplementation(() => {
        throw castError;
      });
      
      await getCompanyUserDetails(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not found')
        })
      );
    });
    
    it('should handle errors in aggregation', async () => {
      // Mock User.findById to return a proper user (important!)
      const mockUser = {
        _id: 'user1',
        company: 'Company 1',
        email: 'user1@example.com'
      };
      
      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(mockUser)
      });
      
      // Mock TOTPSecret.countDocuments
      TOTPSecret.countDocuments = jest.fn().mockResolvedValue(3);
      
      // Make Usage.aggregate throw an error
      Usage.aggregate = jest.fn().mockImplementation(() => {
        throw new Error('Aggregation error');
      });
      
      await getCompanyUserDetails(mockReq, mockRes);
      
      // Controller should handle the error and still return 200
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(logger.error).toHaveBeenCalled();
      
      // Should still return the user and totpCount, with empty usageStats
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
          totpCount: 3,
          usageStats: expect.any(Array)
        })
      );
    });
  });
  
  describe('deleteUserAsAdmin', () => {
    beforeEach(() => {
      // Setup for this test suite
      mockReq.params = { userId: 'user-to-delete' };
      
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-to-delete',
        email: 'user-to-delete@example.com'
      });
      
      // Mock TOTPSecret.deleteMany
      TOTPSecret.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 3 });
      
      // Mock mongoose collection deleteMany
      const mockDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 5 });
      mongoose.connection = {
        collection: jest.fn().mockReturnValue({
          deleteMany: mockDeleteMany
        })
      };
      
      // Mock session for transaction
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(null),
        endSession: jest.fn(),
        abortTransaction: jest.fn()
      };
      
      mongoose.startSession = jest.fn().mockResolvedValue(mockSession);
      
      // Mock User.findByIdAndDelete
      User.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'user-to-delete',
        email: 'deleted@example.com'
      });
    });
    
    it('should handle user not found', async () => {
      // Override findById for this specific test
      User.findById = jest.fn().mockResolvedValue(null);
      
      await deleteUserAsAdmin(mockReq, mockRes);
      
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not found')
        })
      );
    }, 15000);
  });
});