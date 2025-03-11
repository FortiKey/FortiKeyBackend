const mongoose = require('mongoose');
const User = require('../models/userModel');
const TOTPSecret = require('../models/totpSecretModel');
const Usage = require('../models/usageModel');
const { logger } = require('../middlewares/logger');

// Get all business users
const getAllCompanyUsers = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Query parameters
    const { search, sortBy, order } = req.query;
    
    // Build query
    let query = { role: 'user' };
    if (search) {
      query.$or = [
        { Company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort
    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1; // Default: newest first
    }
    
    // Execute query with pagination
    const users = await User.find(query)
      .select('company firstName lastName email createdAt apikey')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    res.status(200).json({
        users,
        pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error.message);
    res.status(500).json({ message: 'Error retrieving users' });
  }
};

// Get detailed info about a specific business user
const getCompanyUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user
    const user = await User.findById(userId)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get TOTP secrets count
    const totpCount = await TOTPSecret.countDocuments({ companyId: userId });
    
    // Get usage statistics 
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const usageStats = await Usage.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(userId),
          timestamp: { $gte: last30Days }
        }
      },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      user,
      totpCount,
      usageStats
    });
  } catch (error) {
    logger.error('Error getting user details:', error.message);
    res.status(500).json({ message: 'Error retrieving user details' });
  }
};

// Future feature....
// const disableCompanyUser = async (req, res) => {
// };

// const enableCompanyUser = async (req, res) => {
// };

module.exports = {
  getAllCompanyUsers,
  getCompanyUserDetails,
//   disableCompanyUser,
//   enableCompanyUser
};