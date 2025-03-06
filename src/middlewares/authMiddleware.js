const jwt = require('jsonwebtoken');
const { logger } = require('./logger');
const User = require('../models/userModel');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        logger.error('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) {
        logger.error('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        const user = await User.findById(decoded.userId).select('role');
        next();
    } catch (error) {
        logger.error('Invalid token');
        res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = { authMiddleware };

// In this file, we define an authMiddleware function that checks for a valid JWT token in the Authorisation header of the request. If the token is missing or invalid, the middleware logs an error message and returns a 401 Unauthorised response. If the token is valid, the middleware decodes the token and extracts the userId, which is then added to the request object for use in subsequent middleware or route handlers. The authMiddleware function is exported so that it can be used in other parts of the application.