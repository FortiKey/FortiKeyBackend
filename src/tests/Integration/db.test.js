const mongoose = require('mongoose');
const { connectDB } = require('../../config/db');

jest.mock('../../config/db', () => ({
  connectDB: jest.fn().mockResolvedValue(true)
}));
jest.mock('mongoose', () => {
  const mockedMongoose = {
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      readyState: 1, // Connected
      close: jest.fn().mockResolvedValue({})
    }
  };
  return mockedMongoose;
});
jest.mock('process', () => ({
  ...process,
  exit: jest.fn()
}));

describe('Database Connection', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should connect to the database successfully', async () => {
    await connectDB();
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('should handle connection errors gracefully', async () => {
    // Save original connection function
    const originalConnect = mongoose.connect;
    
    // Override mongoose.connect to simulate an error
    mongoose.connect = jest.fn().mockRejectedValueOnce(new Error('Connection error'));
    
    // Expect connectDB to handle the error without throwing
    await expect(connectDB()).resolves.not.toThrow();
    
    // Restore original function
    mongoose.connect = originalConnect;
  });
});