const { 
  register,
  login,
  getProfile,
  updatePassword,
  updateUser,
  deleteUser,
  getCurrentAPIKey,
  generateAPIKey,
  deleteAPIKey
} = require('../../controllers/authController');

const User = require('../../models/userModel');
const TOTPSecret = require('../../models/totpSecretModel');
const Usage = require('../../models/usageModel');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { logger } = require('../../middlewares/logger');
const { logEvent } = require('../../controllers/analyticsController');

// Mock dependencies
jest.mock('../../models/userModel');
jest.mock('../../models/totpSecretModel');
jest.mock('../../models/usageModel');
jest.mock('jsonwebtoken');
jest.mock('../../middlewares/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));
jest.mock('../../controllers/analyticsController', () => ({
  logEvent: jest.fn()
}));

describe('Auth Controller Tests', () => {
  let mockReq, mockRes;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request/response
    mockReq = {
      params: { userId: 'user-id' },
      body: {},
      userId: 'user-id',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      cookie: jest.fn().mockReturnThis()
    };
    
    // Default User.findById mock
    User.findById = jest.fn().mockResolvedValue({
      _id: 'user-id',
      email: 'test@example.com',
      company: 'Test Company',
      firstName: 'Test',
      lastName: 'User',
      comparePassword: jest.fn().mockResolvedValue(true),
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
    });
    
    // JWT mock
    jwt.sign = jest.fn().mockReturnValue('test-token');
  });
  
  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockReq.body = {
        company: 'New Company',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to return null (no existing user)
      User.findOne = jest.fn().mockResolvedValue(null);
      
      // Mock User constructor
      const mockUserInstance = {
        _id: 'new-user-id',
        save: jest.fn().mockResolvedValue(true)
      };
      User.mockImplementation(() => mockUserInstance);
      
      await register(mockReq, mockRes);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
      expect(User).toHaveBeenCalledWith(mockReq.body);
      expect(jwt.sign).toHaveBeenCalledWith({ userId: 'new-user-id' }, expect.anything());
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
          userId: 'new-user-id'
        })
      );
    });
    
    it('should reject registration with existing email', async () => {
      mockReq.body = {
        company: 'New Company',
        firstName: 'New',
        lastName: 'User',
        email: 'existing@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to return an existing user
      User.findOne = jest.fn().mockResolvedValue({ _id: 'existing-user-id' });
      
      await register(mockReq, mockRes);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'existing@example.com' });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Email already registered'
        })
      );
    });
    
    it('should handle errors during registration', async () => {
      mockReq.body = {
        company: 'New Company',
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to throw an error
      User.findOne = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await register(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error'
        })
      );
    });
  });
  
  describe('login', () => {
    it('should login a user successfully', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to return a user
      User.findOne = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        company: 'Test Company',
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(true)
      });
      
      await login(mockReq, mockRes);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(jwt.sign).toHaveBeenCalledWith({ userId: 'user-id' }, expect.anything());
      expect(logEvent).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
          userId: 'user-id',
          role: 'user'
        })
      );
    });
    
    it('should reject login with non-existent email', async () => {
      mockReq.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to return null
      User.findOne = jest.fn().mockResolvedValue(null);
      
      await login(mockReq, mockRes);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
      expect(logEvent).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid email or password'
        })
      );
    });
    
    it('should reject login with incorrect password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };
      
      // Mock User.findOne to return a user with failed password comparison
      User.findOne = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'test@example.com',
        comparePassword: jest.fn().mockResolvedValue(false)
      });
      
      await login(mockReq, mockRes);
      
      expect(logEvent).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid email or password'
        })
      );
    });
    
    it('should handle login for admin users', async () => {
      mockReq.body = {
        email: 'admin@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to return an admin user
      User.findOne = jest.fn().mockResolvedValue({
        _id: 'admin-id',
        email: 'admin@example.com',
        company: 'Admin Company',
        role: 'admin',
        comparePassword: jest.fn().mockResolvedValue(true)
      });
      
      await login(mockReq, mockRes);
      
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'admin_login'
        }),
        expect.anything()
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        })
      );
    });
    
    it('should handle errors during login', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      // Mock User.findOne to throw an error
      User.findOne = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await login(mockReq, mockRes);
      
      expect(logEvent).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error'
        })
      );
    });
  });
  
  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      // Mock mongoose.Types.ObjectId
      mongoose.Types = {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(true)
        }
      };
      
      // Mock User.findById().select() to return a user
      const mockSelect = jest.fn().mockResolvedValue({
        _id: 'user-id',
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'user'
      });
      
      User.findById = jest.fn().mockReturnValue({
        select: mockSelect
      });
      
      await getProfile(mockReq, mockRes);
      
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('user-id');
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(mockSelect).toHaveBeenCalledWith('company firstName lastName email role createdAt');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'user-id',
          company: 'Test Company'
        })
      );
    });
    
    it('should handle invalid user ID format', async () => {
      // Mock mongoose.Types.ObjectId
      mongoose.Types = {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(false)
        }
      };
      
      await getProfile(mockReq, mockRes);
      
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid user ID format'
        })
      );
    });
    
    it('should handle user not found', async () => {
      // Mock mongoose.Types.ObjectId
      mongoose.Types = {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(true)
        }
      };
      
      // Mock User.findById().select() to return null
      const mockSelect = jest.fn().mockResolvedValue(null);
      
      User.findById = jest.fn().mockReturnValue({
        select: mockSelect
      });
      
      await getProfile(mockReq, mockRes);
      
      expect(logger.warn).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User not found'
        })
      );
    });
    
    it('should use authenticated user ID if no userId param', async () => {
      // Remove userId from params
      delete mockReq.params.userId;
      
      // Mock mongoose.Types.ObjectId
      mongoose.Types = {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(true)
        }
      };
      
      // Mock User.findById().select() to return a user
      const mockSelect = jest.fn().mockResolvedValue({
        _id: 'user-id',
        company: 'Test Company'
      });
      
      User.findById = jest.fn().mockReturnValue({
        select: mockSelect
      });
      
      await getProfile(mockReq, mockRes);
      
      // Should use the userId from the authenticated request
      expect(User.findById).toHaveBeenCalledWith('user-id');
    });
    
    it('should handle database errors', async () => {
      // Mock mongoose.Types.ObjectId
      mongoose.Types = {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(true)
        }
      };
      
      // Mock User.findById to throw an error
      User.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await getProfile(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error retrieving user profile'
        })
      );
    });
  });
  
  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      mockReq.body = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      };
      
      await updatePassword(mockReq, mockRes);
      
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Password updated successfully'
        })
      );
    });
    
    it('should reject if current password is missing', async () => {
      mockReq.body = {
        newPassword: 'newpassword123'
      };
      
      await updatePassword(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Both current password and new password are required'
        })
      );
    });
    
    it('should reject if new password is missing', async () => {
      mockReq.body = {
        currentPassword: 'password123'
      };
      
      await updatePassword(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Both current password and new password are required'
        })
      );
    });
    
    it('should handle user not found', async () => {
      mockReq.body = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      };
      
      // Mock User.findById to return null
      User.findById = jest.fn().mockResolvedValue(null);
      
      await updatePassword(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found'
        })
      );
    });
    
    it('should reject if current password is incorrect', async () => {
      mockReq.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };
      
      // Mock user with failed password comparison
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        comparePassword: jest.fn().mockResolvedValue(false)
      });
      
      await updatePassword(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Current password is incorrect'
        })
      );
    });
    
    it('should handle database errors', async () => {
      mockReq.body = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      };
      
      // Mock User.findById to throw an error
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await updatePassword(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error updating password'
        })
      );
    });
  });
  
  describe('updateUser', () => {
    it('should update user profile successfully', async () => {
      mockReq.body = {
        company: 'Updated Company',
        firstName: 'Updated',
        lastName: 'User'
      };
      
      // Mock User.findByIdAndUpdate
      User.findByIdAndUpdate = jest.fn().mockResolvedValue({
        _id: 'user-id',
        company: 'Updated Company',
        firstName: 'Updated',
        lastName: 'User'
      });
      
      await updateUser(mockReq, mockRes);
      
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id',
        mockReq.body,
        { new: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'user-id',
          company: 'Updated Company'
        })
      );
    });
    
    it('should handle user not found', async () => {
      // Mock User.findByIdAndUpdate to return null
      User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
      
      await updateUser(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found'
        })
      );
    });
    
    it('should handle database errors', async () => {
      // Mock User.findByIdAndUpdate to throw an error
      User.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await updateUser(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error'
        })
      );
    });
  });
  
  describe('deleteUser', () => {
    it('should delete user and associated data', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'deleted@example.com'
      });
      
      // Mock TOTPSecret.deleteMany
      TOTPSecret.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });
      
      // Mock Usage.deleteMany
      Usage.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 5 });
      
      // Mock User.findByIdAndDelete
      User.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'deleted@example.com'
      });
      
      await deleteUser(mockReq, mockRes);
      
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(TOTPSecret.deleteMany).toHaveBeenCalledWith({ companyId: 'user-id' });
      expect(Usage.deleteMany).toHaveBeenCalledWith({ companyId: 'user-id' });
      expect(User.findByIdAndDelete).toHaveBeenCalledWith('user-id');
      expect(logger.info).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
    
    it('should handle user not found', async () => {
      // Mock User.findById to return null
      User.findById = jest.fn().mockResolvedValue(null);
      
      await deleteUser(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found'
        })
      );
    });
    
    it('should handle errors in TOTP secret deletion but continue', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'deleted@example.com'
      });
      
      // Mock TOTPSecret.deleteMany to throw an error
      TOTPSecret.deleteMany = jest.fn().mockRejectedValue(new Error('Deletion error'));
      
      // Mock Usage.deleteMany
      Usage.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 5 });
      
      // Mock User.findByIdAndDelete
      User.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'deleted@example.com'
      });
      
      await deleteUser(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
    
    it('should handle errors in usage data deletion but continue', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'deleted@example.com'
      });
      
      // Mock TOTPSecret.deleteMany
      TOTPSecret.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 2 });
      
      // Mock Usage.deleteMany to throw an error
      Usage.deleteMany = jest.fn().mockRejectedValue(new Error('Deletion error'));
      
      // Mock User.findByIdAndDelete
      User.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'user-id',
        email: 'deleted@example.com'
      });
      
      await deleteUser(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
    
    it('should handle database errors', async () => {
      // Mock User.findById to throw an error
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await deleteUser(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error deleting user profile'
        })
      );
    });
  });
  
  describe('getCurrentAPIKey', () => {
    it('should return the current API key', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        apikey: 'test-api-key'
      });
      
      await getCurrentAPIKey(mockReq, mockRes);
      
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key'
        })
      );
    });
    
    it('should return null if no API key exists', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        apikey: null
      });
      
      await getCurrentAPIKey(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: null
        })
      );
    });
    
    it('should handle unauthorized requests', async () => {
      mockReq.userId = null;
      
      await getCurrentAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorised: No user ID provided'
        })
      );
    });
    
    it('should handle user not found', async () => {
      // Mock User.findById to return null
      User.findById = jest.fn().mockResolvedValue(null);
      
      await getCurrentAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found'
        })
      );
    });
    
    it('should handle database errors', async () => {
      // Mock User.findById to throw an error
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await getCurrentAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error'
        })
      );
    });
  });
  
  describe('generateAPIKey', () => {
    beforeEach(() => {
      // Mock crypto.randomBytes
      require('crypto').randomBytes = jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('new-api-key')
      });
    });
    
    it('should generate a new API key', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        apikey: null,
        save: jest.fn().mockResolvedValue({
          _id: 'user-id',
          apikey: 'new-api-key'
        })
      });
      
      await generateAPIKey(mockReq, mockRes);
      
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'new-api-key'
        })
      );
    });
    
    it('should handle existing API key', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        apikey: 'existing-api-key',
        save: jest.fn().mockResolvedValue({
          _id: 'user-id',
          apikey: 'new-api-key'
        })
      });
      
      await generateAPIKey(mockReq, mockRes);
      
      expect(logger.info).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'new-api-key'
        })
      );
    });
    
    it('should handle unauthorized requests', async () => {
      mockReq.userId = null;
      
      await generateAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorised: No user ID provided'
        })
      );
    });
    
    it('should handle user not found', async () => {
      // Mock User.findById to return null
      User.findById = jest.fn().mockResolvedValue(null);
      
      await generateAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found'
        })
      );
    });
    
    it('should handle database errors', async () => {
      // Mock User.findById to throw an error
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await generateAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error'
        })
      );
    });
  });
  
  describe('deleteAPIKey', () => {
    it('should delete the API key', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        apikey: 'existing-api-key',
        save: jest.fn().mockResolvedValue({
          _id: 'user-id',
          apikey: null
        })
      });
      
      await deleteAPIKey(mockReq, mockRes);
      
      expect(User.findById).toHaveBeenCalledWith('user-id');
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
    
    it('should handle unauthorized requests', async () => {
      mockReq.userId = null;
      
      await deleteAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorised: No user ID provided'
        })
      );
    });
    
    it('should handle user not found', async () => {
      // Mock User.findById to return null
      User.findById = jest.fn().mockResolvedValue(null);
      
      await deleteAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found'
        })
      );
    });
    
    it('should handle API key not found', async () => {
      // Mock User.findById
      User.findById = jest.fn().mockResolvedValue({
        _id: 'user-id',
        apikey: null
      });
      
      await deleteAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'API key not found'
        })
      );
    });
    
    it('should handle database errors', async () => {
      // Mock User.findById to throw an error
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await deleteAPIKey(mockReq, mockRes);
      
      expect(logger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error'
        })
      );
    });
  });
});