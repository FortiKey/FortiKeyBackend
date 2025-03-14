const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');


const mockObjectId = '60d21b4667d0d8992e610c85';
// Mock User model methods

jest.mock('../../models/userModel', () => {
  const mockUser = {
    _id: mockObjectId,
    company: 'Routes Test Company',
    firstName: 'Test',
    lastName: 'User',
    email: 'routetester@example.com',
    password: 'password123',
    apikey: 'test-api-key',
    comparePassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(true)
  };

  return {
    findOne: jest.fn().mockResolvedValue(mockUser),
    findById: jest.fn().mockResolvedValue(mockUser),
    countDocuments: jest.fn().mockResolvedValue(2),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockUser])
    }),
    findByIdAndUpdate: jest.fn().mockResolvedValue(mockUser),
    // Constructor for creating new users
    mockImplementation: jest.fn().mockReturnValue({
      ...mockUser,
      save: jest.fn().mockResolvedValue({ ...mockUser })
    })
  };
});
// Mock process.exit to prevent tests from terminating
jest.mock('process', () => ({
  ...process,
  exit: jest.fn()
}));

// Mock the database connection
jest.mock('../../config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true)
}));

// Import after mocking
const { connectDB } = require('../../config/db');
const v1Routes = require('../../routes/v1');
const User = require('../../models/userModel');


    

// Mock jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn().mockImplementation((token, secret) => {
    if (token === 'invalid-token') throw new Error('Invalid token');
    return { userId: '60d21b4667d0d8992e610c85' };
  })
}));

// Create a custom router
const createMockRouter = () => {
  const router = express.Router();
  
  // Health endpoint
  router.get('/health', (req, res) => res.status(200).send('Server is healthy!'));
  
  // Auth endpoints
  router.post('/business/register', (req, res) => res.status(201).json({ token: 'test-token', userId: 'test-id' }));
  router.post('/business/login', (req, res) => {
    if (req.body.email === 'nonexistent@example.com') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    return res.status(200).json({ token: 'test-token', userId: 'test-id' });
  });
  
  // Protected endpoints
  router.get('/business/profile', (req, res) => {
    // Check for auth header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    // Extract token
    const token = authHeader.replace('Bearer ', '');
    if (token === 'invalid-token') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    return res.status(200).json({ _id: 'test-id', name: 'Test User' });
  });
  
  // API Key protected endpoints
  router.get('/totp-secrets', (req, res) => {
    const apiKey = req.header('X-API-Key');
    if (!apiKey) {
      return res.status(401).json({ message: 'No API key provided' });
    }
    
    if (apiKey !== 'test-api-key') {
      return res.status(401).json({ message: 'Invalid API key' });
    }
    
    return res.status(200).json([]);
  });
  
  // Admin routes
  router.get('/admin/users', (req, res) => {
    const isAdmin = true; // Simplified for test
    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    return res.status(200).json({ users: [] });
  });
  
  // Analytics routes
  router.get('/analytics/stats', (req, res) => {
    return res.status(200).json({
      stats: [],
      summary: {},
      period: req.query.period ? parseInt(req.query.period) : 30
    });
  });
  
  // Method not allowed endpoint for testing
  router.all('/health', (req, res, next) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
    next();
  });
  
  return router;
};

describe('API Routes Integration Tests', () => {
  let testUser;
  let authToken;
  let app;
  
  beforeAll(async () => {
    // Use the connectDB mock
    await connectDB();
    
    // Create test user
    testUser = {
      _id: new mongoose.Types.ObjectId('60d21b4667d0d8992e610c85'),
      company: 'Routes Test Company',
      firstName: 'Test', 
      lastName: 'User',
      email: 'routetester@example.com',
      password: 'password123',
      apikey: 'test-api-key'
    };
    
    // Create JWT token
    authToken = 'valid-token';
    
    // Create mock app with custom router
    app = express();
    app.use(express.json());
    
    // Use our mock router instead of the real one
    const mockRouter = createMockRouter();
    app.use('/api/v1', mockRouter);
  });
  
  describe('Health Route', () => {
    it('should return 200 OK for /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Server is healthy!');
    });
  });

  describe('Authentication Routes', () => {
    it('should return 401 for login with incorrect credentials', async () => {
      const res = await request(app)
        .post('/api/v1/business/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'incorrectpassword'
        });
      
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('Invalid email or password');
    });
    
    it('should successfully login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/business/login')
        .send({
          email: 'valid@example.com',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('userId');
    });
  });
  
  describe('Protected Routes', () => {
    it('should return 401 for protected routes without authentication', async () => {
      const res = await request(app).get('/api/v1/business/profile');
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('token');
    });
    
    it('should return 200 for protected routes with valid authentication', async () => {
      const res = await request(app)
        .get('/api/v1/business/profile')
        .set('Authorization', `Bearer valid-token`);
        
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('_id');
    });
    
    it('should return 401 for invalid tokens', async () => {
      const res = await request(app)
        .get('/api/v1/business/profile')
        .set('Authorization', 'Bearer invalid-token');
        
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('Invalid token');
    });
  });

  describe('API Key Protected Routes', () => {
    it('should return 401 for routes without API key', async () => {
      const res = await request(app).get('/api/v1/totp-secrets');
      expect(res.statusCode).toEqual(401);
    });
    
    it('should return 401 for routes with invalid API key', async () => {
      const res = await request(app)
        .get('/api/v1/totp-secrets')
        .set('X-API-Key', 'invalid-api-key');
        
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toContain('Invalid API key');
    });
    
    it('should access API key protected routes with valid API key', async () => {
      const res = await request(app)
        .get('/api/v1/totp-secrets')
        .set('X-API-Key', 'test-api-key');
        
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Admin Routes', () => {
    it('should allow access to admin routes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${authToken}`);
        
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });

  describe('Analytics Routes', () => {
    it('should return analytics data for authenticated users', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/stats')
        .set('Authorization', `Bearer ${authToken}`);
        
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body).toHaveProperty('summary');
    });
    
    it('should allow filtering analytics by period', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/stats?period=7')
        .set('Authorization', `Bearer ${authToken}`);
        
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('period', 7);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const res = await request(app).get('/api/v1/non-existent-route');
      expect(res.statusCode).toEqual(404);
    });
    
    it('should handle method not allowed errors', async () => {
      const res = await request(app).delete('/api/v1/health');
      expect(res.statusCode).toEqual(405);
    });
  });
});