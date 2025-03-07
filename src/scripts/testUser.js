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
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    logger.info('Connected to MongoDB');

    // Drop the database before seeding
    await mongoose.connection.dropDatabase();
    console.log('Database dropped successfully');
    logger.info('Database dropped successfully');

    seedTestData()
      .then(() => {
        logger.info('Test data seeding completed successfully');
        console.log('Test data seeding completed successfully');
        mongoose.connection.close();
      })
      .catch(error => {
        logger.error('Error seeding test data:', error.message);
        console.error('Error seeding test data:', error.message);
        mongoose.connection.close();
      });
  })
  .catch(error => {
    logger.error('MongoDB connection error:', error.message);
    console.error('MongoDB connection error:', error.message);
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
  const existingUser = await User.findOne({ email: 'test@test.com' });

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
  const testUser = new User({
    company: 'Test Company',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@test.com',
    password: 'password123', // Set plain text password
    role: 'user',
    apikey: require('crypto').randomBytes(32).toString('hex')
  });

  const savedUser = await testUser.save();
  console.log('Created test user:', savedUser);

  return savedUser;
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

  // Generate activity pattern - IMPROVED PATTERN GENERATION
  const activityPattern = generateActivityPattern(startDate, endDate);
  logger.info('Generated consistent activity pattern');

  // Assign device preferences to users for consistency
  const userDevicePreferences = assignUserDevicePreferences(testTOTPUsers);
  logger.info('Assigned consistent device preferences to users');

  // Assign usage frequency to users
  const userUsageFrequency = assignUserUsageFrequency(testTOTPUsers);
  logger.info('Assigned consistent usage frequency to users');

  // Generate user login events
  await generateUserLoginEvents(companyId, startDate, endDate, usageEvents, activityPattern);

  // Generate TOTP setup events - spread consistently across the time period
  await generateTOTPSetupEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents, activityPattern);

  // Generate TOTP validation events - using user device preferences and usage frequency
  await generateTOTPValidationEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents,
    activityPattern, userDevicePreferences, userUsageFrequency);

  // Generate backup code usage events - more consistent patterns
  await generateBackupCodeEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents,
    activityPattern, userDevicePreferences, userUsageFrequency);

  // Generate API usage events - consistent with activity pattern
  await generateAPIUsageEvents(companyId, startDate, endDate, usageEvents, activityPattern);

  // Generate analytics access events - consistent weekly pattern
  await generateAnalyticsAccessEvents(companyId, startDate, endDate, usageEvents, activityPattern);

  // Generate rate limit exceeded events with specific failure types - tied to high activity days
  await generateRateLimitEvents(companyId, startDate, endDate, usageEvents, activityPattern);

  // Batch insert all events
  if (usageEvents.length > 0) {
    await Usage.insertMany(usageEvents);
    logger.info(`Inserted ${usageEvents.length} usage events`);
  }
}

/**
 * Generate a consistent activity pattern
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Activity pattern by date
 */
function generateActivityPattern(startDate, endDate) {
  const days = getDaysBetweenDates(startDate, endDate);
  const activityPattern = {};

  // Base multipliers for weekdays and weekends
  const weekdayBase = 1.0;  // Monday-Friday
  const weekendBase = 0.4;  // Saturday-Sunday

  // Create a weekly trend with gradual increase from Monday to Thursday
  // and decrease on Friday, with low activity on weekends
  const dayOfWeekMultipliers = [
    0.4,  // Sunday: 40% of base
    0.9,  // Monday: 90% of base  
    1.0,  // Tuesday: 100% of base
    1.2,  // Wednesday: 120% of base (mid-week peak)
    1.1,  // Thursday: 110% of base
    0.8,  // Friday: 80% of base
    0.3   // Saturday: 30% of base
  ];

  // Create a monthly trend (higher activity in the middle of the month)
  const getMonthlyMultiplier = (date) => {
    const dayOfMonth = date.getDate();
    const monthLength = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    // Calculate distance from middle of month (normalized to 0-1)
    const normalizedDistance = Math.abs((dayOfMonth - (monthLength / 2)) / (monthLength / 2));

    // Middle of month has higher activity (up to 20% boost)
    return 1 - (normalizedDistance * 0.2);
  };

  // Create a long-term trend (gradually increasing activity over time)
  const getLongTermTrend = (date, startDate, endDate) => {
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const dayIndex = (date - startDate) / (1000 * 60 * 60 * 24);

    // 15% increase from start to end
    return 0.9 + (dayIndex / totalDays) * 0.15;
  };

  // Generate consistent noise (same seed for same day)
  const getConsistentNoise = (date) => {
    // Use date as seed
    const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

    // Simple deterministic pseudo-random number generator
    const x = Math.sin(seed) * 10000;
    const noise = x - Math.floor(x);

    // Range of -10% to +10%
    return 0.9 + (noise * 0.2);
  };

  // Apply all factors to create the activity pattern
  days.forEach(day => {
    const dayOfWeek = day.getDay();
    const baseActivity = (dayOfWeek === 0 || dayOfWeek === 6) ? weekendBase : weekdayBase;
    const dowMultiplier = dayOfWeekMultipliers[dayOfWeek];
    const monthMultiplier = getMonthlyMultiplier(day);
    const trendMultiplier = getLongTermTrend(day, startDate, endDate);
    const noiseMultiplier = getConsistentNoise(day);

    // Combine all factors
    const dayActivity = baseActivity * dowMultiplier * monthMultiplier * trendMultiplier * noiseMultiplier;

    // Store the activity level
    const dateStr = day.toISOString().split('T')[0];
    activityPattern[dateStr] = Math.max(0.1, dayActivity); // Ensure minimum activity
  });

  return activityPattern;
}

