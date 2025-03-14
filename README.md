# FortiKeyBackend

FortiKeyBackend is a robust Two-Factor Authentication (2FA) API designed for businesses to integrate secure user authentication into their applications.

## 🔐 Features

- **TOTP Authentication**: Industry-standard Time-based One-Time Password (TOTP) implementation
- **Backup Codes**: Generate and validate backup codes for account recovery
- **User Management**: Create and manage business users
- **Analytics Dashboard**: Track authentication metrics and detect suspicious activities
- **API Key Authentication**: Secure API endpoints with unique API keys
- **Rate Limiting**: Protect against brute force attacks
- **Detailed Logging**: Comprehensive event tracking for auditing

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/FortiKey/FortiKeyBackend.git
   cd FortiKeyBackend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/fortikey
   JWT_SECRET=your_jwt_secret_here
   ENCRYPTION_KEY=32_character_encryption_key_here
   ENCRYPTION_IV=16_character_iv_here
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin_password_here
   ```

   **Note**: For production, use strong secrets and encryption keys.

### Database Setup

Ensure MongoDB is running, then:

```bash
# Create an admin user
npm run seed-Admin

# Seed test data (optional)
npm run seed-test-User
```

### Running the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server should start on http://localhost:3000 (or the port specified in your .env file).

## 📝 API Documentation

### Authentication

#### Register a Business User

```
POST /api/v1/business/register
```

Request body:
```json
{
  "company": "Your Company Name",
  "firstName": "First",
  "lastName": "Last",
  "email": "user@company.com",
  "password": "secure_password"
}
```

#### Login

```
POST /api/v1/business/login
```

Request body:
```json
{
  "email": "user@company.com",
  "password": "secure_password"
}
```

### API Key Management

API keys are used for server-to-server authentication.

#### Get Current API Key

```
GET /api/v1/business/apikey
```

Headers:
```
Authorization: Bearer your_jwt_token
```

#### Generate New API Key

```
POST /api/v1/business/apikey
```

Headers:
```
Authorization: Bearer your_jwt_token
```

#### Delete API Key

```
DELETE /api/v1/business/apikey
```

Headers:
```
Authorization: Bearer your_jwt_token
```

### TOTP Management

#### Create TOTP Secret

```
POST /api/v1/totp-secrets
```

Headers:
```
X-API-Key: your_api_key
```

Request body:
```json
{
  "company": "Your Company Name",
  "externalUserId": "your_user_identifier"
}
```

Response:
```json
{
  "_id": "totp_secret_id",
  "secret": "base32_encoded_secret",
  "backupCodes": ["CODE1", "CODE2", "..."],
  "uri": "otpauth://totp/Company:user_id?secret=secret&issuer=Company",
  "companyId": "company_id",
  "metadata": {
    "company": "Your Company Name",
    "createdBy": "Creator Name"
  }
}
```

The `uri` can be used to generate a QR code for the end user.

#### Validate TOTP Token

```
POST /api/v1/totp-secrets/validate
```

Headers:
```
X-API-Key: your_api_key
```

Request body:
```json
{
  "externalUserId": "your_user_identifier",
  "token": "123456"
}
```

#### Validate Backup Code

```
POST /api/v1/totp-secrets/validate-backup-code
```

Headers:
```
X-API-Key: your_api_key
```

Request body:
```json
{
  "externalUserId": "your_user_identifier",
  "backupCode": "BACKUP1"
}
```

#### Regenerate Backup Codes

```
POST /api/v1/totp-secrets/user/{externalUserId}/regenerate-backup
```

Headers:
```
X-API-Key: your_api_key
```

### Analytics

#### Get Company Stats

```
GET /api/v1/analytics/business
```

Headers:
```
Authorization: Bearer your_jwt_token
```

Query parameters:
```
period=30 (days, optional)
```

#### Get TOTP Stats

```
GET /api/v1/analytics/totp
```

Headers:
```
Authorization: Bearer your_jwt_token
```

Query parameters:
```
period=30 (days, optional)
```

#### Get Failure Analytics

```
GET /api/v1/analytics/failures
```

Headers:
```
Authorization: Bearer your_jwt_token
```

#### Get Suspicious Activity

```
GET /api/v1/analytics/suspicious
```

Headers:
```
Authorization: Bearer your_jwt_token
```

#### Get Device Breakdown

```
GET /api/v1/analytics/devices
```

Headers:
```
Authorization: Bearer your_jwt_token
```

## 🔧 Integration Guide

### Step 1: Register a Business Account

1. Register using the `/api/v1/business/register` endpoint
2. Log in using the `/api/v1/business/login` endpoint
3. Generate an API key using the `/api/v1/business/apikey` endpoint

### Step 2: Implement TOTP Setup Flow

1. When a user wants to enable 2FA:
   - Call the create TOTP secret endpoint
   - Display the QR code to the user (generated from the URI)
   - Store the `externalUserId` association in your system
   - Show backup codes to the user and instruct them to save them securely

2. Verify the setup:
   - Ask the user to enter a code from their authenticator app
   - Validate using the validation endpoint

### Step 3: Implement Login Flow with 2FA

1. Authenticate the user with your primary authentication system
2. If 2FA is enabled for the user:
   - Prompt for the TOTP code
   - Validate using the validation endpoint
   - Provide option to use backup codes if needed

### Sample Integration Code (Node.js)

```javascript
const axios = require('axios');

