const mongoose = require('mongoose');
const { logger } = require('../config/logger');

const UsageSchema = new mongoose.Schema({
    // reference to the business (User) who performed the action
    businessId: {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
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
            'registration',        // New business registration
            'login',               // Business login
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
UsageSchema.index({ businessId: 1, eventType: 1, timestamp: -1 });
UsageSchema.index({ externalUserId: 1, timestamp: -1 });
UsageSchema.index({ eventType: 1, success: 1, timestamp: -1 });

// static method to log an event
UsageSchema.statics.logEvent = async function(eventData) {
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

// Get business usage statistics for a given period
UsageSchema.statics.getBusinessStats = async function(businessId, period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    try {
      return await this.aggregate([
        { 
          $match: { 
            businessId: mongoose.Types.ObjectId(businessId),
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

// Get TOTP usage stats
UsageSchema.statics.getTOTPStats = async function(businessId, period = 30) {
    const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  try {
    return await this.aggregate([
      {
        $match: {
          businessId: mongoose.Types.ObjectId(businessId),
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

// Get failure analytics
UsageSchema.statics.getFailureStats = async function(businessId, period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    try {
      const failures = await this.aggregate([
        {
          $match: {
            businessId: mongoose.Types.ObjectId(businessId),
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
      
      const totalEvents = await this.countDocuments({
        businessId: mongoose.Types.ObjectId(businessId),
        timestamp: { $gte: startDate }
      });
      
      const totalFailures = await this.countDocuments({
        businessId: mongoose.Types.ObjectId(businessId),
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

// Get user TOTP statistics
UsageSchema.statics.getUserTOTPStats = async function(externalUserId, period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    try {
      // First get all TOTP validation attempts for this user
      const validationAttempts = await this.find({
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
      const attemptsByDay = await this.aggregate([
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
      console.error('Error getting user TOTP stats:', error);
      return null;
    }
  };

// Get suspicious activity data
UsageSchema.statics.getSuspiciousActivity = async function(businessId, period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    // First, get typical patterns
    const typicalUserActivity = await this.aggregate([
      {
        $match: {
          businessId: mongoose.Types.ObjectId(businessId),
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
  
  const suspiciousEvents = await this.find({
    businessId: mongoose.Types.ObjectId(businessId),
    externalUserId: { $in: suspiciousUserIds },
    timestamp: { $gte: startDate },
    eventType: { $in: ['totp_validation', 'backup_code_used'] }
  }).sort({ timestamp: -1 });
  
  return {
    suspiciousUsers,
    suspiciousEvents
  };
};

// Get device breakdown based on user agents
UsageSchema.statics.getDeviceBreakdown = async function(businessId, period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    return await this.aggregate([
      {
        $match: {
          businessId: mongoose.Types.ObjectId(businessId),
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
  };

// Get backup code usage statistics
UsageSchema.statics.getBackupCodeUsage = async function(businessId, period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    // Get backup code usage stats
    const backupCodeStats = await this.aggregate([
      {
        $match: {
          businessId: mongoose.Types.ObjectId(businessId),
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
  const totpCount = await this.countDocuments({
    businessId: mongoose.Types.ObjectId(businessId),
    eventType: 'totp_validation',
    timestamp: { $gte: startDate }
  });
  
  const backupCount = await this.countDocuments({
    businessId: mongoose.Types.ObjectId(businessId),
    eventType: 'backup_code_used',
    timestamp: { $gte: startDate }
  });
  
  // Get users who frequently use backup codes
  const frequentBackupUsers = await this.aggregate([
    {
      $match: {
        businessId: mongoose.Types.ObjectId(businessId),
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
};

// Get time-based comparisons
UsageSchema.statics.getTimeComparisons = async function(businessId, period = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    // Get hourly breakdown of authentication attempts
    const hourlyBreakdown = await this.aggregate([
      {
        $match: {
          businessId: mongoose.Types.ObjectId(businessId),
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
  
  const Usage = mongoose.model('Usage', UsageSchema);

module.exports = {
    Usage
}