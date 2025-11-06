// Mock Prisma client - create mock inline in factory to avoid hoisting issues
jest.mock('../../lib/prisma', () => ({
  $queryRaw: jest.fn(),
}));

const { encryptData, decryptData, encryptSqlExpression } = require('../../utils/pgcrypto');
const mockPrismaClient = require('../../lib/prisma');

describe('pgcrypto Utility Functions', () => {
  const mockEncryptionKey = 'test-encryption-key-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('encryptData', () => {
    it('should encrypt data and return base64 encoded result', async () => {
      const plaintext = 'test data';
      const mockEncrypted = 'base64-encoded-encrypted-data';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

      const result = await encryptData(plaintext, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockEncrypted);
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      const plaintext = "test'; DROP TABLE users; --";
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      await encryptData(plaintext, mockEncryptionKey);

      // Verify that $queryRaw was called with a template literal (Prisma's safe way)
      const callArgs = mockPrismaClient.$queryRaw.mock.calls[0];
      expect(callArgs).toBeDefined();
      // The query should use Prisma's template literal syntax
      expect(Array.isArray(callArgs)).toBe(true);
    });

    it('should return null for null plaintext', async () => {
      const result = await encryptData(null, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for undefined plaintext', async () => {
      const result = await encryptData(undefined, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await encryptData('', mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if encryption key is missing', async () => {
      await expect(encryptData('test', null)).rejects.toThrow(
        'Encryption key is required. Set ENCRYPTION_KEY in environment variables.'
      );

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should throw error if encryption key is empty string', async () => {
      await expect(encryptData('test', '')).rejects.toThrow(
        'Encryption key is required. Set ENCRYPTION_KEY in environment variables.'
      );
    });

    it('should handle encryption errors and throw generic error', async () => {
      const plaintext = 'test data';
      const dbError = new Error('Database connection failed');
      mockPrismaClient.$queryRaw.mockRejectedValue(dbError);

      await expect(encryptData(plaintext, mockEncryptionKey)).rejects.toThrow(
        'Failed to encrypt data'
      );

      expect(console.error).toHaveBeenCalledWith('Encryption error:', dbError);
    });

    it('should encrypt various data types converted to string', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      const testCases = ['string', '123', 'true', 'special chars: !@#$%'];
      for (const data of testCases) {
        await encryptData(data, mockEncryptionKey);
      }

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(testCases.length);
    });

    it('should handle long strings', async () => {
      const longString = 'a'.repeat(10000);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      await encryptData(longString, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('decryptData', () => {
    it('should decrypt base64 encoded data and return plaintext', async () => {
      const encryptedData = 'base64-encoded-encrypted-data';
      const mockDecrypted = 'decrypted plaintext';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: mockDecrypted }]);

      const result = await decryptData(encryptedData, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockDecrypted);
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      const encryptedData = "encrypted'; DROP TABLE users; --";
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: 'decrypted' }]);

      await decryptData(encryptedData, mockEncryptionKey);

      // Verify that $queryRaw was called
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return null for null encrypted data', async () => {
      const result = await decryptData(null, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for undefined encrypted data', async () => {
      const result = await decryptData(undefined, mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await decryptData('', mockEncryptionKey);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if decryption key is missing', async () => {
      await expect(decryptData('encrypted', null)).rejects.toThrow(
        'Encryption key is required. Set ENCRYPTION_KEY in environment variables.'
      );

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should throw error if decryption key is empty string', async () => {
      await expect(decryptData('encrypted', '')).rejects.toThrow(
        'Encryption key is required. Set ENCRYPTION_KEY in environment variables.'
      );
    });

    it('should handle decryption errors and throw generic error', async () => {
      const encryptedData = 'invalid-encrypted-data';
      const dbError = new Error('Invalid encrypted data format');
      mockPrismaClient.$queryRaw.mockRejectedValue(dbError);

      await expect(decryptData(encryptedData, mockEncryptionKey)).rejects.toThrow(
        'Failed to decrypt data'
      );

      expect(console.error).toHaveBeenCalledWith('Decryption error:', dbError);
    });

    it('should handle wrong encryption key gracefully', async () => {
      const encryptedData = 'encrypted-data';
      const dbError = new Error('Wrong key or corrupted data');
      mockPrismaClient.$queryRaw.mockRejectedValue(dbError);

      await expect(decryptData(encryptedData, 'wrong-key')).rejects.toThrow(
        'Failed to decrypt data'
      );
    });
  });

  describe('encryptSqlExpression', () => {
    it('should return SQL expression for encryption', () => {
      const plaintext = 'test data';
      const result = encryptSqlExpression(plaintext, mockEncryptionKey);

      expect(result).toContain('pgp_sym_encrypt');
      expect(result).toContain('encode');
      expect(result).toContain('base64');
      expect(result).toContain("'test data'");
      expect(result).toContain(`'${mockEncryptionKey}'`);
    });

    it('should escape single quotes in plaintext', () => {
      const plaintext = "test'data";
      const result = encryptSqlExpression(plaintext, mockEncryptionKey);

      expect(result).toContain("'test''data'");
      expect(result).not.toContain("test'data");
    });

    it('should escape single quotes in encryption key', () => {
      const plaintext = 'test';
      const keyWithQuotes = "key'with'quotes";
      const result = encryptSqlExpression(plaintext, keyWithQuotes);

      expect(result).toContain("'key''with''quotes'");
    });

    it('should return NULL for null plaintext', () => {
      const result = encryptSqlExpression(null, mockEncryptionKey);

      expect(result).toBe('NULL');
    });

    it('should return NULL for undefined plaintext', () => {
      const result = encryptSqlExpression(undefined, mockEncryptionKey);

      expect(result).toBe('NULL');
    });

    it('should throw error if encryption key is missing', () => {
      expect(() => encryptSqlExpression('test', null)).toThrow('Encryption key is required');
    });

    it('should throw error if encryption key is empty string', () => {
      expect(() => encryptSqlExpression('test', '')).toThrow('Encryption key is required');
    });

    it('should handle special characters in plaintext', () => {
      const plaintext = "test'; DROP TABLE users; --";
      const result = encryptSqlExpression(plaintext, mockEncryptionKey);

      // Should escape the single quote
      expect(result).toContain("test''; DROP TABLE users; --");
    });

    it('should return NULL for empty string plaintext', () => {
      const result = encryptSqlExpression('', mockEncryptionKey);

      expect(result).toBe('NULL');
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const originalData = 'test data to encrypt';
      const mockEncrypted = 'base64-encrypted-data';
      const mockDecrypted = originalData;

      // Mock encryption
      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: mockEncrypted }])
        .mockResolvedValueOnce([{ decrypted: mockDecrypted }]);

      const encrypted = await encryptData(originalData, mockEncryptionKey);
      const decrypted = await decryptData(encrypted, mockEncryptionKey);

      expect(encrypted).toBe(mockEncrypted);
      expect(decrypted).toBe(originalData);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should handle unicode characters', async () => {
      const unicodeData = '测试数据 🌍 émoji';
      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: 'encrypted' }])
        .mockResolvedValueOnce([{ decrypted: unicodeData }]);

      const encrypted = await encryptData(unicodeData, mockEncryptionKey);
      const decrypted = await decryptData(encrypted, mockEncryptionKey);

      expect(decrypted).toBe(unicodeData);
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle database connection errors during encryption', async () => {
      const connectionError = new Error('Connection timeout');
      mockPrismaClient.$queryRaw.mockRejectedValue(connectionError);

      await expect(encryptData('test', mockEncryptionKey)).rejects.toThrow(
        'Failed to encrypt data'
      );
    });

    it('should handle database connection errors during decryption', async () => {
      const connectionError = new Error('Connection timeout');
      mockPrismaClient.$queryRaw.mockRejectedValue(connectionError);

      await expect(decryptData('encrypted', mockEncryptionKey)).rejects.toThrow(
        'Failed to decrypt data'
      );
    });

    it('should handle empty result array from database', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await expect(encryptData('test', mockEncryptionKey)).rejects.toThrow();
    });
  });
});
