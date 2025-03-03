const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { logger } = require('../middlewares/logger');

// Register a new user
const register = async (req, res) => {
    try {
        // Extract the user details from the request body
        const { businessName, firstName, lastName, email, password } = req.body;

        // Check if the email is already registered
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create a new user document
        const user = new User({ businessName, firstName, lastName, email, password });
        await user.save();

        // Generate a JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.status(201).json({ token, userId: user._id });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Login an existing user
const login = async (req, res) => {
    try {
        // Extract the email and password from the request body
        const { email, password } = req.body;
        // Find the user by email
        const user = await User.findOne({ email });
        // If the user is not found or the password is incorrect, return an error response
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        // Generate a JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.status(200).json({ token, userId: user._id });
    } catch (error) {
        logger.error("Error logging in user:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// Get user profile
const getProfile = async (req, res) => {
    try {
        // Get the user ID from the request
        const user = await User.findById(req.userId).select('businessName firstName lastName email createdAt');
        // Return the user profile
        res.status(200).json(user);
    } catch (error) {
        logger.error("Error getting user profile:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// Update user profile
const updateUser = async (req, res) => {
    try {
        // Get the user ID from the request
        const { userId } = req.params;
        // Find the user by ID
        const updatedUser = await User.findByIdAndUpdate(userId, req.body, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Return the updated user profile
        res.status(200).json(updatedUser);
    } catch (error) {
        logger.error("Error updating user profile:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// Delete user profile
const deleteUser = async (req, res) => {
    try {
        // Get the user ID from the request
        const { userId } = req.params;
        // Find the user by ID
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Return a success response
        res.status(204).send();
    } catch (error) {
        logger.error("Error deleting user profile:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// Generate API key
const generateAPIKey = async (req, res) => {
    try {
        // Get the user ID from the request
        if (!req.userId) {
            logger.error('Unauthorised: No user ID provided');
            return res.status(401).json({ message: 'Unauthorised: No user ID provided' });
        }
        // Find the user by ID
        const user = await User.findById(req.userId);
        if (!user) {
            logger.error('User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        // Generate a new API key
        user.apikey = require('crypto').randomBytes(32).toString('hex');
        await user.save();
        res.status(201).json({ apiKey: user.apikey });
    } catch (error) {
        logger.error("Error generating API key:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// Delete API key
const deleteAPIKey = async (req, res) => {
    try {
        // Get the user ID from the request
        if (!req.userId) {
            logger.error('Unauthorised: No user ID provided');
            return res.status(401).json({ message: 'Unauthorised: No user ID provided' });
        }
        // Find the user by ID
        const user = await User.findById(req.userId);
        if (!user) {
            logger.error('User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        // Check if the user has an API key
        if (!user.apikey) {
            logger.error('API key not found');
            return res.status(404).json({ message: 'API key not found' });
        }
        // Delete the API key
        user.apikey = null;
        await user.save();
        res.status(204).send();
    } catch (error) {
        logger.error("Error deleting API key:", error.message);
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateUser,
    deleteUser,
    generateAPIKey,
    deleteAPIKey
};