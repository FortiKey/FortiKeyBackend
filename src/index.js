const express = require('express');  // Import express
const dotenv = require('dotenv');   // Import dotenv
const winston = require('winston');  // Import winston
const { connectDB } = require('./config/db');  // Import connectDB function

dotenv.config();  // Initialise dotenv

const app = express();  // Create an express app
const port = process.env.PORT || 5000;  // Define the port

const logger = winston.createLogger({  // Create a logger
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Connect to the database
connectDB();

// Define a route to check the health of the server
app.get('/health', (req, res) => {
    res.status(200).send('Server is healthy!');
});

// Define a route to handle errors
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).send('Something broke!');
  });

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

