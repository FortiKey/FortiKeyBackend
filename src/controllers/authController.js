const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { logger } = require('../middlewares/logger');
const { logEvent } = require('../controllers/analyticsController');

// Register a new user
const register = async (req, res) => {
    try {
        // Extract the user details from the request body
        const { company, firstName, lastName, email, password } = req.body;

        // Check if the email is already registered
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create a new user document
        const user = new User({ company, firstName, lastName, email, password });
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
        
        if (!user) {
            // Log the failed login
            logEvent({
                eventType: 'login',
                success: false,
                details: { 
                    email,
                    error: 'User not found' 
                }
            }, req);
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        // Check if password is correct
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            // Log the failed login
            logEvent({
                eventType: 'login',
                success: false,
                details: { 
                    email,
                    error: 'Invalid password' 
                }
            }, req);
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        // Generate a JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        
        // Log the successful login with the appropriate event type
        logEvent({
            companyId: user._id,
            eventType: user.role === 'admin' ? 'admin_login' : 'login',
            success: true,
            details: { 
                email,
                company: user.company
            }
        }, req);
        
        // Return token, userId, and role in the response
        res.status(200).json({ 
            token, 
            userId: user._id,
            role: user.role // Include the role in the response
        });
    } catch (error) {
        // Log the failed login
        logEvent({
            eventType: 'login',
            success: false,
            details: { 
                email: req.body.email,
                error: error.message 
            }
        }, req);
        
        res.status(400).json({ message: error.message });
    }
};

// Get user profile
const getProfile = async (req, res) => {
    try {
        const userId = req.params.id || req.userId;
        console.log("Fetching user with ID:", userId);

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        const user = await User.findById(userId).select('company firstName lastName email role createdAt');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        logger.error("Error getting user profile:", error.message);
        res.status(400).json({ message: error.message });
    }
};

// update password
const updatePassword = async (req, res) => {
    try {
        // Get the user ID from the request parameters
        const { userId } = req.params;
        
        // Get the password data from the request body
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Both current password and new password are required' });
        }
        
        // Find the user by ID using findById (not findByIdAndUpdate)
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Verify the current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        // Set the new password directly on the user object
        user.password = newPassword;
        
        // Mark the password field as modified to ensure the pre-save hook runs
        user.markModified('password');
        
        // Save the user to trigger the pre-save hook
        await user.save();
        
        // Return success response
        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating password', error: error.message });
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

const deleteUser = async (req, res) => {
    try {
        // Get the user ID from the request
        const { userId } = req.params;
        
        // Find the user by ID
        const deletedUser = await User.findById(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete associated TOTP secrets
        await TOTPSecret.deleteMany({ companyId: userId });
        
        // Delete associated usage data
        await Usage.deleteMany({ companyId: userId });
        
        // Delete the user
        await User.findByIdAndDelete(userId);
        
        // Log the deletion
        logger.info(`User deleted: ${deletedUser.email} (${userId})`);
        
        // Return a success response
        res.status(204).send();
    } catch (error) {
        logger.error("Error deleting user profile:", error.message);
        res.status(500).json({ message: 'Error deleting user profile' });
    }
};

// Get current API key
const getCurrentAPIKey = async (req, res) => {
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
      
      // Return the API key (or null if none exists)
      res.status(200).json({ 
        apiKey: user.apikey || null 
      });
    } catch (error) {
      logger.error("Error retrieving API key:", error.message);
      res.status(500).json({ message: error.message });
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
      
      // Log the previous key (masked) for debugging
      const previousKey = user.apikey ? 
        `${user.apikey.substring(0, 5)}...${user.apikey.substring(user.apikey.length - 5)}` : 
        'none';
      
      logger.info(`Generating new API key for user ${req.userId}. Previous key: ${previousKey}`);
      
      // Generate a new API key
      user.apikey = require('crypto').randomBytes(32).toString('hex');
      
      // Log the new key (masked) for debugging
      const newKeyMasked = `${user.apikey.substring(0, 5)}...${user.apikey.substring(user.apikey.length - 5)}`;
      logger.info(`Generated new API key for user ${req.userId}: ${newKeyMasked}`);
      
      // Save the user with the new API key
      await user.save();
      
      // Return the new API key
      res.status(201).json({ apiKey: user.apikey });
    } catch (error) {
      logger.error("Error generating API key:", error.message);
      res.status(500).json({ message: error.message });
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
    updatePassword,
    updateUser,
    deleteUser,
    getCurrentAPIKey,
    generateAPIKey,
    deleteAPIKey
};