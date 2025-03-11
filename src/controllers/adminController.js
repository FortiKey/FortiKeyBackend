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

const deleteUserAsAdmin = async (req, res) => {
  const { userId } = req.params;

  try {
      // No need to check if admin is deleting themselves - adminMiddleware ensures they're an admin
      logger.info(`Admin ${req.userId} is attempting to delete user ${userId}`);

      // Find the user to be deleted
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
          logger.warn(`Admin ${req.userId} attempted to delete non-existent user ${userId}`);
          return res.status(404).json({ message: 'User not found' });
      }

      // Log details for audit purposes
      logger.info(`Deleting user ${userId} (${userToDelete.email}) and all associated data`);

      // Start a session for transaction
      const session = await User.startSession();
      session.startTransaction();

      try {
          // Step 1: Delete all TOTP secrets associated with this user's company
          const deletedTOTPSecrets = await TOTPSecret.deleteMany(
              { companyId: userId },
              { session }
          );
          logger.info(`Deleted ${deletedTOTPSecrets.deletedCount} TOTP secrets for user ${userId}`);

          // Step 2: Delete API keys
          let deletedAPIKeys = 0;
          if (global.mongoose.models.APIKey) {
              const apiKeyResult = await APIKey.deleteMany(
                  { userId: userId },
                  { session }
              );
              deletedAPIKeys = apiKeyResult.deletedCount;
              logger.info(`Deleted ${deletedAPIKeys} API keys for user ${userId}`);
          }

          // Step 3: Delete usage/analytics data
          const deletedUsage = await Usage.deleteMany(
              { companyId: userId },
              { session }
          );
          logger.info(`Deleted ${deletedUsage.deletedCount} usage records for user ${userId}`);

          // Step 4: Finally delete the user
          await User.findByIdAndDelete(userId, { session });
          logger.info(`Successfully deleted user ${userId} (${userToDelete.email})`);

          // Commit the transaction
          await session.commitTransaction();
          session.endSession();

          // Log this event for admin auditing
          if (global.mongoose.models.AuditLog) {
              try {
                  const AuditLog = global.mongoose.models.AuditLog;
                  await AuditLog.create({
                      adminId: req.userId,
                      action: 'user_delete',
                      targetId: userId,
                      details: {
                          email: userToDelete.email,
                          company: userToDelete.company,
                          deletedTOTPCount: deletedTOTPSecrets.deletedCount,
                          deletedAPIKeyCount: deletedAPIKeys,
                          deletedUsageCount: deletedUsage.deletedCount
                      },
                      timestamp: new Date()
                  });
              } catch (auditError) {
                  logger.error(`Error creating audit log for user deletion: ${auditError.message}`);
                  // Don't fail the operation if audit logging fails
              }
          }

          // Return success
          return res.status(200).json({ 
              message: 'User and all associated data deleted successfully',
              deletedUserId: userId,
              deletedData: {
                  totpSecrets: deletedTOTPSecrets.deletedCount,
                  apiKeys: deletedAPIKeys,
                  usageRecords: deletedUsage.deletedCount
              }
          });
      } catch (transactionError) {
          // If anything fails, abort the transaction
          await session.abortTransaction();
          session.endSession();
          throw transactionError;
      }
  } catch (error) {
      logger.error(`Error deleting user ${userId} as admin:`, error);
      return res.status(500).json({ 
          message: 'Failed to delete user',
          error: error.message 
      });
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
  deleteUserAsAdmin
//   disableCompanyUser,
//   enableCompanyUser
};