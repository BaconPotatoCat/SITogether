const crypto = require('crypto');
const prisma = require('../lib/prisma');
const config = require('../lib/config');

/**
 * Field Encryption Utility
 *
 * Provides application-level encryption for all user data at rest.
 * Uses PostgreSQL's pgcrypto extension for encryption/decryption and SHA-256 for email hashing.
 *
 * This module handles:
 * - Low-level database encryption (encryptData, decryptData)
 * - Email encryption and hashing
 * - User profile field encryption (age, gender, course, bio, interests)
 * - Message encryption and decryption
 *
 * Note: The encryption key must be stored securely (e.g., in environment variables)
 * and should never be committed to version control.
 */

// ============================================================================
// LOW-LEVEL ENCRYPTION FUNCTIONS (pgcrypto)
// ============================================================================

/**
 * Encrypt data using pgcrypto's pgp_sym_encrypt function
 * @param {string} plaintext - The data to encrypt
 * @param {string} encryptionKey - The encryption key (from ENV)
 * @returns {Promise<string|null>} - Base64 encoded encrypted data or null if plaintext is null/undefined
 */
async function encryptData(plaintext, encryptionKey) {
  if (!plaintext) {
    return null;
  }

  if (!encryptionKey) {
    throw new Error('Encryption key is required. Set ENCRYPTION_KEY in environment variables.');
  }

  try {
    const result = await prisma.$queryRaw`
      SELECT encode(pgp_sym_encrypt(${plaintext}, ${encryptionKey}), 'base64') as encrypted
    `;

    return result[0].encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using pgcrypto's pgp_sym_decrypt function
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} encryptionKey - The encryption key (from ENV)
 * @returns {Promise<string|null>} - Decrypted plaintext or null if encryptedData is null/undefined
 */
async function decryptData(encryptedData, encryptionKey) {
  if (!encryptedData) {
    return null;
  }

  if (!encryptionKey) {
    throw new Error('Encryption key is required. Set ENCRYPTION_KEY in environment variables.');
  }

  try {
    const result = await prisma.$queryRaw`
      SELECT pgp_sym_decrypt(decode(${encryptedData}, 'base64'), ${encryptionKey}) as decrypted
    `;

    return result[0].decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// ============================================================================
// GENERIC FIELD ENCRYPTION HELPERS
// ============================================================================

/**
 * Generic function to encrypt a field value
 * @param {*} value - The value to encrypt
 * @param {Function} [preTransform] - Optional function to transform value before encryption (e.g., number to string)
 * @returns {Promise<string|null>} - Encrypted value or null if value is null/undefined/empty
 */
async function encryptField(value, preTransform = null) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Apply pre-transform if provided (e.g., convert number to string)
  const transformedValue = preTransform ? preTransform(value) : value;

  // Handle empty strings/arrays after transformation
  if (!transformedValue || (Array.isArray(transformedValue) && transformedValue.length === 0)) {
    return null;
  }

  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await encryptData(transformedValue, config.encryptionKey);
}

/**
 * Generic function to decrypt a field value
 * @param {string|null} encryptedValue - The encrypted value
 * @param {Function} [postTransform] - Optional function to transform decrypted value (e.g., string to number)
 * @returns {Promise<*>} - Decrypted value or null
 */
async function decryptField(encryptedValue, postTransform = null) {
  if (!encryptedValue) {
    return null;
  }

  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  const decryptedValue = await decryptData(encryptedValue, config.encryptionKey);

  if (!decryptedValue) {
    return null;
  }

  // Apply post-transform if provided (e.g., convert string to number)
  return postTransform ? postTransform(decryptedValue) : decryptedValue;
}

// ============================================================================
// MESSAGE ENCRYPTION FUNCTIONS
// ============================================================================
// Note: Message encryption/decryption functions have been removed.
// Use encryptField() and decryptField() directly:
// - encryptField(messageContent) / decryptField(encryptedMessage)

// ============================================================================
// EMAIL ENCRYPTION FUNCTIONS
// ============================================================================

/**
 * Hash email for authentication and lookup purposes
 * Uses SHA-256 for consistent, fast hashing
 * @param {string} email - The email address to hash
 * @returns {string} - Hexadecimal hash of the email
 */
function hashEmail(email) {
  if (!email) {
    throw new Error('Email is required for hashing');
  }

  // Normalize email (lowercase, trim) for consistent hashing
  const normalizedEmail = email.toLowerCase().trim();

  // Create SHA-256 hash
  return crypto.createHash('sha256').update(normalizedEmail).digest('hex');
}

// ============================================================================
// EMAIL ENCRYPTION FUNCTIONS
// ============================================================================
// Note: Email encryption/decryption functions have been removed.
// Use encryptField() and decryptField() directly:
// - encryptField(email) / decryptField(encryptedEmail)

/**
 * Prepare email for storage: hash for lookup and encrypt for storage
 * @param {string} email - The email address to prepare
 * @returns {Promise<{emailHash: string, encryptedEmail: string}>}
 */
async function prepareEmailForStorage(email) {
  if (!email) {
    throw new Error('Email is required');
  }

  const emailHash = hashEmail(email);
  const encryptedEmail = await encryptField(email);

  return {
    emailHash,
    encryptedEmail,
  };
}

// ============================================================================
// USER FIELD ENCRYPTION FUNCTIONS
// ============================================================================
// Note: Field-specific encryption/decryption functions have been removed.
// Use encryptField() and decryptField() directly with appropriate transforms:
// - Age: encryptField(age, (v) => v.toString()) / decryptField(encrypted, (v) => parseInt(v, 10))
// - Gender/Course/Bio: encryptField(value) / decryptField(encrypted)
// - Interests: encryptField(interests, (v) => Array.isArray(v) && v.length > 0 ? JSON.stringify(v) : null)
//              decryptField(encrypted, (v) => { try { return JSON.parse(v); } catch { return null; } })

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
      decryptField(user.age, (value) => parseInt(value, 10)),
      decryptField(user.gender),
      decryptField(user.course),
      decryptField(user.bio),
      decryptField(user.interests, (value) => {
        try {
          return JSON.parse(value);
        } catch (error) {
          console.error('Error parsing decrypted interests:', error);
          return null;
        }
      }),
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
  // Generic field encryption helpers
  encryptField,
  decryptField,
  // Email functions
  hashEmail,
  prepareEmailForStorage,
  // Helper functions
  decryptUserFields,
  decryptUsersFields,
};
