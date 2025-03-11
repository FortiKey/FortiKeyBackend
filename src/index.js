const express = require('express');  // Import express
const dotenv = require('dotenv');   // Import dotenv
const helmet = require('helmet');  // Import helmet
const cors = require('cors');  // Import cors
const { connectDB } = require('./config/db');  // Import connectDB function
const v1Routes = require('./routes/v1');  // Import v1 routes
const { logger } = require('./middlewares/logger');  // Import logger

dotenv.config();  // Initialise dotenv

const app = express();  // Create an express app
const port = process.env.PORT || 3000;  // Define the port

app.set('trust proxy', 1);  // Trust the first proxy

// Connect to the database
connectDB();

// Configure CORS with more specific options
const corsOptions = {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'https://fortikey.netlify.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };

// Use middleware
app.use(helmet());  // Use helmet
app.use(cors());  // Use cors
app.options('*', cors(corsOptions));  // Enable pre-flight requests
app.use(express.json());  // Parse JSON bodies

// Use the v1 routes
app.use('/api/v1', v1Routes.router);

app.use((req, res, next) => {
    res.status(404).send('Route not found');
});

// Define a route to handle errors
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    console.log(`Server is running on port ${port}`);
});

