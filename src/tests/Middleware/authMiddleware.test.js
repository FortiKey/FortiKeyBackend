const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Mock process.exit to prevent tests from terminating
jest.mock('process', () => ({
  ...process,
  exit: jest.fn()
}));

// Import after mocking process
const { connectDB } = require('../../config/db');
const { authMiddleware, apiKeyMiddleware } = require('../../middlewares/authMiddleware');
const User = require('../../models/userModel');

// Mock the logger to prevent console output during tests
jest.mock('../../middlewares/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Auth Middleware', () => {
  let testUser;
  let validToken;
  let invalidToken;
  let apiKey;
  let app;

  beforeAll(async () => {
    // Mock the database connection
    jest.spyOn(mongoose, 'connect').mockResolvedValue({});
    await connectDB();

    // Create a test user with API key
    testUser = new User({
      company: 'Middleware Test Company',
      firstName: 'Test',
      lastName: 'User',
      email: 'middlewaretest@example.com',
      password: 'password123',
      apikey: require('crypto').randomBytes(32).toString('hex')
    });

    // Mock save method
    testUser.save = jest.fn().mockResolvedValue(testUser);
    await testUser.save();
    apiKey = testUser.apikey;

    // Create a valid JWT token
    validToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET || 'test-secret');

    // Create an invalid JWT token
    invalidToken = jwt.sign({ userId: testUser._id }, 'wrong-secret');

    // Create a test Express app
    app = express();
    app.use(express.json());

    // Mock User.findById for the auth middleware
    User.findById = jest.fn().mockImplementation((id) => {
      if (id.toString() === testUser._id.toString()) {
        return {
          select: jest.fn().mockReturnValue({
            role: 'user'
          })
        };
      }
      return null;
    });

    // Mock User.findOne for the API key middleware
    User.findOne = jest.fn().mockImplementation(({ apikey }) => {
      if (apikey === testUser.apikey) {
        return Promise.resolve(testUser);
      }
      return Promise.resolve(null);
    });

    // Route protected by JWT auth
    app.get('/jwt-protected', authMiddleware, (req, res) => {
      res.status(200).json({ message: 'JWT auth successful', userId: req.userId });
    });

    // Route protected by API key auth
    app.get('/api-key-protected', apiKeyMiddleware, (req, res) => {
      res.status(200).json({ message: 'API key auth successful', userId: req.userId });
    });
  });

  afterAll(async () => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  describe('JWT Authentication Middleware', () => {
    it('should authenticate with valid JWT token', async () => {
      const res = await request(app)
        .get('/jwt-protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toEqual('JWT auth successful');
      expect(res.body.userId).toBeTruthy();
    });

    it('should reject request with no token', async () => {
      const res = await request(app)
        .get('/jwt-protected');

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual('No token provided');
    });

    it('should reject request with empty token', async () => {
      const res = await request(app)
        .get('/jwt-protected')
        .set('Authorization', 'Bearer ');

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual('Invalid token');
    });

    it('should reject request with invalid token', async () => {
      // Mock jwt.verify to throw an error for invalid tokens
      jest.spyOn(jwt, 'verify').mockImplementation((token, secret) => {
        if (token === invalidToken) {
          throw new Error('Invalid token');
        }
        return { userId: testUser._id };
      });

      const res = await request(app)
        .get('/jwt-protected')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual('Invalid token');
    });

    it('should reject request with malformed authorization header', async () => {
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const res = await request(app)
        .get('/jwt-protected')
        .set('Authorization', `${validToken}`); // Missing 'Bearer' prefix

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual('Invalid token');
    });

    describe('API Key Authentication Middleware', () => {
      it('should authenticate with valid API key', async () => {
        const res = await request(app)
          .get('/api-key-protected')
          .set('X-API-Key', apiKey);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual('API key auth successful');
        expect(res.body.userId).toBeTruthy();
      });

      it('should reject request with no API key', async () => {
        const res = await request(app)
          .get('/api-key-protected');

        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual('No API key provided');
      });

      it('should reject request with invalid API key', async () => {
        const res = await request(app)
          .get('/api-key-protected')
          .set('X-API-Key', 'invalid-api-key');

        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual('Invalid API key');
      });
    });
  });
});

