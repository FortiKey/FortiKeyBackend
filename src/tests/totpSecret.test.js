const request = require('supertest'); // Import supertest
const express = require('express'); // Import express
const mongoose = require('mongoose'); // Import mongoose
const { connectDB } = require('../config/db'); // Import connectDB function
const v1Routes = require('../routes/v1'); // Import v1 routes

// Create an express app
const app = express();
// Use middleware
app.use(express.json());
// Use the v1 routes
app.use('/api/v1', v1Routes.router);

// Connect to the database before running tests
beforeAll(async () => {
    await connectDB();
});

// Close the database connection after running tests
afterAll(async () => {
    await mongoose.connection.close();
});

describe('TOTP Secret API', () => {
    let createdSecretId;
    const businessName = 'TestBusiness';
    const externalUserId = 'user123';
    const backupCodes = ['code1', 'code2'];

    // Test creating a new TOTP secret
    it('should create a new TOTP secret', async () => {
        const res = await request(app)
            .post('/api/v1/totp-secrets')
            .send({ businessName, externalUserId, backupCodes });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('secret');
        expect(res.body).toHaveProperty('uri');
        expect(res.body).toHaveProperty('backupCodes');
        expect(res.body).toHaveProperty('_id');

        createdSecretId = res.body._id;
        expect(createdSecretId).toBeDefined();
    });

    // Test getting a TOTP secret by external user ID
    it('should get a TOTP secret by external user ID', async () => {
        const res = await request(app).get(`/api/v1/totp-secrets/user/${externalUserId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.externalUserId).toEqual(externalUserId);
    });

    // Test validating a TOTP token
    // validate a TOTP Token
const validateTOTP = async (req, res) => {
    try {
        const { externalUserId, token } = req.body;

        const totpSecret = await TOTPSecret.findOne({ externalUserId });
        if (!totpSecret) {
            return res.status(404).json({ message: 'TOTP secret not found' });
        }

        const decryptedSecret = totpSecret.decryptSecret();

        const OTPAuth = require('otpauth');
        const totp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(decryptedSecret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30
        });

        const delta = totp.validate({ token, window: 1 });

        if (delta === null) {
            return res.status(400).json({ message: 'Invalid TOTP token' });
        }

        return res.status(200).json({ message: 'TOTP token is valid' });

    } catch (error) {
        return res.status(500).json({ message: 'Error validating TOTP token', error: error.message });
    }
};

    // Test updating a TOTP secret
    it('should update a TOTP secret', async () => {
        const newBackupCodes = ['newcode1', 'newcode2'];
        const resUpdate = await request(app)
            .put(`/api/v1/totp-secrets/${createdSecretId}`)
            .send({ backupCodes: newBackupCodes });

        expect(resUpdate.statusCode).toEqual(200);
        expect(resUpdate.body.backupCodes).toEqual(newBackupCodes);
    });

    // Test deleting a TOTP secret
    it('should delete a TOTP secret', async () => {
        const resDelete = await request(app)
            .delete(`/api/v1/totp-secrets/${createdSecretId}`);

        expect(resDelete.statusCode).toEqual(204);
    });

    // Test getting all TOTP secrets
    it('should get all TOTP secrets', async () => {
        const res = await request(app).get('/api/v1/totp-secrets');
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});