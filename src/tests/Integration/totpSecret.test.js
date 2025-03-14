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

// Import models and utilities for mocking
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

// Import analytics controller after mocking
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

        // Clear the TOTPSecret mock
        TOTPSecret.mockClear();
    });
    it('should return 404 if TOTP secret is not found', async () => {
        TOTPSecret.findOne.mockResolvedValue(null);

        await validateTOTP(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'TOTP secret not found'
            })
        );
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

            // Mock User.findById
            User.findById.mockResolvedValue({
                _id: 'company-id',
                firstName: 'Test',
                lastName: 'User',
                company: 'Test Company',
                role: 'business'
            });

            // Mock saved TOTP Secret
            const mockSavedSecret = {
                _id: 'totp-secret-id',
                secret: 'encrypted-secret',
                backupCodes: ['encrypted-code-1', 'encrypted-code-2'],
                externalUserId: 'test-user-123',
                companyId: 'company-id',
                metadata: {
                    company: 'Test Company',
                    createdBy: 'Test User'
                },
                decryptSecret: jest.fn().mockReturnValue('generated-secret'),
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
            };

            // Mock TOTPSecret constructor and save method
            TOTPSecret.mockImplementation(() => ({
                save: jest.fn().mockResolvedValue(mockSavedSecret),
                _id: 'totp-secret-id',
                secret: 'encrypted-secret',
                backupCodes: ['encrypted-code-1', 'encrypted-code-2'],
                externalUserId: 'test-user-123',
                companyId: 'company-id',
                metadata: {
                    company: 'Test Company',
                    createdBy: 'Test User'
                },
                decryptSecret: jest.fn().mockReturnValue('generated-secret'),
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
            }));
        });

        it('should create a new TOTP secret with auto-generated backup codes', async () => {
            // Reset any mocks we need to configure specially for this test
            const newTOTPSecretInstance = {
                save: jest.fn().mockResolvedValue({
                    _id: 'totp-secret-id',
                    secret: 'encrypted-secret',
                    backupCodes: ['encrypted-code-1', 'encrypted-code-2'],
                    externalUserId: 'test-user-123',
                    companyId: 'company-id',
                    metadata: {
                        company: 'Test Company',
                        createdBy: 'Test User'
                    },
                    decryptSecret: jest.fn().mockReturnValue('generated-secret'),
                    decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
                })
            };

            TOTPSecret.mockImplementation(() => newTOTPSecretInstance);

            await createTOTPSecret(mockReq, mockRes);

            expect(generateTOTPSecret).toHaveBeenCalledWith('Test Company', 'test-user-123');
            expect(TOTPSecret).toHaveBeenCalled();
            expect(newTOTPSecretInstance.save).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'totp-secret-id',
                    secret: 'generated-secret',
                    backupCodes: expect.any(Array),
                    uri: expect.stringContaining('otpauth://totp/')
                })
            );
        });

        it('should create a new TOTP secret with provided backup codes', async () => {
            mockReq.body.backupCodes = ['CODE1', 'CODE2'];

            // Reset any mocks we need to configure specially for this test
            const newTOTPSecretInstance = {
                save: jest.fn().mockResolvedValue({
                    _id: 'totp-secret-id',
                    secret: 'encrypted-secret',
                    backupCodes: ['encrypted-code-1', 'encrypted-code-2'],
                    externalUserId: 'test-user-123',
                    companyId: 'company-id',
                    metadata: {
                        company: 'Test Company',
                        createdBy: 'Test User'
                    },
                    decryptSecret: jest.fn().mockReturnValue('generated-secret'),
                    decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
                })
            };

            TOTPSecret.mockImplementation(() => newTOTPSecretInstance);

            await createTOTPSecret(mockReq, mockRes);

            expect(generateTOTPSecret).toHaveBeenCalledWith('Test Company', 'test-user-123');
            expect(TOTPSecret).toHaveBeenCalled();
            expect(newTOTPSecretInstance.save).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'totp-secret-id',
                    secret: 'generated-secret',
                    backupCodes: expect.any(Array)
                })
            );
        });

        it('should reject requests without required fields', async () => {
            mockReq.body = {}; // Missing required fields

            await createTOTPSecret(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Missing required fields')
                })
            );
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle errors during creation', async () => {
            // Mock a failure case
            generateTOTPSecret.mockReturnValue({
                secret: 'generated-secret',
                uri: 'otpauth://totp/Test%20Company:test-user-123?secret=generated-secret&issuer=Test%20Company'
            });

            const mockError = new Error('Database error');
            const newTOTPSecretInstance = {
                save: jest.fn().mockRejectedValue(mockError)
            };

            TOTPSecret.mockImplementation(() => newTOTPSecretInstance);

            await createTOTPSecret(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Error creating TOTP secret')
                })
            );
            expect(logger.error).toHaveBeenCalled();
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

            // Properly mock OTPAuth.TOTP and validate
            const mockTotp = {
                validate: jest.fn().mockReturnValue(0) // Simulates a valid token
            };
            OTPAuth.TOTP = jest.fn(() => mockTotp); // Ensure it returns an instance
            OTPAuth.Secret = {
                fromBase32: jest.fn().mockReturnValue('base32Secret')
            };
        });

        it('should return 404 if TOTP secret is not found', async () => {
            TOTPSecret.findOne.mockResolvedValue(null);

            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'TOTP secret not found'
            }));
        });

        it('should return 400 for invalid token', async () => {
            OTPAuth.TOTP().validate.mockReturnValue(null);

            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid TOTP token'
            }));
        });

        it('should handle errors gracefully', async () => {
            TOTPSecret.findOne.mockRejectedValue(new Error('Database error'));

            await validateTOTP(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Error validating TOTP token'
            }));
        });
    });

    describe('getAllTOTPSecrets', () => {
        beforeEach(() => {
            const mockTOTPSecrets = [
                { _id: 'totp-secret-id-1', companyId: 'company-id', externalUserId: 'test-user-1' },
                { _id: 'totp-secret-id-2', companyId: 'company-id', externalUserId: 'test-user-2' }
            ];

            // Mock find
            TOTPSecret.find = jest.fn().mockResolvedValue(mockTOTPSecrets);
        });

        it('should get all TOTP secrets for the company', async () => {
            await getAllTOTPSecrets(mockReq, mockRes);

            expect(TOTPSecret.find).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });

        it('should handle unauthorized requests', async () => {
            // For admin users, we want to query all secrets
            mockReq.user.role = 'admin';

            await getAllTOTPSecrets(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
        });

        it('should handle errors during retrieval', async () => {
            // Force error in find
            TOTPSecret.find = jest.fn().mockImplementation(() => {
                throw new Error('Database error');
            });

            await getAllTOTPSecrets(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Error retrieving TOTP secrets')
                })
            );
            expect(logger.error).toHaveBeenCalled();
        });
    });
    describe('getTOTPSecretById', () => {
        beforeEach(() => {
            mockReq.params = { id: 'totp-secret-id' };
            TOTPSecret.findById = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123',
                decryptSecret: jest.fn().mockReturnValue('decrypted-secret'),
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
            });
        });

        it('should return TOTP secret by ID', async () => {
            await getTOTPSecretById(mockReq, mockRes);
            expect(TOTPSecret.findById).toHaveBeenCalledWith('totp-secret-id');
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });

        it('should return 404 if TOTP secret is not found', async () => {
            TOTPSecret.findById.mockResolvedValue(null);

            await getTOTPSecretById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'TOTP secret not found'
            }));
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

        it('should get a TOTP secret by external user ID', async () => {
            await getTOTPSecretByExternalUserId(mockReq, mockRes);

            expect(TOTPSecret.findOne).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'totp-secret-id'
                })
            );
        });

        it('should handle secret not found', async () => {
            TOTPSecret.findOne.mockResolvedValue(null);

            await getTOTPSecretByExternalUserId(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'TOTP secret not found'
                })
            );
        });
    });

    describe('getTOTPSecretById', () => {
        beforeEach(() => {
            mockReq.params = { id: 'totp-secret-id' };
            TOTPSecret.findById = jest.fn().mockResolvedValue({
                _id: 'totp-secret-id',
                externalUserId: 'test-user-123',
                decryptSecret: jest.fn().mockReturnValue('decrypted-secret'),
                decryptBackupCodes: jest.fn().mockReturnValue(['CODE1', 'CODE2'])
            });
        });
        it('should get a TOTP secret by ID', async () => {
            await getTOTPSecretById(mockReq, mockRes);
            expect(TOTPSecret.findById).toHaveBeenCalledWith('totp-secret-id');
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
    });


describe('updateTOTPSecret', () => {
    beforeEach(() => {
        mockReq.params = { id: 'totp-secret-id' };
        mockReq.body = { externalUserId: 'updated-user-id' };

        // For findByIdAndUpdate
        TOTPSecret.findByIdAndUpdate = jest.fn().mockResolvedValue({
            _id: 'totp-secret-id',
            externalUserId: 'updated-user-id'
        });
    });

    it('should update a TOTP secret', async () => {
        await updateTOTPSecret(mockReq, mockRes);

        expect(TOTPSecret.findByIdAndUpdate).toHaveBeenCalledWith(
            'totp-secret-id',
            { externalUserId: 'updated-user-id' },
            { new: true }
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle secret not found', async () => {
        // Make findByIdAndUpdate return null to trigger "not found" path
        TOTPSecret.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

        await updateTOTPSecret(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'TOTP secret not found'
            })
        );
    });
});

describe('deleteTOTPSecret', () => {
    beforeEach(() => {
        mockReq.params = { id: 'totp-secret-id' };
        TOTPSecret.findByIdAndDelete = jest.fn().mockResolvedValue({
            _id: 'totp-secret-id',
            externalUserId: 'test-user-123'
        });
    });

    it('should delete a TOTP secret successfully', async () => {
        await deleteTOTPSecret(mockReq, mockRes);

        expect(TOTPSecret.findByIdAndDelete).toHaveBeenCalledWith('totp-secret-id');
        expect(mockRes.status).toHaveBeenCalledWith(204);
    });
});


it('should return 404 if TOTP secret is not found', async () => {
    TOTPSecret.findOne.mockResolvedValue(null);

    await validateTOTP(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'TOTP secret not found'
    }));
});

