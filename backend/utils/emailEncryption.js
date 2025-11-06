const crypto = require('crypto');
const { encryptData, decryptData } = require('./pgcrypto');

/**
 * Email Encryption Utility
 *
 * Provides application-level encryption for email data at rest.
 * Uses pgcrypto for encryption/decryption and SHA-256 for hashing.
 */

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

/**
 * Encrypt email for storage at rest
 * @param {string} email - The email address to encrypt
 * @returns {Promise<string>} - Encrypted email (base64 encoded)
 */
async function encryptEmail(email) {
  if (!email) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await encryptData(email, encryptionKey);
}

/**
 * Decrypt email from storage
 * @param {string} encryptedEmail - The encrypted email (base64 encoded)
 * @returns {Promise<string>} - Decrypted email address
 */
async function decryptEmail(encryptedEmail) {
  if (!encryptedEmail) {
    return null;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  return await decryptData(encryptedEmail, encryptionKey);
}

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
  const encryptedEmail = await encryptEmail(email);

  return {
    emailHash,
    encryptedEmail,
  };
}

module.exports = {
  hashEmail,
  encryptEmail,
  decryptEmail,
  prepareEmailForStorage,
};
