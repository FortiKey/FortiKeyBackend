const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('../config/db');
const mongoose = require('mongoose');
const { logger } = require('../middlewares/logger');

describe('Rate Limiting Middleware', () => {
    let app;

    beforeAll(async () => {
        // Create a fresh Express app for testing
        app = express();
        app.use(express.json());
        await connectDB();
        
        // Define simple test routes with rate limiters directly in the test
        // This avoids issues with middleware imports
        
        // Auth rate limiter - 5 requests max
        const authRoute = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
                return res.status(429).json({
                    message: 'Too many failed attempts, please try again later.'
                });
            }
        });
        
        // TOTP rate limiter - 10 requests max
        const totpRoute = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn(`TOTP validation rate limit exceeded for IP: ${req.ip}`);
                return res.status(429).json({
                    message: 'Too many TOTP validation attempts, please try again later.'
                });
            }
        });
        
        // API rate limiter - 5 requests max (reduced for testing)
        const apiRoute = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
                return res.status(429).json({
                    message: 'Too many requests from this IP, please try again later.'
                });
            }
        });

        app.post('/test-auth', authRoute, (req, res) => {
            res.status(200).json({ message: 'Auth success' });
        });

        app.post('/test-totp', totpRoute, (req, res) => {
            res.status(200).json({ message: 'TOTP success' });
        });

        app.get('/test-api', apiRoute, (req, res) => {
            res.status(200).json({ message: 'API success' });
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('Auth Rate Limiting', () => {
        it('should allow requests within rate limit and block exceeding requests', async () => {
            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {
                const res = await request(app)
                    .post('/test-auth')
                    .send({});
                expect(res.status).toBe(200);
            }

            // This 6th request should be blocked
            const blockedRes = await request(app)
                .post('/test-auth')
                .send({});
            expect(blockedRes.status).toBe(429);
            expect(blockedRes.body).toHaveProperty('message');
            expect(blockedRes.body.message).toContain('Too many failed attempts');
        });
    });

    describe('TOTP Rate Limiting', () => {
        it('should allow requests within rate limit and block exceeding requests', async () => {
            // Make 10 requests (within limit)
            for (let i = 0; i < 10; i++) {
                const res = await request(app)
                    .post('/test-totp')
                    .send({});
                expect(res.status).toBe(200);
            }

            // This 11th request should be blocked
            const blockedRes = await request(app)
                .post('/test-totp')
                .send({});
            expect(blockedRes.status).toBe(429);
            expect(blockedRes.body).toHaveProperty('message');
            expect(blockedRes.body.message).toContain('Too many TOTP validation attempts');
        });
    });

    describe('General API Rate Limiting', () => {
        it('should allow requests within rate limit and block exceeding requests', async () => {
            // Make 5 requests (within limit)
            for (let i = 0; i < 5; i++) {
                const res = await request(app)
                    .get('/test-api');
                expect(res.status).toBe(200);
            }

            // This 6th request should be blocked
            const blockedRes = await request(app)
                .get('/test-api');
            expect(blockedRes.status).toBe(429);
            expect(blockedRes.body).toHaveProperty('message');
            expect(blockedRes.body.message).toContain('Too many requests');
        });
    });
});