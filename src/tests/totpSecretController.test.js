const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { connectDB } = require('../config/db');
const v1Routes = require('../routes/v1');
const User = require('../models/userModel');
const TOTPSecret = require('../models/totpSecretModel');
const { validateTOTP } = require('../controllers/totpSecretController');


// Create an express app
const app = express();
app.use(express.json());
app.use('/api/v1', v1Routes.router);

describe('TOTP Secret Controller', () => {
  let testUser;
  let testToken;
  let apiKey;
  let createdSecretId;
  let testExternalUserId;

  beforeAll(async () => {
    await connectDB();

    // Create a test user
    testUser = new User({
      company: 'TOTP Controller Test',
      firstName: 'Test',
      lastName: 'User',
      email: 'totpcontrollertest@example.com',
      password: 'password123',
      apikey: require('crypto').randomBytes(32).toString('hex')
    });

    await testUser.save();
    apiKey = testUser.apikey;
    testToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET);
    testExternalUserId = `totp-controller-test-${Date.now()}`;
  });

  afterAll(async () => {
    // Clean up
    await User.findByIdAndDelete(testUser._id);
    await TOTPSecret.deleteMany({ externalUserId: { $regex: /^totp-controller-test/ } });
    await mongoose.connection.close();
  });

  describe('createTOTPSecret', () => {
    it('should create a new TOTP secret', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets')
        .set('X-API-Key', apiKey)
        .send({
          company: 'Test Company',
          externalUserId: testExternalUserId
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body).toHaveProperty('secret');
      expect(res.body).toHaveProperty('uri');
      expect(res.body).toHaveProperty('backupCodes');
      expect(res.body.backupCodes.length).toBe(8); // Should generate 8 backup codes
      expect(res.body.companyId).toEqual(testUser._id.toString());

      // Save ID for later tests
      createdSecretId = res.body._id;
    });

    it('should reject requests without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets')
        .set('X-API-Key', apiKey)
        .send({
          // Missing required fields
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Missing required fields');
    });
  });

  describe('validateTOTP and validateBackupCode', () => {
    it('should attempt to validate TOTP token', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets/validate')
        .set('X-API-Key', apiKey)
        .send({
          externalUserId: testExternalUserId,
          token: '123456' // Invalid token for testing
        });

      // Should be 400 for invalid token
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Invalid TOTP token');
    });

    it('should return 404 for non-existent user in token validation', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets/validate')
        .set('X-API-Key', apiKey)
        .send({
          externalUserId: 'non-existent-user',
          token: '123456'
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });

    it('should attempt to validate backup code', async () => {
      // Get the TOTP secret to find valid backup codes
      const secretRes = await request(app)
        .get(`/api/v1/totp-secrets/${createdSecretId}`)
        .set('X-API-Key', apiKey);
      
      const backupCodes = secretRes.body.backupCodes;
      
      // Try with an invalid backup code
      const res = await request(app)
        .post('/api/v1/totp-secrets/validate-backup-code')
        .set('X-API-Key', apiKey)
        .send({
          externalUserId: testExternalUserId,
          backupCode: 'INVALID-CODE'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('Invalid backup code');
      
      // Try with a valid backup code
      if (backupCodes && backupCodes.length > 0) {
        const validRes = await request(app)
          .post('/api/v1/totp-secrets/validate-backup-code')
          .set('X-API-Key', apiKey)
          .send({
            externalUserId: testExternalUserId,
            backupCode: backupCodes[0]
          });
  
        expect(validRes.statusCode).toEqual(200);
        expect(validRes.body.message).toContain('Backup code is valid');
        expect(validRes.body).toHaveProperty('remainingCodes', backupCodes.length - 1);
      }
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes', async () => {
      const res = await request(app)
        .post(`/api/v1/totp-secrets/user/${testExternalUserId}/regenerate-backup`)
        .set('X-API-Key', apiKey);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('regenerated successfully');
      expect(res.body).toHaveProperty('backupCodes');
      expect(res.body.backupCodes.length).toBe(8);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets/user/non-existent-user/regenerate-backup')
        .set('X-API-Key', apiKey);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toContain('not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing external user ID in backup code validation', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets/validate-backup-code')
        .set('X-API-Key', apiKey)
        .send({
          // Missing externalUserId
          backupCode: 'SOMECODE'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('required');
    });

    it('should handle missing backup code in validation', async () => {
      const res = await request(app)
        .post('/api/v1/totp-secrets/validate-backup-code')
        .set('X-API-Key', apiKey)
        .send({
          externalUserId: testExternalUserId
          // Missing backupCode
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('required');
    });
  });
});

it('should successfully validate a valid TOTP token', async () => {
    // Mock the OTPAuth library for this test
    jest.mock('otpauth', () => {
      return {
        TOTP: jest.fn().mockImplementation(() => ({
          validate: jest.fn().mockReturnValue(0) // Returns a delta value for valid token
        })),
        Secret: {
          fromBase32: jest.fn()
        }
      };
    });
    
    // Mock request
    const mockReq = {
      body: {
        externalUserId: 'test-user',
        token: '123456'
      }
    };
    
    // Mock response
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Mock TOTPSecret.findOne
    TOTPSecret.findOne = jest.fn().mockResolvedValue({
      decryptSecret: jest.fn().mockReturnValue('SECRET123')
    });
    
    // Call validateTOTP
    await validateTOTP(mockReq, mockRes);
    
    // Verify success response
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'TOTP token is valid'
      })
    );
  });