/**
 * Assign consistent device preferences to users
 * @param {Array} users - List of TOTP users
 * @returns {Object} User device preferences
 */
function assignUserDevicePreferences(users) {
  const preferences = {};

  // Device distribution - matches real-world usage patterns
  const deviceTypes = [
    { type: 'mobile', probability: 0.45 },   // 45% primarily mobile
    { type: 'desktop', probability: 0.45 },  // 45% primarily desktop
    { type: 'tablet', probability: 0.1 }     // 10% primarily tablet
  ];

  // Generate secondary device probabilities
  // e.g., mobile users sometimes use desktop
  const secondaryDeviceMatrix = {
    mobile: { desktop: 0.3, tablet: 0.1 },     // Mobile users: 30% also use desktop, 10% also use tablet
    desktop: { mobile: 0.4, tablet: 0.15 },    // Desktop users: 40% also use mobile, 15% also use tablet
    tablet: { mobile: 0.5, desktop: 0.4 }      // Tablet users: 50% also use mobile, 40% also use desktop
  };

  // Browser preferences by device
  const browserPreferences = {
    mobile: [
      { browser: 'Chrome', probability: 0.4 },
      { browser: 'Safari', probability: 0.4 },
      { browser: 'Firefox', probability: 0.1 },
      { browser: 'Samsung Internet', probability: 0.1 }
    ],
    desktop: [
      { browser: 'Chrome', probability: 0.6 },
      { browser: 'Firefox', probability: 0.2 },
      { browser: 'Safari', probability: 0.1 },
      { browser: 'Edge', probability: 0.1 }
    ],
    tablet: [
      { browser: 'Safari', probability: 0.5 },
      { browser: 'Chrome', probability: 0.3 },
      { browser: 'Firefox', probability: 0.1 },
      { browser: 'Samsung Internet', probability: 0.1 }
    ]
  };

  // OS preferences by device
  const osPreferences = {
    mobile: [
      { os: 'iOS', probability: 0.5 },
      { os: 'Android', probability: 0.5 }
    ],
    desktop: [
      { os: 'Windows', probability: 0.7 },
      { os: 'macOS', probability: 0.25 },
      { os: 'Linux', probability: 0.05 }
    ],
    tablet: [
      { os: 'iOS', probability: 0.6 },
      { os: 'Android', probability: 0.4 }
    ]
  };

  // Assign preferences to each user
  users.forEach(user => {
    // Determine primary device type
    const primaryDevice = selectWithProbability(
      deviceTypes.map(d => d.type),
      deviceTypes.map(d => d.probability)
    ) || 'desktop'; // Default to desktop

    // Determine secondary devices
    const secondaryDevices = {};
    if (secondaryDeviceMatrix[primaryDevice]) {
      Object.entries(secondaryDeviceMatrix[primaryDevice]).forEach(([deviceType, probability]) => {
        if (Math.random() < probability) {
          secondaryDevices[deviceType] = true;
        }
      });
    }

    // Determine browser for each device
    const browsers = {};
    const allDevices = [primaryDevice, ...Object.keys(secondaryDevices)];

    allDevices.forEach(deviceType => {
      if (browserPreferences[deviceType]) {
        browsers[deviceType] = selectWithProbability(
          browserPreferences[deviceType].map(b => b.browser),
          browserPreferences[deviceType].map(b => b.probability)
        );
      } else {
        // Default to Chrome if device type is unknown
        browsers[deviceType] = 'Chrome';
      }
    });

    // Determine OS for each device
    const operatingSystems = {};

    allDevices.forEach(deviceType => {
      if (osPreferences[deviceType]) {
        operatingSystems[deviceType] = selectWithProbability(
          osPreferences[deviceType].map(o => o.os),
          osPreferences[deviceType].map(o => o.probability)
        );
      } else {
        // Default to Windows/Android based on device type
        operatingSystems[deviceType] = deviceType === 'mobile' || deviceType === 'tablet' ? 'Android' : 'Windows';
      }
    });

    // Store preferences
    preferences[user.externalUserId] = {
      primaryDevice,
      secondaryDevices,
      browsers,
      operatingSystems,
      // Generate consistent user agents - with null checks
      userAgents: {
        mobile: getDeviceSpecificUserAgent('mobile', browsers.mobile, operatingSystems.mobile),
        desktop: getDeviceSpecificUserAgent('desktop', browsers.desktop, operatingSystems.desktop),
        tablet: getDeviceSpecificUserAgent('tablet', browsers.tablet, operatingSystems.tablet)
      }
    };
  });

  return preferences;
}

/**
 * Assign consistent usage frequency to users
 * @param {Array} users - List of TOTP users
 * @returns {Object} User usage frequency
 */
