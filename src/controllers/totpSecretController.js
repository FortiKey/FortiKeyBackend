const TOTPSecret = require('../models/totpSecretModel');  // Import the TOTPSecret model
const { generateTOTPSecret, validateTOTPToken } = require('../utils/totpGeneration');  // Import the TOTP functions
const { logger } = require('../middlewares/logger');  // Import the logger

// Create a new TOTP secret
const createTOTPSecret = async (req, res) => {
    try {
        // Get the business name and external user ID from the request body
        const { businessName, externalUserId, backupCodes } = req.body;
        // Generate a new TOTP secret
        const secret = generateTOTPSecret(businessName, externalUserId);
        // Create a new TOTP secret document
        const newTOTPSecret = new TOTPSecret({
            secret,
            backupCodes,
            externalUserId,
        });
        // Save the TOTP secret document
        await newTOTPSecret.save();
        // Return the TOTP secret
        return res.status(201).json({ secret });
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error creating TOTP secret' });
    }
};

// Get all TOTP secrets
const getAllTOTPSecrets = async (req, res) => {
    try {
        // Find all TOTP secrets
        const totpSecrets = await TOTPSecret.find();
        // Return the TOTP secrets
        return res.status(200).json(totpSecrets);
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error retrieving TOTP secrets' });
    }
};

// Get a TOTP secret by external user ID
const getTOTPSecretByExternalUserId = async (req, res) => {
    try {
        // Get the external user ID from the request parameters
        const { externalUserId } = req.params;
        // Find the TOTP secret by external user ID
        const totpSecret = await TOTPSecret.findOne({ externalUserId });
        if (!totpSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }
        // Return the TOTP secret
        return res.status(200).json(totpSecret);
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error retrieving TOTP secret' });
    }
};

// Get a TOTP secret by MongoDB document ID
const getTOTPSecretById = async (req, res) => {
    try {
        // Get the MongoDB document ID from the request parameters
        const { id } = req.params;
        // Find the TOTP secret by MongoDB document ID
        const totpSecret = await TOTPSecret.findById(id);
        if (!totpSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }
        // Return the TOTP secret
        return res.status(200).json(totpSecret);
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error retrieving TOTP secret' });
    }
};

// Update a TOTP secret by MongoDB document ID
const updateTOTPSecret = async (req, res) => {
    try {
        // Get the MongoDB document ID from the request parameters
        const { id } = req.params;
        // Update the TOTP secret by MongoDB document ID
        const updatedSecret = await TOTPSecret.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }
        // Return the updated TOTP secret
        return res.status(200).json(updatedSecret);
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error updating TOTP secret' });
    }
};

// Delete a TOTP secret by MongoDB document ID
const deleteTOTPSecret = async (req, res) => {
    try {
        // Get the MongoDB document ID from the request parameters
        const { id } = req.params;
        // Delete the TOTP secret by MongoDB document ID
        const deletedSecret = await TOTPSecret.findByIdAndDelete(id);
        if (!deletedSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }
        // Return a success response
        return res.status(204).send();
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error deleting TOTP secret' });
    }
};

// validate a TOTP Token
const validateTOTP = async (req, res) => {
    try {
        // Get the external user ID and token from the request body
        const { externalUserId, token } = req.body;
        // Find the TOTP secret by external user ID
        const totpSecret = await TOTPSecret.findOne({ externalUserId });
        if (!totpSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }
        // Decrypt the TOTP secret
        const decryptedSecret = totpSecret.decryptSecret();
        // Validate the token
        const isValid = validateTOTPToken(decryptedSecret, token);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid TOTP token' });
        }
        // Return a success response
        return res.status(200).json({ message: 'TOTP token is valid' });
    } catch (error) {
        // Log the error
        logger.error(error.message);
        // Return an error response
        return res.status(500).json({ message: 'Error validating TOTP token' });
    }
};

module.exports = {
    createTOTPSecret,
    getAllTOTPSecrets,
    getTOTPSecretByExternalUserId,
    getTOTPSecretById,
    updateTOTPSecret,
    deleteTOTPSecret,
    validateTOTP,
};
