const request = require('supertest'); // Import supertest
const express = require('express'); // Import express
const v1Routes = require('../routes/v1'); // Import v1 routes

// Create an express app
const app = express();
// Use the v1 routes
app.use('/api/v1', v1Routes.router);

// Test the health route
describe('GET /api/v1/health', () => {
    // Test if the server is healthy
    it('should return 200 OK for /api/v1/health', async () => {
        const res = await request(app).get('/api/v1/health');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toEqual('Server is healthy!');
    });
});
