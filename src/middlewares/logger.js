const winston = require('winston');  // Import winston

// Create a logger 
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Export the logger
module.exports = {
    logger
};

// In this file, we create a logger using the winston package. The logger is configured with a console transport for logging to the console and a file transport for logging to a file named combined.log. The logger is exported so that it can be used in other parts of the application.