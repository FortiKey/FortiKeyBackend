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

// TOTP secret routes
router.post('/totp-secrets', createTOTPSecret);  // Create a new TOTP secret
router.get('/totp-secrets', getAllTOTPSecrets);  // Get all TOTP secrets
router.get('/totp-secrets/user/:externalUserId', getTOTPSecretByExternalUserId);  // Get a TOTP secret by external user ID
router.get('/totp-secrets/:id', getTOTPSecretById);  // Get a TOTP secret by MongoDB document ID
router.put('/totp-secrets/:id', updateTOTPSecret);  // Update a TOTP secret by MongoDB document ID
router.delete('/totp-secrets/:id', deleteTOTPSecret);  // Delete a TOTP secret by MongoDB document ID
router.post('/totp-secrets/validate', validateTOTP);  // Validate a TOTP token

// auth routes
router.post('/business/register', register);
router.post('/business/login', login);
router.get('/business/profile/:userId', authMiddleware, getProfile);
router.patch('/business/profile/:userId', authMiddleware, updateUser);
router.delete('/business/profile/:userId', authMiddleware, deleteUser);
router.post('/business/apikey', authMiddleware, generateAPIKey);
router.delete('/business/apikey', authMiddleware, deleteAPIKey);


module.exports = {
    router
};