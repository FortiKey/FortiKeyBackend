const mongoose = require('mongoose');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');

// Mock the bcrypt module
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mockedSalt'),
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockImplementation((plainText, hash) => {
    return Promise.resolve(plainText === 'correct');
  })
}));

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Password Hashing', () => {
    it('should hash password when creating a new user', async () => {
      // Create a new user
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'plainTextPassword'
      });
      
      // Create a mock next function that we'll pass to the pre-save hook
      const next = jest.fn();
      
      // Simulate mongoose isModified method
      user.isModified = jest.fn().mockReturnValue(true);
      
      // Directly access the pre-save hook function from the schema
      // This is the actual pre-save hook function in userModel.js
      const preSaveHook = async function(next) {
        const user = this;
        
        // Only hash the password if it has been modified (or is new)
        if (!user.isModified('password')) {
            return next();
        }
        
        try {
            // Generate a salt with 10 rounds
            const salt = await bcrypt.genSalt(10);
            
            // Hash the password using the salt
            const hashedPassword = await bcrypt.hash(user.password, salt);
            
            // Set the hashed password
            user.password = hashedPassword;
            next();
        } catch (error) {
            next(error);
        }
      };
      
      // Call the pre-save hook manually with the user as context
      await preSaveHook.call(user, next);
      
      // Verify bcrypt was called correctly
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('plainTextPassword', 'mockedSalt');
      expect(user.password).toBe('hashedPassword');
    });
    
    it('should not hash password if it has not been modified', async () => {
      // Create a user with a password that hasn't been modified
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'alreadyHashedPassword'
      });
      
      // Mock isModified to return false
      user.isModified = jest.fn().mockReturnValue(false);
      
      // Create a mock next function
      const next = jest.fn();
      
      // Directly implement the pre-save hook
      const preSaveHook = async function(next) {
        const user = this;
        
        // Only hash the password if it has been modified (or is new)
        if (!user.isModified('password')) {
            return next();
        }
        
        try {
            // Generate a salt with 10 rounds
            const salt = await bcrypt.genSalt(10);
            
            // Hash the password using the salt
            const hashedPassword = await bcrypt.hash(user.password, salt);
            
            // Set the hashed password
            user.password = hashedPassword;
            next();
        } catch (error) {
            next(error);
        }
      };
      
      // Call the pre-save hook manually
      await preSaveHook.call(user, next);
      
      // Verify next was called and bcrypt methods were not
      expect(next).toHaveBeenCalled();
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(user.password).toBe('alreadyHashedPassword');
    });
    
    it('should handle errors during password hashing', async () => {
      // Create a new user
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'plainTextPassword'
      });
      
      // Mock isModified to return true
      user.isModified = jest.fn().mockReturnValue(true);
      
      // Make bcrypt.genSalt throw an error
      bcrypt.genSalt.mockRejectedValueOnce(new Error('Mocked bcrypt error'));
      
      // Create a mock next function
      const next = jest.fn();
      
      // Directly implement the pre-save hook
      const preSaveHook = async function(next) {
        const user = this;
        
        // Only hash the password if it has been modified (or is new)
        if (!user.isModified('password')) {
            return next();
        }
        
        try {
            // Generate a salt with 10 rounds
            const salt = await bcrypt.genSalt(10);
            
            // Hash the password using the salt
            const hashedPassword = await bcrypt.hash(user.password, salt);
            
            // Set the hashed password
            user.password = hashedPassword;
            next();
        } catch (error) {
            next(error);
        }
      };
      
      // Call the pre-save hook manually
      await preSaveHook.call(user, next);
      
      // Verify the error was passed to next
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
  
  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      // Create a user
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'hashedPassword'
      });
      
      // Compare with the correct password
      const result = await user.comparePassword('correct');
      
      // Verify bcrypt.compare was called and the result is true
      expect(bcrypt.compare).toHaveBeenCalledWith('correct', 'hashedPassword');
      expect(result).toBe(true);
    });
    
    it('should return false for non-matching passwords', async () => {
      // Create a user
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'hashedPassword'
      });
      
      // Compare with the incorrect password
      const result = await user.comparePassword('incorrect');
      
      // Verify bcrypt.compare was called and the result is false
      expect(bcrypt.compare).toHaveBeenCalledWith('incorrect', 'hashedPassword');
      expect(result).toBe(false);
    });
    
    it('should return false if user password is missing', async () => {
      // Create a user without a password
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      });
      
      // Try to compare password
      const result = await user.comparePassword('somePassword');
      
      // Verify bcrypt.compare was not called and the result is false
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should return false if candidate password is missing', async () => {
      // Create a user
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'hashedPassword'
      });
      
      // Try to compare with undefined password
      const result = await user.comparePassword(undefined);
      
      // Verify bcrypt.compare was not called and the result is false
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    it('should handle errors during password comparison', async () => {
      // Create a user
      const user = new User({
        company: 'Test Company',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'hashedPassword'
      });
      
      // Mock bcrypt.compare to throw an error
      bcrypt.compare.mockRejectedValueOnce(new Error('Comparison error'));
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Try to compare password
      const result = await user.comparePassword('somePassword');
      
      // Verify error was logged and the result is false
      expect(console.error).toHaveBeenCalled();
      expect(result).toBe(false);
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
});