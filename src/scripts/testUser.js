/**
 * Test User Analytics Data Seeder
 * 
 * This script creates a test user account and populates it with realistic 
 * usage analytics data for testing the analytics dashboard.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const TOTPSecret = require('../models/totpSecretModel');
const { Usage } = require('../models/usageModel');
const { generateTOTPSecret } = require('../utils/totpGeneration');
const dotenv = require('dotenv');
const { logger } = require('../middlewares/logger');

// Load environment variables
dotenv.config();

// Check if MONGODB_URI exists
if (!process.env.MONGO_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  console.error('Please make sure you have a .env file with MONGODB_URI defined.');
  process.exit(1);
}

// Connect to MongoDB
console.log(`Attempting to connect to MongoDB using URI: ${process.env.MONGO_URI.replace(/:\/\/(.*?)@/, '://*****:*****@')}`);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    logger.info('Connected to MongoDB');
    seedTestData()
      .then(() => {
        logger.info('Test data seeding completed successfully');
        console.log('✅ Test data seeding completed successfully');
        mongoose.connection.close();
      })
      .catch(error => {
        logger.error('Error seeding test data:', error.message);
        console.error('❌ Error seeding test data:', error.message);
        mongoose.connection.close();
      });
  })
  .catch(error => {
    logger.error('MongoDB connection error:', error.message);
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Check if MongoDB is running on your system');
    console.error('2. Verify the connection string format is correct');
    console.error('3. Make sure the database user has proper permissions');
    console.error('4. Check for network/firewall issues if using a remote database');
    process.exit(1);
  });

/**
 * Main function to seed test data
 */
async function seedTestData() {
  try {
    // Clear existing test user data
    await clearExistingTestData();
    
    // Create test user
    const testUser = await createTestUser();
    logger.info(`Created test user: ${testUser.email} with ID: ${testUser._id}`);
    
    // Create test TOTP users
    const testTOTPUsers = await createTestTOTPUsers(testUser._id, 50);
    logger.info(`Created ${testTOTPUsers.length} test TOTP users`);
    
    // Generate usage analytics data
    await generateAnalyticsData(testUser._id, testTOTPUsers);
    logger.info('Generated analytics data');
    
    return testUser;
  } catch (error) {
    logger.error('Error in seedTestData:', error.message);
    throw error;
  }
}

/**
 * Clear existing test data
 */
async function clearExistingTestData() {
  // Find existing test user
  const existingUser = await User.findOne({ email: 'test@example.com' });
  
  if (existingUser) {
    // Delete usage data associated with this user
    await Usage.deleteMany({ companyId: existingUser._id });
    logger.info('Deleted existing usage data');
    
    // Delete TOTP secrets associated with this user
    await TOTPSecret.deleteMany({ companyId: existingUser._id });
    logger.info('Deleted existing TOTP secrets');
    
    // Delete the user
    await User.deleteOne({ _id: existingUser._id });
    logger.info('Deleted existing test user');
  }
}

/**
 * Create a test user
 */
async function createTestUser() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);
  
  const testUser = new User({
    company: 'Test Company',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: hashedPassword,
    role: 'user',
    apikey: require('crypto').randomBytes(32).toString('hex')
  });
  
  return await testUser.save();
}

/**
 * Create test TOTP users
 * @param {mongoose.Types.ObjectId} companyId - ID of the company/user
 * @param {number} count - Number of TOTP users to create
 */
async function createTestTOTPUsers(companyId, count) {
  const users = [];
  
  for (let i = 0; i < count; i++) {
    const externalUserId = `test-user-${i + 1}`;
    const { secret } = generateTOTPSecret('Test Company', externalUserId);
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );
    
    const totpSecret = new TOTPSecret({
      secret,
      backupCodes,
      externalUserId,
      companyId
    });
    
    await totpSecret.save();
    users.push({ externalUserId, _id: totpSecret._id });
  }
  
  return users;
}

/**
 * Generate analytics data
 * @param {mongoose.Types.ObjectId} companyId - ID of the company/user
 * @param {Array} testTOTPUsers - Array of test TOTP users
 */
async function generateAnalyticsData(companyId, testTOTPUsers) {
  // Generate data for the past 60 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);
  
  // Create usage events
  const usageEvents = [];
  
  // Generate user login events
  await generateUserLoginEvents(companyId, startDate, endDate, usageEvents);
  
  // Generate TOTP setup events
  await generateTOTPSetupEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents);
  
  // Generate TOTP validation events
  await generateTOTPValidationEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents);
  
  // Generate backup code usage events
  await generateBackupCodeEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents);
  
  // Generate analytics access events
  await generateAnalyticsAccessEvents(companyId, startDate, endDate, usageEvents);
  
  // Generate rate limit exceeded events
  await generateRateLimitEvents(companyId, startDate, endDate, usageEvents);
  
  // Batch insert all events
  if (usageEvents.length > 0) {
    await Usage.insertMany(usageEvents);
  }
}

