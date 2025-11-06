const crypto = require('crypto');
const {
  hashEmail,
  encryptEmail,
  decryptEmail,
  prepareEmailForStorage,
} = require('../../utils/emailEncryption');

// Mock pgcrypto module
jest.mock('../../utils/pgcrypto', () => ({
  encryptData: jest.fn(),
  decryptData: jest.fn(),
}));

const { encryptData, decryptData } = require('../../utils/pgcrypto');

describe('Email Encryption Utility', () => {
  const mockEncryptionKey = 'test-encryption-key-12345';
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.ENCRYPTION_KEY;
    // Set test encryption key
    process.env.ENCRYPTION_KEY = mockEncryptionKey;
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('hashEmail', () => {
    it('should hash email using SHA-256', () => {
      const email = 'test@example.com';
      const result = hashEmail(email);

      // SHA-256 hash should be 64 characters (hex)
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should normalize email to lowercase before hashing', () => {
      const email1 = 'Test@Example.COM';
      const email2 = 'test@example.com';
      const email3 = '  TEST@EXAMPLE.COM  ';

      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);
      const hash3 = hashEmail(email3);

      // All should produce the same hash
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should trim whitespace from email', () => {
      const email1 = 'test@example.com';
      const email2 = '  test@example.com  ';

      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);

      expect(hash1).toBe(hash2);
    });

    it('should produce consistent hashes for same email', () => {
      const email = 'test@example.com';
      const hash1 = hashEmail(email);
      const hash2 = hashEmail(email);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different emails', () => {
      const email1 = 'test1@example.com';
      const email2 = 'test2@example.com';

      const hash1 = hashEmail(email1);
      const hash2 = hashEmail(email2);

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for null email', () => {
      expect(() => hashEmail(null)).toThrow('Email is required for hashing');
    });

    it('should throw error for undefined email', () => {
      expect(() => hashEmail(undefined)).toThrow('Email is required for hashing');
    });

    it('should throw error for empty string', () => {
      expect(() => hashEmail('')).toThrow('Email is required for hashing');
    });

    it('should handle emails with special characters', () => {
      const email = 'test+tag@example.com';
      const result = hashEmail(email);

      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle long email addresses', () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      const result = hashEmail(longEmail);

      expect(result).toHaveLength(64);
    });

    it('should produce deterministic hashes', () => {
      const email = 'user@example.com';
      // Manually calculate expected hash
      const normalized = email.toLowerCase().trim();
      const expectedHash = crypto.createHash('sha256').update(normalized).digest('hex');

      const result = hashEmail(email);

      expect(result).toBe(expectedHash);
    });
  });

  describe('encryptEmail', () => {
    it('should encrypt email using pgcrypto', async () => {
      const email = 'test@example.com';
      const mockEncrypted = 'encrypted-email-data';
      encryptData.mockResolvedValue(mockEncrypted);

      const result = await encryptEmail(email);

      expect(encryptData).toHaveBeenCalledWith(email, mockEncryptionKey);
      expect(result).toBe(mockEncrypted);
    });

    it('should return null for null email', async () => {
      const result = await encryptEmail(null);

      expect(encryptData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for undefined email', async () => {
      const result = await encryptEmail(undefined);

      expect(encryptData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await encryptEmail('');

      expect(encryptData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if ENCRYPTION_KEY is not set', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(encryptEmail('test@example.com')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
    });

    it('should handle various email formats', async () => {
      encryptData.mockResolvedValue('encrypted');

      const emails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@subdomain.example.com',
      ];

      for (const email of emails) {
        await encryptEmail(email);
        expect(encryptData).toHaveBeenCalledWith(email, mockEncryptionKey);
      }

      expect(encryptData).toHaveBeenCalledTimes(emails.length);
    });

    it('should propagate encryption errors', async () => {
      const email = 'test@example.com';
      const error = new Error('Encryption failed');
      encryptData.mockRejectedValue(error);

      await expect(encryptEmail(email)).rejects.toThrow('Encryption failed');
    });
  });

  describe('decryptEmail', () => {
    it('should decrypt email using pgcrypto', async () => {
      const encryptedEmail = 'encrypted-email-data';
      const mockDecrypted = 'test@example.com';
      decryptData.mockResolvedValue(mockDecrypted);

      const result = await decryptEmail(encryptedEmail);

      expect(decryptData).toHaveBeenCalledWith(encryptedEmail, mockEncryptionKey);
      expect(result).toBe(mockDecrypted);
    });

    it('should return null for null encrypted email', async () => {
      const result = await decryptEmail(null);

      expect(decryptData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for undefined encrypted email', async () => {
      const result = await decryptEmail(undefined);

      expect(decryptData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await decryptEmail('');

      expect(decryptData).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if ENCRYPTION_KEY is not set', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(decryptEmail('encrypted')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
    });

    it('should propagate decryption errors', async () => {
      const encryptedEmail = 'encrypted-email-data';
      const error = new Error('Decryption failed');
      decryptData.mockRejectedValue(error);

      await expect(decryptEmail(encryptedEmail)).rejects.toThrow('Decryption failed');
    });
  });

  describe('prepareEmailForStorage', () => {
    it('should hash and encrypt email', async () => {
      const email = 'test@example.com';
      const mockEncrypted = 'encrypted-email';
      encryptData.mockResolvedValue(mockEncrypted);

      const result = await prepareEmailForStorage(email);

      expect(result).toHaveProperty('emailHash');
      expect(result).toHaveProperty('encryptedEmail');
      expect(result.emailHash).toHaveLength(64); // SHA-256 hash length
      expect(result.encryptedEmail).toBe(mockEncrypted);
      expect(encryptData).toHaveBeenCalledWith(email, mockEncryptionKey);
    });

    it('should produce consistent hash for same email', async () => {
      const email = 'test@example.com';
      encryptData.mockResolvedValue('encrypted');

      const result1 = await prepareEmailForStorage(email);
      const result2 = await prepareEmailForStorage(email);

      expect(result1.emailHash).toBe(result2.emailHash);
    });

    it('should normalize email before hashing', async () => {
      const email1 = 'Test@Example.COM';
      const email2 = 'test@example.com';
      encryptData.mockResolvedValue('encrypted');

      const result1 = await prepareEmailForStorage(email1);
      const result2 = await prepareEmailForStorage(email2);

      expect(result1.emailHash).toBe(result2.emailHash);
    });

    it('should throw error for null email', async () => {
      await expect(prepareEmailForStorage(null)).rejects.toThrow('Email is required');
    });

    it('should throw error for undefined email', async () => {
      await expect(prepareEmailForStorage(undefined)).rejects.toThrow('Email is required');
    });

    it('should throw error for empty string', async () => {
      await expect(prepareEmailForStorage('')).rejects.toThrow('Email is required');
    });

    it('should handle email with whitespace', async () => {
      const email = '  test@example.com  ';
      encryptData.mockResolvedValue('encrypted');

      const result = await prepareEmailForStorage(email);

      // Hash should be for trimmed email
      const expectedHash = hashEmail('test@example.com');
      expect(result.emailHash).toBe(expectedHash);
    });

    it('should return both hash and encrypted email', async () => {
      const email = 'user@example.com';
      const mockEncrypted = 'encrypted-data';
      encryptData.mockResolvedValue(mockEncrypted);

      const result = await prepareEmailForStorage(email);

      expect(result.emailHash).toBeDefined();
      expect(result.encryptedEmail).toBe(mockEncrypted);
      expect(typeof result.emailHash).toBe('string');
      expect(typeof result.encryptedEmail).toBe('string');
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should encrypt and decrypt email correctly', async () => {
      const originalEmail = 'test@example.com';
      const mockEncrypted = 'encrypted-email';
      const mockDecrypted = originalEmail;

      encryptData.mockResolvedValue(mockEncrypted);
      decryptData.mockResolvedValue(mockDecrypted);

      const encrypted = await encryptEmail(originalEmail);
      const decrypted = await decryptEmail(encrypted);

      expect(encrypted).toBe(mockEncrypted);
      expect(decrypted).toBe(originalEmail);
    });

    it('should maintain email format after encryption/decryption', async () => {
      const email = 'user.name+tag@subdomain.example.com';
      encryptData.mockResolvedValue('encrypted');
      decryptData.mockResolvedValue(email);

      const encrypted = await encryptEmail(email);
      const decrypted = await decryptEmail(encrypted);

      expect(decrypted).toBe(email);
    });
  });

  describe('Integration with hashEmail', () => {
    it('should use hashEmail in prepareEmailForStorage', async () => {
      const email = 'test@example.com';
      encryptData.mockResolvedValue('encrypted');

      const result = await prepareEmailForStorage(email);
      const expectedHash = hashEmail(email);

      expect(result.emailHash).toBe(expectedHash);
    });

    it('should produce same hash regardless of email case', async () => {
      const email1 = 'Test@Example.COM';
      const email2 = 'test@example.com';
      encryptData.mockResolvedValue('encrypted');

      const result1 = await prepareEmailForStorage(email1);
      const result2 = await prepareEmailForStorage(email2);

      expect(result1.emailHash).toBe(result2.emailHash);
    });
  });

  describe('Error handling', () => {
    it('should handle encryption failures in prepareEmailForStorage', async () => {
      const email = 'test@example.com';
      const error = new Error('Encryption failed');
      encryptData.mockRejectedValue(error);

      await expect(prepareEmailForStorage(email)).rejects.toThrow('Encryption failed');
    });

    it('should handle missing ENCRYPTION_KEY in all functions', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(encryptEmail('test@example.com')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(decryptEmail('encrypted')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(prepareEmailForStorage('test@example.com')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
    });
  });
});
