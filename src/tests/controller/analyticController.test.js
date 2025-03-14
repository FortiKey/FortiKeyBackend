const {
  logEvent,
  getCompanyStats,
  getTOTPStats,
  getFailureAnalytics,
  getUserTOTPStats,
  getDeviceBreakdown,
  getBackupCodeUsage,
  getTimeComparisons,
  getSuspiciousActivity
} = require('../../controllers/analyticsController');
const usageService = require('../../services/usageService');
const { Usage } = require('../../models/usageModel');
const { logger } = require('../../middlewares/logger');

// Mock dependencies
jest.mock('../../services/usageService');
jest.mock('../../models/usageModel');
jest.mock('../../middlewares/logger');

// Global variables for all tests
let mockReq, mockRes;

describe('Analytics Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock request/response objects
    mockReq = {
      userId: 'user-id',
      query: { period: '30' },
      params: {},
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock logger functions
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock Usage.logEvent
    Usage.logEvent = jest.fn().mockResolvedValue({ _id: 'event-id' });
  });

  describe('getCompanyStats', () => {
    beforeEach(() => {
      // Setup mocks for this section
      usageService.getCompanyStats = jest.fn().mockResolvedValue([
        { _id: { eventType: 'login' }, totalCount: 10 }
      ]);
      usageService.getAuthenticationSummary = jest.fn().mockResolvedValue({
        totalEvents: 10,
        successfulEvents: 8,
        failedEvents: 2,
        successRate: '80%'
      });
    });

    it('should return business stats for default period', async () => {
      delete mockReq.query.period;

      await getCompanyStats(mockReq, mockRes);

      expect(usageService.getCompanyStats).toHaveBeenCalledWith('user-id', 30);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });


    describe('getCompanyStats', () => {
      beforeEach(() => {
        // Setup mocks for this section
        usageService.getCompanyStats = jest.fn().mockResolvedValue([
          { _id: { eventType: 'login' }, totalCount: 10 }
        ]);
        usageService.getAuthenticationSummary = jest.fn().mockResolvedValue({
          totalEvents: 10,
          successfulEvents: 8,
          failedEvents: 2,
          successRate: '80%'
        });
      });

      it('should return business stats for default period', async () => {
        // Use the mockReq from the outer scope
        delete mockReq.query.period;

        await getCompanyStats(mockReq, mockRes);

        expect(usageService.getCompanyStats).toHaveBeenCalledWith('user-id', 30);
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should return business stats for specific period', async () => {
        mockReq.query.period = '7';

        await getCompanyStats(mockReq, mockRes);

        expect(usageService.getCompanyStats).toHaveBeenCalledWith('user-id', 7);
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      it('should handle unauthorized requests', async () => {
        mockReq.userId = null;

        await getCompanyStats(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(401);
      });

      it('should handle service errors', async () => {
        usageService.getCompanyStats = jest.fn().mockRejectedValue(new Error('Service error'));

        await getCompanyStats(mockReq, mockRes);

        expect(logger.error).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
      });
    });
  });
});


describe('getTOTPStats', () => {
  beforeEach(() => {
    // Setup usageService mocks
    usageService.getTOTPStats = jest.fn().mockResolvedValue([
      { _id: { eventType: 'totp_validation' }, count: 10 }
    ]);
    usageService.calculateTOTPSummary = jest.fn().mockReturnValue({
      setupSuccessRate: '90%',
      validationSuccessRate: '85%',
      totalSetups: 10,
      totalValidations: 50,
      totalBackupCodesUsed: 5
    });
  });

  it('should return TOTP analytics for default period', async () => {
    delete mockReq.query.period;

    await getTOTPStats(mockReq, mockRes);

    expect(usageService.getTOTPStats).toHaveBeenCalledWith('user-id', 30);
    expect(usageService.calculateTOTPSummary).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 30,
        summary: expect.any(Object),
        dailyStats: expect.any(Array)
      })
    );
  });

  it('should return TOTP analytics for specific period', async () => {
    mockReq.query.period = '14';

    await getTOTPStats(mockReq, mockRes);

    expect(usageService.getTOTPStats).toHaveBeenCalledWith('user-id', 14);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 14,
        summary: expect.any(Object),
        dailyStats: expect.any(Array)
      })
    );
  });

  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getTOTPStats(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getTOTPStats = jest.fn().mockRejectedValue(new Error('Service error'));

    await getTOTPStats(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});

