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
  console.error('Please make sure you have a .env file with MONGO_URI defined.');
  process.exit(1);
}

// Connect to MongoDB
console.log(`Attempting to connect to MongoDB using URI: ${process.env.MONGO_URI.replace(/:\/\/(.*?)@/, '://*****:*****@')}`);

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    logger.info('Connected to MongoDB');

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
 * Clear existing test data
 */
async function clearExistingTestData() {
  // Find test users by their email pattern
  const testUsers = await User.find({ 
    email: { 
      $regex: /^test\.(petbarn|techinnovations|globalfinance)@fortikey\.com$/i 
    } 
  });

  // If test users exist, delete their associated data
  if (testUsers.length > 0) {
    const userIds = testUsers.map(user => user._id);

    // Delete associated TOTP secrets
    await TOTPSecret.deleteMany({ companyId: { $in: userIds } });
    logger.info('Deleted TOTP secrets for test users');

    // Delete associated usage data
    await Usage.deleteMany({ companyId: { $in: userIds } });
    logger.info('Deleted usage data for test users');

    // Delete the test users
    await User.deleteMany({ _id: { $in: userIds } });
    logger.info('Deleted test users');
  }
}

/**
 * Create test users
 */
async function createTestUsers() {
  const testUsers = [
    {
      company: 'PetBarn',
      firstName: 'Sarah',
      lastName: 'Miller',
      email: 'test.petbarn@fortikey.com',
      password: 'password123',
      role: 'user'
    },
    {
      company: 'Tech Innovations',
      firstName: 'Michael',
      lastName: 'Johnson',
      email: 'test.techinnovations@fortikey.com',
      password: 'password123',
      role: 'user'
    },
    {
      company: 'Global Finance',
      firstName: 'Emily',
      lastName: 'Rodriguez',
      email: 'test.globalfinance@fortikey.com',
      password: 'password123',
      role: 'user'
    }
  ];

  // Save users and generate API keys
  const savedUsers = await Promise.all(
    testUsers.map(async (userData) => {
      const user = new User({
        ...userData,
        apikey: require('crypto').randomBytes(32).toString('hex')
      });

      const savedUser = await user.save();
      console.log('Created test user:', savedUser.toObject());

      // Convert to plain object with explicit properties
      return {
        _id: savedUser._id,
        company: String(savedUser.company),
        firstName: String(savedUser.firstName),
        lastName: String(savedUser.lastName),
        email: String(savedUser.email),
        role: String(savedUser.role),
        apikey: String(savedUser.apikey),
        createdAt: savedUser.createdAt
      };
    })
  );

  // Additional logging to verify user objects
  console.log('Saved Users:', JSON.stringify(savedUsers, null, 2));

  return savedUsers;
}

/**
 * Create test TOTP users
 * @param {mongoose.Types.ObjectId} companyId - ID of the company/user
 * @param {number} count - Number of TOTP users to create
 * @param {string} [parentCompanyName] - Optional parent company name
 */
