const User = require('../models/userModel');
const { logger } = require('./logger');

const adminMiddleware = async (req, res, next) => {
    // If role was already fetched in authMiddleware
    if (req.userRole && req.userRole === 'admin') {
        return next();
    }

    try {
        // Otherwise check database
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'admin') {
            logger.warn(`Non-admin user ${req.userId} attempted to access admin route`);
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }

        // User is an admin, proceed
        next();
    } catch (error) {
        logger.error('Error in admin middleware:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    adminMiddleware
};