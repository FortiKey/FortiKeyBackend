const {
    createTOTPSecret,
    getAllTOTPSecrets,
    getTOTPSecretByExternalUserId,
    getTOTPSecretById,
    updateTOTPSecret,
    deleteTOTPSecret,
    validateTOTP,
    validateBackupCode,
    regenerateBackupCodes
} = require('../../controllers/totpSecretController');

const TOTPSecret = require('../../models/totpSecretModel');
const User = require('../../models/userModel');
const { generateTOTPSecret } = require('../../utils/totpGeneration');
const { logger } = require('../../middlewares/logger');
const OTPAuth = require('otpauth');

// Mock dependencies
jest.mock('../../models/totpSecretModel');
jest.mock('../../models/userModel');
jest.mock('../../utils/totpGeneration');
jest.mock('../../middlewares/logger');
jest.mock('otpauth');
jest.mock('../../controllers/analyticsController', () => ({
    logEvent: jest.fn()
}));

const { logEvent } = require('../../controllers/analyticsController');

describe('TOTP Secret Controller Unit Tests', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup request and response objects
        mockReq = {
            body: {},
            params: {},
            userId: 'company-id',
            user: {
                _id: 'company-id',
                role: 'business'
            }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };

        // Mock logger
        logger.error = jest.fn();
        logger.info = jest.fn();

        // Default User mock
        User.findById = jest.fn().mockResolvedValue({
            _id: 'company-id',
            firstName: 'Test',
            lastName: 'User',
            company: 'Test Company',
            role: 'business'
        });
    });

    describe('createTOTPSecret', () => {
        beforeEach(() => {
            mockReq.body = {
                company: 'Test Company',
                externalUserId: 'test-user-123'
            };

            // Mock TOTP Secret generation
            generateTOTPSecret.mockReturnValue({
                secret: 'generated-secret',
                uri: 'otpauth://totp/Test%20Company:test-user-123?secret=generated-secret&issuer=Test%20Company'
            });

            // Setup TOTPSecret constructor mock
            const mockSaved = {
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123',
                companyId: 'company-id',
                metadata: { company: 'Test Company', createdBy: 'Test User' },
                decryptSecret: jest.fn().mockReturnValue('generated-secret'),
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
            };

            const mockInstance = {
                save: jest.fn().mockResolvedValue(mockSaved)
            };

            TOTPSecret.mockImplementation(() => mockInstance);
        });

        it('should reject requests without required fields', async () => {
            mockReq.body = {}; // Missing required fields

            await createTOTPSecret(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle errors during creation', async () => {
            // Mock a save error
            const mockInstance = {
                save: jest.fn().mockRejectedValue(new Error('Database error'))
            };
            TOTPSecret.mockImplementation(() => mockInstance);

            await createTOTPSecret(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('getAllTOTPSecrets', () => {
        beforeEach(() => {
            const mockSecrets = [
                { _id: 'secret1', externalUserId: 'user1' },
                { _id: 'secret2', externalUserId: 'user2' }
            ];

            TOTPSecret.find = jest.fn().mockResolvedValue(mockSecrets);
        });

        it('should handle errors during retrieval', async () => {
            TOTPSecret.find = jest.fn().mockRejectedValue(new Error('Database error'));

            await getAllTOTPSecrets(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('getTOTPSecretByExternalUserId', () => {
        beforeEach(() => {
            mockReq.params = { externalUserId: 'test-user-123' };
            TOTPSecret.findOne = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123'
            });
        });

        it('should handle secret not found', async () => {
            TOTPSecret.findOne.mockResolvedValue(null);

            await getTOTPSecretByExternalUserId(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('updateTOTPSecret', () => {
        beforeEach(() => {
            mockReq.params = { id: 'totp-secret-id' };
            mockReq.body = { externalUserId: 'updated-user-id' };

            TOTPSecret.findByIdAndUpdate = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'updated-user-id'
            });
        });

        it('should handle secret not found', async () => {
            TOTPSecret.findByIdAndUpdate.mockResolvedValue(null);

            await updateTOTPSecret(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('validateTOTP', () => {
        beforeEach(() => {
            mockReq.body = {
                externalUserId: 'test-user-123',
                token: '123456'
            };

            TOTPSecret.findOne = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123',
                decryptSecret: jest.fn().mockReturnValue('DECRYPTEDTOTP')
            });

            // Mock OTPAuth functionality
            const mockTotp = {
                validate: jest.fn().mockReturnValue(0) // Default: Valid token
            };
            OTPAuth.TOTP = jest.fn().mockReturnValue(mockTotp);
            OTPAuth.Secret = {
                fromBase32: jest.fn().mockReturnValue('base32Secret')
            };

            // Reset mock response handlers
            mockRes.status = jest.fn().mockReturnThis();
            mockRes.json = jest.fn();
        });

        it('should reject invalid tokens', async () => {
            // Override the OTPAuth validation to simulate an invalid token
            OTPAuth.TOTP().validate.mockReturnValue(null);

            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Invalid TOTP token' })
            );
        });

        it('should validate successful tokens', async () => {
            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'TOTP token is valid' })
            );
        });

        it('should return 404 if TOTP secret is not found', async () => {
            // Override `findOne` to return `null`, simulating a missing secret
            TOTPSecret.findOne.mockResolvedValue(null);

            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'TOTP secret not found' })
            );
        });

        it('should handle errors gracefully', async () => {
            // Force an error inside `validateTOTP`
            TOTPSecret.findOne.mockRejectedValue(new Error('Database failure'));

            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Error validating TOTP token' })
            );
        });
    });

    describe('validateBackupCode', () => {
        beforeEach(() => {
            mockReq.body = {
                externalUserId: 'test-user-123',
                backupCode: 'BACKUP1'
            };

            TOTPSecret.findOne = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123',
                companyId: 'company-id',
                backupCodes: ['encrypted1', 'encrypted2'],
                decryptBackupCodes: jest.fn().mockReturnValue(['BACKUP1', 'BACKUP2']),
                save: jest.fn().mockResolvedValue({})
            });
        });

        it('should validate a valid backup code', async () => {
            await validateBackupCode(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
        });

        it('should reject invalid backup codes', async () => {
            mockReq.body.backupCode = 'INVALID';

            await validateBackupCode(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should handle user not found', async () => {
            TOTPSecret.findOne.mockResolvedValue(null);

            await validateBackupCode(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('regenerateBackupCodes', () => {
        beforeEach(() => {
            mockReq.params = { externalUserId: 'test-user-123' };

            TOTPSecret.findOne = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123',
                companyId: 'company-id',
                backupCodes: ['oldCode1', 'oldCode2'],
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2']),
                save: jest.fn().mockResolvedValue({})
            });
        });

        it('should handle user not found', async () => {
            TOTPSecret.findOne.mockResolvedValue(null);

            await regenerateBackupCodes(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    // Add a simple test for deleteTOTPSecret to boost coverage
    describe('deleteTOTPSecret', () => {
        beforeEach(() => {
            mockReq.params = { id: 'totp-secret-id' };
            TOTPSecret.findByIdAndDelete = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123'
            });
        });

        it('should handle not found case', async () => {
            TOTPSecret.findByIdAndDelete.mockResolvedValue(null);

            await deleteTOTPSecret(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    // Add test for getTOTPSecretById
    describe('getTOTPSecretById', () => {
        beforeEach(() => {
            mockReq.params = { id: 'totp-secret-id' };
            TOTPSecret.findById = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                decryptSecret: jest.fn().mockReturnValue('decrypted-secret'),
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
            });
        });

        it('should return TOTP secret by ID', async () => {
            await getTOTPSecretById(mockReq, mockRes);
            expect(TOTPSecret.findById).toHaveBeenCalledWith('totp-secret-id');
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
    });
});