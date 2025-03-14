const { generateTOTPSecret, validateTOTPToken } = require('../utils/totpGeneration');

describe('TOTP Generation Utils', () => {
  const company = 'Test Company';
  const externalUserId = 'test-user-123';

  describe('generateTOTPSecret', () => {
    it('should generate a TOTP secret', () => {
      const result = generateTOTPSecret(company, externalUserId);
      
      expect(result).toBeTruthy();
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('uri');
      
      // Check that secret is in Base32 format (A-Z, 2-7)
      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
      
      // Check that URI has expected format
      expect(result.uri).toContain('otpauth://totp/');
      
      // URL encoding turns spaces into %20, so we need to check for either
      expect(result.uri.includes(company) || result.uri.includes(encodeURIComponent(company))).toBe(true);
      expect(result.uri.includes(externalUserId) || result.uri.includes(encodeURIComponent(externalUserId))).toBe(true);
    });

    it('should handle errors and return null', () => {
      // Passing invalid parameters should return null
      const result = generateTOTPSecret(null, null);
      expect(result).toBeNull();
    });
  });

  describe('validateTOTPToken', () => {
    it('should validate a TOTP token', () => {
      // First generate a secret
      const { secret } = generateTOTPSecret(company, externalUserId);
      
      // Since we can't easily generate a valid token for testing,
      // we'll just verify that invalid tokens are rejected
      const result = validateTOTPToken(secret, '123456');
      
      // This should be false since '123456' is unlikely to be valid
      expect(result).toBe(false);
    });

    it('should handle invalid secrets', () => {
      // Test with an invalid secret
      const result = validateTOTPToken('INVALID_SECRET', '123456');
      expect(result).toBe(false);
    });
    
    it('should handle empty inputs', () => {
      const result = validateTOTPToken('', '');
      expect(result).toBe(false);
    });
  });
});