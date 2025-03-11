const TOTPSecret = require('../models/totpSecretModel');  // Import the TOTPSecret model
const { generateTOTPSecret, validateTOTPToken } = require('../utils/totpGeneration');  // Import the TOTP functions
const { logger } = require('../middlewares/logger');  // Import the logger
const User = require('../models/userModel');  // Import the User model

// Create a new TOTP secret
const createTOTPSecret = async (req, res) => {
    try {
        const { company, externalUserId } = req.body;

        if (!company || !externalUserId) {
            logger.error("Missing required fields");
            return res.status(400).json({ message: 'Missing required fields (company and externalUserId are required)' });
        }

        // Generate a new TOTP secret
        const { secret, uri } = generateTOTPSecret(company, externalUserId);

        if (!secret) {
            logger.error("Failed to generate TOTP secret");
            return res.status(500).json({ message: 'Failed to generate TOTP secret' });
        }

        // Automatically generate backup codes (8 codes, each 6 characters long)
        const backupCodes = Array.from({ length: 8 }, () =>
            Math.random().toString(36).substring(2, 8).toUpperCase()
        );

        // Get the authenticated user ID
        const userId = req.userId;
        
        // Get the user to retrieve their company name
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create and save the TOTP secret document
        const newTOTPSecret = new TOTPSecret({
            secret,
            backupCodes,
            externalUserId,
            companyId: userId, // Set the creator's user ID
            metadata: {
                company: user.company, // Store company name in metadata
                createdBy: `${user.firstName} ${user.lastName}`
            }
        });

        // Save the TOTP secret
        const savedSecret = await newTOTPSecret.save();

        // Return the TOTP secret
        return res.status(201).json({
            _id: savedSecret._id,
            secret: savedSecret.decryptSecret(),
            backupCodes: savedSecret.decryptBackupCodes(), 
            uri,
            companyId: savedSecret.companyId,
            metadata: savedSecret.metadata
        });

    } catch (error) {
        logger.error("Error creating TOTP secret:", error.message);
        return res.status(500).json({ message: 'Error creating TOTP secret', error: error.message });
    }
};

// Get all TOTP secrets
const getAllTOTPSecrets = async (req, res) => {
    try {
        // Get the authenticated user ID from the request
        const userId = req.userId;
        
        // Find the user to get their role
        const user = await User.findById(userId);
        if (!user) {
            logger.error(`User not found: ${userId}`);
            return res.status(404).json({ message: 'User not found' });
        }
        
        logger.info(`Getting TOTP secrets for user: ${userId}, role: ${user.role}`);
        
        // Determine query based on user role
        let query;
        if (user.role === 'admin') {
            // Admin can see all TOTP secrets
            query = {};
            logger.info('Admin user - returning all secrets');
        } else {
            // Business users can only see their own TOTP secrets
            query = { companyId: userId };
            logger.info(`Business user - returning secrets with companyId: ${userId}`);
        }
        
        // Find TOTP secrets based on the query
        const totpSecrets = await TOTPSecret.find(query);
        
        logger.info(`Found ${totpSecrets.length} TOTP secrets`);
        
        // Return the filtered TOTP secrets
        return res.status(200).json(totpSecrets);
    } catch (error) {
        // Log the error
        logger.error(`Error in getAllTOTPSecrets: ${error.message}`);
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
        // Get the TOTP secret ID from the request
        const { id } = req.params;
        
        // Find the TOTP secret by ID
        const deletedSecret = await TOTPSecret.findByIdAndDelete(id);
        
        if (!deletedSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }
        
        // Log the deletion
        logger.info(`TOTP secret deleted: ${deletedSecret.externalUserId}`);
    
        // Return a success response
        res.status(204).send();
    } catch (error) {
        logger.error("Error deleting TOTP secret:", error.message);
        res.status(500).json({ message: 'Error deleting TOTP secret' });
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

// Validate a backup code
const validateBackupCode = async (req, res) => {
    try {
        const { externalUserId, backupCode } = req.body;

        if (!externalUserId || !backupCode) {
            logger.error("Missing required fields for backup code validation");
            return res.status(400).json({ message: 'External user ID and backup code are required' });
        }

        // Find the TOTP secret by external user ID
        const totpSecret = await TOTPSecret.findOne({ externalUserId });
        if (!totpSecret) {
            logger.error(`TOTP secret not found for user: ${externalUserId}`);
            return res.status(404).json({ message: 'TOTP secret not found' });
        }

        // Decrypt the stored backup codes
        const decryptedBackupCodes = totpSecret.decryptBackupCodes();
        
        // Check if the provided backup code matches any of the stored backup codes
        const codeIndex = decryptedBackupCodes.findIndex(code => code === backupCode);
        
        if (codeIndex === -1) {
            // Log the failed backup code attempt
            const { logEvent } = require('./analyticsController');
            logEvent({
                companyId: totpSecret.companyId,
                externalUserId,
                eventType: 'backup_code_used',
                success: false,
                details: { error: 'Invalid backup code' }
            }, req);
            
            return res.status(400).json({ message: 'Invalid backup code' });
        }
        
        // Remove the used backup code from the array
        const updatedBackupCodes = [...decryptedBackupCodes];
        updatedBackupCodes.splice(codeIndex, 1);
        
        // Update the TOTP secret with the new backup codes array
        totpSecret.backupCodes = updatedBackupCodes;
        await totpSecret.save();
        
        // Log the successful backup code usage
        const { logEvent } = require('./analyticsController');
        logEvent({
            companyId: totpSecret.companyId,
            externalUserId,
            eventType: 'backup_code_used',
            success: true,
            details: { 
                backupCodeIndex: codeIndex,
                remainingCodes: updatedBackupCodes.length
            }
        }, req);

        return res.status(200).json({ 
            message: 'Backup code is valid',
            remainingCodes: updatedBackupCodes.length
        });
    } catch (error) {
        logger.error("Error validating backup code:", error.message);
        return res.status(500).json({ message: 'Error validating backup code', error: error.message });
    }
};

// Regenerate backup codes
const regenerateBackupCodes = async (req, res) => {
    try {
        const { externalUserId } = req.params;

        if (!externalUserId) {
            logger.error("Missing external user ID");
            return res.status(400).json({ message: 'External user ID is required' });
        }

        // Find the TOTP secret by external user ID
        const totpSecret = await TOTPSecret.findOne({ externalUserId });
        if (!totpSecret) {
            logger.error(`TOTP secret not found for user: ${externalUserId}`);
            return res.status(404).json({ message: 'TOTP secret not found' });
        }

        // Generate new backup codes
        const newBackupCodes = Array.from({ length: 8 }, () =>
            Math.random().toString(36).substring(2, 8).toUpperCase()
        );

        // Update the backup codes
        totpSecret.backupCodes = newBackupCodes;

        // Save the updated TOTP secret
        await totpSecret.save();

        // Log the backup code regeneration
        const { logEvent } = require('./analyticsController');
        logEvent({
            companyId: totpSecret.companyId,
            externalUserId,
            eventType: 'backup_codes_regenerated',
            success: true,
            details: { count: newBackupCodes.length }
        }, req);

        // Return the new backup codes
        return res.status(200).json({
            message: 'Backup codes regenerated successfully',
            backupCodes: totpSecret.decryptBackupCodes()
        });
    } catch (error) {
        logger.error("Error regenerating backup codes:", error.message);
        return res.status(500).json({ message: 'Error regenerating backup codes', error: error.message });
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
    validateBackupCode,
    regenerateBackupCodes
};