async function createTestTOTPUsers(companyId, count, parentCompanyName) {
  const users = [];
  
  // Define company domains for distributing users across companies
  const companies = [
    { name: 'FortiKey Security', domains: ['fortikey.com', 'fortikey.io'] },
    { name: 'Acme Corp', domains: ['acme.com', 'acmecorp.org'] },
    { name: 'Tech Innovations', domains: ['techinnovations.io', 'tech-innovations.com'] },
    { name: 'Global Finance', domains: ['globalfinance.com', 'gfin.org'] },
    { name: 'Healthcare Systems', domains: ['healthsys.org', 'healthcare-systems.com'] }
  ];

  // First names for generating realistic user identities
  const firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 
    'William', 'Elizabeth', 'David', 'Susan', 'Richard', 'Jessica', 'Joseph', 'Sarah'
  ];
  
  // Last names for generating realistic user identities
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
    'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'Keen', 'Harris', 'Martin'
  ];

  // Determine the final company name
  const effectiveCompanyName = parentCompanyName || 'Unknown Company';

  console.log('Creating TOTP Users:');
  console.log('- Company ID:', companyId);
  console.log('- User Count:', count);
  console.log('- Parent Company Name:', parentCompanyName);
  console.log('- Effective Company Name:', effectiveCompanyName);

  for (let i = 0; i < count; i++) {
    // Generate random values
    const company = companies[i % companies.length];
    const domain = company.domains[Math.floor(Math.random() * company.domains.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Create email with a unique timestamp to prevent collisions
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Date.now()}.${i}@${domain}`;
    
    const externalUserId = email;
    
    // Generate TOTP secret
    const { secret } = generateTOTPSecret(effectiveCompanyName, externalUserId);

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    // Record creation date with some variation
    const createdAt = new Date();
    // Offset by up to 60 days in the past
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 60));

    const metadata = {
      name: `${firstName} ${lastName}`,
      company: effectiveCompanyName,
      validated: Math.random() > 0.1, // 90% are validated
    };

    const totpSecret = new TOTPSecret({
      secret,
      backupCodes,
      externalUserId,
      companyId,
      createdAt,
      metadata // Save additional metadata
    });

    const savedSecret = await totpSecret.save();
    users.push({ 
      externalUserId, 
      _id: savedSecret._id,
      company: effectiveCompanyName,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      validated: metadata.validated
    });
  }

  console.log(`Created ${users.length} TOTP Users`);
  return users;
}

/**
 * Generate simple analytics data
 */
async function generateAnalyticsData(companyId, testTOTPUsers, userData = {}) {
    try {
      console.log('=== Generating Realistic 30-Day Analytics Data ===');
      console.log('Company ID:', companyId);
      console.log('TOTP Users Count:', testTOTPUsers.length);
      console.log('User Data:', JSON.stringify(userData, null, 2));
  
      const usageEvents = [];
      
      // Calculate dates for the past 30 days exactly
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      // Create company-specific patterns based on company name
      const companyName = userData.company || 'Unknown Company';
      
      // Define more realistic company traits with natural variation
      const companyTraits = {
        'PetBarn': {
          // Retail business pattern
          activeUsers: 25,          // Active users per month (out of 100)
          authsPerActiveUser: 12,   // Average auths per active user
          authDistribution: {       // Distribution of auths through the week
            weekday: 0.7,           // 70% on weekdays
            weekend: 0.3            // 30% on weekends
          },
          dayPartDistribution: {    // Time of day distribution
            morning: 0.2,           // 8am-12pm
            afternoon: 0.5,         // 12pm-5pm
            evening: 0.25,          // 5pm-9pm
            night: 0.05             // 9pm-8am
          },
          deviceDistribution: {     // Device type distribution
            desktop: 0.6,
            mobile: 0.35,
            tablet: 0.05
          },
          browserDistribution: {    // Browser preferences
            'Chrome': 0.55,
            'Safari': 0.25,
            'Firefox': 0.1,
            'Edge': 0.1
          },
          failureRate: 0.07,        // 7% failure rate
          apiUsage: 15,             // API calls per month
          analyticsUsage: 8         // Analytics views per month
        },
        'Tech Innovations': {
          // Tech company pattern
          activeUsers: 35,          // Higher active user count
          authsPerActiveUser: 18,   // Tech users authenticate more
          authDistribution: {
            weekday: 0.85,          // Heavy weekday usage
            weekend: 0.15           // Some weekend work
          },
          dayPartDistribution: {
            morning: 0.15,          // Tech people start later
            afternoon: 0.45,
            evening: 0.3,           // More evening work
            night: 0.1              // Some late night coding
          },
          deviceDistribution: {
            desktop: 0.7,           // More desktop use (developers)
            mobile: 0.2,
            tablet: 0.1
          },
          browserDistribution: {
            'Chrome': 0.4,
            'Firefox': 0.35,        // Developers love Firefox
            'Edge': 0.15,
            'Safari': 0.1
          },
          failureRate: 0.05,        // Tech-savvy users have fewer failures
          apiUsage: 45,             // Heavy API usage
          analyticsUsage: 12        // Moderate analytics usage
        },
        'Global Finance': {
          // Financial institution pattern
          activeUsers: 45,          // High active user count
          authsPerActiveUser: 22,   // Frequent authentication (security)
          authDistribution: {
            weekday: 0.95,          // Almost exclusively weekday
            weekend: 0.05           // Minimal weekend activity
          },
          dayPartDistribution: {
            morning: 0.3,           // Early starts
            afternoon: 0.5,
            evening: 0.15,
            night: 0.05
          },
          deviceDistribution: {
            desktop: 0.8,           // Mostly desktop (corporate policy)
            mobile: 0.15,
            tablet: 0.05
          },
          browserDistribution: {
            'Chrome': 0.35,
            'Edge': 0.4,            // Corporate Edge usage
            'Firefox': 0.15,
            'Safari': 0.1
          },
          failureRate: 0.12,        // Higher failure rate (security policies)
          apiUsage: 25,             // Moderate API usage
          analyticsUsage: 30        // Heavy analytics usage (data-driven)
        }
      };
      
      // Use default traits if company not found
      const traits = companyTraits[companyName] || {
        activeUsers: 20,
        authsPerActiveUser: 10,
        authDistribution: { weekday: 0.8, weekend: 0.2 },
        dayPartDistribution: { morning: 0.25, afternoon: 0.45, evening: 0.25, night: 0.05 },
        deviceDistribution: { desktop: 0.65, mobile: 0.3, tablet: 0.05 },
        browserDistribution: { 'Chrome': 0.6, 'Firefox': 0.2, 'Safari': 0.15, 'Edge': 0.05 },
        failureRate: 0.08,
        apiUsage: 20,
        analyticsUsage: 10
      };
      
      // Create realistic user engagement patterns
      // Some users are daily active, some weekly, some occasional
      const userEngagementPattern = {};
      
      testTOTPUsers.forEach((user, index) => {
        // Determine engagement pattern for this user
        const randomFactor = Math.random();
        let category;
        
        if (randomFactor < 0.15) {
          category = 'daily'; // 15% are daily users
        } else if (randomFactor < 0.45) {
          category = 'regular'; // 30% are regular users (several times a week)
        } else if (randomFactor < 0.75) {
          category = 'occasional'; // 30% are occasional users (once a week or less)
        } else {
          category = 'rare'; // 25% are rare users (once or twice a month)
        }
        
        // User engagement multiplier depends on category
        const engagementMultiplier = 
          category === 'daily' ? 2.5 + Math.random() * 0.5 :
          category === 'regular' ? 1.2 + Math.random() * 0.6 :
          category === 'occasional' ? 0.5 + Math.random() * 0.4 :
          0.1 + Math.random() * 0.2; // rare
        
        // Determine device preference with some natural stickiness
        // Most users strongly prefer one device type
        const primaryDeviceRoll = Math.random();
        let primaryDevice;
        
        if (primaryDeviceRoll < traits.deviceDistribution.desktop) {
          primaryDevice = 'Desktop';
        } else if (primaryDeviceRoll < traits.deviceDistribution.desktop + traits.deviceDistribution.mobile) {
          primaryDevice = 'Mobile';
        } else {
          primaryDevice = 'Tablet';
        }
        
        // Most users strongly prefer one browser type
        const preferredBrowser = selectWeighted(traits.browserDistribution);
        
        // Store user's engagement pattern
        userEngagementPattern[user.externalUserId] = {
          category,
          engagementMultiplier,
          primaryDevice,
          deviceLoyalty: 0.8 + Math.random() * 0.15, // 80-95% of time on primary device
          preferredBrowser,
          browserLoyalty: 0.75 + Math.random() * 0.2, // 75-95% of time on preferred browser
          failureRate: traits.failureRate * (0.5 + Math.random() * 1.5), // Individual failure rates
          usesBackupCodes: Math.random() < 0.15, // Only 15% of users ever use backup codes
          hasRecentFailure: Math.random() < 0.3 // 30% of users had a recent auth failure
        };
      });
      
      // Generate recurring usage patterns (many users authenticate at similar times each day/week)
      const activeDays = Math.min(Math.round(traits.activeUsers / testTOTPUsers.length * 30), 30);
      const activeUsers = testTOTPUsers.slice(0, traits.activeUsers % testTOTPUsers.length);
      
      // 1. Generate user login patterns with natural clustering
      for (const user of activeUsers) {
        const pattern = userEngagementPattern[user.externalUserId];
        if (!pattern) continue;
        
        // Determine how many days this user will authenticate
        let userActiveDays;
        
        if (pattern.category === 'daily') {
          userActiveDays = 20 + Math.floor(Math.random() * 10); // 20-29 days
        } else if (pattern.category === 'regular') {
          userActiveDays = 8 + Math.floor(Math.random() * 12); // 8-19 days
        } else if (pattern.category === 'occasional') {
          userActiveDays = 3 + Math.floor(Math.random() * 5); // 3-7 days
        } else {
          userActiveDays = 1 + Math.floor(Math.random() * 2); // 1-2 days
        }
        
        // Get actual auth count for this user
        const authCount = Math.max(1, Math.round(traits.authsPerActiveUser * pattern.engagementMultiplier));
        
        // Distribute authentication across active days
        const authsPerDay = {};
        const activeDaysList = [];
        
        // First, choose the active days for this user
        for (let i = 0; i < userActiveDays; i++) {
          let day;
          let attempts = 0;
          let isValid = false;
          
          // Generate days with appropriate weekday/weekend distribution
          while (!isValid && attempts < 10) {
            attempts++;
            const dayOffset = Math.floor(Math.random() * 30);
            const potentialDay = new Date(startDate);
            potentialDay.setDate(startDate.getDate() + dayOffset);
            
            // Check if it's a weekday or weekend
            const isWeekend = potentialDay.getDay() === 0 || potentialDay.getDay() === 6;
            
            // Apply weekday/weekend distribution
            if ((isWeekend && Math.random() < traits.authDistribution.weekend) || 
                (!isWeekend && Math.random() < traits.authDistribution.weekday)) {
              
              // Format as YYYY-MM-DD for easier comparison
              day = potentialDay.toISOString().split('T')[0];
              isValid = true;
            }
          }
          
          if (isValid && day) {
            activeDaysList.push(day);
            authsPerDay[day] = 0;
          }
        }
        
        // Ensure we have at least one active day
        if (activeDaysList.length === 0) {
          const dayOffset = Math.floor(Math.random() * 30);
          const day = new Date(startDate);
          day.setDate(startDate.getDate() + dayOffset);
          const dayStr = day.toISOString().split('T')[0];
          activeDaysList.push(dayStr);
          authsPerDay[dayStr] = 0;
        }
        
        // Now distribute auth events across active days
        // Some users authenticate multiple times per day
        for (let i = 0; i < authCount; i++) {
          const dayIndex = Math.floor(Math.random() * activeDaysList.length);
          const day = activeDaysList[dayIndex];
          authsPerDay[day] = (authsPerDay[day] || 0) + 1;
        }
        
        // For each active day, generate auth events
        for (const [day, count] of Object.entries(authsPerDay)) {
          for (let i = 0; i < count; i++) {
            // Create date object from day string and add hours/minutes
            const date = new Date(day);
            
            // Apply time of day distribution
            const timeRoll = Math.random();
            let hour;
            
            if (timeRoll < traits.dayPartDistribution.morning) {
              // Morning: 8am-12pm
              hour = 8 + Math.floor(Math.random() * 4);
            } else if (timeRoll < traits.dayPartDistribution.morning + traits.dayPartDistribution.afternoon) {
              // Afternoon: 12pm-5pm
              hour = 12 + Math.floor(Math.random() * 5);
            } else if (timeRoll < traits.dayPartDistribution.morning + traits.dayPartDistribution.afternoon + traits.dayPartDistribution.evening) {
              // Evening: 5pm-9pm
              hour = 17 + Math.floor(Math.random() * 4);
            } else {
              // Night: 9pm-8am
              hour = (21 + Math.floor(Math.random() * 11)) % 24;
            }
            
            date.setHours(hour);
            date.setMinutes(Math.floor(Math.random() * 60));
            date.setSeconds(Math.floor(Math.random() * 60));
            
            // Determine if this is a success or failure
            const isFailure = Math.random() < pattern.failureRate;
            
            // Determine if this uses a backup code
            const isBackupCode = pattern.usesBackupCodes && Math.random() < 0.2; // 20% chance for users who use backup codes
            
            // Determine device type based on user's preferences
            const usesPrimaryDevice = Math.random() < pattern.deviceLoyalty;
            const deviceType = usesPrimaryDevice ? pattern.primaryDevice : selectWeighted(traits.deviceDistribution);
            
            // Determine browser based on user's preferences
            const usesPrimaryBrowser = Math.random() < pattern.browserLoyalty;
            const browser = usesPrimaryBrowser ? pattern.preferredBrowser : selectWeighted(traits.browserDistribution);
            
            // Determine OS based on device
            const os = deviceType === 'Mobile' ? 
              (Math.random() < 0.6 ? 'iOS' : 'Android') :
              deviceType === 'Tablet' ?
              (Math.random() < 0.7 ? 'iOS' : 'Android') :
              (Math.random() < 0.7 ? 'Windows' : 'macOS');
            
            // Generate user agent
            const userAgent = generateUserAgent(deviceType, os, browser);
            
            // Add the authentication event
            usageEvents.push({
              companyId,
              externalUserId: user.externalUserId,
              eventType: isBackupCode ? 'backup_code_used' : 'totp_validation',
              success: !isFailure,
              timestamp: date,
              ipAddress: generateConsistentIP(user.externalUserId, 0.95),
              userAgent: userAgent,
              details: {
                method: isBackupCode ? 'backup_code' : 'totp',
                deviceInfo: {
                  type: deviceType,
                  os: os,
                  browser: browser
                },
                ...(isBackupCode ? { backupCodeIndex: Math.floor(Math.random() * 8) } : {})
              }
            });
            
            // If failed, often generate a successful retry shortly after (80% of failures are followed by success)
            if (isFailure && Math.random() < 0.8) {
              const retryDate = new Date(date);
              retryDate.setMinutes(date.getMinutes() + Math.floor(Math.random() * 2) + 1); // 1-2 minutes later
              
              usageEvents.push({
                companyId,
                externalUserId: user.externalUserId,
                eventType: isBackupCode ? 'backup_code_used' : 'totp_validation',
                success: true,
                timestamp: retryDate,
                ipAddress: generateConsistentIP(user.externalUserId, 0.99), // Same IP
                userAgent: userAgent,
                details: {
                  method: isBackupCode ? 'backup_code' : 'totp',
                  deviceInfo: {
                    type: deviceType,
                    os: os,
                    browser: browser
                  },
                  ...(isBackupCode ? { backupCodeIndex: Math.floor(Math.random() * 8) } : {})
                }
              });
            }
          }
        }
      }
      
      // 2. Generate TOTP setup events - clustered together for each user
      activeUsers.forEach((user, index) => {
        // Create setup date from 5-25 days ago for most users
        const setupDate = new Date();
        setupDate.setDate(setupDate.getDate() - (5 + Math.floor(Math.random() * 20)));
        
        const pattern = userEngagementPattern[user.externalUserId] || {
          primaryDevice: 'Desktop',
          preferredBrowser: 'Chrome'
        };
        
        // Generate TOTP setup event
        usageEvents.push({
          companyId,
          externalUserId: user.externalUserId,
          eventType: 'totp_setup',
          success: Math.random() < 0.95, // 95% success rate
          timestamp: setupDate,
          ipAddress: generateConsistentIP(user.externalUserId, 0.99),
          userAgent: generateUserAgent(
            pattern.primaryDevice, 
            pattern.primaryDevice === 'Desktop' ? 'Windows' : 'iOS',
            pattern.preferredBrowser
          ),
          details: {
            setupMethod: 'api',
            deviceInfo: {
              type: pattern.primaryDevice,
              os: pattern.primaryDevice === 'Desktop' ? 'Windows' : 'iOS',
              browser: pattern.preferredBrowser
            }
          }
        });
      });
      
      // 3. Generate admin login events - clustered on weekdays during business hours
      const loginCount = Math.round(15 * (traits.activeUsers / 30));
      
      for (let i = 0; i < loginCount; i++) {
        // Create date object
        const date = new Date();
        
        // Mostly on weekdays
        let day;
        let isWeekday = false;
        let attempts = 0;
        
        // Keep trying until we get a weekday or exceed max attempts
        while (!isWeekday && attempts < 10) {
          attempts++;
          day = new Date(startDate);
          day.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
          isWeekday = day.getDay() !== 0 && day.getDay() !== 6; // Not Saturday or Sunday
          
          // Break loop even if not weekday after 5 attempts
          if (attempts > 5) break;
        }
        
        // Set date to generated day
        date.setDate(day.getDate());
        date.setMonth(day.getMonth());
        date.setFullYear(day.getFullYear());
        
        // Mostly during business hours
        if (Math.random() < 0.9) {
          // Business hours: 9am-5pm
          date.setHours(9 + Math.floor(Math.random() * 8));
        } else {
          // Outside business hours
          date.setHours(Math.random() < 0.5 ? 
            (17 + Math.floor(Math.random() * 6)) : // Evening: 5pm-11pm
            (6 + Math.floor(Math.random() * 3))    // Early morning: 6am-9am
          );
        }
        
        date.setMinutes(Math.floor(Math.random() * 60));
        date.setSeconds(Math.floor(Math.random() * 60));
        
        // Admin typically uses desktop
        const deviceType = Math.random() < 0.9 ? 'Desktop' : 'Mobile';
        const browser = selectWeighted(traits.browserDistribution);
        const os = deviceType === 'Desktop' ? 
          (Math.random() < 0.8 ? 'Windows' : 'macOS') :
          (Math.random() < 0.6 ? 'iOS' : 'Android');
        
        usageEvents.push({
          companyId,
          eventType: 'login',
          success: Math.random() < 0.98, // 98% success
          timestamp: date,
          ipAddress: generateConsistentIP(userData.email, 0.95),
          userAgent: generateUserAgent(deviceType, os, browser),
          details: {
            email: userData.email,
            company: userData.company,
            firstName: userData.firstName,
            lastName: userData.lastName,
            deviceInfo: {
              type: deviceType,
              os: os,
              browser: browser
            }
          }
        });
      }
      
      // 4. Generate API usage events - match company's API usage profile
      const apiCount = traits.apiUsage;
      
      // API access tends to be automated and evenly distributed
      // Often occurs in batches
      
      // Create 2-4 batch periods with higher API usage
      const batchCount = 2 + Math.floor(Math.random() * 3);
      const batchDays = [];
      
      for (let i = 0; i < batchCount; i++) {
        const batchDay = new Date(startDate);
        batchDay.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
        batchDays.push(batchDay);
      }
      
      // API endpoints and methods with realistic distribution
      const apiEndpoints = [
        { endpoint: '/api/totp-secrets/validate', method: 'POST', weight: 0.6 },   // Most common
        { endpoint: '/api/analytics/business', method: 'GET', weight: 0.1 },
        { endpoint: '/api/analytics/totp', method: 'GET', weight: 0.1 },
        { endpoint: '/api/analytics/failures', method: 'GET', weight: 0.05 },
        { endpoint: '/api/analytics/devices', method: 'GET', weight: 0.05 },
        { endpoint: '/api/business/profile', method: 'GET', weight: 0.05 },
        { endpoint: '/api/business/apikey', method: 'POST', weight: 0.05 }
      ];
      
      for (let i = 0; i < apiCount; i++) {
        // Create date - either from a batch period or random
        const usesBatchPeriod = Math.random() < 0.7; // 70% of API calls in batch periods
        let date;
        
        if (usesBatchPeriod && batchDays.length > 0) {
          // Pick a random batch day
          const batchDay = batchDays[Math.floor(Math.random() * batchDays.length)];
          date = new Date(batchDay);
          
          // Add some hours/minutes variation but keep related calls close together
          date.setHours(date.getHours() + Math.floor(Math.random() * 4));
          date.setMinutes(date.getMinutes() + Math.floor(Math.random() * 30));
        } else {
          // Random day within the 30-day period
          date = new Date(startDate);
          date.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
          date.setHours(Math.floor(Math.random() * 24));
          date.setMinutes(Math.floor(Math.random() * 60));
        }
        
        const endpoint = selectWeightedObject(apiEndpoints);
        
        usageEvents.push({
          companyId,
          eventType: 'api_key_generated', // The eventType used for API calls in your model
          success: Math.random() < 0.985, // 98.5% success rate for API
          timestamp: date,
          ipAddress: generateConsistentIP(userData.email, 0.98), // Very consistent IP for API
          userAgent: 'API Client/1.0',
          details: {
            endpoint: endpoint.endpoint,
            method: endpoint.method
          }
        });
      }
      
      // 5. Generate analytics access events - concentrated on specific days of the week
      const analyticsCount = traits.analyticsUsage;
      
      // Analytics access is often part of a weekly routine
      // Find 1-2 preferred days of the week for analytics
      const preferredDays = [];
      while (preferredDays.length < 2) {
        const day = 1 + Math.floor(Math.random() * 5); // Monday=1 to Friday=5
        if (!preferredDays.includes(day)) {
          preferredDays.push(day);
        }
      }
      
      // Analytics types with weights - different profiles based on company
      const analyticsTypes = [
        { type: 'company_stats', weight: 0.3 },
        { type: 'totp_stats', weight: 0.25 },
        { type: 'failure_analytics', weight: companyName === 'Global Finance' ? 0.2 : 0.1 },
        { type: 'device_breakdown', weight: 0.15 },
        { type: 'backup_code_usage', weight: 0.05 },
        { type: 'suspicious_activity', weight: companyName === 'Global Finance' ? 0.15 : 0.05 },
        { type: 'time_comparisons', weight: 0.1 }
      ];
      
      for (let i = 0; i < analyticsCount; i++) {
        // Create date - biased toward preferred days
        const usePreferredDay = Math.random() < 0.7; // 70% on preferred days
        let date = new Date(startDate);
        
        // Add days to reach one of the days in the 30-day window
        if (usePreferredDay) {
          // Choose one of the preferred days
          const targetDay = preferredDays[Math.floor(Math.random() * preferredDays.length)];
          
          // Find instances of this day of week in our 30-day window
          const instances = [];
          for (let d = 0; d < 30; d++) {
            const testDate = new Date(startDate);
            testDate.setDate(startDate.getDate() + d);
            if (testDate.getDay() === targetDay) {
              instances.push(testDate);
            }
          }
          
          if (instances.length > 0) {
            // Choose one of the instances
            date = instances[Math.floor(Math.random() * instances.length)];
          }
        } else {
          // Random day
          date.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
        }
        
        // Business hours for analytics access
        date.setHours(9 + Math.floor(Math.random() * 8)); // 9am-5pm
        date.setMinutes(Math.floor(Math.random() * 60));
        
        const analyticsType = selectWeightedObject(analyticsTypes);
        const browser = selectWeighted(traits.browserDistribution);
        
        usageEvents.push({
          companyId,
          eventType: 'analytics_access',
          success: true,
          timestamp: date,
          ipAddress: generateConsistentIP(userData.email, 0.95),
          userAgent: generateUserAgent('Desktop', 'Windows', browser),
          details: {
            type: analyticsType.type,
            period: [7, 30, 30, 30, 90][Math.floor(Math.random() * 5)], // Mostly 30 days
            deviceInfo: {
              type: 'Desktop', // Analytics almost always on desktop
              os: Math.random() < 0.7 ? 'Windows' : 'macOS',
              browser: browser
            }
          }
        });
      }
      
      // Sort all events by timestamp before inserting
      usageEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Get counts of various event types for logging
      const authCount = usageEvents.filter(e => 
        e.eventType === 'totp_validation' || e.eventType === 'backup_code_used'
      ).length;
      const failedAuthCount = usageEvents.filter(e => 
        (e.eventType === 'totp_validation' || e.eventType === 'backup_code_used') && !e.success
      ).length;
      const backupCodeCount = usageEvents.filter(e => e.eventType === 'backup_code_used').length;
      
      // Batch insert all events
      if (usageEvents.length > 0) {
        await Usage.insertMany(usageEvents);
        console.log(`Inserted ${usageEvents.length} usage events`);
        
        // Log event type breakdown
        const eventCounts = {};
        usageEvents.forEach(event => {
          if (!eventCounts[event.eventType]) eventCounts[event.eventType] = 0;
          eventCounts[event.eventType]++;
        });
        console.log('Event breakdown:', eventCounts);
        
        // Log authentication stats
        console.log(`Authentication stats: ${authCount} total auth events, ${failedAuthCount} failures, ${backupCodeCount} backup codes used`);
        console.log(`Real-world failure rate: ${(failedAuthCount / authCount * 100).toFixed(2)}%`);
        
        // Log device and browser breakdown
        const deviceCounts = {};
        const browserCounts = {};
        
        usageEvents.forEach(event => {
          if (event.details?.deviceInfo?.type) {
            const deviceType = event.details.deviceInfo.type;
            deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
          }
          
          if (event.details?.deviceInfo?.browser) {
            const browser = event.details.deviceInfo.browser;
            browserCounts[browser] = (browserCounts[browser] || 0) + 1;
          }
        });
        
        console.log('Device usage:', deviceCounts);
        console.log('Browser usage:', browserCounts);
      }
      
      console.log('Realistic Analytics Data Generation Completed');
    } catch (error) {
      console.error('Error in generateAnalyticsData:', error);
      throw error;
    }
  }
  
  // Helper Functions
  
  /**
   * Select an item from a weighted distribution
   * @param {Object} weights - Object mapping items to weights
   * @returns {string} Selected item
   */
  function selectWeighted(weights) {
    const options = Object.keys(weights);
    const weightValues = options.map(key => weights[key]);
    
    const totalWeight = weightValues.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < options.length; i++) {
      random -= weightValues[i];
      if (random <= 0) {
        return options[i];
      }
    }
    
    return options[0]; // Fallback to first option
  }
  
  /**
   * Select an object from an array of objects with weights
   * @param {Array} objects - Array of objects with weight property
   * @returns {Object} Selected object
   */
  function selectWeightedObject(objects) {
    const totalWeight = objects.reduce((sum, obj) => sum + (obj.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < objects.length; i++) {
      random -= (objects[i].weight || 1);
      if (random <= 0) {
        return objects[i];
      }
    }
    
    return objects[0]; // Fallback to first object
  }
  
  /**
   * Generate a set of realistic dates with business hour and weekday weightings
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} count - Number of dates to generate
   * @param {Object} options - Weighting options
   * @returns {Array} Array of dates
   */
  function generateRealisticDates(startDate, endDate, count, options = {}) {
    const { weekdayWeight = 0.7, businessHoursWeight = 0.7 } = options;
    const dates = [];
    
    for (let i = 0; i < count; i++) {
      let date;
      
      // Apply weekday weighting
      if (Math.random() < weekdayWeight) {
        // Generate a weekday date (Monday-Friday)
        do {
          date = randomDateBetween(startDate, endDate);
        } while (date.getDay() === 0 || date.getDay() === 6); // 0 = Sunday, 6 = Saturday
      } else {
        // Generate any date (could be weekend)
        date = randomDateBetween(startDate, endDate);
      }
      
      // Apply business hours weighting
      if (Math.random() < businessHoursWeight) {
        // Business hours (9am-5pm)
        date.setHours(9 + Math.floor(Math.random() * 8));
        date.setMinutes(Math.floor(Math.random() * 60));
      } else {
        // Any hour
        date.setHours(Math.floor(Math.random() * 24));
        date.setMinutes(Math.floor(Math.random() * 60));
      }
      
      dates.push(date);
    }
    
    // Sort dates chronologically
    return dates.sort((a, b) => a - b);
  }
  
  /**
   * Generate a random date between two dates
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @returns {Date} Random date
   */
  function randomDateBetween(start, end) {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = startTime + Math.random() * (endTime - startTime);
    return new Date(randomTime);
  }
  
  /**
   * Assign events to users based on their activity level
   * @param {Array} users - Array of users
   * @param {number} eventCount - Total events to assign
   * @param {Object} userTraits - User traits with activity levels
   * @returns {Object} Events assigned to each user
   */
  function assignEventsToUsers(users, eventCount, userTraits) {
    const userEvents = {};
    
    // First calculate relative activity levels
    const activityLevels = {};
    let totalActivity = 0;
    
    users.forEach(user => {
      const trait = userTraits[user.externalUserId];
      if (!trait) return;
      
      activityLevels[user.externalUserId] = trait.activityLevel;
      totalActivity += trait.activityLevel;
    });
    
    // Then assign events proportionally with some randomness
    users.forEach(user => {
      if (!activityLevels[user.externalUserId]) return;
      
      const userShare = activityLevels[user.externalUserId] / totalActivity;
      const baseCount = Math.floor(eventCount * userShare);
      
      // Add some randomness (±20%)
      const variation = Math.floor(baseCount * 0.2 * (Math.random() * 2 - 1));
      userEvents[user.externalUserId] = Math.max(1, baseCount + variation);
    });
    
    return userEvents;
  }
  
  /**
   * Generate a consistent IP for a user with occasional variation
   * @param {string} userId - User identifier
   * @param {number} consistency - How consistent the IP should be (0-1)
   * @returns {string} IP address
   */
  function generateConsistentIP(userId, consistency = 0.9) {
    // Generate a consistent base IP from the user ID
    const hash = simpleHash(userId);
    
    // Base segments using the hash
    const segment1 = 10 + (hash % 240); // 10-249 for first segment
    const segment2 = 1 + (Math.floor(hash / 250) % 254); // 1-254
    const segment3 = 1 + (Math.floor(hash / 63500) % 254); // 1-254
    
    // Decide whether to use the base IP or generate variation
    if (Math.random() < consistency) {
      // Use consistent (base) IP
      const segment4 = 1 + (Math.floor(hash / 16129000) % 254); // 1-254
      return `${segment1}.${segment2}.${segment3}.${segment4}`;
    } else {
      // Generate a variant IP
      return `${segment1}.${segment2}.${segment3}.${1 + Math.floor(Math.random() * 254)}`;
    }
  }
  
  /**
   * Generate a simple hash from a string
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  function simpleHash(str) {
    let hash = 0;
    if (!str) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  }
  
  /**
   * Generate a realistic user agent string
   * @param {string} deviceType - Device type (Desktop, Mobile, Tablet)
   * @param {string} os - Operating system
   * @param {string} browser - Browser name
   * @returns {string} User agent string
   */
  function generateUserAgent(deviceType, os, browser) {
    if (deviceType === 'Mobile') {
      if (os === 'iOS') {
        return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
      } else { // Android
        if (browser === 'Chrome') {
          return 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
        } else if (browser === 'Firefox') {
          return 'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0';
        } else {
          return 'Mozilla/5.0 (Linux; Android 11; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
        }
      }
    } else if (deviceType === 'Tablet') {
      if (os === 'iOS') {
        return 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
      } else { // Android
        return 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36';
      }
    } else { // Desktop
      if (os === 'Windows') {
        if (browser === 'Chrome') {
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        } else if (browser === 'Firefox') {
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
        } else if (browser === 'Edge') {
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
        } else {
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        }
      } else if (os === 'macOS') {
        if (browser === 'Safari') {
          return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
        } else if (browser === 'Chrome') {
          return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';
        } else if (browser === 'Firefox') {
          return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/89.0';
        } else {
          return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';
        }
      } else { // Linux
        if (browser === 'Firefox') {
          return 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0';
        } else if (browser === 'Chrome') {
          return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        } else {
          return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        }
      }
    }
  }

/**
 * Main function to seed test data - SINGLE IMPLEMENTATION
 */
async function seedTestData() {
  try {
    console.log('=== Starting seedTestData ===');
    
    // Step 1: Clear existing test data
    console.log('Step 1: Clearing existing test user data');
    await clearExistingTestData();
    console.log('Cleared existing test user data');

    // Step 2: Create test users
    console.log('Step 2: Creating test users');
    const testUsers = await createTestUsers();
    logger.info('Created test users');
    
    // Step 3: Create TOTP users for each company
    console.log('Step 3: Creating TOTP users for each company');
    const totpUserResults = [];
    
    for (const user of testUsers) {
      console.log(`Processing user: ${user.email}`);
      
      const totpUsers = await createTestTOTPUsers(
        user._id, 
        10, // Reduced for testing
        user.company
      );
      
      console.log(`Created ${totpUsers.length} TOTP users for ${user.company}`);
      
      totpUserResults.push({
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          company: user.company,
          email: user.email
        },
        totpUsers
      });
    }
    
    // Step 4: Generate usage analytics data for each user
    console.log('Step 4: Generating analytics data');
    for (const { user, totpUsers } of totpUserResults) {
      console.log(`Generating analytics for ${user.company}`);
      
      // Create userData object with explicit properties
      const userData = {
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        email: user.email
      };
      
      console.log('User data being passed:', JSON.stringify(userData, null, 2));
      
      await generateAnalyticsData(
        user._id, 
        totpUsers,
        userData
      );
      
      logger.info(`Generated analytics data for ${user.company}`);
    }
    
    console.log('=== seedTestData Completed Successfully ===');
    return testUsers;
  } catch (error) {
    console.error('=== FULL ERROR IN seedTestData ===');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    logger.error('Error in seedTestData:', error.message);
    throw error;
  }
}