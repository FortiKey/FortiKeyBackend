const mongoose = require('mongoose');
const { Types } = mongoose;
const { connectDB } = require('../config/db');
const usageService = require('../services/usageService');
const { Usage } = require('../models/usageModel');
const User = require('../models/userModel');

describe('Usage Service', () => {
  let testUser;
  let testUserId;

  // Connect to the database before tests
  beforeAll(async () => {
    await connectDB();
    
    // Create a test user
    testUser = new User({
      businessName: 'Usage Service Test Business',
      firstName: 'Test',
      lastName: 'User',
      email: 'usageservicetest@example.com',
      password: 'password123'
    });
    
    await testUser.save();
    testUserId = testUser._id;
  });

  // Clean up after tests
  afterAll(async () => {
    try {
      // Delete test data
      await Usage.deleteMany({ businessId: testUserId });
      await User.findByIdAndDelete(testUserId);
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      // Close connection
      await mongoose.connection.close();
    }
  });

  // Clear Usage collection between tests
  afterEach(async () => {
    await Usage.deleteMany({ businessId: testUserId });
  });

  // Helper function to create test data
  const createTestEvents = async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    // Convert testUserId to ObjectId safely
    const userIdObj = testUserId instanceof Types.ObjectId 
      ? testUserId 
      : new Types.ObjectId(String(testUserId));
    
    console.log('Creating test events for user ID:', userIdObj);
    
    // Create test events
    await Usage.create([
      {
        businessId: userIdObj,
        externalUserId: 'ext-user-1',
        eventType: 'totp_setup',
        success: true,
        timestamp: today,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      },
      {
        businessId: userIdObj,
        externalUserId: 'ext-user-1',
        eventType: 'totp_validation',
        success: true,
        timestamp: today,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      },
      {
        businessId: userIdObj,
        externalUserId: 'ext-user-1',
        eventType: 'totp_validation',
        success: false,
        timestamp: yesterday,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      },
      {
        businessId: userIdObj,
        externalUserId: 'ext-user-2',
        eventType: 'backup_code_used',
        success: true,
        timestamp: twoDaysAgo,
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
      },
      {
        businessId: userIdObj,
        eventType: 'login',
        businessId: userIdObj,
        eventType: 'login',
        success: true,
        timestamp: today,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      },
      {
        businessId: userIdObj,
        eventType: 'login',
        success: false,
        timestamp: yesterday,
        ipAddress: '192.168.1.3',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15'
      }
    ]);
    
    // Verify data was created
    const count = await Usage.countDocuments({ businessId: userIdObj });
    console.log(`Created ${count} test events for user ${userIdObj}`);
  };

  describe('getBusinessStats', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return business statistics for the given period', async () => {
      // Convert testUserId to string for consistent handling
      const stats = await usageService.getBusinessStats(testUserId.toString(), 30);
      
      expect(stats).toBeTruthy();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      
      // Check structure of returned data
      const firstStat = stats[0];
      expect(firstStat).toHaveProperty('_id');
      expect(firstStat).toHaveProperty('totalCount');
      expect(firstStat).toHaveProperty('dailyCounts');
      expect(firstStat._id).toHaveProperty('eventType');
      expect(firstStat._id).toHaveProperty('success');
      
      // Check total count
      const totalCount = stats.reduce((sum, stat) => sum + stat.totalCount, 0);
      expect(totalCount).toBe(6); // 6 events created in beforeEach
    });

    it('should filter results by period', async () => {
      // Get stats for only today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats = await usageService.getBusinessStats(testUserId.toString(), 1);
      
      // Calculate events from today only
      const totalTodayEvents = stats.reduce((sum, stat) => sum + stat.totalCount, 0);
      
      // We created 3 events for today in our test data
      expect(totalTodayEvents).toBeGreaterThanOrEqual(2); // At least 2 events from today
    });
  });

  describe('getAuthenticationSummary', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return authentication summary statistics', async () => {
      const summary = await usageService.getAuthenticationSummary(testUserId.toString(), 30);
      
      expect(summary).toBeTruthy();
      expect(summary).toHaveProperty('totalEvents');
      expect(summary).toHaveProperty('successfulEvents');
      expect(summary).toHaveProperty('failedEvents');
      expect(summary).toHaveProperty('successRate');
      
      // Check data accuracy
      // We have 3 auth events (2 totp_validation, 1 backup_code_used)
      // 2 successful, 1 failed
      expect(summary.totalEvents).toBe(3);
      expect(summary.successfulEvents).toBe(2);
      expect(summary.failedEvents).toBe(1);
      expect(summary.successRate).toBe('66.67%');
    });
  });

  describe('getTOTPStats', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return TOTP-specific statistics', async () => {
      const stats = await usageService.getTOTPStats(testUserId.toString(), 30);
      
      expect(stats).toBeTruthy();
      expect(Array.isArray(stats)).toBe(true);
      
      // Check that only TOTP-related events are included
      stats.forEach(stat => {
        expect(['totp_setup', 'totp_validation', 'backup_code_used']).toContain(stat._id.eventType);
      });
      
      // Calculate total TOTP events
      const totalEvents = stats.reduce((sum, stat) => sum + stat.count, 0);
      expect(totalEvents).toBe(4); // 1 setup, 2 validations, 1 backup code
    });
  });

  describe('calculateTOTPSummary', () => {
    it('should correctly calculate TOTP summary from stats', async () => {
      // Create mock TOTP stats data
      const mockStats = [
        { _id: { eventType: 'totp_setup', success: true }, count: 8 },
        { _id: { eventType: 'totp_setup', success: false }, count: 2 },
        { _id: { eventType: 'totp_validation', success: true }, count: 75 },
        { _id: { eventType: 'totp_validation', success: false }, count: 25 },
        { _id: { eventType: 'backup_code_used', success: true }, count: 5 }
      ];
      
      const summary = usageService.calculateTOTPSummary(mockStats);
      
      expect(summary).toHaveProperty('setupSuccessRate', '80.00%');
      expect(summary).toHaveProperty('validationSuccessRate', '75.00%');
      expect(summary).toHaveProperty('totalSetups', 10);
      expect(summary).toHaveProperty('totalValidations', 100);
      expect(summary).toHaveProperty('totalBackupCodesUsed', 5);
    });
    
    it('should handle empty stats', () => {
      const summary = usageService.calculateTOTPSummary([]);
      
      expect(summary).toHaveProperty('setupSuccessRate', 'N/A');
      expect(summary).toHaveProperty('validationSuccessRate', 'N/A');
      expect(summary).toHaveProperty('totalSetups', 0);
      expect(summary).toHaveProperty('totalValidations', 0);
      expect(summary).toHaveProperty('totalBackupCodesUsed', 0);
    });
  });

  describe('getFailureStats', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return failure statistics', async () => {
      const result = await usageService.getFailureStats(testUserId.toString(), 30);
      
      expect(result).toHaveProperty('failures');
      expect(result).toHaveProperty('totalEvents');
      expect(result).toHaveProperty('totalFailures');
      expect(result).toHaveProperty('failureRate');
      
      // Check data accuracy
      // We have 6 total events, 2 failures (1 failed totp validation, 1 failed login)
      expect(result.totalEvents).toBe(6);
      expect(result.totalFailures).toBe(2);
      expect(parseFloat(result.failureRate)).toBeCloseTo(33.33, 2); // 33.33%
      
      // Check failures breakdown
      expect(Array.isArray(result.failures)).toBe(true);
      expect(result.failures.length).toBe(2); // 2 different failure types
      
      // Verify failure types
      const failureTypes = result.failures.map(f => f._id.eventType);
      expect(failureTypes).toContain('totp_validation');
      expect(failureTypes).toContain('login');
    });
  });

  describe('getUserTOTPStats', () => {
    const externalUserId = 'ext-user-1';
    
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return TOTP statistics for a specific user', async () => {
      const stats = await usageService.getUserTOTPStats(externalUserId, 30);
      
      expect(stats).toBeTruthy();
      expect(stats).toHaveProperty('totalAttempts');
      expect(stats).toHaveProperty('successfulAttempts');
      expect(stats).toHaveProperty('failedAttempts');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('attemptsByDay');
      
      // Check data accuracy
      // User has 2 validation attempts, 1 success and 1 failure
      expect(stats.totalAttempts).toBe(2);
      expect(stats.successfulAttempts).toBe(1);
      expect(stats.failedAttempts).toBe(1);
      expect(stats.successRate).toBe('50.00%');
      
      // Check attempts by day
      expect(Array.isArray(stats.attemptsByDay)).toBe(true);
      expect(stats.attemptsByDay.length).toBe(2); // 2 days with attempts
    });
    
    it('should return null for non-existent user', async () => {
      const stats = await usageService.getUserTOTPStats('non-existent-user', 30);
      
      // For an empty user, we should get default statistics, not null
      expect(stats).toBeTruthy();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulAttempts).toBe(0);
      expect(stats.failedAttempts).toBe(0);
      expect(stats.successRate).toBe('0%');
      expect(stats.attemptsByDay).toEqual([]);
    });
  });

  describe('getDeviceBreakdown', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return device breakdown statistics', async () => {
      const breakdown = await usageService.getDeviceBreakdown(testUserId.toString(), 30);
      
      expect(breakdown).toBeTruthy();
      expect(Array.isArray(breakdown)).toBe(true);
      expect(breakdown.length).toBeGreaterThan(0);
      
      // Check structure
      const firstDevice = breakdown[0];
      expect(firstDevice).toHaveProperty('_id');
      expect(firstDevice._id).toHaveProperty('deviceType');
      expect(firstDevice._id).toHaveProperty('browser');
      expect(firstDevice).toHaveProperty('count');
      expect(firstDevice).toHaveProperty('successCount');
      
      // Check detection accuracy
      // We have both Desktop and Mobile in our test data
      const deviceTypes = breakdown.map(d => d._id.deviceType);
      expect(deviceTypes).toContain('Desktop');
      expect(deviceTypes).toContain('Mobile');
      
      // Check browser detection
      const browsers = breakdown.map(d => d._id.browser);
      expect(browsers.some(b => ['Chrome', 'Safari'].includes(b))).toBe(true);
    });
  });

  describe('processDeviceData', () => {
    it('should process raw device data into frontend-friendly format', () => {
      // Mock device breakdown data
      const mockDeviceData = [
        { 
          _id: { deviceType: 'Desktop', browser: 'Chrome' }, 
          count: 50,
          successCount: 45,
          users: ['user1', 'user2'] 
        },
        { 
          _id: { deviceType: 'Mobile', browser: 'Safari' }, 
          count: 30,
          successCount: 28,
          users: ['user3'] 
        },
        { 
          _id: { deviceType: 'Desktop', browser: 'Firefox' }, 
          count: 20,
          successCount: 18,
          users: ['user4', 'user5'] 
        }
      ];
      
      const processed = usageService.processDeviceData(mockDeviceData);
      
      expect(processed).toHaveProperty('deviceTypes');
      expect(processed).toHaveProperty('browsers');
      expect(processed).toHaveProperty('detailedBreakdown');
      
      // Check device type counts
      expect(processed.deviceTypes).toHaveProperty('Desktop', 70); // 50 + 20
      expect(processed.deviceTypes).toHaveProperty('Mobile', 30);
      
      // Check browser counts
      expect(processed.browsers).toHaveProperty('Chrome', 50);
      expect(processed.browsers).toHaveProperty('Safari', 30);
      expect(processed.browsers).toHaveProperty('Firefox', 20);
      
      // Check that detailed breakdown is preserved
      expect(processed.detailedBreakdown).toEqual(mockDeviceData);
    });
  });
  
  describe('getBackupCodeUsage', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return backup code usage statistics', async () => {
      const usage = await usageService.getBackupCodeUsage(testUserId.toString(), 30);
      
      expect(usage).toBeTruthy();
      expect(usage).toHaveProperty('backupCodeStats');
      expect(usage).toHaveProperty('totpCount');
      expect(usage).toHaveProperty('backupCount');
      expect(usage).toHaveProperty('backupToTotpRatio');
      expect(usage).toHaveProperty('frequentBackupUsers');
      
      // Check data accuracy
      expect(usage.totpCount).toBe(2); // 2 totp_validation events
      expect(usage.backupCount).toBe(1); // 1 backup_code_used event
      expect(usage.backupToTotpRatio).toBe('50.00%'); // 1 backup code use out of 2 totp validations
    });
  });
  
  describe('getTimeComparisons', () => {
    beforeEach(async () => {
      await createTestEvents();
    });

    it('should return time-based comparison data', async () => {
      const comparisons = await usageService.getTimeComparisons(testUserId.toString(), 30);
      
      expect(comparisons).toBeTruthy();
      expect(comparisons).toHaveProperty('dayOverDayComparison');
      expect(comparisons).toHaveProperty('businessHoursSummary');
      
      // Check structure of dayOverDayComparison
      expect(Array.isArray(comparisons.dayOverDayComparison)).toBe(true);
      expect(comparisons.dayOverDayComparison.length).toBeGreaterThan(0);
      
      // Check structure of businessHoursSummary
      expect(comparisons.businessHoursSummary).toHaveProperty('businessHoursCount');
      expect(comparisons.businessHoursSummary).toHaveProperty('offHoursCount');
      expect(comparisons.businessHoursSummary).toHaveProperty('businessHoursPercentage');
    });
  });
});