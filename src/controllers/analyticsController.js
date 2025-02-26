const mongoose = require('mongoose');
const { Usage } = require('../models/usageModel');
const { logger } = require('../middlewares/logger');


// Utility function to log events.  Can be called from other controllers and middleware
const logEvent = async (eventData, req = null) => {
    try {
      // Add IP and user agent if request object is provided
      if (req) {
        eventData.ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        eventData.userAgent = req.headers['user-agent'] || 'unknown';
      }
      
      await Usage.logEvent(eventData);
    } catch (error) {
      logger.error('Error logging event:', error.message);
    }
  };


// Get general usage statistics for a business
const getBusinessStats = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 30; // Default to 30 days
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const stats = await Usage.getBusinessStats(req.userId, periodDays);
      
      // Calculate overall success/failure rate
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      const totalEvents = await Usage.countDocuments({
        businessId: req.userId,
        timestamp: { $gte: startDate },
        eventType: { $in: ['totp_validation', 'backup_code_used'] } // Include only auth events
      });
      
      const successfulEvents = await Usage.countDocuments({
        businessId: req.userId,
        timestamp: { $gte: startDate },
        eventType: { $in: ['totp_validation', 'backup_code_used'] },
        success: true
      });
      
      const successRate = totalEvents > 0 
        ? (successfulEvents / totalEvents * 100).toFixed(2) 
        : 100;
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
        eventType: 'analytics_access',
        success: true,
        details: { type: 'business_stats', period: periodDays }
      }, req);
      
      return res.status(200).json({
        period: periodDays,
        summary: {
          successRate: successRate + '%',
          totalEvents,
          successfulEvents,
          failedEvents: totalEvents - successfulEvents
        },
        stats
      });
    } catch (error) {
      logger.error('Error retrieving business stats:', error.message);
      
      // Log the error
      logEvent({
        businessId: req.userId,
        eventType: 'analytics_access',
        success: false,
        details: { type: 'business_stats', error: error.message }
      }, req);
      
      return res.status(500).json({
        message: 'Error retrieving business statistics',
        error: error.message
      });
    }
  };

// Get TOTP-specific statistics
const getTOTPStats = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 30; // Default to 30 days
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const stats = await Usage.getTOTPStats(req.userId, periodDays);
      
      // Calculate summary statistics
      const totpSetups = stats.filter(s => s._id.eventType === 'totp_setup');
      const totpValidations = stats.filter(s => s._id.eventType === 'totp_validation');
      const backupCodeUsage = stats.filter(s => s._id.eventType === 'backup_code_used');
      
      const setupSuccess = totpSetups.filter(s => s._id.success).reduce((sum, item) => sum + item.count, 0);
      const setupTotal = totpSetups.reduce((sum, item) => sum + item.count, 0);
      
      const validationSuccess = totpValidations.filter(s => s._id.success).reduce((sum, item) => sum + item.count, 0);
      const validationTotal = totpValidations.reduce((sum, item) => sum + item.count, 0);
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
        eventType: 'analytics_access',
        success: true,
        details: { type: 'totp_stats', period: periodDays }
      }, req);
      
      return res.status(200).json({
        period: periodDays,
        summary: {
          setupSuccessRate: setupTotal ? (setupSuccess / setupTotal * 100).toFixed(2) + '%' : 'N/A',
          validationSuccessRate: validationTotal ? (validationSuccess / validationTotal * 100).toFixed(2) + '%' : 'N/A',
          totalSetups: setupTotal,
          totalValidations: validationTotal,
          totalBackupCodesUsed: backupCodeUsage.reduce((sum, item) => sum + item.count, 0)
        },
        dailyStats: stats
      });
    } catch (error) {
      logger.error('Error retrieving TOTP stats:', error.message);
      
      // Log the error
      logEvent({
        businessId: req.userId,
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

// Get failure analytics 
const getFailureAnalytics = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 30; // Default to 30 days
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const result = await Usage.getFailureStats(req.userId, periodDays);
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
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
        businessId: req.userId,
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

// Get user-specific TOTP stats 
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
      
      const stats = await Usage.getUserTOTPStats(externalUserId, periodDays);
      
      if (!stats) {
        return res.status(500).json({ message: 'Error retrieving user TOTP statistics' });
      }
      
      // Log the analytics access
      logEvent({
        businessId: req.userId,
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
      
      return res.status(500).json({
        message: 'Error retrieving user TOTP statistics',
        error: error.message
      });
    }
  };

// Get suspicious activity analytics 
const getSuspiciousActivity = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 30;
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const suspiciousActivity = await Usage.getSuspiciousActivity(req.userId, periodDays);
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
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
      return res.status(500).json({
        message: 'Error retrieving suspicious activity data',
        error: error.message
      });
    }
  };

// Get device breakdown analytics
const getDeviceBreakdown = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 30;
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const deviceBreakdown = await Usage.getDeviceBreakdown(req.userId, periodDays);
      
      // Organize data for easier consumption
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
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
        eventType: 'analytics_access',
        success: true,
        details: { type: 'device_breakdown', period: periodDays }
      }, req);
      
      return res.status(200).json({
        period: periodDays,
        deviceTypes,
        browsers,
        detailedBreakdown: deviceBreakdown
      });
    } catch (error) {
      logger.error('Error retrieving device breakdown:', error.message);
      return res.status(500).json({
        message: 'Error retrieving device analytics',
        error: error.message
      });
    }
  };

// Get backup code usage analytics
const getBackupCodeUsage = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 30;
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const backupCodeAnalytics = await Usage.getBackupCodeUsage(req.userId, periodDays);
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
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
      return res.status(500).json({
        message: 'Error retrieving backup code analytics',
        error: error.message
      });
    }
  }; 

// Get time-based comparisons (day-over-day and business hours)
const getTimeComparisons = async (req, res) => {
    try {
      const { period } = req.query;
      const periodDays = parseInt(period) || 7; // Default to 7 days for day-over-day
      
      if (!req.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const timeComparisons = await Usage.getTimeComparisons(req.userId, periodDays);
      
      // Log this analytics request
      logEvent({
        businessId: req.userId,
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
      return res.status(500).json({
        message: 'Error retrieving time comparison analytics',
        error: error.message
      });
    }
  };

module.exports = {
    logEvent,
    getBusinessStats,
    getTOTPStats,
    getFailureAnalytics,
    getUserTOTPStats,
    getSuspiciousActivity,
    getDeviceBreakdown,
    getBackupCodeUsage,
    getTimeComparisons
  };
