const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const v1Routes = require('../routes/v1');

// Create an express app
const app = express();
app.use(express.json());
app.use('/api/v1', v1Routes.router);

// Connect to the database before running tests
beforeAll(async () => {
    await connectDB();
});

// Close the database connection after running tests
afterAll(async () => {
    await mongoose.connection.close();
});

// Describe the Authentication API
describe('Authentication API', () => { 
    // Define a token variable
    let token;
    // Test registering a new user
    it('should register a new user', async () => {
        const res = await request(app)  
            .post('/api/v1/business/register')
            .send({
                businessName: 'TestBusiness',
                email: 'test@email.com',
                password: 'password'
            });
        // Check the response
        expect(res.statusCode).toEqual(201); // Check the status code
        expect(res.body).toHaveProperty('token'); // Check the response body
        token = res.body.token; // Set the token variable
    });

    // Test registering a user with an existing email
    it('should not register a user with an existing email', async () => {  
        // Send a request to register a user with an existing email
        const res = await request(app)
            .post('/api/v1/business/register') // Send a request to register a user
            .send({  // Send the request body
                businessName: 'TestBusiness',
                email: 'test@email.com',
                password: 'password'
            });
        // Check the response
        expect(res.statusCode).toEqual(400); // Check the status code
        expect(res.body).toHaveProperty('message');  // Check the response body
        expect(res.body.message).toEqual('Email already registered'); // Check the response body
    });

    // Test logging in a user
    it('should login an existing user', async () => {
        // Send a request to login a user
        const res = await request(app)
            .post('/api/v1/business/login') // Send a request to login a user
            .send({  // Send the request body
                email: 'test@email.com',
                password: 'password'
            });
        // Check the response
        expect(res.statusCode).toEqual(200); // Check the status code
        expect(res.body).toHaveProperty('token');  // Check the response body
        token = res.body.token; // Set the token variable
    });

    // Test logging in a user with an incorrect password
    it('should not login a user with an incorrect password', async () => {
        // Send a request to login a user with an incorrect password
        const res = await request(app)
            .post('/api/v1/business/login') // Send a request to login a user
            .send({  // Send the request body
                email: 'test@email.com',
                password: 'wrongpassword'
            }); 
        // Check the response
        expect(res.statusCode).toEqual(401); // Check the status code
        expect(res.body).toHaveProperty('message');  // Check the response body
        expect(res.body.message).toEqual('Invalid Password'); // Check the response body
    });

    // Test logging in a user with an incorrect email
    it('should not login a non-existent user', async () => {
        // Send a request to login a non-existent user
        const res = await request(app)
            .post('/api/v1/business/login') // Send a request to login a user
            .send({  // Send the request body
                email: 'nonexistent@example.com',
                password: 'password'
            });
        // Check the response
        expect(res.statusCode).toEqual(401); // Check the status code
        expect(res.body).toHaveProperty('message');  // Check the response body
        expect(res.body.message).toEqual('User not found'); // Check the response body
    });

    // Test getting the user profile
    it('should get the user profile', async () => {      
        // Send a request to get the user profile
        const res = await request(app)
            .get('/api/v1/business/profile') // Send a request to get the user profile
            .set('Authorization', `Bearer ${token}`);  // Set the Authorization header
        // Check the response
        expect(res.statusCode).toEqual(200); // Check the status code
        expect(res.body).toHaveProperty('businessName');  // Check the response body
        expect(res.body).toHaveProperty('email', 'test@email.com');  // Check the response body
    });

    // Test generating an API key
    it('should generate an API key', async () => {
        // Send a request to generate an API key
        const res = await request(app)
            .post('/api/v1/business/api-key') // Send a request to generate an API key
            .set('Authorization', `Bearer ${token}`);  // Set the Authorization header
        // Check the response
        expect(res.statusCode).toEqual(201); // Check the status code
        expect(res.body).toHaveProperty('apiKey');  // Check the response body
    });
});