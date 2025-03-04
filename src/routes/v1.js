const express = require('express');  // Import express
const router = express.Router();  // Create a router
const {
    createTOTPSecret,
    getAllTOTPSecrets,
    getTOTPSecretByExternalUserId,
    getTOTPSecretById,
    updateTOTPSecret,
    deleteTOTPSecret,
    validateTOTP
} = require('../controllers/totpSecretController');  // Import the TOTP secret controller
const { 
    register,
    login,
    getProfile,
    updateUser,
    deleteUser,
    generateAPIKey,
    deleteAPIKey
} = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const { 
    apiLimiter,
    authLimiter, 
    totpLimiter 
} = require('../middlewares/rateLimiter');
const {
    getCompanyStats,
    getTOTPStats,
    getFailureAnalytics,
    getUserTOTPStats,
    getSuspiciousActivity,
    getDeviceBreakdown,
    getBackupCodeUsage,
    getTimeComparisons,
} = require('../controllers/analyticsController');
const { logRateLimitExceeded } = require('../middlewares/analyticsMiddleware');


// Define a route for the health check
router.get('/health', (req, res) => {  // Define a route for the health check
    res.status(200).send('Server is healthy!');  // Send a response
});

// TOTP secret routes
router.post('/totp-secrets', apiLimiter, createTOTPSecret);  // Create a new TOTP secret
router.get('/totp-secrets', authMiddleware, apiLimiter, getAllTOTPSecrets);  // Get all TOTP secrets
router.get('/totp-secrets/user/:externalUserId', authMiddleware, apiLimiter, getTOTPSecretByExternalUserId);  // Get a TOTP secret by external user ID
router.get('/totp-secrets/:id', authMiddleware, apiLimiter, getTOTPSecretById);  // Get a TOTP secret by MongoDB document ID
router.patch('/totp-secrets/:id', authMiddleware, apiLimiter, updateTOTPSecret);  // Update a TOTP secret by MongoDB document ID
router.delete('/totp-secrets/:id', authMiddleware, apiLimiter, deleteTOTPSecret);  // Delete a TOTP secret by MongoDB document ID
router.post('/totp-secrets/validate',totpLimiter, validateTOTP);  // Validate a TOTP token

// Auth routes
router.post('/business/register', authLimiter, register);  // Register a new user
router.post('/business/login', authLimiter, login);  // Login an existing user
router.get('/business/profile/:userId', authMiddleware, apiLimiter, getProfile);  // Get user profile
router.patch('/business/profile/:userId', authMiddleware, apiLimiter, updateUser);  // Update user profile
router.delete('/business/profile/:userId', authMiddleware, apiLimiter, deleteUser);  // Delete user profile

// API key routes
router.post('/business/apikey', authMiddleware, apiLimiter, generateAPIKey);  // Generate an API key
router.delete('/business/apikey', authMiddleware, apiLimiter, deleteAPIKey);  // Delete an API key

// Analytics routes
router.get('/analytics/business', authMiddleware, apiLimiter, getCompanyStats);  // Get business analytics
router.get('/analytics/totp', authMiddleware, apiLimiter, getTOTPStats);  // Get TOTP analytics
router.get('/analytics/failures', authMiddleware, apiLimiter, getFailureAnalytics);  // Get failure analytics
router.get('/analytics/users/:externalUserId/totp', authMiddleware, apiLimiter, getUserTOTPStats);  // Get user TOTP analytics
router.get('/analytics/suspicious', authMiddleware, apiLimiter, getSuspiciousActivity);  // Get suspicious activity analytics
router.get('/analytics/devices', authMiddleware, apiLimiter, getDeviceBreakdown);  // Get device breakdown analytics
router.get('/analytics/backup-codes', authMiddleware, apiLimiter, getBackupCodeUsage);  // Get backup code usage analytics
router.get('/analytics/time-comparison', authMiddleware, apiLimiter, getTimeComparisons);  // Get time comparison analytics


module.exports = {
    router
};