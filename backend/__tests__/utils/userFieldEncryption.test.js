const {
  encryptAge,
  decryptAge,
  encryptGender,
  decryptGender,
  encryptCourse,
  decryptCourse,
  encryptBio,
  decryptBio,
  encryptInterests,
  decryptInterests,
  decryptUserFields,
  decryptUsersFields,
} = require('../../utils/userFieldEncryption');

// Mock pgcrypto module
jest.mock('../../utils/pgcrypto', () => ({
  encryptData: jest.fn(),
  decryptData: jest.fn(),
}));

const { encryptData, decryptData } = require('../../utils/pgcrypto');

describe('User Field Encryption', () => {
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

  describe('Age Encryption/Decryption', () => {
    describe('encryptAge', () => {
      it('should encrypt a valid age number', async () => {
        const age = 25;
        const mockEncrypted = 'encrypted-age-25';
        encryptData.mockResolvedValue(mockEncrypted);

        const result = await encryptAge(age);

        expect(encryptData).toHaveBeenCalledWith('25', mockEncryptionKey);
        expect(result).toBe(mockEncrypted);
      });

      it('should convert age to string before encryption', async () => {
        const age = 30;
        encryptData.mockResolvedValue('encrypted');

        await encryptAge(age);

        expect(encryptData).toHaveBeenCalledWith('30', mockEncryptionKey);
      });

      it('should return null for null age', async () => {
        const result = await encryptAge(null);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for undefined age', async () => {
        const result = await encryptAge(undefined);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should throw error if ENCRYPTION_KEY is not set', async () => {
        delete process.env.ENCRYPTION_KEY;

        await expect(encryptAge(25)).rejects.toThrow(
          'ENCRYPTION_KEY environment variable is required'
        );
      });

      it('should handle edge case ages (18, 65)', async () => {
        encryptData.mockResolvedValue('encrypted');

        await encryptAge(18);
        expect(encryptData).toHaveBeenCalledWith('18', mockEncryptionKey);

        await encryptAge(65);
        expect(encryptData).toHaveBeenCalledWith('65', mockEncryptionKey);
      });
    });

    describe('decryptAge', () => {
      it('should decrypt and convert to integer', async () => {
        const encryptedAge = 'encrypted-age-25';
        const decryptedString = '25';
        decryptData.mockResolvedValue(decryptedString);

        const result = await decryptAge(encryptedAge);

        expect(decryptData).toHaveBeenCalledWith(encryptedAge, mockEncryptionKey);
        expect(result).toBe(25);
      });

      it('should return null for null encrypted age', async () => {
        const result = await decryptAge(null);

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for empty string', async () => {
        const result = await decryptAge('');

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should throw error if ENCRYPTION_KEY is not set', async () => {
        delete process.env.ENCRYPTION_KEY;

        await expect(decryptAge('encrypted')).rejects.toThrow(
          'ENCRYPTION_KEY environment variable is required'
        );
      });

      it('should handle decrypted null string', async () => {
        decryptData.mockResolvedValue(null);

        const result = await decryptAge('encrypted');

        expect(result).toBeNull();
      });
    });

    describe('Age round-trip encryption', () => {
      it('should encrypt and decrypt age correctly', async () => {
        const originalAge = 25;
        const mockEncrypted = 'encrypted-age';
        const mockDecrypted = '25';

        encryptData.mockResolvedValue(mockEncrypted);
        decryptData.mockResolvedValue(mockDecrypted);

        const encrypted = await encryptAge(originalAge);
        const decrypted = await decryptAge(encrypted);

        expect(encrypted).toBe(mockEncrypted);
        expect(decrypted).toBe(25);
      });
    });
  });

  describe('Gender Encryption/Decryption', () => {
    describe('encryptGender', () => {
      it('should encrypt a valid gender string', async () => {
        const gender = 'Male';
        const mockEncrypted = 'encrypted-gender';
        encryptData.mockResolvedValue(mockEncrypted);

        const result = await encryptGender(gender);

        expect(encryptData).toHaveBeenCalledWith('Male', mockEncryptionKey);
        expect(result).toBe(mockEncrypted);
      });

      it('should return null for null gender', async () => {
        const result = await encryptGender(null);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for empty string', async () => {
        const result = await encryptGender('');

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should encrypt all valid gender values', async () => {
        encryptData.mockResolvedValue('encrypted');

        const genders = ['Male', 'Female', 'Other'];
        for (const gender of genders) {
          await encryptGender(gender);
          expect(encryptData).toHaveBeenCalledWith(gender, mockEncryptionKey);
        }
      });
    });

    describe('decryptGender', () => {
      it('should decrypt gender correctly', async () => {
        const encryptedGender = 'encrypted-gender';
        const decryptedGender = 'Female';
        decryptData.mockResolvedValue(decryptedGender);

        const result = await decryptGender(encryptedGender);

        expect(decryptData).toHaveBeenCalledWith(encryptedGender, mockEncryptionKey);
        expect(result).toBe(decryptedGender);
      });

      it('should return null for null encrypted gender', async () => {
        const result = await decryptGender(null);

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });

  describe('Course Encryption/Decryption', () => {
    describe('encryptCourse', () => {
      it('should encrypt a valid course string', async () => {
        const course = 'CSC';
        const mockEncrypted = 'encrypted-course';
        encryptData.mockResolvedValue(mockEncrypted);

        const result = await encryptCourse(course);

        expect(encryptData).toHaveBeenCalledWith('CSC', mockEncryptionKey);
        expect(result).toBe(mockEncrypted);
      });

      it('should return null for null course', async () => {
        const result = await encryptCourse(null);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for empty string', async () => {
        const result = await encryptCourse('');

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should handle various course codes', async () => {
        encryptData.mockResolvedValue('encrypted');

        const courses = ['CSC', 'EEE', 'CDM', 'NUR', 'MEC', 'PHT'];
        for (const course of courses) {
          await encryptCourse(course);
          expect(encryptData).toHaveBeenCalledWith(course, mockEncryptionKey);
        }
      });
    });

    describe('decryptCourse', () => {
      it('should decrypt course correctly', async () => {
        const encryptedCourse = 'encrypted-course';
        const decryptedCourse = 'EEE';
        decryptData.mockResolvedValue(decryptedCourse);

        const result = await decryptCourse(encryptedCourse);

        expect(decryptData).toHaveBeenCalledWith(encryptedCourse, mockEncryptionKey);
        expect(result).toBe(decryptedCourse);
      });

      it('should return null for null encrypted course', async () => {
        const result = await decryptCourse(null);

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });

  describe('Bio Encryption/Decryption', () => {
    describe('encryptBio', () => {
      it('should encrypt a valid bio string', async () => {
        const bio = 'This is a test bio about the user.';
        const mockEncrypted = 'encrypted-bio';
        encryptData.mockResolvedValue(mockEncrypted);

        const result = await encryptBio(bio);

        expect(encryptData).toHaveBeenCalledWith(bio, mockEncryptionKey);
        expect(result).toBe(mockEncrypted);
      });

      it('should handle long bio text', async () => {
        const longBio = 'A'.repeat(500);
        encryptData.mockResolvedValue('encrypted');

        await encryptBio(longBio);

        expect(encryptData).toHaveBeenCalledWith(longBio, mockEncryptionKey);
      });

      it('should return null for null bio', async () => {
        const result = await encryptBio(null);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for empty string', async () => {
        const result = await encryptBio('');

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });

    describe('decryptBio', () => {
      it('should decrypt bio correctly', async () => {
        const encryptedBio = 'encrypted-bio';
        const decryptedBio = 'This is the decrypted bio.';
        decryptData.mockResolvedValue(decryptedBio);

        const result = await decryptBio(encryptedBio);

        expect(decryptData).toHaveBeenCalledWith(encryptedBio, mockEncryptionKey);
        expect(result).toBe(decryptedBio);
      });

      it('should return null for null encrypted bio', async () => {
        const result = await decryptBio(null);

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });
    });
  });

  describe('Interests Encryption/Decryption', () => {
    describe('encryptInterests', () => {
      it('should encrypt a valid interests array', async () => {
        const interests = ['Programming', 'Gaming', 'Tech'];
        const mockEncrypted = 'encrypted-interests';
        encryptData.mockResolvedValue(mockEncrypted);

        const result = await encryptInterests(interests);

        expect(encryptData).toHaveBeenCalledWith(JSON.stringify(interests), mockEncryptionKey);
        expect(result).toBe(mockEncrypted);
      });

      it('should serialize array to JSON before encryption', async () => {
        const interests = ['Reading', 'Music'];
        encryptData.mockResolvedValue('encrypted');

        await encryptInterests(interests);

        expect(encryptData).toHaveBeenCalledWith('["Reading","Music"]', mockEncryptionKey);
      });

      it('should return null for null interests', async () => {
        const result = await encryptInterests(null);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for empty array', async () => {
        const result = await encryptInterests([]);

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for non-array value', async () => {
        const result = await encryptInterests('not-an-array');

        expect(encryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should handle single interest', async () => {
        const interests = ['Programming'];
        encryptData.mockResolvedValue('encrypted');

        await encryptInterests(interests);

        expect(encryptData).toHaveBeenCalledWith(JSON.stringify(interests), mockEncryptionKey);
      });

      it('should handle many interests', async () => {
        const interests = Array.from({ length: 20 }, (_, i) => `Interest${i}`);
        encryptData.mockResolvedValue('encrypted');

        await encryptInterests(interests);

        expect(encryptData).toHaveBeenCalledWith(JSON.stringify(interests), mockEncryptionKey);
      });
    });

    describe('decryptInterests', () => {
      it('should decrypt and parse interests array', async () => {
        const encryptedInterests = 'encrypted-interests';
        const decryptedJson = '["Programming","Gaming","Tech"]';
        decryptData.mockResolvedValue(decryptedJson);

        const result = await decryptInterests(encryptedInterests);

        expect(decryptData).toHaveBeenCalledWith(encryptedInterests, mockEncryptionKey);
        expect(result).toEqual(['Programming', 'Gaming', 'Tech']);
      });

      it('should return null for null encrypted interests', async () => {
        const result = await decryptInterests(null);

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null for empty string', async () => {
        const result = await decryptInterests('');

        expect(decryptData).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null if decrypted value is null', async () => {
        decryptData.mockResolvedValue(null);

        const result = await decryptInterests('encrypted');

        expect(result).toBeNull();
      });

      it('should handle invalid JSON gracefully', async () => {
        const encryptedInterests = 'encrypted-interests';
        const invalidJson = 'not-valid-json';
        decryptData.mockResolvedValue(invalidJson);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = await decryptInterests(encryptedInterests);

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error parsing decrypted interests:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle empty array JSON', async () => {
        decryptData.mockResolvedValue('[]');

        const result = await decryptInterests('encrypted');

        expect(result).toEqual([]);
      });
    });

    describe('Interests round-trip encryption', () => {
      it('should encrypt and decrypt interests correctly', async () => {
        const originalInterests = ['Programming', 'Gaming', 'Tech'];
        const mockEncrypted = 'encrypted-interests';
        const mockDecrypted = JSON.stringify(originalInterests);

        encryptData.mockResolvedValue(mockEncrypted);
        decryptData.mockResolvedValue(mockDecrypted);

        const encrypted = await encryptInterests(originalInterests);
        const decrypted = await decryptInterests(encrypted);

        expect(encrypted).toBe(mockEncrypted);
        expect(decrypted).toEqual(originalInterests);
      });
    });
  });

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

      decryptData
        .mockResolvedValueOnce('25') // age
        .mockResolvedValueOnce('Female') // gender
        .mockResolvedValueOnce('CSC') // course
        .mockResolvedValueOnce('Test bio') // bio
        .mockResolvedValueOnce('["Programming","Gaming"]'); // interests

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

      decryptData
        .mockResolvedValueOnce('30') // age
        .mockResolvedValueOnce('Male'); // gender

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

      decryptData.mockResolvedValueOnce('25').mockResolvedValueOnce('Female');

      const result = await decryptUserFields(encryptedUser);

      expect(result.interests).toEqual([]);
    });

    it('should return user as-is if user is null', async () => {
      const result = await decryptUserFields(null);

      expect(result).toBeNull();
      expect(decryptData).not.toHaveBeenCalled();
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

      decryptData.mockResolvedValueOnce('28').mockResolvedValueOnce('Other');

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

      decryptData
        .mockResolvedValueOnce('25') // user-1 age
        .mockResolvedValueOnce('Female') // user-1 gender
        .mockResolvedValueOnce('CSC') // user-1 course
        .mockResolvedValueOnce('30') // user-2 age
        .mockResolvedValueOnce('Male') // user-2 gender
        .mockResolvedValueOnce('Test bio') // user-2 bio
        .mockResolvedValueOnce('["Reading"]'); // user-2 interests

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
      expect(decryptData).not.toHaveBeenCalled();
    });

    it('should return non-array as-is', async () => {
      const result = await decryptUsersFields('not-an-array');

      expect(result).toBe('not-an-array');
      expect(decryptData).not.toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      const result = await decryptUsersFields([]);

      expect(result).toEqual([]);
      expect(decryptData).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate encryption errors', async () => {
      encryptData.mockRejectedValue(new Error('Encryption failed'));

      await expect(encryptAge(25)).rejects.toThrow('Encryption failed');
    });

    it('should propagate decryption errors', async () => {
      decryptData.mockRejectedValue(new Error('Decryption failed'));

      await expect(decryptAge('encrypted')).rejects.toThrow('Decryption failed');
    });

    it('should handle missing ENCRYPTION_KEY for all functions', async () => {
      delete process.env.ENCRYPTION_KEY;

      await expect(encryptAge(25)).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(encryptGender('Male')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(encryptCourse('CSC')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(encryptBio('Bio')).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
      await expect(encryptInterests(['Test'])).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required'
      );
    });
  });

  describe('Integration Tests', () => {
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
      encryptData
        .mockResolvedValueOnce('encrypted-age')
        .mockResolvedValueOnce('encrypted-gender')
        .mockResolvedValueOnce('encrypted-course')
        .mockResolvedValueOnce('encrypted-bio')
        .mockResolvedValueOnce('encrypted-interests');

      // Encrypt fields
      const [encryptedAge, encryptedGender, encryptedCourse, encryptedBio, encryptedInterests] =
        await Promise.all([
          encryptAge(originalUser.age),
          encryptGender(originalUser.gender),
          encryptCourse(originalUser.course),
          encryptBio(originalUser.bio),
          encryptInterests(originalUser.interests),
        ]);

      // Mock decryption
      decryptData
        .mockResolvedValueOnce('28')
        .mockResolvedValueOnce('Male')
        .mockResolvedValueOnce('CSC')
        .mockResolvedValueOnce('Software developer')
        .mockResolvedValueOnce(JSON.stringify(originalUser.interests));

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
});