function assignUserUsageFrequency(users) {
  const frequencies = {};

  // Define user types with different usage patterns
  const userTypes = [
    { type: 'daily', probability: 0.1, daysPerWeek: 5, attemptsPerDay: { min: 1, max: 3 } },
    { type: 'regular', probability: 0.3, daysPerWeek: 3, attemptsPerDay: { min: 1, max: 2 } },
    { type: 'occasional', probability: 0.4, daysPerWeek: 1, attemptsPerDay: { min: 1, max: 2 } },
    { type: 'rare', probability: 0.2, daysPerWeek: 0.5, attemptsPerDay: { min: 1, max: 1 } }
  ];

  // Define backup code usage types
  const backupTypes = [
    { type: 'never', probability: 0.7, frequency: 0 },
    { type: 'rare', probability: 0.2, frequency: 0.05 },
    { type: 'sometimes', probability: 0.08, frequency: 0.2 },
    { type: 'frequent', probability: 0.02, frequency: 0.5 }
  ];

  // Assign frequencies to each user
  users.forEach(user => {
    // Select user type
    const userType = selectWithProbability(
      userTypes.map(t => t.type),
      userTypes.map(t => t.probability)
    ) || 'occasional'; // Default if selection fails

    // Find the selected user type object
    const selectedType = userTypes.find(t => t.type === userType) || userTypes[2]; // Default to occasional

    // Select backup usage type
    const backupType = selectWithProbability(
      backupTypes.map(t => t.type),
      backupTypes.map(t => t.probability)
    ) || 'never'; // Default if selection fails

    // Find the selected backup type object
    const selectedBackupType = backupTypes.find(t => t.type === backupType) || backupTypes[0]; // Default to never

    // Store frequencies
    frequencies[user.externalUserId] = {
      type: userType,
      daysPerWeek: selectedType.daysPerWeek,
      attemptsPerDay: selectedType.attemptsPerDay,
      backupType: backupType,
      backupFrequency: selectedBackupType.frequency,
      // User-specific variation (±20%) for more realistic patterns
      personalMultiplier: 0.8 + (Math.random() * 0.4)
    };
  });

  return frequencies;
}

/**
 * Generate user login events
 */
async function generateUserLoginEvents(companyId, startDate, endDate, usageEvents, activityPattern) {
  const days = getDaysBetweenDates(startDate, endDate);

  // Admin user login frequency (2-4 times per week)
  const loginDaysPerWeek = 3;
  const totalWeeks = days.length / 7;
  const targetLoginDays = Math.round(totalWeeks * loginDaysPerWeek);

  // Select days based on activity pattern (prefer higher activity days)
  const daysByActivity = [...days].sort((a, b) => {
    const dateA = a.toISOString().split('T')[0];
    const dateB = b.toISOString().split('T')[0];
    return activityPattern[dateB] - activityPattern[dateA];
  });

  // Take top days by activity
  const loginDays = daysByActivity.slice(0, targetLoginDays);

  // Generate logins for each selected day
  for (const day of loginDays) {
    const dateStr = day.toISOString().split('T')[0];
    const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

    // 1-3 logins per day, scaled by activity level
    const loginCount = Math.max(1, Math.round(3 * dayActivity));

    for (let i = 0; i < loginCount; i++) {
      // Timestamps more concentrated during business hours
      const timestamp = getBusinessHourTimeOnDay(day);
      // 5% failure rate
      const success = Math.random() > 0.05;

      usageEvents.push({
        companyId,
        eventType: 'login',
        success,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getRandomUserAgent(),
        details: {
          email: 'test@test.com',
          company: 'Test Company'
        }
      });
    }
  }
}

/**
 * Generate TOTP setup events - spread consistently across time
 */
