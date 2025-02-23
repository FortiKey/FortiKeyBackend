const OTPAuth = require('otpauth'); // Import otpauth

// Generate a TOTP secret
const generateTOTPSecret = (businessName, userId) => {
    const totp = new OTPAuth.TOTP({
        issuer: businessName, // The name of the business
        label: externalUserId, // The user ID
        algorithm: 'SHA1', // The algorithm to use
        digits: 6, // The number of digits
        period: 30, // The period
    });
    return totp.secret.base32; // Return the base32 secret
};

// Validate a TOTP token
const validateTOTPToken = (secret, token) => {
    const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret), // The secret
        algorithm: 'SHA1', // The algorithm
        digits: 6, // The number of digits
        period: 30, // The period
    });
    return totp.validate({
        token, // The token
    });
}

// Export the functions
module.exports = {
    generateTOTPSecret,
    validateTOTPToken,
};