/**
 * Generate user login events
 */
async function generateUserLoginEvents(companyId, startDate, endDate, usageEvents) {
  const days = getDaysBetweenDates(startDate, endDate);
  
  // Generate 1-3 logins per day
  for (const day of days) {
    const loginCount = getRandomInt(1, 3);
    
    for (let i = 0; i < loginCount; i++) {
      const timestamp = getRandomTimeOnDay(day);
      const success = Math.random() > 0.05; // 5% failure rate
      
      usageEvents.push({
        companyId,
        eventType: 'login',
        success,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getRandomUserAgent(),
        details: {
          email: 'test@example.com',
          company: 'Test Company'
        }
      });
    }
  }
}

/**
 * Generate TOTP setup events
 */
async function generateTOTPSetupEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents) {
  const days = getDaysBetweenDates(startDate, endDate);
  
  // Setup events are distributed across days
  let userIndex = 0;
  
  for (const day of days) {
    // Setup 0-2 users per day
    const setupCount = getRandomInt(0, 2);
    
    for (let i = 0; i < setupCount && userIndex < testTOTPUsers.length; i++) {
      const timestamp = getRandomTimeOnDay(day);
      const success = Math.random() > 0.1; // 10% failure rate
      
      usageEvents.push({
        companyId,
        externalUserId: testTOTPUsers[userIndex].externalUserId,
        eventType: 'totp_setup',
        success,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getRandomUserAgent(),
        details: {
          setupMethod: 'api'
        }
      });
      
      userIndex++;
    }
  }
}

/**
 * Generate TOTP validation events
 */
async function generateTOTPValidationEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents) {
  const days = getDaysBetweenDates(startDate, endDate);
  
  // For each user, generate validation events
  for (const user of testTOTPUsers) {
    // Each user logs in 0-3 times a week
    const loginDays = getRandomSubset(days, getRandomInt(0, 3 * (days.length / 7)));
    
    for (const day of loginDays) {
      // Generate 1-3 validation attempts per login day
      const attempts = getRandomInt(1, 3);
      
      for (let i = 0; i < attempts; i++) {
        const timestamp = getRandomTimeOnDay(day);
        const success = Math.random() > 0.12; // 12% failure rate
        
        const ipAddress = getRandomIP();
        const userAgent = getRandomUserAgent();
        
        usageEvents.push({
          companyId,
          externalUserId: user.externalUserId,
          eventType: 'totp_validation',
          success,
          timestamp,
          ipAddress,
          userAgent,
          details: {
            method: 'totp',
            deviceInfo: getUserDeviceInfo(userAgent)
          }
        });
        
        // If failed, maybe try again
        if (!success && Math.random() > 0.6) {
          const retryTimestamp = new Date(timestamp);
          retryTimestamp.setMinutes(timestamp.getMinutes() + getRandomInt(1, 5));
          
          usageEvents.push({
            companyId,
            externalUserId: user.externalUserId,
            eventType: 'totp_validation',
            success: true, // usually succeeds on retry
            timestamp: retryTimestamp,
            ipAddress,
            userAgent,
            details: {
              method: 'totp',
              deviceInfo: getUserDeviceInfo(userAgent)
            }
          });
        }
      }
    }
  }
}

/**
 * Generate backup code usage events
 */
async function generateBackupCodeEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents) {
  const days = getDaysBetweenDates(startDate, endDate);
  
  // 20% of users use backup codes at least once
  const backupUsers = getRandomSubset(testTOTPUsers, Math.ceil(testTOTPUsers.length * 0.2));
  
  for (const user of backupUsers) {
    // Each backup user has 0-3 backup code usages
    const usageCount = getRandomInt(0, 3);
    
    for (let i = 0; i < usageCount; i++) {
      const day = getRandomItem(days);
      const timestamp = getRandomTimeOnDay(day);
      const success = Math.random() > 0.05; // 5% failure rate
      
      usageEvents.push({
        companyId,
        externalUserId: user.externalUserId,
        eventType: 'backup_code_used',
        success,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getRandomUserAgent(),
        details: {
          backupCodeIndex: getRandomInt(0, 7)
        }
      });
    }
  }
  
  // Generate a few heavy backup code users (3-5 users who use backup codes frequently)
  const heavyBackupUsers = getRandomSubset(
    testTOTPUsers.filter(u => !backupUsers.includes(u)), 
    getRandomInt(3, 5)
  );
  
  for (const user of heavyBackupUsers) {
    // Each heavy user has 4-10 backup code usages
    const usageCount = getRandomInt(4, 10);
    
    for (let i = 0; i < usageCount; i++) {
      const day = getRandomItem(days);
      const timestamp = getRandomTimeOnDay(day);
      const success = Math.random() > 0.05; // 5% failure rate
      
      usageEvents.push({
        companyId,
        externalUserId: user.externalUserId,
        eventType: 'backup_code_used',
        success,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getRandomUserAgent(),
        details: {
          backupCodeIndex: getRandomInt(0, 7)
        }
      });
    }
  }
}

