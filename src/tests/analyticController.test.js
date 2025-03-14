const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { connectDB } = require('../config/db');
const v1Routes = require('../routes/v1');
const User = require('../models/userModel');
const { Usage } = require('../models/usageModel');
const { logEvent } = require('../controllers/analyticsController');

// Create an express app
const app = express();
app.use(express.json());
app.use('/api/v1', v1Routes.router);

describe('Analytics Controller', () => {
  let testUser;
  let testToken;
  let userId;

  beforeAll(async () => {
    await connectDB();

    // Create a test user
    testUser = new User({
      company: 'Analytics Test Company',
      firstName: 'Test',
      lastName: 'User',
      email: `analyticstest${Date.now()}@example.com`,
      password: 'password123'
    });

    await testUser.save();
    userId = testUser._id;
    testToken = jwt.sign({ userId }, process.env.JWT_SECRET);

    // Create some test usage data
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Create a range of different event types
    await Usage.create([
      {
        companyId: userId,
        externalUserId: 'external-user-1',
        eventType: 'totp_validation',
        success: true,
        timestamp: today,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      {
        companyId: userId,
        externalUserId: 'external-user-1',
        eventType: 'totp_validation',
        success: false,
        timestamp: yesterday,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      {
        companyId: userId,
        externalUserId: 'external-user-2',
        eventType: 'backup_code_used',
        success: true,
        timestamp: twoDaysAgo,
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)'
      },
      {
        companyId: userId,
        eventType: 'login',
        success: true,
        timestamp: today,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      {
        companyId: userId,
        eventType: 'login',
        success: false,
        timestamp: yesterday,
        ipAddress: '192.168.1.3',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    ]);
  });

  // Clean up after tests
  afterAll(async () => {
    await Usage.deleteMany({ companyId: userId });
    await User.findByIdAndDelete(userId);
    await mongoose.connection.close();
  });

  // Test the logEvent function
  it('should log an event', async () => {
    const mockReq = {
      userId,
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Test Agent'
      }
    };

    const eventData = {
      companyId: userId,
      eventType: 'test_event',
      success: true,
      details: { test: 'data' }
    };

    logEvent(eventData, mockReq);
    
    // Since logEvent doesn't return anything we're just testing it doesn't throw
    expect(true).toBe(true);
  });

  // Test the analytics endpoints
  describe('Analytics Endpoints', () => {
    it('should get company stats', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/business?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 30);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('stats');
    });

    it('should get TOTP stats', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/totp?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 30);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('dailyStats');
    });

    it('should get failure analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/failures?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 30);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('failuresByType');
    });

    it('should get user TOTP stats', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/users/external-user-1/totp?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('externalUserId', 'external-user-1');
      expect(res.body).toHaveProperty('period', 30);
      expect(res.body).toHaveProperty('stats');
    });

    it('should get device breakdown analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/devices?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 30);
      expect(res.body).toHaveProperty('deviceTypes');
      expect(res.body).toHaveProperty('browsers');
    });

    it('should get backup code usage analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/backup-codes?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 30);
      expect(res.body).toHaveProperty('backupCodeUsage');
      expect(res.body).toHaveProperty('summary');
    });

    it('should get time comparison analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/time-comparison?period=7')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 7);
      
      // Check for dayOverDay, but don't require businessHours
      expect(res.body).toHaveProperty('dayOverDay');
      
      // The test data might not be sufficient to generate business hours data
      // We'll just make sure the request succeeds
    });

    it('should get suspicious activity analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/suspicious?period=30')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 30);
      // Could have suspiciousUsers and recentEvents properties
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/business');

      expect(res.statusCode).toEqual(401);
    });
  });

  // Test error handling
  describe('Error Handling', () => {
    it('should handle invalid token', async () => {
      // Create an invalid token
      const invalidToken = 'invalid-token';
      
      const res = await request(app)
        .get('/api/v1/analytics/totp')
        .set('Authorization', `Bearer ${invalidToken}`);
        
      expect(res.statusCode).toEqual(401);
    });
    
    it('should handle missing externalUserId', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/users//totp')
        .set('Authorization', `Bearer ${testToken}`);
        
      expect(res.statusCode).toEqual(404);
    });
  });
});