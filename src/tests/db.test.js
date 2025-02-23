const mongoose = require('mongoose'); // Import mongoose
const { connectDB } = require('../config/db'); // Import connectDB function

// Describe the test suite
describe('Database connection', () => {
    // Before all tests, connect to the database
    beforeAll(async () => {
        await connectDB();
    });
    // After all tests, close the database connection
    afterAll(async () => {
        await mongoose.connection.close();
    });
    // Test if the connection is successful
    it('should connect to the database', () => {
        expect(mongoose.connection.readyState).toBe(1);
    });
});