/**
 * Generate analytics access events
 */
async function generateAnalyticsAccessEvents(companyId, startDate, endDate, usageEvents) {
  const days = getDaysBetweenDates(startDate, endDate);
  
  // Generate 0-3 analytics accesses per week
  const analyticsDays = getRandomSubset(days, getRandomInt(0, 3 * (days.length / 7)));
  
  const analyticsTypes = [
    'company_stats',
    'totp_stats',
    'failure_analytics',
    'suspicious_activity',
    'device_breakdown',
    'backup_code_usage',
    'time_comparisons'
  ];
  
  for (const day of analyticsDays) {
    // Access 1-4 different analytics types per day
    const accessCount = getRandomInt(1, 4);
    const accessedTypes = getRandomSubset(analyticsTypes, accessCount);
    
    for (const type of accessedTypes) {
      const timestamp = getRandomTimeOnDay(day);
      
      usageEvents.push({
        companyId,
        eventType: 'analytics_access',
        success: true,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getRandomUserAgent(),
        details: {
          type,
          period: getRandomItem([7, 30, 60, 90])
        }
      });
    }
  }
}

/**
 * Generate rate limit exceeded events
 */
async function generateRateLimitEvents(companyId, startDate, endDate, usageEvents) {
  const days = getDaysBetweenDates(startDate, endDate);
  
  // Generate 0-5 rate limit events total
  const rateLimitCount = getRandomInt(0, 5);
  
  for (let i = 0; i < rateLimitCount; i++) {
    const day = getRandomItem(days);
    const timestamp = getRandomTimeOnDay(day);
    
    usageEvents.push({
      companyId,
      eventType: 'rate_limit_exceeded',
      success: false,
      timestamp,
      ipAddress: getRandomIP(),
      userAgent: getRandomUserAgent(),
      details: {
        endpoint: getRandomItem([
          '/api/totp/validate',
          '/api/analytics/company-stats',
          '/api/company/users'
        ]),
        method: 'POST'
      }
    });
  }
}

/**
 * HELPER FUNCTIONS
 */

/**
 * Get days between two dates
 */
function getDaysBetweenDates(startDate, endDate) {
  const days = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}

/**
 * Get random time on a specific day
 */
function getRandomTimeOnDay(day) {
  const result = new Date(day);
  result.setHours(getRandomInt(0, 23));
  result.setMinutes(getRandomInt(0, 59));
  result.setSeconds(getRandomInt(0, 59));
  return result;
}

/**
 * Get random integer between min and max (inclusive)
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random IP address
 */
function getRandomIP() {
  return `${getRandomInt(1, 255)}.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}.${getRandomInt(0, 255)}`;
}

/**
 * Get random user agent
 */
function getRandomUserAgent() {
  const userAgents = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    // Chrome on Android
    'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    // Safari on iOS
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Get user device info from user agent
 */
function getUserDeviceInfo(userAgent) {
  if (userAgent.includes('Android')) {
    return { type: 'Mobile', os: 'Android', browser: 'Chrome' };
  } else if (userAgent.includes('iPhone')) {
    return { type: 'Mobile', os: 'iOS', browser: 'Safari' };
  } else if (userAgent.includes('Windows')) {
    return { 
      type: 'Desktop', 
      os: 'Windows', 
      browser: userAgent.includes('Edge') ? 'Edge' : 
               userAgent.includes('Firefox') ? 'Firefox' : 'Chrome' 
    };
  } else if (userAgent.includes('Macintosh')) {
    return { 
      type: 'Desktop', 
      os: 'macOS', 
      browser: userAgent.includes('Safari') && !userAgent.includes('Chrome') ? 'Safari' : 'Chrome' 
    };
  } else {
    return { type: 'Unknown', os: 'Unknown', browser: 'Unknown' };
  }
}

/**
 * Get random subset of array
 */
function getRandomSubset(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Get random item from array
 */
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}