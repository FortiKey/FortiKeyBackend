const OTPAuth = require('otpauth'); // Import otpauth

// Generate a TOTP secret
const generateTOTPSecret = (businessName, externalUserId) => {
    try {
        // Generate a random 20-byte secret in Base32 format
        const secret = new OTPAuth.Secret({ size: 20 });

        // Create a TOTP instance with Issuer and Label
        const totp = new OTPAuth.TOTP({
            issuer: businessName, // Issuer name
            label: externalUserId, // Label (external user ID)
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: secret // Use the generated secret
        });

        // Convert to URI format (useful for QR codes)
        const uri = totp.toString();

        return {
            secret: secret.base32, // Return the secret in Base32 format
            uri // Return the TOTP URI
        };
    } catch (error) {
        return null;
    }
};

// Validate a TOTP token
const validateTOTPToken = (secret, token) => {
    try {
        // Create a TOTP instance with the secret
        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(secret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
        });

        // Validate the token using the `validate` method
        const delta = totp.validate({ token, window: 1 });
        
        // Return true if the token is valid (delta is not null)
        return delta !== null; 
    } catch (error) {
        return false;
    }
};

// Export the functions
module.exports = {
    generateTOTPSecret,
    validateTOTPToken,
};