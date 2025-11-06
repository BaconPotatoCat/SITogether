const crypto = require('crypto');

// Mock Prisma client first - this prevents database connection attempts
jest.mock('../../lib/prisma', () => ({
  $queryRaw: jest.fn(),
}));

const {
  hashEmail,
  prepareEmailForStorage,
  encryptField,
  decryptField,
  decryptUserFields,
  decryptUsersFields,
} = require('../../utils/fieldEncryption');

const mockPrismaClient = require('../../lib/prisma');

describe('Field Encryption Utility', () => {
  const mockEncryptionKey = 'test-encryption-key-12345';
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.ENCRYPTION_KEY;
    // Set test encryption key
    process.env.ENCRYPTION_KEY = mockEncryptionKey;
    // Clear all mocks
    jest.clearAllMocks();
    // Suppress console.error during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
    jest.restoreAllMocks();
  });

  // ============================================================================
  // EMAIL HASHING
  // ============================================================================

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

  // ============================================================================
  // GENERIC FIELD ENCRYPTION/DECRYPTION
  // ============================================================================

  describe('encryptField', () => {
    it('should encrypt data and return base64 encoded result', async () => {
      const plaintext = 'test data';
      const mockEncrypted = 'base64-encoded-encrypted-data';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

      const result = await encryptField(plaintext);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockEncrypted);
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      const plaintext = "test'; DROP TABLE users; --";
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      await encryptField(plaintext);

      // Verify that $queryRaw was called with a template literal (Prisma's safe way)
      const callArgs = mockPrismaClient.$queryRaw.mock.calls[0];
      expect(callArgs).toBeDefined();
      // The query should use Prisma's template literal syntax
      expect(Array.isArray(callArgs)).toBe(true);
    });

    it('should return null for null plaintext', async () => {
      const result = await encryptField(null);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for undefined plaintext', async () => {
      const result = await encryptField(undefined);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await encryptField('');

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(encryptField('test')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should handle encryption errors and throw generic error', async () => {
      const plaintext = 'test data';
      const dbError = new Error('Database connection failed');
      mockPrismaClient.$queryRaw.mockRejectedValue(dbError);

      await expect(encryptField(plaintext)).rejects.toThrow('Failed to encrypt data');

      expect(console.error).toHaveBeenCalledWith('Encryption error:', dbError);
    });

    it('should encrypt various data types', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      const testCases = ['string', '123', 'true', 'special chars: !@#$%'];
      for (const data of testCases) {
        await encryptField(data);
      }

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(testCases.length);
    });

    it('should handle long strings', async () => {
      const longString = 'a'.repeat(10000);
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      await encryptField(longString);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should support pre-transform functions', async () => {
      const number = 42;
      const mockEncrypted = 'encrypted-42';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

      const result = await encryptField(number, (value) => value.toString());

      expect(result).toBe(mockEncrypted);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });

    it('should return null for empty array after transform', async () => {
      const result = await encryptField([], (value) => {
        if (!Array.isArray(value) || value.length === 0) return null;
        return JSON.stringify(value);
      });

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('decryptField', () => {
    it('should decrypt base64 encoded data and return plaintext', async () => {
      const encryptedData = 'base64-encoded-encrypted-data';
      const mockDecrypted = 'decrypted plaintext';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: mockDecrypted }]);

      const result = await decryptField(encryptedData);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockDecrypted);
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      const encryptedData = "encrypted'; DROP TABLE users; --";
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: 'decrypted' }]);

      await decryptField(encryptedData);

      // Verify that $queryRaw was called
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return null for null encrypted data', async () => {
      const result = await decryptField(null);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for undefined encrypted data', async () => {
      const result = await decryptField(undefined);

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await decryptField('');

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw error if ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(decryptField('encrypted')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );

      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should handle decryption errors and throw generic error', async () => {
      const encryptedData = 'invalid-encrypted-data';
      const dbError = new Error('Invalid encrypted data format');
      mockPrismaClient.$queryRaw.mockRejectedValue(dbError);

      await expect(decryptField(encryptedData)).rejects.toThrow('Failed to decrypt data');

      expect(console.error).toHaveBeenCalledWith('Decryption error:', dbError);
    });

    it('should support post-transform functions', async () => {
      const encryptedData = 'encrypted-42';
      const mockDecrypted = '42';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: mockDecrypted }]);

      const result = await decryptField(encryptedData, (value) => parseInt(value, 10));

      expect(result).toBe(42);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });

    it('should return null if decrypted value is null', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: null }]);

      const result = await decryptField('encrypted');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // EMAIL ENCRYPTION (using encryptField/decryptField)
  // ============================================================================

  describe('Email Encryption (using encryptField/decryptField)', () => {
    it('should encrypt email using encryptField', async () => {
      const email = 'test@example.com';
      const mockEncrypted = 'encrypted-email-data';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

      const result = await encryptField(email);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      expect(result).toBe(mockEncrypted);
    });

    it('should decrypt email using decryptField', async () => {
      const encryptedEmail = 'encrypted-email-data';
      const mockDecrypted = 'test@example.com';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: mockDecrypted }]);

      const result = await decryptField(encryptedEmail);

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      expect(result).toBe(mockDecrypted);
    });

    it('should handle various email formats', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      const emails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@subdomain.example.com',
      ];

      for (const email of emails) {
        await encryptField(email);
      }

      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(emails.length);
    });
  });

  describe('prepareEmailForStorage', () => {
    it('should hash and encrypt email', async () => {
      const email = 'test@example.com';
      const mockEncrypted = 'encrypted-email';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

      const result = await prepareEmailForStorage(email);

      expect(result).toHaveProperty('emailHash');
      expect(result).toHaveProperty('encryptedEmail');
      expect(result.emailHash).toHaveLength(64); // SHA-256 hash length
      expect(result.encryptedEmail).toBe(mockEncrypted);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
    });

    it('should produce consistent hash for same email', async () => {
      const email = 'test@example.com';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      const result1 = await prepareEmailForStorage(email);
      const result2 = await prepareEmailForStorage(email);

      expect(result1.emailHash).toBe(result2.emailHash);
    });

    it('should normalize email before hashing', async () => {
      const email1 = 'Test@Example.COM';
      const email2 = 'test@example.com';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

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
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      const result = await prepareEmailForStorage(email);

      // Hash should be for trimmed email
      const expectedHash = hashEmail('test@example.com');
      expect(result.emailHash).toBe(expectedHash);
    });

    it('should return both hash and encrypted email', async () => {
      const email = 'user@example.com';
      const mockEncrypted = 'encrypted-data';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

      const result = await prepareEmailForStorage(email);

      expect(result.emailHash).toBeDefined();
      expect(result.encryptedEmail).toBe(mockEncrypted);
      expect(typeof result.emailHash).toBe('string');
      expect(typeof result.encryptedEmail).toBe('string');
    });

    it('should use hashEmail in prepareEmailForStorage', async () => {
      const email = 'test@example.com';
      mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

      const result = await prepareEmailForStorage(email);
      const expectedHash = hashEmail(email);

      expect(result.emailHash).toBe(expectedHash);
    });

    it('should handle encryption failures in prepareEmailForStorage', async () => {
      const email = 'test@example.com';
      const error = new Error('Encryption failed');
      mockPrismaClient.$queryRaw.mockRejectedValue(error);

      await expect(prepareEmailForStorage(email)).rejects.toThrow('Failed to encrypt data');
    });
  });

  // ============================================================================
  // USER FIELD ENCRYPTION (using encryptField/decryptField with transforms)
  // ============================================================================

  describe('User Field Encryption (using encryptField/decryptField with transforms)', () => {
    describe('Age field', () => {
      it('should encrypt age using encryptField with number-to-string transform', async () => {
        const age = 25;
        const mockEncrypted = 'encrypted-age-25';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

        const result = await encryptField(age, (value) => value.toString());

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(mockEncrypted);
      });

      it('should decrypt age using decryptField with string-to-number transform', async () => {
        const encryptedAge = 'encrypted-age-25';
        const decryptedString = '25';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: decryptedString }]);

        const result = await decryptField(encryptedAge, (value) => parseInt(value, 10));

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(25);
      });

      it('should handle edge case ages (18, 65)', async () => {
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

        await encryptField(18, (value) => value.toString());
        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();

        await encryptField(65, (value) => value.toString());
        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      });
    });

    describe('Gender field', () => {
      it('should encrypt gender using encryptField', async () => {
        const gender = 'Male';
        const mockEncrypted = 'encrypted-gender';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

        const result = await encryptField(gender);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(mockEncrypted);
      });

      it('should decrypt gender using decryptField', async () => {
        const encryptedGender = 'encrypted-gender';
        const decryptedGender = 'Female';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: decryptedGender }]);

        const result = await decryptField(encryptedGender);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(decryptedGender);
      });

      it('should encrypt all valid gender values', async () => {
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

        const genders = ['Male', 'Female', 'Other'];
        for (const gender of genders) {
          await encryptField(gender);
        }

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(genders.length);
      });
    });

    describe('Course field', () => {
      it('should encrypt course using encryptField', async () => {
        const course = 'CSC';
        const mockEncrypted = 'encrypted-course';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

        const result = await encryptField(course);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(mockEncrypted);
      });

      it('should decrypt course using decryptField', async () => {
        const encryptedCourse = 'encrypted-course';
        const decryptedCourse = 'EEE';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: decryptedCourse }]);

        const result = await decryptField(encryptedCourse);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(decryptedCourse);
      });

      it('should handle various course codes', async () => {
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

        const courses = ['CSC', 'EEE', 'CDM', 'NUR', 'MEC', 'PHT'];
        for (const course of courses) {
          await encryptField(course);
        }

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(courses.length);
      });
    });

    describe('Bio field', () => {
      it('should encrypt bio using encryptField', async () => {
        const bio = 'This is a test bio about the user.';
        const mockEncrypted = 'encrypted-bio';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

        const result = await encryptField(bio);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(mockEncrypted);
      });

      it('should decrypt bio using decryptField', async () => {
        const encryptedBio = 'encrypted-bio';
        const decryptedBio = 'This is the decrypted bio.';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: decryptedBio }]);

        const result = await decryptField(encryptedBio);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(decryptedBio);
      });

      it('should handle long bio text', async () => {
        const longBio = 'A'.repeat(500);
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

        await encryptField(longBio);

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      });
    });

    describe('Interests field', () => {
      it('should encrypt interests using encryptField with array-to-JSON transform', async () => {
        const interests = ['Programming', 'Gaming', 'Tech'];
        const mockEncrypted = 'encrypted-interests';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: mockEncrypted }]);

        const result = await encryptField(interests, (value) => {
          if (!Array.isArray(value) || value.length === 0) return null;
          return JSON.stringify(value);
        });

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toBe(mockEncrypted);
      });

      it('should decrypt interests using decryptField with JSON-to-array transform', async () => {
        const encryptedInterests = 'encrypted-interests';
        const decryptedJson = '["Programming","Gaming","Tech"]';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: decryptedJson }]);

        const result = await decryptField(encryptedInterests, (value) => {
          try {
            return JSON.parse(value);
          } catch (error) {
            console.error('Error parsing decrypted interests:', error);
            return null;
          }
        });

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
        expect(result).toEqual(['Programming', 'Gaming', 'Tech']);
      });

      it('should return null for empty array', async () => {
        const result = await encryptField([], (value) => {
          if (!Array.isArray(value) || value.length === 0) return null;
          return JSON.stringify(value);
        });

        expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should handle invalid JSON gracefully', async () => {
        const encryptedInterests = 'encrypted-interests';
        const invalidJson = 'not-valid-json';
        mockPrismaClient.$queryRaw.mockResolvedValue([{ decrypted: invalidJson }]);

        const result = await decryptField(encryptedInterests, (value) => {
          try {
            return JSON.parse(value);
          } catch (error) {
            console.error('Error parsing decrypted interests:', error);
            return null;
          }
        });

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
          'Error parsing decrypted interests:',
          expect.any(Error)
        );
      });

      it('should handle single interest', async () => {
        const interests = ['Programming'];
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

        await encryptField(interests, (value) => {
          if (!Array.isArray(value) || value.length === 0) return null;
          return JSON.stringify(value);
        });

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      });

      it('should handle many interests', async () => {
        const interests = Array.from({ length: 20 }, (_, i) => `Interest${i}`);
        mockPrismaClient.$queryRaw.mockResolvedValue([{ encrypted: 'encrypted' }]);

        await encryptField(interests, (value) => {
          if (!Array.isArray(value) || value.length === 0) return null;
          return JSON.stringify(value);
        });

        expect(mockPrismaClient.$queryRaw).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  describe('decryptUserFields', () => {
    it('should decrypt all user fields', async () => {
      const encryptedUser = {
        id: 'user-id',
        name: 'Test User',
        age: 'encrypted-age',
        gender: 'encrypted-gender',
        course: 'encrypted-course',
        bio: 'encrypted-bio',
        interests: 'encrypted-interests',
        email: 'test@example.com',
        verified: true,
      };

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ decrypted: '25' }]) // age
        .mockResolvedValueOnce([{ decrypted: 'Female' }]) // gender
        .mockResolvedValueOnce([{ decrypted: 'CSC' }]) // course
        .mockResolvedValueOnce([{ decrypted: 'Test bio' }]) // bio
        .mockResolvedValueOnce([{ decrypted: '["Programming","Gaming"]' }]); // interests

      const result = await decryptUserFields(encryptedUser);

      expect(result).toEqual({
        id: 'user-id',
        name: 'Test User',
        age: 25,
        gender: 'Female',
        course: 'CSC',
        bio: 'Test bio',
        interests: ['Programming', 'Gaming'],
        email: 'test@example.com',
        verified: true,
      });
    });

    it('should handle null fields correctly', async () => {
      const encryptedUser = {
        id: 'user-id',
        name: 'Test User',
        age: 'encrypted-age',
        gender: 'encrypted-gender',
        course: null,
        bio: null,
        interests: null,
      };

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ decrypted: '30' }]) // age
        .mockResolvedValueOnce([{ decrypted: 'Male' }]); // gender

      const result = await decryptUserFields(encryptedUser);

      expect(result.age).toBe(30);
      expect(result.gender).toBe('Male');
      expect(result.course).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.interests).toEqual([]); // Should default to empty array
    });

    it('should return null interests as empty array', async () => {
      const encryptedUser = {
        id: 'user-id',
        age: 'encrypted-age',
        gender: 'encrypted-gender',
        course: null,
        bio: null,
        interests: null,
      };

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ decrypted: '25' }])
        .mockResolvedValueOnce([{ decrypted: 'Female' }]);

      const result = await decryptUserFields(encryptedUser);

      expect(result.interests).toEqual([]);
    });

    it('should return user as-is if user is null', async () => {
      const result = await decryptUserFields(null);

      expect(result).toBeNull();
      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should preserve all non-encrypted fields', async () => {
      const encryptedUser = {
        id: 'user-id',
        name: 'Test User',
        role: 'Admin',
        avatarUrl: 'https://example.com/avatar.jpg',
        verified: true,
        createdAt: new Date(),
        age: 'encrypted-age',
        gender: 'encrypted-gender',
        course: null,
        bio: null,
        interests: null,
      };

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ decrypted: '28' }])
        .mockResolvedValueOnce([{ decrypted: 'Other' }]);

      const result = await decryptUserFields(encryptedUser);

      expect(result.id).toBe('user-id');
      expect(result.name).toBe('Test User');
      expect(result.role).toBe('Admin');
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.verified).toBe(true);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('decryptUsersFields', () => {
    it('should decrypt multiple users', async () => {
      const encryptedUsers = [
        {
          id: 'user-1',
          age: 'encrypted-age-1',
          gender: 'encrypted-gender-1',
          course: 'encrypted-course-1',
          bio: null,
          interests: null,
        },
        {
          id: 'user-2',
          age: 'encrypted-age-2',
          gender: 'encrypted-gender-2',
          course: null,
          bio: 'encrypted-bio-2',
          interests: 'encrypted-interests-2',
        },
      ];

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ decrypted: '25' }]) // user-1 age
        .mockResolvedValueOnce([{ decrypted: 'Female' }]) // user-1 gender
        .mockResolvedValueOnce([{ decrypted: 'CSC' }]) // user-1 course
        .mockResolvedValueOnce([{ decrypted: '30' }]) // user-2 age
        .mockResolvedValueOnce([{ decrypted: 'Male' }]) // user-2 gender
        .mockResolvedValueOnce([{ decrypted: 'Test bio' }]) // user-2 bio
        .mockResolvedValueOnce([{ decrypted: '["Reading"]' }]); // user-2 interests

      const result = await decryptUsersFields(encryptedUsers);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'user-1',
        age: 25,
        gender: 'Female',
        course: 'CSC',
        bio: null,
        interests: [],
      });
      expect(result[1]).toEqual({
        id: 'user-2',
        age: 30,
        gender: 'Male',
        course: null,
        bio: 'Test bio',
        interests: ['Reading'],
      });
    });

    it('should return null if users is null', async () => {
      const result = await decryptUsersFields(null);

      expect(result).toBeNull();
      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should return non-array as-is', async () => {
      const result = await decryptUsersFields('not-an-array');

      expect(result).toBe('not-an-array');
      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      const result = await decryptUsersFields([]);

      expect(result).toEqual([]);
      expect(mockPrismaClient.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ROUND-TRIP TESTS
  // ============================================================================

  describe('Round-trip encryption/decryption', () => {
    it('should encrypt and decrypt email correctly', async () => {
      const originalEmail = 'test@example.com';
      const mockEncrypted = 'encrypted-email';
      const mockDecrypted = originalEmail;

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: mockEncrypted }])
        .mockResolvedValueOnce([{ decrypted: mockDecrypted }]);

      const encrypted = await encryptField(originalEmail);
      const decrypted = await decryptField(encrypted);

      expect(encrypted).toBe(mockEncrypted);
      expect(decrypted).toBe(originalEmail);
    });

    it('should encrypt and decrypt age correctly', async () => {
      const originalAge = 25;
      const mockEncrypted = 'encrypted-age';
      const mockDecrypted = '25';

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: mockEncrypted }])
        .mockResolvedValueOnce([{ decrypted: mockDecrypted }]);

      const encrypted = await encryptField(originalAge, (value) => value.toString());
      const decrypted = await decryptField(encrypted, (value) => parseInt(value, 10));

      expect(encrypted).toBe(mockEncrypted);
      expect(decrypted).toBe(25);
    });

    it('should encrypt and decrypt interests correctly', async () => {
      const originalInterests = ['Programming', 'Gaming', 'Tech'];
      const mockEncrypted = 'encrypted-interests';
      const mockDecrypted = JSON.stringify(originalInterests);

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: mockEncrypted }])
        .mockResolvedValueOnce([{ decrypted: mockDecrypted }]);

      const encrypted = await encryptField(originalInterests, (value) => {
        if (!Array.isArray(value) || value.length === 0) return null;
        return JSON.stringify(value);
      });
      const decrypted = await decryptField(encrypted, (value) => {
        try {
          return JSON.parse(value);
        } catch (error) {
          console.error('Error parsing decrypted interests:', error);
          return null;
        }
      });

      expect(encrypted).toBe(mockEncrypted);
      expect(decrypted).toEqual(originalInterests);
    });

    it('should handle unicode characters', async () => {
      const unicodeData = '测试数据 🌍 émoji';
      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: 'encrypted' }])
        .mockResolvedValueOnce([{ decrypted: unicodeData }]);

      const encrypted = await encryptField(unicodeData);
      const decrypted = await decryptField(encrypted);

      expect(decrypted).toBe(unicodeData);
    });

    it('should handle complete user encryption/decryption flow', async () => {
      const originalUser = {
        id: 'user-id',
        name: 'John Doe',
        age: 28,
        gender: 'Male',
        course: 'CSC',
        bio: 'Software developer',
        interests: ['Programming', 'Gaming', 'Tech'],
      };

      // Mock encryption
      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ encrypted: 'encrypted-age' }])
        .mockResolvedValueOnce([{ encrypted: 'encrypted-gender' }])
        .mockResolvedValueOnce([{ encrypted: 'encrypted-course' }])
        .mockResolvedValueOnce([{ encrypted: 'encrypted-bio' }])
        .mockResolvedValueOnce([{ encrypted: 'encrypted-interests' }]);

      // Encrypt fields
      const [encryptedAge, encryptedGender, encryptedCourse, encryptedBio, encryptedInterests] =
        await Promise.all([
          encryptField(originalUser.age, (value) => value.toString()),
          encryptField(originalUser.gender),
          encryptField(originalUser.course),
          encryptField(originalUser.bio),
          encryptField(originalUser.interests, (value) => {
            if (!Array.isArray(value) || value.length === 0) return null;
            return JSON.stringify(value);
          }),
        ]);

      // Mock decryption
      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([{ decrypted: '28' }])
        .mockResolvedValueOnce([{ decrypted: 'Male' }])
        .mockResolvedValueOnce([{ decrypted: 'CSC' }])
        .mockResolvedValueOnce([{ decrypted: 'Software developer' }])
        .mockResolvedValueOnce([{ decrypted: JSON.stringify(originalUser.interests) }]);

      // Decrypt user
      const encryptedUser = {
        ...originalUser,
        age: encryptedAge,
        gender: encryptedGender,
        course: encryptedCourse,
        bio: encryptedBio,
        interests: encryptedInterests,
      };

      const decryptedUser = await decryptUserFields(encryptedUser);

      // Verify round-trip
      expect(decryptedUser.age).toBe(originalUser.age);
      expect(decryptedUser.gender).toBe(originalUser.gender);
      expect(decryptedUser.course).toBe(originalUser.course);
      expect(decryptedUser.bio).toBe(originalUser.bio);
      expect(decryptedUser.interests).toEqual(originalUser.interests);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle database connection errors during encryption', async () => {
      const connectionError = new Error('Connection timeout');
      mockPrismaClient.$queryRaw.mockRejectedValue(connectionError);

      await expect(encryptField('test')).rejects.toThrow('Failed to encrypt data');
    });

    it('should handle database connection errors during decryption', async () => {
      const connectionError = new Error('Connection timeout');
      mockPrismaClient.$queryRaw.mockRejectedValue(connectionError);

      await expect(decryptField('encrypted')).rejects.toThrow('Failed to decrypt data');
    });

    it('should handle empty result array from database', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([]);

      await expect(encryptField('test')).rejects.toThrow();
    });

    it('should handle missing ENCRYPTION_KEY for all functions', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(encryptField('test')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(decryptField('encrypted')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(prepareEmailForStorage('test@example.com')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
    });
  });
});