describe('getFailureAnalytics', () => {
  beforeEach(() => {
    usageService.getFailureStats = jest.fn().mockResolvedValue({
      failures: [{ _id: { eventType: 'login' }, count: 5 }],
      totalEvents: 100,
      totalFailures: 10,
      failureRate: '10%'
    });
  });

  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getFailureAnalytics(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getFailureStats = jest.fn().mockRejectedValue(new Error('Service error'));

    await getFailureAnalytics(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});

describe('getUserTOTPStats', () => {
  beforeEach(() => {
    // Reset params first
    mockReq.params = { externalUserId: 'external-user-1' };

    usageService.getUserTOTPStats = jest.fn().mockResolvedValue({
      totalAttempts: 20,
      successfulAttempts: 18,
      failedAttempts: 2,
      successRate: '90%',
      attemptsByDay: [{ date: '2025-03-10', attempts: 5, successful: 4 }]
    });
  });


  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getUserTOTPStats(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle null result from service', async () => {
    usageService.getUserTOTPStats = jest.fn().mockResolvedValue(null);

    await getUserTOTPStats(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getUserTOTPStats = jest.fn().mockRejectedValue(new Error('Service error'));

    await getUserTOTPStats(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});

describe('getDeviceBreakdown', () => {
  beforeEach(() => {
    usageService.getDeviceBreakdown = jest.fn().mockResolvedValue([
      { _id: { deviceType: 'Desktop', browser: 'Chrome' }, count: 50 }
    ]);
  });

  usageService.processDeviceData = jest.fn().mockReturnValue({
    deviceTypes: { Desktop: 70, Mobile: 30 },
    browsers: { Chrome: 50, Safari: 30, Firefox: 20 },
    detailedBreakdown: [
      { _id: { deviceType: 'Desktop', browser: 'Chrome' }, count: 50 }
    ]

  });

  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getDeviceBreakdown(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getDeviceBreakdown = jest.fn().mockRejectedValue(new Error('Service error'));

    await getDeviceBreakdown(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});


describe('getBackupCodeUsage', () => {
  beforeEach(() => {
    usageService.getBackupCodeUsage = jest.fn().mockResolvedValue({
      backupCodeStats: [{ date: '2025-03-10', count: 2 }],
      totpCount: 50,
      backupCount: 5,
      backupToTotpRatio: '10%',
      frequentBackupUsers: [{ externalUserId: 'user1', count: 3 }]
    });
  });

  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getBackupCodeUsage(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getBackupCodeUsage = jest.fn().mockRejectedValue(new Error('Service error'));

    await getBackupCodeUsage(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});

describe('getTimeComparisons', () => {
  beforeEach(() => {
    usageService.getTimeComparisons = jest.fn().mockResolvedValue({
      dayOverDayComparison: [
        { date: '2025-03-10', count: 15, prevDayCount: 10 }
      ],
      companyHoursSummary: {
        companyHoursCount: 80,
        offHoursCount: 20,
        companyHoursPercentage: '80%'
      }
    });
  });

  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getTimeComparisons(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getTimeComparisons = jest.fn().mockRejectedValue(new Error('Service error'));

    await getTimeComparisons(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});

describe('getSuspiciousActivity', () => {
  beforeEach(() => {
    usageService.getSuspiciousActivity = jest.fn().mockResolvedValue({
      suspiciousUsers: [
        { _id: 'user1', totalAttempts: 15, failedAttempts: 8 }
      ],
      suspiciousEvents: [
        { _id: 'event1', eventType: 'totp_validation', success: false }
      ]
    });
  });

  it('should handle unauthorized requests', async () => {
    mockReq.userId = null;

    await getSuspiciousActivity(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized'
      })
    );
  });

  it('should handle service errors', async () => {
    usageService.getSuspiciousActivity = jest.fn().mockRejectedValue(new Error('Service error'));

    await getSuspiciousActivity(mockReq, mockRes);

    expect(logger.error).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Error')
      })
    );
  });
});