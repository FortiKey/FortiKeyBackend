// services/usageService.js
const mongoose = require('mongoose');
const { Types } = mongoose;
const { Usage } = require('../models/usageModel');
const { logger } = require('../middlewares/logger');

/**
 * Convert any valid ID format to MongoDB ObjectId
 * @param {string|ObjectId} id - ID to convert
 * @returns {ObjectId|null} - MongoDB ObjectId or null if invalid
 */
const toObjectId = (id) => {
  if (!id) return null;
  
  if (id instanceof Types.ObjectId) {
    return id;
  }
  
  try {
    return new Types.ObjectId(String(id));
  } catch (error) {
    console.error('Invalid ID format:', id);
    return null;
  }
};

/**
 * Get business usage stats for a period
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days (default: 30)
 * @returns {Promise<Array>} - Business statistics
 */
const getBusinessStats = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return [];
  
  try {
    return await Usage.aggregate([
      { 
        $match: { 
          businessId: businessIdObj,
          timestamp: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: { 
            eventType: "$eventType",
            success: "$success",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            eventType: "$_id.eventType",
            success: "$_id.success"
          },
          dailyCounts: {
            $push: {
              date: "$_id.day",
              count: "$count"
            }
          },
          totalCount: { $sum: "$count" }
        }
      },
      {
        $sort: { 
          "_id.eventType": 1, 
          "_id.success": -1 
        }
      }
    ]);
  } catch (error) {
    logger.error('Error getting business stats:', error.message);
    return [];
  }
};

/**
 * Calculate authentication success/failure summary
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Object>} - Authentication summary
 */
const getAuthenticationSummary = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return { totalEvents: 0, successfulEvents: 0, failedEvents: 0, successRate: '0%' };
  
  try {
    const totalEvents = await Usage.countDocuments({
      businessId: businessIdObj,
      timestamp: { $gte: startDate },
      eventType: { $in: ['totp_validation', 'backup_code_used'] }
    });
    
    const successfulEvents = await Usage.countDocuments({
      businessId: businessIdObj,
      timestamp: { $gte: startDate },
      eventType: { $in: ['totp_validation', 'backup_code_used'] },
      success: true
    });
    
    const failedEvents = totalEvents - successfulEvents;
    const successRate = totalEvents > 0 
      ? (successfulEvents / totalEvents * 100).toFixed(2) 
      : 100;
    
    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      successRate: successRate + '%'
    };
  } catch (error) {
    logger.error('Error calculating authentication summary:', error.message);
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      successRate: '0%'
    };
  }
};

/**
 * Get TOTP-specific statistics
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Array>} - TOTP statistics
 */
const getTOTPStats = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return [];
  
  try {
    return await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          eventType: { $in: ['totp_setup', 'totp_validation', 'backup_code_used'] },
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            eventType: "$eventType",
            success: "$success",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.day": 1, "_id.eventType": 1 }
      }
    ]);
  } catch (error) {
    logger.error('Error getting TOTP stats:', error.message);
    return [];
  }
};

/**
 * Calculate TOTP summary statistics
 * @param {Array} totpStats - TOTP statistics from getTOTPStats
 * @returns {Object} - TOTP summary
 */
const calculateTOTPSummary = (totpStats) => {
  const totpSetups = totpStats.filter(s => s._id.eventType === 'totp_setup');
  const totpValidations = totpStats.filter(s => s._id.eventType === 'totp_validation');
  const backupCodeUsage = totpStats.filter(s => s._id.eventType === 'backup_code_used');
  
  const setupSuccess = totpSetups.filter(s => s._id.success).reduce((sum, item) => sum + item.count, 0);
  const setupTotal = totpSetups.reduce((sum, item) => sum + item.count, 0);
  
  const validationSuccess = totpValidations.filter(s => s._id.success).reduce((sum, item) => sum + item.count, 0);
  const validationTotal = totpValidations.reduce((sum, item) => sum + item.count, 0);
  
  return {
    setupSuccessRate: setupTotal ? (setupSuccess / setupTotal * 100).toFixed(2) + '%' : 'N/A',
    validationSuccessRate: validationTotal ? (validationSuccess / validationTotal * 100).toFixed(2) + '%' : 'N/A',
    totalSetups: setupTotal,
    totalValidations: validationTotal,
    totalBackupCodesUsed: backupCodeUsage.reduce((sum, item) => sum + item.count, 0)
  };
};

