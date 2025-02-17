const mongoose = require('mongoose'); // Import mongoose
const dotenv = require('dotenv');   // Import dotenv

dotenv.config(); // Initialise dotenv

// Connect to MongoDB
const connectDB = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
        });
        // Log a success message if the connection is successful
        console.log('MongoDB connected successfully');
    } catch (error) {
        // Log an error message if the connection fails
        console.error('MongoDB connection failed');
        // Exit the process if the connection fails
        process.exit(1);
    }
};

module.exports = {
    connectDB
}