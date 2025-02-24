const request = require('supertest');  // Import supertest
const express = require('express');  // Import express
const mongoose = require('mongoose');  // Import mongoose
const { connectDB } = require('../config/db');  // Import the connectDB function
const { apiLimiter, authLimiter, totpLimiter } = require('../middlewares/rateLimiter');  // Import the rate limiters

describe('Rate Limiting Middleware', () => { 
    let app;  // Define the app variable

    beforeAll(async () => {  // Connect to the database before running tests
       
        app = express();  // Create an express app
        app.use(express.json());  // Use the JSON middleware
         await connectDB();  // Connect to the database

        // Test routes 
        app.post('/api/v1/test/auth', authLimiter, (req, res) => {  // Test route with authLimiter
            res.status(200).json({ message: 'Auth success' });
        });
        app.post('/api/v1/test/api', apiLimiter, (req, res) => {  // Test route with apiLimiter
        res.status(200).json({ message: 'API success' });
        });
        app.post('/api/v1/test/totp', totpLimiter, (req, res) => {  // Test route with totpLimiter
        res.status(200).json({ message: 'TOTP success' });
        });
    });

    afterAll(async () => {  // Close the database connection after running tests
        await mongoose.connection.close();  // Close the database connection
    });

    // Auth Rate Limiting
    describe('Auth Rate Limiting', () => {
        it('should allow requests within rate limit', async () => { // Test that requests within the rate limit are allowed
            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {  // Loop through 5 requests
                const res = await request(app)  // Make a request
                    .post('/api/v1/test/auth')  
                    .send({});
                expect(res.status).toBe(200);  // Check the status code
            }
        });

        it('should block requests exceeding rate limit', async () => {  // Test that requests exceeding the rate limit are blocked
            // Make 6 requests (exceeding limit)
            for (let i = 0; i < 5; i++) {  // Loop through 5 requests
                await request(app)  // Make a request
                    .post('/api/v1/test/auth')
                    .send({});
            }

            // This request should be blocked
            const res = await request(app)  // Make a request
                .post('/api/v1/test/auth')
                .send({});
            expect(res.status).toBe(429);  // Check the status code
            expect(res.body.message).toContain('Too many failed attempts');  // Check the response body
        });
    });

    // TOTP Rate Limiting
    describe('TOTP Rate Limiting', () => {
        it('should allow TOTP validation requests within rate limit', async () => {  // Test that TOTP validation requests within the rate limit are allowed
            // Make 10 requests (within limit)
            for (let i = 0; i < 10; i++) {  // Loop through 10 requests
                const res = await request(app)  // Make a request
                    .post('/api/v1/test/totp')
                    .send({});
                expect(res.status).toBe(200);  // Check the status code
            }
        });

        
        it('should block TOTP validation requests exceeding rate limit', async () =>{  // Test that TOTP validation requests exceeding the rate limit are blocked
            // Make 11 requests (exceeding limit)
            for (let i = 0; i < 10; i++) {  // Loop through 10 requests
                await request(app)  // Make a request
                    .post('/api/v1/test/totp')
                    .send({});
            }

            // This request should be blocked
            const res = await request(app)  
                .post('/api/v1/test/totp')  // Make a request
                .send({});
            expect(res.status).toBe(429);  // Check the status code
            expect(res.body.message).toContain('Too many TOTP validation attempts');  // Check the response body
        });
    });

    // General API Rate Limiting
    describe('General API Rate Limiting', () => {  // Test the general API rate limiting
        it('should allow API requests within rate limit', async () => {  // Test that API requests within the rate limit are allowed
            // Make 100 requests (within limit)  
            for (let i = 0; i < 100; i++) {  // Loop through 100 requests
                const res = await request(app)  // Make a request
                    .get('/api/v1/test/api');
                expect(res.status).toBe(200);   // Check the status code
            }
        });

        it('should block API requests exceeding rate limit', async () => {  // Test that API requests exceeding the rate limit are blocked
            // Make 101 requests (exceeding limit)
            for (let i = 0; i < 100; i++) {
                await request(app)
                    .get('/api/v1/test/api');
            }

            // This request should be blocked
            const res = await request(app)
                .get('/api/v1/test/api');
            expect(res.status).toBe(429);
            expect(res.body.message).toContain('Too many requests');
        });
    });
});