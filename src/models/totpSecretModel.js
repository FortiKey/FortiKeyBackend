const mongoose = require('mongoose'); // Import mongoose
const crypto = require('crypto'); // Import crypto
const dotenv = require('dotenv'); // Import dotenv

dotenv.config(); // Initialise dotenv

// Ensure encryption key & IV exist
if (!process.env.ENCRYPTION_KEY || !process.env.ENCRYPTION_IV) {
    throw new Error("Missing ENCRYPTION_KEY or ENCRYPTION_IV in environment variables.");
}

// Convert string environment variables to Buffer
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8');
const ENCRYPTION_IV = Buffer.from(process.env.ENCRYPTION_IV, 'utf8');

// Define the schema for the TOTP secret
const TOTPSecretSchema = new mongoose.Schema({
    secret: {
        type: String,
        required: true,
    },
    backupCodes: {
        type: [String],
        required: true,
    },
    externalUserId: {
        type: String,
        required: true,
        unique: true,
        index: true,  
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Encrypt secret before saving
TOTPSecretSchema.pre('save', function (next) {
    if (this.isModified('secret')) {
        this.secret = encrypt(this.secret);
    }
    if (this.isModified('backupCodes')) {
        this.backupCodes = this.backupCodes.map(encrypt);
    }
    next();
});

// Decrypt secret before returning
TOTPSecretSchema.methods.decryptSecret = function () {
    return decrypt(this.secret);
};
// Decrypt backup codes before returning
TOTPSecretSchema.methods.decryptBackupCodes = function () {
    return this.backupCodes.map(decrypt);
};

// Encrypt backup codes before saving
const encrypt = (text) => {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY), Buffer.from(process.env.ENCRYPTION_IV));
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

// Decrypt backup codes before returning
const decrypt = (text) => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY), Buffer.from(process.env.ENCRYPTION_IV));
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

const TOTPSecret = mongoose.model('TOTPSecret', TOTPSecretSchema);

module.exports = TOTPSecret;
