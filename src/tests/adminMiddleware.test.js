const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { connectDB } = require('../config/db');
const { adminMiddleware } = require('../middlewares/adminMiddleware');
const User = require('../models/userModel');

describe('Admin Middleware', () => {
  let adminUser;
  let regularUser;
  let adminToken;
  let userToken;
  let app;
  const timestamp = Date.now(); // Use timestamp to make emails unique

  beforeAll(async () => {
    await connectDB();

    // Create an admin user with unique email
    adminUser = new User({
      company: 'Admin Company',
      firstName: 'Admin',
      lastName: 'User',
      email: `admintest${timestamp}@example.com`,
      password: 'password123',
      role: 'admin'
    });

    // Create a regular user with unique email
    regularUser = new User({
      company: 'Regular Company',
      firstName: 'Regular',
      lastName: 'User',
      email: `regulartest${timestamp}@example.com`,
      password: 'password123',
      role: 'user'
    });

    await adminUser.save();
    await regularUser.save();

    adminToken = jwt.sign({ userId: adminUser._id }, process.env.JWT_SECRET);
    userToken = jwt.sign({ userId: regularUser._id }, process.env.JWT_SECRET);

    // Create a test Express app
    app = express();
    app.use(express.json());

    // Create a test route protected by adminMiddleware
    app.get('/admin-only', (req, res, next) => {
      req.userId = req.headers.userid;
      next();
    }, adminMiddleware, (req, res) => {
      res.status(200).json({ message: 'Admin access granted' });
    });

    // Create a test route with already established admin role
    app.get('/admin-with-role', (req, res, next) => {
      req.userId = req.headers.userid;
      req.userRole = req.headers.userrole;
      next();
    }, adminMiddleware, (req, res) => {
      res.status(200).json({ message: 'Admin access granted with role' });
    });
  });

  afterAll(async () => {
    await User.deleteMany({ 
      email: { 
        $in: [
          `admintest${timestamp}@example.com`, 
          `regulartest${timestamp}@example.com`
        ] 
      } 
    });
    await mongoose.connection.close();
  });

  it('should allow access to admin users', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('userId', adminUser._id.toString());

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Admin access granted');
  });

  it('should deny access to regular users', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('userId', regularUser._id.toString());

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toEqual('Forbidden: Admin access required');
  });

  it('should allow access when userRole is already admin', async () => {
    const res = await request(app)
      .get('/admin-with-role')
      .set('userId', regularUser._id.toString())
      .set('userRole', 'admin');

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Admin access granted with role');
  });

  it('should handle database errors', async () => {
    const res = await request(app)
      .get('/admin-only')
      .set('userId', 'invalid-id');

    expect(res.statusCode).toEqual(500);
    expect(res.body.message).toEqual('Internal server error');
  });
});