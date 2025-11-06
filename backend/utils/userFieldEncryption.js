const { encryptData, decryptData } = require('./pgcrypto');

/**
 * User Field Encryption Utility
 *
 * Provides application-level encryption for user profile fields at rest.
 * Uses pgcrypto for encryption/decryption.
 *
 * Fields encrypted:
 * - age (Int -> String conversion)
 * - gender (String)
 * - course (String?, nullable)
 * - bio (Text?, nullable)
 * - interests (String[] -> JSON String conversion)
 */

/**
 * Encrypt age for storage at rest
 * @param {number} age - The age to encrypt
 * @returns {Promise<string|null>} - Encrypted age (base64 encoded) or null if age is null/undefined
 */
async function encryptAge(age) {
  if (age === null || age === undefined) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Convert number to string for encryption
  const ageString = age.toString();
  return await encryptData(ageString, encryptionKey);
}

/**
 * Decrypt age from storage
 * @param {string|null} encryptedAge - The encrypted age (base64 encoded)
 * @returns {Promise<number|null>} - Decrypted age as integer or null
 */
async function decryptAge(encryptedAge) {
  if (!encryptedAge) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  const decryptedString = await decryptData(encryptedAge, encryptionKey);
  // Convert back to integer
  return decryptedString ? parseInt(decryptedString, 10) : null;
}

/**
 * Encrypt gender for storage at rest
 * @param {string} gender - The gender to encrypt
 * @returns {Promise<string|null>} - Encrypted gender (base64 encoded) or null if gender is null/undefined
 */
async function encryptGender(gender) {
  if (!gender) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await encryptData(gender, encryptionKey);
}

/**
 * Decrypt gender from storage
 * @param {string|null} encryptedGender - The encrypted gender (base64 encoded)
 * @returns {Promise<string|null>} - Decrypted gender or null
 */
async function decryptGender(encryptedGender) {
  if (!encryptedGender) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await decryptData(encryptedGender, encryptionKey);
}

/**
 * Encrypt course for storage at rest
 * @param {string|null} course - The course to encrypt
 * @returns {Promise<string|null>} - Encrypted course (base64 encoded) or null if course is null/undefined
 */
async function encryptCourse(course) {
  if (!course) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await encryptData(course, encryptionKey);
}

/**
 * Decrypt course from storage
 * @param {string|null} encryptedCourse - The encrypted course (base64 encoded)
 * @returns {Promise<string|null>} - Decrypted course or null
 */
async function decryptCourse(encryptedCourse) {
  if (!encryptedCourse) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await decryptData(encryptedCourse, encryptionKey);
}

/**
 * Encrypt bio for storage at rest
 * @param {string|null} bio - The bio to encrypt
 * @returns {Promise<string|null>} - Encrypted bio (base64 encoded) or null if bio is null/undefined
 */
async function encryptBio(bio) {
  if (!bio) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await encryptData(bio, encryptionKey);
}

/**
 * Decrypt bio from storage
 * @param {string|null} encryptedBio - The encrypted bio (base64 encoded)
 * @returns {Promise<string|null>} - Decrypted bio or null
 */
async function decryptBio(encryptedBio) {
  if (!encryptedBio) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await decryptData(encryptedBio, encryptionKey);
}

/**
 * Encrypt interests array for storage at rest
 * @param {string[]|null} interests - The interests array to encrypt
 * @returns {Promise<string|null>} - Encrypted interests (base64 encoded JSON string) or null if interests is null/empty
 */
async function encryptInterests(interests) {
  if (!interests || !Array.isArray(interests) || interests.length === 0) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Serialize array to JSON string before encryption
  const interestsJson = JSON.stringify(interests);
  return await encryptData(interestsJson, encryptionKey);
}

/**
 * Decrypt interests from storage
 * @param {string|null} encryptedInterests - The encrypted interests (base64 encoded JSON string)
 * @returns {Promise<string[]|null>} - Decrypted interests array or null
 */
async function decryptInterests(encryptedInterests) {
  if (!encryptedInterests) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  const decryptedJson = await decryptData(encryptedInterests, encryptionKey);
  if (!decryptedJson) {
    return null;
  }

  // Parse JSON string back to array
  try {
    return JSON.parse(decryptedJson);
  } catch (error) {
    console.error('Error parsing decrypted interests:', error);
    return null;
  }
}

/**
 * Decrypt all user fields from a user object
 * @param {Object} user - User object with encrypted fields
 * @returns {Promise<Object>} - User object with decrypted fields
 */
async function decryptUserFields(user) {
  if (!user) {
    return user;
  }

  const [decryptedAge, decryptedGender, decryptedCourse, decryptedBio, decryptedInterests] =
    await Promise.all([
      decryptAge(user.age),
      decryptGender(user.gender),
      decryptCourse(user.course),
      decryptBio(user.bio),
      decryptInterests(user.interests),
    ]);

  return {
    ...user,
    age: decryptedAge,
    gender: decryptedGender,
    course: decryptedCourse,
    bio: decryptedBio,
    interests: decryptedInterests || [], // Ensure interests is always an array
  };
}

/**
 * Decrypt multiple user fields from an array of user objects
 * @param {Array} users - Array of user objects with encrypted fields
 * @returns {Promise<Array>} - Array of user objects with decrypted fields
 */
async function decryptUsersFields(users) {
  if (!users || !Array.isArray(users)) {
    return users;
  }

  return Promise.all(users.map((user) => decryptUserFields(user)));
}

module.exports = {
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
};
