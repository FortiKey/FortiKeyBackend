const TOTPSecret = require('../models/totpSecretModel');  // Import the TOTPSecret model
const { generateTOTPSecret, validateTOTPToken } = require('../utils/totpGeneration');  // Import the TOTP functions
const { logger } = require('../middlewares/logger');  // Import the logger

// Create a new TOTP secret
const createTOTPSecret = async (req, res) => {
    try {
        const { company, externalUserId, backupCodes } = req.body;

        if (!company || !externalUserId || !backupCodes) {
            logger.error("Missing required fields");
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Generate a new TOTP secret
        const { secret, uri } = generateTOTPSecret(company, externalUserId);

        if (!secret) {
            logger.error("Failed to generate TOTP secret");
            return res.status(500).json({ message: 'Failed to generate TOTP secret' });
        }

        // Create and save the TOTP secret document
        const newTOTPSecret = new TOTPSecret({
            secret,
            backupCodes,
            externalUserId,
        });

        // Save the TOTP secret
        const savedSecret = await newTOTPSecret.save();

        // Return the TOTP secret
        return res.status(201).json({
            _id: savedSecret._id,
            secret: savedSecret.decryptSecret(),
            backupCodes: savedSecret.decryptBackupCodes(), 
            uri,
        });

    } catch (error) {
        logger.error("Error creating TOTP secret:", error.message);
        return res.status(500).json({ message: 'Error creating TOTP secret', error: error.message });
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
        return res.status(200).json({
            _id: totpSecret._id, // Return the MongoDB document ID
            secret: totpSecret.decryptSecret(), // Decrypt the secret
            backupCodes: totpSecret.decryptBackupCodes(), // Decrypt the backup codes
            externalUserId: totpSecret.externalUserId // Return the external user ID
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error retrieving TOTP secret by ID', error: error.message });
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
        const { externalUserId, token } = req.body;

        // Find the TOTP secret by external user ID
        const totpSecret = await TOTPSecret.findOne({ externalUserId });
        if (!totpSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }

        // Decrypt the stored secret
        const decryptedSecret = totpSecret.decryptSecret();

        const OTPAuth = require('otpauth');
        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(decryptedSecret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
        });

        // Validate the token using the `validate` method
        const delta = totp.validate({ token, window: 1 });

        if (delta === null) {
            return res.status(400).json({ message: 'Invalid TOTP token' });
        }

        return res.status(200).json({ message: 'TOTP token is valid' });

    } catch (error) {
        return res.status(500).json({ message: 'Error validating TOTP token', error: error.message });
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