it('should return 400 for invalid token', async () => {
    // Ensure `TOTPSecret.findOne` returns a valid object
    TOTPSecret.findOne.mockResolvedValue({
        _id: 'totp-secret-id',
        decryptSecret: jest.fn().mockReturnValue('DECRYPTEDTOTP')
    });

    // Simulate invalid token
    OTPAuth.TOTP().validate.mockReturnValue(null);

    await validateTOTP(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid TOTP token' })
    );
});

it('should handle errors', async () => {
    // Force an error in the database call
    TOTPSecret.findOne.mockRejectedValue(new Error('Database error'));

    await validateTOTP(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error validating TOTP token' })
    );
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

        expect(TOTPSecret.findOne).toHaveBeenCalledWith({ externalUserId: 'test-user-123' });
        expect(logEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'backup_code_used',
                success: true
            }),
            mockReq
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Backup code is valid',
                remainingCodes: expect.any(Number)
            })
        );
    });

    it('should reject invalid backup codes', async () => {
        mockReq.body.backupCode = 'INVALID';

        await validateBackupCode(mockReq, mockRes);

        expect(logEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'backup_code_used',
                success: false
            }),
            mockReq
        );
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Invalid backup code'
            })
        );
    });

    it('should handle user not found', async () => {
        TOTPSecret.findOne.mockResolvedValue(null);

        await validateBackupCode(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'TOTP secret not found'
            })
        );
        expect(logger.error).toHaveBeenCalled();
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
            decryptBackupCodes: jest.fn().mockImplementation(function () {
                return Array.from({ length: 8 }, (_, i) => `NEW_CODE${i + 1}`);
            }),
            save: jest.fn().mockResolvedValue({})
        });
    });

    it('should regenerate backup codes', async () => {
        await regenerateBackupCodes(mockReq, mockRes);

        expect(TOTPSecret.findOne).toHaveBeenCalled();
        expect(logEvent).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('Backup codes regenerated successfully'),
                backupCodes: expect.any(Array)
            })
        );
    });

    it('should handle user not found', async () => {
        TOTPSecret.findOne.mockResolvedValue(null);

        await regenerateBackupCodes(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'TOTP secret not found'
            })
        );
        expect(logger.error).toHaveBeenCalled();
    });
});
});

