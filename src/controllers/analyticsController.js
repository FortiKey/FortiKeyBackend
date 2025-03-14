const Usage = require('../models/usageModel');
const usageService = require('../services/usageService');
const { logger } = require('../middlewares/logger');

/**
 * Utility function to log events
 */
const logEvent = async (eventData, req) => {
  try {
    // Ensure req is valid
    if (!req || typeof req !== 'object') {
      logger.warn('Invalid request object passed to logEvent');
      return;
    }

    // Create event log data
    const eventLog = {
      companyId: eventData.companyId || req.userId,
      eventType: eventData.eventType || 'unknown',
      success: eventData.success !== undefined ? eventData.success : true,
      details: eventData.details || {},
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers?.['user-agent'] || 'unknown',
      timestamp: new Date()
    };

    await Usage.logEvent(eventLog);

    // Just log to the console/logger without database storage
    logger.info('Event logged', { event: eventLog });

  } catch (error) {
    // Don't let errors in event logging break the app
    logger.error(`Error in logEvent: ${error.message}`);
  }
};

/**
 * Get general usage statistics for a company
 */
const getCompanyStats = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 30; // Default to 30 days

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get stats from service
    const stats = await usageService.getCompanyStats(req.userId, periodDays);
    const summary = await usageService.getAuthenticationSummary(req.userId, periodDays);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'company_stats', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      summary,
      stats
    });
  } catch (error) {
    logger.error('Error retrieving company stats:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'company_stats', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving company statistics',
      error: error.message
    });
  }
};

/**
 * Get TOTP-specific statistics
 */
const getTOTPStats = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 30; // Default to 30 days

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get stats from service
    const stats = await usageService.getTOTPStats(req.userId, periodDays);
    const summary = usageService.calculateTOTPSummary(stats);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'totp_stats', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      summary,
      dailyStats: stats
    });
  } catch (error) {
    logger.error('Error retrieving TOTP stats:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'totp_stats', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving TOTP statistics',
      error: error.message
    });
  }
};

/**
 * Get failure analytics
 */
const getFailureAnalytics = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 30; // Default to 30 days

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get failure stats from service
    const result = await usageService.getFailureStats(req.userId, periodDays);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'failure_analytics', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      summary: {
        totalEvents: result.totalEvents,
        totalFailures: result.totalFailures,
        failureRate: result.failureRate + '%'
      },
      failuresByType: result.failures
    });
  } catch (error) {
    logger.error('Error retrieving failure analytics:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'failure_analytics', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving failure analytics',
      error: error.message
    });
  }
};

/**
 * Get user-specific TOTP stats
 */
const getUserTOTPStats = async (req, res) => {
  try {
    const { externalUserId } = req.params;
    const { period } = req.query;
    const periodDays = parseInt(period) || 30;

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!externalUserId) {
      return res.status(400).json({ message: 'External user ID is required' });
    }

    // Get user stats from service
    const stats = await usageService.getUserTOTPStats(externalUserId, periodDays);

    if (!stats) {
      return res.status(500).json({ message: 'Error retrieving user TOTP statistics' });
    }

    // Log the analytics access
    logEvent({
      companyId: req.userId,
      externalUserId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'user_totp_stats', period: periodDays }
    }, req);

    return res.status(200).json({
      externalUserId,
      period: periodDays,
      stats
    });
  } catch (error) {
    logger.error('Error retrieving user TOTP stats:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      externalUserId: req.params.externalUserId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'user_totp_stats', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving user TOTP statistics',
      error: error.message
    });
  }
};

/**
 * Get suspicious activity analytics
 */
const getSuspiciousActivity = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 30;

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get suspicious activity data from service
    const suspiciousActivity = await usageService.getSuspiciousActivity(req.userId, periodDays);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'suspicious_activity', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      suspiciousUsersCount: suspiciousActivity.suspiciousUsers.length,
      suspiciousUsers: suspiciousActivity.suspiciousUsers,
      recentEvents: suspiciousActivity.suspiciousEvents.slice(0, 20) // Return most recent 20 events
    });
  } catch (error) {
    logger.error('Error retrieving suspicious activity:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'suspicious_activity', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving suspicious activity data',
      error: error.message
    });
  }
};

/**
 * Get device breakdown analytics
 */
const getDeviceBreakdown = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 30;

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get device breakdown from service
    const deviceBreakdown = await usageService.getDeviceBreakdown(req.userId, periodDays);

    // Process into frontend-friendly format
    const processedData = usageService.processDeviceData(deviceBreakdown);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'device_breakdown', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      ...processedData
    });
  } catch (error) {
    logger.error('Error retrieving device breakdown:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'device_breakdown', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving device analytics',
      error: error.message
    });
  }
};

/**
 * Get backup code usage analytics
 */
const getBackupCodeUsage = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 30;

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get backup code usage data from service
    const backupCodeAnalytics = await usageService.getBackupCodeUsage(req.userId, periodDays);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'backup_code_usage', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      backupCodeUsage: backupCodeAnalytics.backupCodeStats,
      summary: {
        totpValidations: backupCodeAnalytics.totpCount,
        backupCodeUses: backupCodeAnalytics.backupCount,
        backupToTotpRatio: backupCodeAnalytics.backupToTotpRatio
      },
      frequentBackupUsers: backupCodeAnalytics.frequentBackupUsers
    });
  } catch (error) {
    logger.error('Error retrieving backup code usage:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'backup_code_usage', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving backup code analytics',
      error: error.message
    });
  }
};

/**
 * Get time-based comparisons (day-over-day and business hours)
 */
const getTimeComparisons = async (req, res) => {
  try {
    const { period } = req.query;
    const periodDays = parseInt(period) || 7; // Default to 7 days for day-over-day

    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get time comparison data from service
    const timeComparisons = await usageService.getTimeComparisons(req.userId, periodDays);

    // Log this analytics request
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: true,
      details: { type: 'time_comparisons', period: periodDays }
    }, req);

    return res.status(200).json({
      period: periodDays,
      dayOverDay: timeComparisons.dayOverDayComparison,
      businessHours: timeComparisons.businessHoursSummary
    });
  } catch (error) {
    logger.error('Error retrieving time comparisons:', error.message);

    // Log the error
    logEvent({
      companyId: req.userId,
      eventType: 'analytics_access',
      success: false,
      details: { type: 'time_comparisons', error: error.message }
    }, req);

    return res.status(500).json({
      message: 'Error retrieving time comparison analytics',
      error: error.message
    });
  }
};

/**
 * Middleware to log rate limit exceeded events
 */
const logRateLimitExceeded = (req, res, next) => {
  // Log the rate limit event
  logEvent({
    companyId: req.userId, // May be undefined for unauthenticated requests
    eventType: 'rate_limit_exceeded',
    success: false,
    details: {
      endpoint: req.originalUrl,
      method: req.method
    }
  }, req);

  if (typeof next === 'function') {
    next();
  }
};

module.exports = {
  logEvent,
  getCompanyStats,
  getTOTPStats,
  getFailureAnalytics,
  getUserTOTPStats,
  getSuspiciousActivity,
  getDeviceBreakdown,
  getBackupCodeUsage,
  getTimeComparisons,
  logRateLimitExceeded
};