async function generateTOTPSetupEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents, activityPattern) {
  const days = getDaysBetweenDates(startDate, endDate);

  // Setup events are distributed across days, with more at the beginning
  // to simulate initial account creation followed by occasional new users

  // Calculate target number of initial setups (40% of users in first week)
  const initialSetupCount = Math.floor(testTOTPUsers.length * 0.4);
  const remainingSetupCount = testTOTPUsers.length - initialSetupCount;

  // Setup 40% of users in the first week
  const firstWeekDays = days.slice(0, 7);
  const initialDailySetups = Math.ceil(initialSetupCount / firstWeekDays.length);

  let userIndex = 0;

  // First week - concentrated setups
  for (const day of firstWeekDays) {
    const dateStr = day.toISOString().split('T')[0];
    const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

    // Scale setup count by day activity
    const setupCount = Math.max(1, Math.round(initialDailySetups * dayActivity));

    for (let i = 0; i < setupCount && userIndex < testTOTPUsers.length; i++) {
      const timestamp = getBusinessHourTimeOnDay(day);
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

  // Remaining weeks - gradual setups
  const remainingDays = days.slice(7);

  // Distribute remaining setups, weighted towards higher activity days
  if (userIndex < testTOTPUsers.length) {
    // Sort remaining days by activity
    const remainingDaysByActivity = [...remainingDays].sort((a, b) => {
      const dateA = a.toISOString().split('T')[0];
      const dateB = b.toISOString().split('T')[0];
      return (activityPattern[dateB] || 0) - (activityPattern[dateA] || 0);
    });

    // Select top activity days for setups
    const setupDaysCount = Math.min(remainingSetupCount * 1.2, remainingDaysByActivity.length);
    const setupDays = remainingDaysByActivity.slice(0, setupDaysCount);

    // Distribute users across setup days
    const usersPerDay = Math.ceil(remainingSetupCount / setupDays.length);

    for (const day of setupDays) {
      const dateStr = day.toISOString().split('T')[0];
      const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

      // Scale by activity
      const setupCount = Math.max(1, Math.round(usersPerDay * dayActivity));

      for (let i = 0; i < setupCount && userIndex < testTOTPUsers.length; i++) {
        const timestamp = getBusinessHourTimeOnDay(day);
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
}

/**
 * Generate TOTP validation events with consistent patterns
 */
async function generateTOTPValidationEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents,
  activityPattern, userDevicePreferences, userUsageFrequency) {
  const days = getDaysBetweenDates(startDate, endDate);

  // For each user, generate validation events based on their pattern
  for (const user of testTOTPUsers) {
    const userId = user.externalUserId;
    const frequency = userUsageFrequency[userId];
    const devicePrefs = userDevicePreferences[userId];

    if (!frequency || !devicePrefs) continue;

    // Calculate number of login days for this user
    const targetDaysCount = Math.round(days.length * (frequency.daysPerWeek / 7) * frequency.personalMultiplier);

    // Select login days based on activity pattern (prefer higher activity days)
    const sortedDays = [...days].sort((a, b) => {
      const dateA = a.toISOString().split('T')[0];
      const dateB = b.toISOString().split('T')[0];
      return (activityPattern[dateB] || 0) - (activityPattern[dateA] || 0);
    });

    // Take top days by activity, biased by user's pattern
    const loginDays = sortedDays.slice(0, targetDaysCount);

    // For each login day, generate validation attempts
    for (const day of loginDays) {
      const dateStr = day.toISOString().split('T')[0];
      const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

      // Scale attempts by day activity and user pattern
      const baseAttempts = getRandomInt(
        frequency.attemptsPerDay.min,
        frequency.attemptsPerDay.max
      );

      const attemptCount = Math.max(1, Math.round(baseAttempts * dayActivity));

      for (let i = 0; i < attemptCount; i++) {
        // Determine which device is used for this login
        // Prefer primary device (70% chance)
        const usesPrimaryDevice = Math.random() < 0.7;
        
        // FIXED: Safer device type handling
        let deviceTypeToUse = 'desktop'; // Default to desktop
        
        if (usesPrimaryDevice && devicePrefs.primaryDevice) {
          deviceTypeToUse = devicePrefs.primaryDevice;
        } else if (devicePrefs.secondaryDevices && Object.keys(devicePrefs.secondaryDevices).length > 0) {
          const secondaryDeviceKeys = Object.keys(devicePrefs.secondaryDevices);
          if (secondaryDeviceKeys.length > 0) {
            deviceTypeToUse = secondaryDeviceKeys[Math.floor(Math.random() * secondaryDeviceKeys.length)];
          }
        }

        // Get consistent user agent, browser and OS for this user's device
        const userAgent = devicePrefs.userAgents[deviceTypeToUse] ||
          getDeviceSpecificUserAgent(deviceTypeToUse,
            devicePrefs.browsers[deviceTypeToUse],
            devicePrefs.operatingSystems[deviceTypeToUse]);

        // Calculate success rate (primary device has better success)
        const baseSuccessRate = usesPrimaryDevice ? 0.95 : 0.85;
        const success = Math.random() < baseSuccessRate;

        // Generate validation event
        const timestamp = getTimeOnDayForUser(day, userId);
        const ipAddress = getIPForUser(userId);

        // FIXED: Safe access to browser and OS
        const browser = devicePrefs.browsers && devicePrefs.browsers[deviceTypeToUse] ? 
                        devicePrefs.browsers[deviceTypeToUse] : 'Chrome';
        
        const os = devicePrefs.operatingSystems && devicePrefs.operatingSystems[deviceTypeToUse] ? 
                  devicePrefs.operatingSystems[deviceTypeToUse] : 
                  (deviceTypeToUse === 'mobile' || deviceTypeToUse === 'tablet' ? 'Android' : 'Windows');

        usageEvents.push({
          companyId,
          externalUserId: userId,
          eventType: 'totp_validation',
          success,
          timestamp,
          ipAddress,
          userAgent,
          details: {
            method: 'totp',
            deviceInfo: {
              // FIXED: Safe string methods
              type: deviceTypeToUse ? (deviceTypeToUse.charAt(0).toUpperCase() + deviceTypeToUse.slice(1)) : 'Unknown',
              os: os || 'Unknown',
              browser: browser || 'Unknown'
            }
          }
        });

        // If failed, maybe try again with higher success rate
        if (!success && Math.random() > 0.4) {
          const retryTimestamp = new Date(timestamp);
          retryTimestamp.setMinutes(timestamp.getMinutes() + getRandomInt(1, 5));

          usageEvents.push({
            companyId,
            externalUserId: userId,
            eventType: 'totp_validation',
            success: true, // 95% success on retry
            timestamp: retryTimestamp,
            ipAddress,
            userAgent,
            details: {
              method: 'totp',
              deviceInfo: {
                // FIXED: Safe string methods
                type: deviceTypeToUse ? (deviceTypeToUse.charAt(0).toUpperCase() + deviceTypeToUse.slice(1)) : 'Unknown',
                os: os || 'Unknown',
                browser: browser || 'Unknown'
              }
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
async function generateBackupCodeEvents(companyId, testTOTPUsers, startDate, endDate, usageEvents,
  activityPattern, userDevicePreferences, userUsageFrequency) {
  const days = getDaysBetweenDates(startDate, endDate);

  // Process each user based on their backup usage pattern
  for (const user of testTOTPUsers) {
    const userId = user.externalUserId;
    const frequency = userUsageFrequency[userId];
    const devicePrefs = userDevicePreferences[userId];

    if (!frequency || !devicePrefs) continue;

    // Skip users who never use backup codes
    if (frequency.backupType === 'never') continue;

    // Calculate backup usage days based on frequency and activity
    const loginDaysCount = Math.round(days.length * (frequency.daysPerWeek / 7) * frequency.personalMultiplier);
    const backupDaysCount = Math.round(loginDaysCount * frequency.backupFrequency);

    // No backup days for this user
    if (backupDaysCount === 0) continue;

    // Select backup days from highest activity days
    const sortedDays = [...days].sort((a, b) => {
      const dateA = a.toISOString().split('T')[0];
      const dateB = b.toISOString().split('T')[0];
      return (activityPattern[dateB] || 0) - (activityPattern[dateA] || 0);
    });

    const backupDays = sortedDays.slice(0, backupDaysCount);

    // Generate backup code usage for each selected day
    for (const day of backupDays) {
      // Determine which device to use - more often use secondary devices for backup codes
      const usesPrimaryDevice = Math.random() < 0.3; // Only 30% on primary device
      
      // FIXED: Safer device type handling
      let deviceTypeToUse = 'desktop'; // Default to desktop
      
      if (usesPrimaryDevice && devicePrefs.primaryDevice) {
        deviceTypeToUse = devicePrefs.primaryDevice;
      } else if (devicePrefs.secondaryDevices && Object.keys(devicePrefs.secondaryDevices).length > 0) {
        const secondaryDeviceKeys = Object.keys(devicePrefs.secondaryDevices);
        if (secondaryDeviceKeys.length > 0) {
          deviceTypeToUse = secondaryDeviceKeys[Math.floor(Math.random() * secondaryDeviceKeys.length)];
        }
      }

      // FIXED: Safe access to browser and OS
      const browser = devicePrefs.browsers && devicePrefs.browsers[deviceTypeToUse] ? 
                      devicePrefs.browsers[deviceTypeToUse] : 'Chrome';
      
      const os = devicePrefs.operatingSystems && devicePrefs.operatingSystems[deviceTypeToUse] ? 
                devicePrefs.operatingSystems[deviceTypeToUse] : 
                (deviceTypeToUse === 'mobile' || deviceTypeToUse === 'tablet' ? 'Android' : 'Windows');

      // Get consistent user agent, browser and OS
      const userAgent = devicePrefs.userAgents[deviceTypeToUse] ||
        getDeviceSpecificUserAgent(deviceTypeToUse, browser, os);

      const timestamp = getTimeOnDayForUser(day, userId);
      const ipAddress = getIPForUser(userId);
      const success = Math.random() > 0.05; // 5% failure rate

      usageEvents.push({
        companyId,
        externalUserId: userId,
        eventType: 'backup_code_used',
        success,
        timestamp,
        ipAddress,
        userAgent,
        details: {
          backupCodeIndex: getRandomInt(0, 7),
          deviceInfo: {
            // FIXED: Safe string methods
            type: deviceTypeToUse ? (deviceTypeToUse.charAt(0).toUpperCase() + deviceTypeToUse.slice(1)) : 'Unknown',
            os: os || 'Unknown',
            browser: browser || 'Unknown'
          }
        }
      });
    }
  }
}
/**
 * Generate API usage events with consistent pattern
 */
async function generateAPIUsageEvents(companyId, startDate, endDate, usageEvents, activityPattern) {
  const days = getDaysBetweenDates(startDate, endDate);

  // Create a baseline of daily API calls that scales with activity
  for (const day of days) {
    const dateStr = day.toISOString().split('T')[0];
    const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

    // Base API usage (5-15 calls per day)
    const baseAPIUsage = 5;
    const maxAdditionalUsage = 10;

    // Scale API usage with activity
    const apiUsageCount = Math.round(baseAPIUsage + (maxAdditionalUsage * dayActivity));

    // Generate API calls throughout the day, concentrated in business hours
    for (let i = 0; i < apiUsageCount; i++) {
      const timestamp = getBusinessHourTimeOnDay(day);

      // API calls are very reliable (98% success rate)
      const success = Math.random() > 0.02;

      // Distribution of API endpoints
      const endpoint = getWeightedAPIEndpoint(dayActivity);
      const method = getAPIMethodForEndpoint(endpoint);

      usageEvents.push({
        companyId,
        eventType: 'api_key_generated',
        success,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: 'API Client/1.0',
        details: {
          endpoint,
          method
        }
      });
    }
  }
}

/**
 * Generate analytics access events with weekly pattern
 */
async function generateAnalyticsAccessEvents(companyId, startDate, endDate, usageEvents, activityPattern) {
  const days = getDaysBetweenDates(startDate, endDate);

  // Analytics is typically accessed weekly or bi-weekly
  // Most common on Mondays (start of week reports)

  // Group days by week
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Analytics types with probabilities
  const analyticsTypes = [
    { type: 'company_stats', probability: 0.9 },        // Most common
    { type: 'totp_stats', probability: 0.7 },           // Very common
    { type: 'failure_analytics', probability: 0.5 },    // Somewhat common
    { type: 'device_breakdown', probability: 0.6 },     // Common
    { type: 'backup_code_usage', probability: 0.4 },    // Less common
    { type: 'suspicious_activity', probability: 0.3 },  // Rare
    { type: 'time_comparisons', probability: 0.2 }      // Very rare
  ];

  // For each week, generate analytics accesses
  for (const week of weeks) {
    // Select 1-2 days per week for analytics access
    const accessDaysCount = Math.random() < 0.3 ? 2 : 1;

    // Prefer Mondays (index 1) and Thursdays (index 4)
    const preferredDays = week.filter((day) => [1, 4].includes(day.getDay()));

    // If no preferred days in this week, take any weekday
    const candidateDays = preferredDays.length > 0 ? preferredDays :
      week.filter(day => day.getDay() !== 0 && day.getDay() !== 6);

    if (candidateDays.length === 0) continue;

    // Take top days by activity
    const analyticsDays = candidateDays
      .sort((a, b) => {
        const dateA = a.toISOString().split('T')[0];
        const dateB = b.toISOString().split('T')[0];
        return (activityPattern[dateB] || 0) - (activityPattern[dateA] || 0);
      })
      .slice(0, accessDaysCount);

    // For each analytics day, access several reports
    for (const day of analyticsDays) {
      const dateStr = day.toISOString().split('T')[0];
      const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

      // Access different analytics types based on probabilities
      for (const analytics of analyticsTypes) {
        if (Math.random() < analytics.probability * dayActivity) {
          const timestamp = getBusinessHourTimeOnDay(day);

          // Period preferences (30 days most common)
          const periodOptions = [
            { period: 7, probability: 0.2 },
            { period: 30, probability: 0.6 },
            { period: 90, probability: 0.2 }
          ];

          const period = selectWithProbability(
            periodOptions.map(p => p.period),
            periodOptions.map(p => p.probability)
          ) || 30; // Default to 30 days

          usageEvents.push({
            companyId,
            eventType: 'analytics_access',
            success: true,
            timestamp,
            ipAddress: getRandomIP(),
            userAgent: getRandomUserAgent(),
            details: {
              type: analytics.type,
              period
            }
          });
        }
      }
    }
  }
}

/**
 * Generate rate limit exceeded events tied to activity level
 */
async function generateRateLimitEvents(companyId, startDate, endDate, usageEvents, activityPattern) {
  const days = getDaysBetweenDates(startDate, endDate);

  // Rate limit events are more common on high activity days
  // Sort days by activity level
  const sortedDays = [...days].sort((a, b) => {
    const dateA = a.toISOString().split('T')[0];
    const dateB = b.toISOString().split('T')[0];
    return (activityPattern[dateB] || 0) - (activityPattern[dateA] || 0);
  });

  // Take top 15% of days for rate limit events
  const rateLimitDays = sortedDays.slice(0, Math.ceil(days.length * 0.15));

  // Define failure types with stable distribution
  const failureReasons = [
    { reason: 'invalidToken', probability: 0.5 },    // Most common
    { reason: 'expiredToken', probability: 0.3 },    // Common
    { reason: 'rateLimited', probability: 0.15 },    // Less common
    { reason: 'other', probability: 0.05 }           // Rare
  ];

  // Generate 1-3 rate limit events per selected day
  for (const day of rateLimitDays) {
    const dateStr = day.toISOString().split('T')[0];
    const dayActivity = activityPattern[dateStr] || 0.5; // Default if undefined

    // More rate limits on higher activity days
    const eventCount = Math.ceil(3 * dayActivity);

    for (let i = 0; i < eventCount; i++) {
      const timestamp = getBusinessHourTimeOnDay(day);

      // Select failure reason based on distribution
      const reason = selectWithProbability(
        failureReasons.map(f => f.reason),
        failureReasons.map(f => f.probability)
      ) || 'other'; // Default if selection fails

      // Generate device type - more often mobile for rate limits
      const deviceType = Math.random() < 0.6 ? 'mobile' :
        (Math.random() < 0.7 ? 'desktop' : 'tablet');

      const browser = getBrowserForDeviceType(deviceType);
      const os = getOSForDeviceType(deviceType);

      usageEvents.push({
        companyId,
        eventType: 'rate_limit_exceeded',
        success: false,
        timestamp,
        ipAddress: getRandomIP(),
        userAgent: getDeviceSpecificUserAgent(deviceType, browser, os),
        details: {
          endpoint: getWeightedAPIEndpoint(dayActivity),
          method: getRandomAPIMethod(),
          reason: reason,
          deviceInfo: {
            // FIXED: Safe string methods
            type: deviceType ? (deviceType.charAt(0).toUpperCase() + deviceType.slice(1)) : 'Unknown',
            os: os || 'Unknown',
            browser: browser || 'Unknown'
          }
        }
      });
    }
  }
}

/**
 * ENHANCED HELPER FUNCTIONS
 */

/**
 * Get a time during business hours on a specific day
 */
function getBusinessHourTimeOnDay(day) {
  if (!day) return new Date(); // Default to current time if day is undefined
  
  const result = new Date(day);
  // Business hours: 9am-5pm with bell curve distribution
  const hour = 9 + Math.floor(normRand() * 8);
  result.setHours(hour);
  result.setMinutes(getRandomInt(0, 59));
  result.setSeconds(getRandomInt(0, 59));
  return result;
}

/**
 * Generate a normally distributed random number (approx)
 * Returns value between 0-1 with bell curve
 */
function normRand() {
  // Box-Muller transform for normal distribution
  const u = 1 - Math.random(); // Convert [0,1) to (0,1]
  const v = 1 - Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

  // Convert to range 0-1 (from normal distribution with mean 0.5, stddev 0.15)
  const scaled = 0.5 + 0.15 * z;

  // Clamp to 0-1
  return Math.max(0, Math.min(1, scaled));
}

/**
 * Get time on day with user-specific pattern
 */
function getTimeOnDayForUser(day, userId) {
  if (!day) return new Date(); // Default to current time if day is undefined
  
  const result = new Date(day);

  // Create user-specific time pattern
  // Use userId to generate consistent pattern
  const hash = hashString(userId || '');

  // Determine if user is morning, afternoon, or evening person
  const timePreference = hash % 3; // 0: morning, 1: afternoon, 2: evening

  let hour;
  if (timePreference === 0) {
    // Morning person: 7am-11am
    hour = 7 + Math.floor(normRand() * 4);
  } else if (timePreference === 1) {
    // Afternoon person: 12pm-5pm
    hour = 12 + Math.floor(normRand() * 5);
  } else {
    // Evening person: 6pm-11pm
    hour = 18 + Math.floor(normRand() * 5);
  }

  result.setHours(hour);

  // Minutes also follow user pattern
  const minuteBase = (hash % 4) * 15; // 0, 15, 30, or 45 minute base
  const minuteVariation = getRandomInt(0, 14); // Add 0-14 minutes of variation
  result.setMinutes(minuteBase + minuteVariation);

  result.setSeconds(getRandomInt(0, 59));
  return result;
}

/**
 * Get consistent IP for a user
 */
function getIPForUser(userId) {
  // Generate user-specific IPs
  const hash = hashString(userId || '');

  // Generate base IP segments
  const segment1 = 1 + (hash % 254);
  const segment2 = (hash % 251) + 1;
  const segment3 = ((hash * 17) % 251) + 1;

  // Generate variable last segment with 90% chance of being the same
  const baseSegment4 = ((hash * 31) % 251) + 1;
  const segment4 = Math.random() < 0.9 ? baseSegment4 : getRandomInt(1, 254);

  return `${segment1}.${segment2}.${segment3}.${segment4}`;
}

/**
 * Simple string hash function
 */
function hashString(str) {
  if (!str) return 0; // Return 0 for empty strings
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

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
  if (!day) return new Date(); // Default to current time if day is undefined
  
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
  min = min || 0; // Default min to 0
  max = max || 100; // Default max to 100
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
 * Get device specific user agent
 * Enhanced to take specific browser and OS with safety checks
 */
function getDeviceSpecificUserAgent(deviceType, browser, os) {
  // FIXED: Default values for undefined parameters
  deviceType = deviceType || 'desktop';
  browser = browser || getBrowserForDeviceType(deviceType);
  os = os || getOSForDeviceType(deviceType);

  if (deviceType === 'mobile') {
    if (os === 'iOS') {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    } else { // Android
      return 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
    }
  } else if (deviceType === 'tablet') {
    if (os === 'iOS') {
      return 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    } else { // Android
      return 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36';
    }
  } else { // desktop
    if (os === 'Windows') {
      if (browser === 'Chrome') {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      } else if (browser === 'Firefox') {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      } else if (browser === 'Edge') {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
      }
    } else if (os === 'macOS') {
      if (browser === 'Safari') {
        return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      } else if (browser === 'Chrome') {
        return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';
      } else if (browser === 'Firefox') {
        return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/89.0';
      }
    }
  }

  // Default fallback
  return getRandomUserAgent();
}

/**
 * Get OS for device type
 */
function getOSForDeviceType(deviceType) {
  if (!deviceType) return 'Windows'; // Default to Windows if deviceType is undefined
  
  if (deviceType === 'mobile') {
    return Math.random() < 0.6 ? 'iOS' : 'Android';
  } else if (deviceType === 'tablet') {
    return Math.random() < 0.5 ? 'iOS' : 'Android';
  } else { // desktop
    return Math.random() < 0.7 ? 'Windows' : 'macOS';
  }
}

/**
 * Get browser for device type
 */
function getBrowserForDeviceType(deviceType) {
  if (!deviceType) return 'Chrome'; // Default to Chrome if deviceType is undefined
  
  if (deviceType === 'mobile' || deviceType === 'tablet') {
    const os = getOSForDeviceType(deviceType);
    if (os === 'iOS') {
      return Math.random() < 0.8 ? 'Safari' : 'Chrome';
    } else {
      return Math.random() < 0.8 ? 'Chrome' : 'Firefox';
    }
  } else { // desktop
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const weights = [0.6, 0.2, 0.1, 0.1];
    return selectWithProbability(browsers, weights) || 'Chrome'; // Default to Chrome if selection fails
  }
}

/**
 * Get weighted API endpoint based on activity
 */
function getWeightedAPIEndpoint(activityLevel) {
  // Default activityLevel to 0.5 if undefined
  activityLevel = activityLevel || 0.5;
  
  // Define endpoints with their base probabilities
  const endpoints = [
    { endpoint: '/api/totp-secrets/validate', probability: 0.4 },
    { endpoint: '/api/analytics/business', probability: 0.15 },
    { endpoint: '/api/analytics/totp', probability: 0.15 },
    { endpoint: '/api/analytics/failures', probability: 0.1 },
    { endpoint: '/api/analytics/devices', probability: 0.1 },
    { endpoint: '/api/business/profile', probability: 0.05 },
    { endpoint: '/api/business/apikey', probability: 0.05 }
  ];

  // Adjust probabilities based on activity level
  // Higher activity days have more validation calls
  const adjustedProbabilities = endpoints.map(e => {
    if (e.endpoint === '/api/totp-secrets/validate') {
      // Increase validation calls on high activity days
      return e.probability * (1 + activityLevel * 0.5);
    } else if (e.endpoint.includes('/api/analytics/')) {
      // Slightly decrease analytics calls on high activity days
      return e.probability * (1 - activityLevel * 0.2);
    }
    return e.probability;
  });

  // Normalize probabilities
  const sum = adjustedProbabilities.reduce((a, b) => a + b, 0);
  const normalizedProbabilities = adjustedProbabilities.map(p => p / sum);

  // Select endpoint based on adjusted probabilities
  const selected = selectWithProbability(
    endpoints.map(e => e.endpoint),
    normalizedProbabilities
  );
  
  // Default fallback
  return selected || '/api/totp-secrets/validate';
}

/**
 * Get appropriate API method for an endpoint
 */
function getAPIMethodForEndpoint(endpoint) {
  if (!endpoint) return 'GET'; // Default to GET if endpoint is undefined
  
  // Define common methods for each endpoint
  const endpointMethods = {
    '/api/totp-secrets/validate': 'POST',
    '/api/analytics/business': 'GET',
    '/api/analytics/totp': 'GET',
    '/api/analytics/failures': 'GET',
    '/api/analytics/devices': 'GET',
    '/api/business/profile': 'GET',
    '/api/business/apikey': Math.random() < 0.8 ? 'GET' : 'POST'
  };

  return endpointMethods[endpoint] || getRandomAPIMethod();
}

/**
 * Get random API method
 */
function getRandomAPIMethod() {
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const weights = [0.6, 0.3, 0.05, 0.05];

  return selectWithProbability(methods, weights) || 'GET'; // Default to GET if selection fails
}

/**
 * Select an item from an array based on probability weights
 * Enhanced with safety checks
 */
function selectWithProbability(items, weights) {
  // Safety checks
  if (!items || !Array.isArray(items) || items.length === 0) {
    return undefined;
  }
  
  if (!weights || !Array.isArray(weights) || weights.length === 0) {
    // If no valid weights, select randomly
    return items[Math.floor(Math.random() * items.length)];
  }
  
  // Make sure weights array is the same length as items array
  if (weights.length !== items.length) {
    // Truncate or extend weights array to match items length
    if (weights.length > items.length) {
      weights = weights.slice(0, items.length);
    } else {
      // Fill with equal weights for missing elements
      const defaultWeight = 1 / items.length;
      while (weights.length < items.length) {
        weights.push(defaultWeight);
      }
    }
  }

  // Normalize weights if they don't sum to 1
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    // If all weights are zero, use equal probability
    weights = weights.map(() => 1 / items.length);
  } else {
    // Otherwise normalize to sum to 1
    weights = weights.map(w => w / sum);
  }

  // Create cumulative distribution
  const cumulativeWeights = [];
  let cumulativeWeight = 0;

  for (const weight of weights) {
    cumulativeWeight += weight;
    cumulativeWeights.push(cumulativeWeight);
  }

  // Get a random number between 0 and 1
  const randomValue = Math.random();

  // Find the index where randomValue falls
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (randomValue <= cumulativeWeights[i]) {
      return items[i];
    }
  }

  // Fallback (should rarely happen due to floating point precision)
  return items[items.length - 1];
}

/**
 * Get random subset of array
 * Enhanced with safety checks
 */
function getRandomSubset(array, count) {
  // Safety checks
  if (!array || !Array.isArray(array) || array.length === 0) {
    return [];
  }
  
  // Ensure count is valid
  count = Math.max(0, Math.min(array.length, count || 0));
  
  if (count === 0) return [];
  if (count === array.length) return [...array];
  
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Get random item from array
 * Enhanced with safety checks
 */
function getRandomItem(array) {
  // Safety checks
  if (!array || !Array.isArray(array) || array.length === 0) {
    return undefined;
  }
  
  return array[Math.floor(Math.random() * array.length)];
}