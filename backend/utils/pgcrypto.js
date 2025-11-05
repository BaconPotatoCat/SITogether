const prisma = require('../lib/prisma');

/**
 * pgcrypto Utility Functions
 * 
 * Provides encryption and decryption functions using PostgreSQL's pgcrypto extension.
 * Data is encrypted at rest in the database using AES-256 encryption.
 * 
 * Note: The encryption key must be stored securely (e.g., in environment variables)
 * and should never be committed to version control.
 */

/**
 * Encrypt data using pgcrypto's pgp_sym_encrypt function
 * @param {string} plaintext - The data to encrypt
 * @param {string} encryptionKey - The encryption key (from ENV)
 * @returns {Promise<string>} - Base64 encoded encrypted data
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
 * @returns {Promise<string>} - Decrypted plaintext
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

/**
 * Encrypt data directly in PostgreSQL using a SQL query expression
 * 
 * ⚠️ WARNING: This function constructs SQL strings and should be used with caution.
 * Prefer using encryptData() with parameterized queries for better security.
 * 
 * @param {string} plaintext - The data to encrypt
 * @param {string} encryptionKey - The encryption key
 * @returns {string} - SQL expression for encryption
 */
function encryptSqlExpression(plaintext, encryptionKey) {
  if (!plaintext) {
    return 'NULL';
  }
  
  if (!encryptionKey) {
    throw new Error('Encryption key is required');
  }
  
  // Escape single quotes to prevent SQL injection
  const escapedPlaintext = plaintext.replace(/'/g, "''");
  const escapedKey = encryptionKey.replace(/'/g, "''");
  
  // Return SQL expression for use in raw queries
  // Note: This requires careful parameterization to prevent SQL injection
  return `encode(pgp_sym_encrypt('${escapedPlaintext}', '${escapedKey}'), 'base64')`;
}

module.exports = {
  encryptData,
  decryptData,
  encryptSqlExpression,
};
