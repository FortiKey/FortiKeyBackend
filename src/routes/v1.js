const express = require('express');  // Import express
const router = express.Router();  // Create a router
const {
    createTOTPSecret,
    getAllTOTPSecrets,
    getTOTPSecretByExternalUserId,
    getTOTPSecretById,
    updateTOTPSecret,
    deleteTOTPSecret,
    validateTOTP,
    validateBackupCode,
    regenerateBackupCodes
} = require('../controllers/totpSecretController');  // Import the TOTP secret controller
const {
    register,
    login,
    getProfile,
    updateUser,
    deleteUser,
    getCurrentAPIKey,
    generateAPIKey,
    deleteAPIKey,
    updatePassword
} = require('../controllers/authController');
const {
    authMiddleware,
    apiKeyMiddleware
} = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/adminMiddleware');
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
const {
    getAllCompanyUsers,
    getCompanyUserDetails
} = require('../controllers/adminController');


// Define a route for the health check
router.get('/health', (req, res) => {  // Define a route for the health check
    res.status(200).send('Server is healthy!');  // Send a response
});

// TOTP secret routes
router.post('/totp-secrets/validate', apiKeyMiddleware, totpLimiter, validateTOTP);  // Validate a TOTP token
router.post('/totp-secrets/validate-backup-code', apiKeyMiddleware, totpLimiter, validateBackupCode);  // Validate a backup code
router.post('/totp-secrets', apiKeyMiddleware, apiLimiter, createTOTPSecret);  // Create a new TOTP secret
router.get('/totp-secrets', authMiddleware, apiLimiter, getAllTOTPSecrets);  // Get all TOTP secrets
router.get('/totp-secrets/user/:externalUserId', apiKeyMiddleware, apiLimiter, getTOTPSecretByExternalUserId);  // Get a TOTP secret by external user ID
router.post('/totp-secrets/user/:externalUserId/regenerate-backup', apiKeyMiddleware, totpLimiter, regenerateBackupCodes);  // Regenerate backup codes
router.get('/totp-secrets/:id', apiKeyMiddleware, apiLimiter, getTOTPSecretById);  // Get a TOTP secret by MongoDB document ID
router.patch('/totp-secrets/:id', apiKeyMiddleware, apiLimiter, updateTOTPSecret);  // Update a TOTP secret by MongoDB document ID
router.delete('/totp-secrets/:id',
    (req, res, next) => {
        // Try both auth methods
        if (req.header('Authorization')) {
            return authMiddleware(req, res, next);
        }
        return apiKeyMiddleware(req, res, next);
    },
    apiLimiter, deleteTOTPSecret);  // Delete a TOTP secret by MongoDB document ID


// Auth routes
router.post('/business/register', authLimiter, register);  // Register a new user
router.post('/business/login', authLimiter, login);  // Login an existing user
router.get('/business/profile/:userId', authMiddleware, apiLimiter, getProfile);  // Get user profile
router.patch('/business/profile/:userId', authMiddleware, apiLimiter, updateUser);  // Update user profile
router.patch('/business/profile/:userId/password', authMiddleware, apiLimiter, updatePassword);  // Update user password
router.delete('/business/profile/:userId', authMiddleware, apiLimiter, deleteUser);  // Delete user profile

// Admin routes
router.get('/admin/business-users', authMiddleware, adminMiddleware, apiLimiter, getAllCompanyUsers);  // Get all business users
router.get('/admin/business-users/:userId', authMiddleware, adminMiddleware, apiLimiter, getCompanyUserDetails);  // Get detailed info about a specific business user

// API key routes
router.get('/business/apikey', authMiddleware, apiLimiter, getCurrentAPIKey);  // Get the user's API key
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