/**
 * Get failure statistics
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Object>} - Failure statistics
 */
const getFailureStats = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return { failures: [], totalEvents: 0, totalFailures: 0, failureRate: 0 };
  
  try {
    const failures = await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          success: false,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            eventType: "$eventType",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.day": 1, "_id.eventType": 1 }
      }
    ]);
    
    const totalEvents = await Usage.countDocuments({
      businessId: businessIdObj,
      timestamp: { $gte: startDate }
    });
    
    const totalFailures = await Usage.countDocuments({
      businessId: businessIdObj,
      success: false,
      timestamp: { $gte: startDate }
    });
    
    return {
      failures,
      totalEvents,
      totalFailures,
      failureRate: totalEvents ? (totalFailures / totalEvents * 100).toFixed(2) : 0
    };
  } catch (error) {
    logger.error('Error getting failure stats:', error.message);
    return {
      failures: [],
      totalEvents: 0,
      totalFailures: 0,
      failureRate: 0
    };
  }
};

/**
 * Get user-specific TOTP statistics
 * @param {string} externalUserId - External user ID
 * @param {number} period - Period in days
 * @returns {Promise<Object>} - User TOTP statistics
 */
const getUserTOTPStats = async (externalUserId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  try {
    // Get all TOTP validation attempts for this user
    const validationAttempts = await Usage.find({
      externalUserId: externalUserId,
      eventType: 'totp_validation',
      timestamp: { $gte: startDate }
    });
    
    // Count successful and failed attempts
    const successfulAttempts = validationAttempts.filter(attempt => attempt.success).length;
    const failedAttempts = validationAttempts.length - successfulAttempts;
    
    // Calculate success rate
    const successRate = validationAttempts.length > 0 
      ? (successfulAttempts / validationAttempts.length * 100).toFixed(2)
      : 0;
    
    // Get attempts by day for trend analysis
    const attemptsByDay = await Usage.aggregate([
      {
        $match: {
          externalUserId: externalUserId,
          eventType: 'totp_validation',
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            success: "$success"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.day": 1 }  // Sort by date ascending
      }
    ]);
    
    return {
      totalAttempts: validationAttempts.length,
      successfulAttempts,
      failedAttempts,
      successRate: successRate + '%',
      attemptsByDay
    };
  } catch (error) {
    logger.error('Error getting user TOTP stats:', error.message);
    return null;
  }
};

/**
 * Get suspicious activity data
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Object>} - Suspicious activity data
 */
const getSuspiciousActivity = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return { suspiciousUsers: [], suspiciousEvents: [] };
  
  try {
    // First, get typical patterns
    const typicalUserActivity = await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          timestamp: { $gte: startDate },
          eventType: { $in: ['totp_validation', 'backup_code_used'] }
        }
      },
      {
        $group: {
          _id: "$externalUserId",
          totalAttempts: { $sum: 1 },
          failedAttempts: { 
            $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] }
          },
          uniqueIPs: { $addToSet: "$ipAddress" }
        }
      }
    ]);
    
    // Find users with suspicious patterns
    const suspiciousUsers = typicalUserActivity.filter(user => {
      // More than 5 failed attempts
      const highFailures = user.failedAttempts > 5;
      
      // More than 3 different IP addresses (unusual for most users)
      const multipleIPs = user.uniqueIPs.length > 3;
      
      // High failure rate (more than 40% failures)
      const highFailureRate = user.totalAttempts > 0 && 
        (user.failedAttempts / user.totalAttempts) > 0.4;
        
      return highFailures || multipleIPs || highFailureRate;
    });
    
    // Get detailed events for suspicious users
    const suspiciousUserIds = suspiciousUsers.map(user => user._id);
    
    const suspiciousEvents = await Usage.find({
      businessId: businessIdObj,
      externalUserId: { $in: suspiciousUserIds },
      timestamp: { $gte: startDate },
      eventType: { $in: ['totp_validation', 'backup_code_used'] }
    }).sort({ timestamp: -1 });
    
    return {
      suspiciousUsers,
      suspiciousEvents
    };
  } catch (error) {
    logger.error('Error getting suspicious activity:', error.message);
    return {
      suspiciousUsers: [],
      suspiciousEvents: []
    };
  }
};

/**
 * Get device breakdown based on user agents
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Array>} - Device breakdown
 */
