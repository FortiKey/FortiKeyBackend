const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const v1Routes = require('../routes/v1');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { updatePassword } = require('../controllers/authController');

// Create an express app
const app = express();
app.use(express.json());
app.use('/api/v1', v1Routes.router);

describe('Auth Controller Error Handling', () => {
  let token;
  let userId;
  const timestamp = Date.now();
  const testEmail = `autherror${timestamp}@example.com`;

  beforeAll(async () => {
    await connectDB();
    
    // Create a test user
    const user = new User({
      company: 'Error Test Company',
      firstName: 'Error',
      lastName: 'Test',
      email: testEmail,
      password: 'password123'
    });
    await user.save();
    userId = user._id;
    token = jwt.sign({ userId }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    await User.findByIdAndDelete(userId);
    await mongoose.connection.close();
  });

  describe('Registration Errors', () => {
    it('should handle missing fields in registration', async () => {
      const res = await request(app)
        .post('/api/v1/business/register')
        .send({
          // Missing required fields
          firstName: 'Test'
          // No lastName, email, password, company
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Login Errors', () => {
    it('should handle login with missing password', async () => {
      const res = await request(app)
        .post('/api/v1/business/login')
        .send({
          // Missing password
          email: testEmail
        });
      
      // The implementation returns 401 for invalid credentials, even if fields are missing
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('Invalid');
    });
    
    it('should handle login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/business/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'somepassword'
        });
      
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('Invalid');
    });
  });

  describe('Update Password Errors', () => {
    it('should reject empty password updates', async () => {
      const res = await request(app)
        .patch(`/api/v1/business/profile/${userId}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          // Missing passwords
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('required');
    });

    it('should handle non-existent user in password update', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/business/profile/${fakeId}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword'
        });
      
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('Profile Update Errors', () => {
    it('should handle non-existent user in profile update', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/business/profile/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          company: 'New Company Name'
        });
      
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('Profile Deletion Errors', () => {
    it('should handle non-existent user in profile deletion', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/v1/business/profile/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('API Key Errors', () => {
    it('should handle API key deletion when none exists', async () => {
      // First make sure we don't have an API key
      await User.updateOne({ _id: userId }, { $set: { apikey: null } });
      
      // Try to delete a non-existent API key
      const res = await request(app)
        .delete('/api/v1/business/apikey')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });
    
    it('should handle getting API key with invalid user', async () => {
      // Create an invalid token (with non-existent user)
      const invalidToken = jwt.sign({ userId: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET);
      
      const res = await request(app)
        .get('/api/v1/business/apikey')
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });
    
    it('should handle generating API key with invalid user', async () => {
      // Create an invalid token (with non-existent user)
      const invalidToken = jwt.sign({ userId: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET);
      
      const res = await request(app)
        .post('/api/v1/business/apikey')
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });
  });
});

it('should update a user password', async () => {
  // Mock request with user ID and passwords
  const mockReq = {
    params: { userId: 'user-id' },
    body: {
      currentPassword: 'password123',
      newPassword: 'newpassword123'
    }
  };
  
  // Mock response object
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  
  // Mock User.findById to return a user with comparePassword method
  User.findById = jest.fn().mockResolvedValue({
    _id: 'user-id',
    comparePassword: jest.fn().mockResolvedValue(true), // Simulate valid password
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(true)
  });
  
  // Call the updatePassword function
  await updatePassword(mockReq, mockRes);
  
  // Verify correct response was sent
  expect(mockRes.status).toHaveBeenCalledWith(200);
  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      message: 'Password updated successfully'
    })
  );
});

// Test for error in password update (incorrect current password)
it('should reject password update for incorrect current password', async () => {
  // Mock request
  const mockReq = {
    params: { userId: 'user-id' },
    body: {
      currentPassword: 'wrongpassword',
      newPassword: 'newpassword123'
    }
  };
  
  // Mock response
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  
  // Mock User.findById with failed password comparison
  User.findById = jest.fn().mockResolvedValue({
    _id: 'user-id',
    comparePassword: jest.fn().mockResolvedValue(false) // Simulate invalid password
  });
  
  // Call the updatePassword function
  await updatePassword(mockReq, mockRes);
  
  // Verify error response
  expect(mockRes.status).toHaveBeenCalledWith(401);
  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      message: 'Current password is incorrect'
    })
  );
});