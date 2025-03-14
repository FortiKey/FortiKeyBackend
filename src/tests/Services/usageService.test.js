const mongoose = require('mongoose');
const { Types } = mongoose;
const { Usage } = require('../../models/usageModel');
const { logger } = require('../../middlewares/logger');
const { getCompanyStats, getAuthenticationSummary, getFailureStats } = require('../../services/usageService');

jest.mock('../../models/usageModel');
jest.mock('../../middlewares/logger');

describe('Usage Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCompanyStats', () => {
    it('should return company stats', async () => {
      Usage.aggregate.mockResolvedValue([{ _id: { eventType: 'login', success: true }, dailyCounts: [], totalCount: 10 }]);
      const result = await getCompanyStats('60d5ec49f1e7e2a5d8b5b5b5');
      expect(result).toEqual([{ _id: { eventType: 'login', success: true }, dailyCounts: [], totalCount: 10 }]);
    });

    it('should return an empty array if companyId is invalid', async () => {
      const result = await getCompanyStats(null);
      expect(result).toEqual([]);
    });
  });

  describe('getAuthenticationSummary', () => {
    it('should return authentication summary', async () => {
      Usage.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(7);
      const result = await getAuthenticationSummary('60d5ec49f1e7e2a5d8b5b5b5');
      expect(result).toEqual({
        totalEvents: 10,
        successfulEvents: 7,
        failedEvents: 3,
        successRate: '70.00%'
      });
    });

    it('should return default summary if companyId is invalid', async () => {
      const result = await getAuthenticationSummary(null);
      expect(result).toEqual({
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        successRate: '0%'
      });
    });
  });

  describe('getFailureStats', () => {
    it('should return failure stats', async () => {
      Usage.aggregate.mockResolvedValue([{ _id: 'login', count: 5 }]);
      Usage.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(5);
      const result = await getFailureStats('60d5ec49f1e7e2a5d8b5b5b5');
      expect(result).toEqual({
        failures: [{ _id: 'login', count: 5 }],
        totalEvents: 10,
        totalFailures: 5,
        failureRate: '50.00'
      });
    });

    it('should return default stats if companyId is invalid', async () => {
      const result = await getFailureStats(null);
      expect(result).toEqual({
        failures: [],
        totalEvents: 0,
        totalFailures: 0,
        failureRate: '0.00'
      });
    });
  });
});