const getDeviceBreakdown = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return [];
  
  try {
    return await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          timestamp: { $gte: startDate },
          userAgent: { $exists: true, $ne: null }
        }
      },
      {
        $addFields: {
          deviceType: {
            $cond: {
              if: {
                $regexMatch: {
                  input: "$userAgent",
                  regex: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
                }
              },
              then: "Mobile",
              else: {
                $cond: {
                  if: {
                    $regexMatch: {
                      input: "$userAgent",
                      regex: /Tablet|iPad/i
                    }
                  },
                  then: "Tablet",
                  else: "Desktop"
                }
              }
            }
          },
          browser: {
            $cond: [
              { $regexMatch: { input: "$userAgent", regex: /Chrome/i } }, "Chrome",
              { $cond: [
                { $regexMatch: { input: "$userAgent", regex: /Firefox/i } }, "Firefox",
                { $cond: [
                  { $regexMatch: { input: "$userAgent", regex: /Safari/i } }, "Safari",
                  { $cond: [
                    { $regexMatch: { input: "$userAgent", regex: /Edge|Edg/i } }, "Edge",
                    { $cond: [
                      { $regexMatch: { input: "$userAgent", regex: /MSIE|Trident/i } }, "Internet Explorer",
                      "Other"
                    ]}
                  ]}
                ]}
              ]}
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            deviceType: "$deviceType",
            browser: "$browser"
          },
          count: { $sum: 1 },
          successCount: { 
            $sum: { $cond: [{ $eq: ["$success", true] }, 1, 0] }
          },
          users: { $addToSet: "$externalUserId" }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
  } catch (error) {
    logger.error('Error getting device breakdown:', error.message);
    return [];
  }
};

/**
 * Process device breakdown data for frontend consumption
 * @param {Array} deviceBreakdown - Raw device breakdown data
 * @returns {Object} - Processed device data
 */
const processDeviceData = (deviceBreakdown) => {
  const deviceTypes = {};
  const browsers = {};
  
  deviceBreakdown.forEach(item => {
    // Add to device types
    if (!deviceTypes[item._id.deviceType]) {
      deviceTypes[item._id.deviceType] = 0;
    }
    deviceTypes[item._id.deviceType] += item.count;
    
    // Add to browsers
    if (!browsers[item._id.browser]) {
      browsers[item._id.browser] = 0;
    }
    browsers[item._id.browser] += item.count;
  });
  
  return {
    deviceTypes,
    browsers,
    detailedBreakdown: deviceBreakdown
  };
};

/**
 * Get backup code usage statistics
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Object>} - Backup code usage data
 */
const getBackupCodeUsage = async (businessId, period = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return {
    backupCodeStats: [],
    totpCount: 0,
    backupCount: 0,
    backupToTotpRatio: '0%',
    frequentBackupUsers: []
  };
  
  try {
    // Get backup code usage stats
    const backupCodeStats = await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          eventType: 'backup_code_used',
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            success: "$success"
          },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: "$externalUserId" }
        }
      },
      {
        $sort: { "_id.day": 1 }
      }
    ]);
    
    // Calculate comparison with TOTP usage
    const totpCount = await Usage.countDocuments({
      businessId: businessIdObj,
      eventType: 'totp_validation',
      timestamp: { $gte: startDate }
    });
    
    const backupCount = await Usage.countDocuments({
      businessId: businessIdObj,
      eventType: 'backup_code_used',
      timestamp: { $gte: startDate }
    });
    
    // Get users who frequently use backup codes
    const frequentBackupUsers = await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          eventType: 'backup_code_used',
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$externalUserId",
          backupUseCount: { $sum: 1 }
        }
      },
      {
        $match: {
          backupUseCount: { $gt: 2 } // Users who used backup codes more than twice
        }
      },
      {
        $sort: { backupUseCount: -1 }
      },
      {
        $limit: 10 // Top 10 users
      }
    ]);
    
    return {
      backupCodeStats,
      totpCount,
      backupCount,
      backupToTotpRatio: totpCount > 0 ? (backupCount / totpCount * 100).toFixed(2) + '%' : '0%',
      frequentBackupUsers
    };
  } catch (error) {
    logger.error('Error getting backup code usage:', error.message);
    return {
      backupCodeStats: [],
      totpCount: 0,
      backupCount: 0,
      backupToTotpRatio: '0%',
      frequentBackupUsers: []
    };
  }
};

