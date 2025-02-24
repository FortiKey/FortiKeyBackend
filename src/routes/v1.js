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


// Define a route for the health check
router.get('/health', (req, res) => {  // Define a route for the health check
    res.status(200).send('Server is healthy!');  // Send a response
});

// test routes


// TOTP secret routes
router.post('/totp-secrets', createTOTPSecret);  // Create a new TOTP secret
router.get('/totp-secrets', getAllTOTPSecrets);  // Get all TOTP secrets
router.get('/totp-secrets/user/:externalUserId', getTOTPSecretByExternalUserId);  // Get a TOTP secret by external user ID
router.get('/totp-secrets/:id', getTOTPSecretById);  // Get a TOTP secret by MongoDB document ID
router.put('/totp-secrets/:id', updateTOTPSecret);  // Update a TOTP secret by MongoDB document ID
router.delete('/totp-secrets/:id', deleteTOTPSecret);  // Delete a TOTP secret by MongoDB document ID
router.post('/totp-secrets/validate', validateTOTP);  // Validate a TOTP token

// auth routes
router.post('/business/register', register);  // Register a new user
router.post('/business/login', login);  // Login an existing user
router.get('/business/profile/:userId', authMiddleware, getProfile);  // Get user profile
router.patch('/business/profile/:userId', authMiddleware, updateUser);  // Update user profile
router.delete('/business/profile/:userId', authMiddleware, deleteUser);  // Delete user profile
router.post('/business/apikey', authMiddleware, generateAPIKey);  // Generate an API key
router.delete('/business/apikey', authMiddleware, deleteAPIKey);  // Delete an API key


module.exports = {
    router
};