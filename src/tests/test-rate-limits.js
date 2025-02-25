const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
const TOTAL_REQUESTS = 15;
const DELAY_MS = 200;

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test auth rate limiting (5 requests per hour)
const testAuthRateLimit = async () => {
  console.log('\n===== Testing Auth Rate Limiting =====');
  const endpoint = `${API_URL}/business/login`;
  const requestData = {
    email: 'test@example.com',
    password: 'wrongpassword'  // Using wrong password to avoid successful login
  };
  
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    try {
      console.log(`Request ${i}/${TOTAL_REQUESTS}...`);
      const response = await axios.post(endpoint, requestData);
      console.log(`Response: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`Response: ${error.response?.status} ${error.response?.statusText}`);
      console.log(`Message: ${error.response?.data?.message}`);
    }
    
    await delay(DELAY_MS);
  }
};

// Test TOTP validation rate limiting (10 attempts per 5 min)
const testTOTPRateLimit = async () => {
  console.log('\n===== Testing TOTP Validation Rate Limiting =====');
  const endpoint = `${API_URL}/totp-secrets/validate`;
  const requestData = {
    externalUserId: 'user123',
    token: '123456'  // Using invalid token
  };
  
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    try {
      console.log(`Request ${i}/${TOTAL_REQUESTS}...`);
      const response = await axios.post(endpoint, requestData);
      console.log(`Response: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`Response: ${error.response?.status} ${error.response?.statusText}`);
      console.log(`Message: ${error.response?.data?.message}`);
    }
    
    await delay(DELAY_MS);
  }
};

// Test general API rate limiting (100 requests per 15 min)
const testAPIRateLimit = async () => {
  console.log('\n===== Testing General API Rate Limiting =====');
  const endpoint = `${API_URL}/health`;  // Using health endpoint as it should be publicly accessible
  
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    try {
      console.log(`Request ${i}/${TOTAL_REQUESTS}...`);
      const response = await axios.get(endpoint);
      console.log(`Response: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`Response: ${error.response?.status} ${error.response?.statusText}`);
      console.log(`Message: ${error.response?.data?.message}`);
    }
    
    await delay(DELAY_MS);
  }
};

// Run all tests in sequence
const runAllTests = async () => {
  await testAuthRateLimit();
  await testTOTPRateLimit();
  await testAPIRateLimit();
  console.log('\nAll rate limiting tests completed!');
};

runAllTests().catch(console.error);