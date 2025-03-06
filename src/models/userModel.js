const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Define the schema for the user
const UserSchema = new mongoose.Schema({
    company: {
        type: String,
        required: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    apikey: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Hash the password before saving
UserSchema.pre('save', async function(next) {
    const user = this;
    
    // Only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) {
        return next();
    }
    
    try {
        // Generate a salt with 10 rounds
        const salt = await bcrypt.genSalt(10);
        
        // Hash the password using the salt
        const hashedPassword = await bcrypt.hash(user.password, salt);
        
        // Set the hashed password
        user.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        // Make sure we have both values
        if (!this.password || !candidatePassword) {
            return false;
        }
        
        // Use bcrypt to compare the plain password with the stored hash
        const isMatch = await bcrypt.compare(candidatePassword, this.password);

        return isMatch;
    } catch (error) {
        console.error('Error comparing password:', error);
        return false;
    }
};

// Create and export the User model
const User = mongoose.model('User', UserSchema);

module.exports = User;