/**
 * Get time-based comparisons
 * @param {string|ObjectId} businessId - The business ID
 * @param {number} period - Period in days
 * @returns {Promise<Object>} - Time comparison data
 */
const getTimeComparisons = async (businessId, period = 7) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  // Convert businessId to ObjectId
  const businessIdObj = toObjectId(businessId);
  if (!businessIdObj) return {
    dayOverDayComparison: [],
    businessHoursSummary: {
      businessHoursCount: 0,
      offHoursCount: 0,
      businessHoursPercentage: '0%'
    }
  };
  
  try {
    // Get hourly breakdown of authentication attempts
    const hourlyBreakdown = await Usage.aggregate([
      {
        $match: {
          businessId: businessIdObj,
          eventType: { $in: ['totp_validation', 'backup_code_used'] },
          timestamp: { $gte: startDate }
        }
      },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          hour: { $hour: "$timestamp" },
          success: "$success",
          eventType: "$eventType"
        }
      },
      {
        $group: {
          _id: {
            date: "$date",
            hour: "$hour"
          },
          count: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ["$success", true] }, 1, 0] } }
        }
      },
      {
        $sort: { "_id.date": 1, "_id.hour": 1 }
      }
    ]);
    
    // Process the raw data
    return processTimeComparisonData(hourlyBreakdown);
  } catch (error) {
    logger.error('Error getting time comparisons:', error.message);
    return {
      dayOverDayComparison: [],
      businessHoursSummary: {
        businessHoursCount: 0,
        offHoursCount: 0,
        businessHoursPercentage: '0%'
      }
    };
  }
};

/**
 * Process time comparison data
 * @param {Array} hourlyBreakdown - Raw hourly breakdown data
 * @returns {Object} - Processed time comparison data
 */
const processTimeComparisonData = (hourlyBreakdown) => {
  // Process data for day-over-day comparison
  const dayData = {};
  hourlyBreakdown.forEach(item => {
    if (!dayData[item._id.date]) {
      dayData[item._id.date] = {
        totalCount: 0,
        hourly: Array(24).fill(0),
        businessHours: 0,
        offHours: 0
      };
    }
    
    dayData[item._id.date].totalCount += item.count;
    dayData[item._id.date].hourly[item._id.hour] = item.count;
    
    // Define business hours as 9am-5pm (hours 9-17)
    if (item._id.hour >= 9 && item._id.hour < 17) {
      dayData[item._id.date].businessHours += item.count;
    } else {
      dayData[item._id.date].offHours += item.count;
    }
  });
  
  // Calculate day-over-day changes
  const days = Object.keys(dayData).sort();
  const dayOverDayComparison = [];
  
  for (let i = 1; i < days.length; i++) {
    const currentDay = days[i];
    const previousDay = days[i-1];
    
    const currentTotal = dayData[currentDay].totalCount;
    const previousTotal = dayData[previousDay].totalCount;
    
    const percentChange = previousTotal > 0 
      ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(2) 
      : 'N/A';
    
    dayOverDayComparison.push({
      date: currentDay,
      totalCount: currentTotal,
      previousDayCount: previousTotal,
      percentChange: percentChange !== 'N/A' ? percentChange + '%' : percentChange,
      hourlyBreakdown: dayData[currentDay].hourly
    });
  }
  
  // Business hours vs. off-hours summary
  let totalBusinessHours = 0;
  let totalOffHours = 0;
  
  Object.values(dayData).forEach(day => {
    totalBusinessHours += day.businessHours;
    totalOffHours += day.offHours;
  });
  
  return {
    dayOverDayComparison,
    businessHoursSummary: {
      businessHoursCount: totalBusinessHours,
      offHoursCount: totalOffHours,
      businessHoursPercentage: (totalBusinessHours + totalOffHours > 0) 
        ? (totalBusinessHours / (totalBusinessHours + totalOffHours) * 100).toFixed(2) + '%'
        : '0%'
    }
  };
};

// Export all functions
module.exports = {
  getBusinessStats,
  getAuthenticationSummary,
  getTOTPStats,
  calculateTOTPSummary,
  getFailureStats,
  getUserTOTPStats,
  getSuspiciousActivity,
  getDeviceBreakdown,
  processDeviceData,
  getBackupCodeUsage,
  getTimeComparisons,
  processTimeComparisonData
};