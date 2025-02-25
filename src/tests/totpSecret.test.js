const request = require('supertest'); // Import supertest
const express = require('express'); // Import express
const mongoose = require('mongoose'); // Import mongoose
const jwt = require('jsonwebtoken'); // Import jsonwebtoken

const { connectDB } = require('../config/db'); // Import connectDB function
const v1Routes = require('../routes/v1'); // Import v1 routes
const User = require('../models/userModel'); // Import the user model
const TOTPSecret = require('../models/totpSecretModel'); // Import the TOTP secret model

const dotenv = require('dotenv'); // Import dotenv

dotenv.config(); // Configure dotenv

// Create an express app
const app = express();
// Use middleware
app.use(express.json());
// Use the v1 routes
app.use('/api/v1', v1Routes.router);

// test variables
let testUser;
let testToken;
let createdSecretId;
const businessName = 'TestBusiness';
const externalUserId = 'user123';
const backupCodes = ['code1', 'code2'];

// Connect to the database before running tests
beforeAll(async () => {
    await connectDB();

    // Create a test user
    testUser = new User({
        businessName: 'TOTP Test Business',
        fullName: 'TOTP Test User',
        email: 'totptester@example.com',
        password: 'password123'
    });

    await testUser.save();
    // Create a JWT token for the test user
    testToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET);

    // Create a TOTP secret and store its ID
    const res = await request(app)
        .post('/api/v1/totp-secrets')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ businessName, externalUserId, backupCodes });

    createdSecretId = res.body._id;
});

// Close the database connection after running tests
afterAll(async () => {
    // Clean up created data
    await User.findByIdAndDelete(testUser._id);
    await TOTPSecret.deleteOne({ externalUserId });
    
    await mongoose.connection.close();
});

// Test getting a TOTP secret by external user ID
it('should get a TOTP secret by external user ID', async () => {
    const res = await request(app)
      .get(`/api/v1/totp-secrets/user/${externalUserId}`)
      .set('Authorization', `Bearer ${testToken}`); // Add auth token
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.externalUserId).toEqual(externalUserId);
});

// Test getting a TOTP secret by ID
it('should get a TOTP secret by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/totp-secrets/${createdSecretId}`)
      .set('Authorization', `Bearer ${testToken}`); // Add auth token
      
    expect(res.statusCode).toEqual(200);
    expect(res.body._id).toEqual(createdSecretId);
});

// Test validating a TOTP token
it('should attempt to validate a TOTP token', async () => {
    // We're just testing the endpoint works, not that validation passes
    const res = await request(app)
      .post('/api/v1/totp-secrets/validate')
      .send({
        externalUserId,
        token: '123456' // Invalid token, but we just want to test the endpoint
      });

    // Expect either 400 (invalid token) or 404 (not found)
    // Both are acceptable for this test
    expect([400, 404]).toContain(res.statusCode);
});

// Test updating a TOTP secret
it('should update a TOTP secret', async () => {
    const newBackupCodes = ['newcode1', 'newcode2'];
    const resUpdate = await request(app)
      .patch(`/api/v1/totp-secrets/${createdSecretId}`) // Update the TOTP secret
      .set('Authorization', `Bearer ${testToken}`) // Add auth token
      .send({ backupCodes: newBackupCodes });

    expect(resUpdate.statusCode).toEqual(200);
    expect(resUpdate.body.backupCodes).toEqual(newBackupCodes);
});

// Test deleting a TOTP secret
it('should delete a TOTP secret', async () => {
    const resDelete = await request(app)
      .delete(`/api/v1/totp-secrets/${createdSecretId}`)
      .set('Authorization', `Bearer ${testToken}`); // Add auth token

    expect(resDelete.statusCode).toEqual(204);
});

// Test getting all TOTP secrets
it('should get all TOTP secrets', async () => {
    const res = await request(app)
      .get('/api/v1/totp-secrets')
      .set('Authorization', `Bearer ${testToken}`); // Add auth token
      
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
});