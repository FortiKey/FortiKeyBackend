const jwt = require('jsonwebtoken');
const { logger } = require('./logger');

const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) {
        logger.error('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        logger.error('Invalid token');
        res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = { authMiddleware };