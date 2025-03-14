const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { connectDB } = require('../config/db');
const { authMiddleware, apiKeyMiddleware } = require('../middlewares/authMiddleware');
const User = require('../models/userModel');

describe('Auth Middleware', () => {
  let testUser;
  let validToken;
  let invalidToken;
  let apiKey;
  let app;

  beforeAll(async () => {
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

    await testUser.save();
    apiKey = testUser.apikey;

    // Create a valid JWT token
    validToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET);
    
    // Create an invalid JWT token
    invalidToken = jwt.sign({ userId: testUser._id }, 'wrong-secret');

    // Create a test Express app
    app = express();
    app.use(express.json());

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
    await User.findByIdAndDelete(testUser._id);
    await mongoose.connection.close();
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
      // This matches the actual implementation behavior
      expect(res.body.message).toEqual('Invalid token');
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/jwt-protected')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toEqual('Invalid token');
    });
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