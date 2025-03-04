const mongoose = require('mongoose');
const { logger } = require('../middlewares/logger');

const UsageSchema = new mongoose.Schema({
    // reference to the company (User) who performed the action
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true,
    },

    // external user ID (from the client system)
    externalUserId: {
        type: String,
        required: false,
        index: true,
    },

    // Event type
    eventType: {
        type: String,
        required: true,
        enum: [
            'totp_setup',          // Initial TOTP setup
            'totp_validation',     // TOTP validation attempt
            'backup_code_used',    // Backup code used
            'api_key_generated',   // API key generation
            'api_key_deleted',     // API key deletion
            'registration',        // New company registration
            'login',               // Company login
            'profile_access',      // Profile information access
            'profile_update',      // Profile information update
            'profile_delete',      // Profile deletion
            'totp_access',         // TOTP secret access
            'totp_update',         // TOTP secret update
            'totp_delete',         // TOTP secret deletion
            'analytics_access',    // Analytics access
            'rate_limit_exceeded'  // Rate limit exceeded
        ],
        index: true,
    },

    // Success or failure
    success: {
        type: Boolean,
        required: true,
        index: true,
    },

    // Additional information (flexible JSON data specific to the event type)
    details: {
        type: Object,
        required: false,
    },

    // IP address
    ipAddress: {
        type: String,
        required: false,
    },

    userAgent: {
        type: String,
        required: false,
    },

    // Timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// Compound index for common queries
UsageSchema.index({ companyId: 1, eventType: 1, timestamp: -1 });
UsageSchema.index({ externalUserId: 1, timestamp: -1 });
UsageSchema.index({ eventType: 1, success: 1, timestamp: -1 });

// static method to log an event
UsageSchema.statics.logEvent = async function (eventData) {
    try {
        const usage = new this(eventData);
        await usage.save();
        return usage;
    } catch (error) {
        logger.error('Error logging usage event:', error.message);
        // Don't throw - logging should never break the main flow
        return null;
    }
};

const Usage = mongoose.model('Usage', UsageSchema);

module.exports = {
    Usage,
    UsageSchema,
}