const FORTIKEY_API = 'https://your-fortikey-instance.com/api/v1';
const API_KEY = 'your_api_key';

// Create TOTP for a user
async function setupTOTP(userId) {
  try {
    const response = await axios.post(
      `${FORTIKEY_API}/totp-secrets`,
      { 
        company: 'Your Company',
        externalUserId: userId
      },
      { 
        headers: { 'X-API-Key': API_KEY }
      }
    );
    
    return {
      qrCodeUri: response.data.uri,
      backupCodes: response.data.backupCodes
    };
  } catch (error) {
    console.error('Error setting up TOTP:', error);
    throw error;
  }
}

// Validate TOTP during login
async function validateTOTP(userId, token) {
  try {
    const response = await axios.post(
      `${FORTIKEY_API}/totp-secrets/validate`,
      { 
        externalUserId: userId,
        token
      },
      { 
        headers: { 'X-API-Key': API_KEY }
      }
    );
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Validate backup code
async function validateBackupCode(userId, backupCode) {
  try {
    const response = await axios.post(
      `${FORTIKEY_API}/totp-secrets/validate-backup-code`,
      { 
        externalUserId: userId,
        backupCode
      },
      { 
        headers: { 'X-API-Key': API_KEY }
      }
    );
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
}
```

## 🔒 Security Considerations

1. **API Key Protection**: Store your API key securely and never expose it to clients
2. **HTTPS**: Always use HTTPS for production deployments
3. **User IDs**: Use non-sequential, non-guessable IDs for `externalUserId`
4. **Rate Limiting**: The API has built-in rate limiting, but consider adding your own as well
5. **Backup Codes**: Ensure users understand the importance of saving their backup codes

## 🧪 Testing

Run the test suite:

```bash
npm test
```

For manual rate limit testing:

```bash
node src/tests/manual/test-rate-limits.js
```

## 🔄 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port number | Yes |
| MONGO_URI | MongoDB connection string | Yes |
| JWT_SECRET | Secret for JWT token generation | Yes |
| ENCRYPTION_KEY | 32-character key for TOTP secret encryption | Yes |
| ENCRYPTION_IV | 16-character initialization vector | Yes |
| ADMIN_EMAIL | Email for admin user creation | For admin setup |
| ADMIN_PASSWORD | Password for admin user | For admin setup |

## 📚 Additional Resources

- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
- [QR Code Generation Libraries](https://github.com/soldair/node-qrcode)
- [2FA Best Practices](https://www.nist.gov/itl/applied-cybersecurity/tig/back-basics-multi-factor-authentication)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ✉️ Contact

For support or inquiries, please reach out to keennathan@gmail.com or create an issue on GitHub.