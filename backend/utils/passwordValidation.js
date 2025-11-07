/**
 * Password validation utility following NIST Password Guidelines 2025
 *
 * Key requirements:
 * - Minimum length: 8 characters
 * - Maximum length: 64 characters
 * - Check against commonly used/compromised passwords via Have I Been Pwned API
 * - No mandatory complexity requirements (no forced uppercase, numbers, special chars)
 * - Allow all printable ASCII characters, Unicode characters, and spaces
 */

const crypto = require('crypto');
const https = require('https');
function getHibpHash(value) {
  return crypto.createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
}

/**
 * Checks if a password has been compromised using Have I Been Pwned API
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function checkPasswordPwned(password) {
  try {
    const hash = getHibpHash(password);

    // Extract first 5 characters (prefix) and remaining 35 characters (suffix)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5).toUpperCase(); // Ensure uppercase for comparison

    return new Promise((resolve, _reject) => {
      const options = {
        hostname: 'api.pwnedpasswords.com',
        path: `/range/${prefix}`,
        method: 'GET',
        headers: {
          'User-Agent': 'SITogether-Password-Validator',
        },
        timeout: 5000, // 5 second timeout
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            // Parse the response: each line is in format "SUFFIX:COUNT" (CRLF or LF line endings)
            const lines = data.split(/\r?\n/).filter((line) => line.trim().length > 0);
            const suffixes = lines.map((line) => {
              const trimmedLine = line.trim();
              const parts = trimmedLine.split(':');
              return parts[0].trim().toUpperCase(); // Get the suffix (first part before colon), trim and uppercase
            });

            // Check if our suffix appears in the list (uppercase for consistency)
            const isPwned = suffixes.includes(suffix.toUpperCase());

            if (isPwned) {
              console.log(
                `[HIBP] Password found in database. Prefix: ${prefix}, Suffix: ${suffix}`
              );
            }

            resolve(isPwned);
          } else {
            // If API returns non-200, assume password is safe (fail open)
            // This prevents blocking legitimate passwords if API is down
            console.warn(`HIBP API returned status ${res.statusCode}, assuming password is safe`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        // If request fails (network error, timeout, etc.), assume password is safe (fail open)
        // This prevents blocking legitimate passwords if API is unavailable
        console.warn(`HIBP API check failed: ${error.message}, assuming password is safe`);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('HIBP API request timed out, assuming password is safe');
        resolve(false);
      });

      req.end();
    });
  } catch (error) {
    // If any error occurs, assume password is safe (fail open)
    console.warn(
      `Error checking password with HIBP API: ${error.message}, assuming password is safe`
    );
    return false;
  }
}

/**
 * Validates a password according to NIST 2025 guidelines
 * @param {string} password
 * @returns {Promise<Object>}
 */
async function validatePassword(password) {
  const errors = [];

  // Check if password is provided
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required'],
    };
  }

  // Check minimum length (8 characters)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check maximum length (64 characters)
  if (password.length > 64) {
    errors.push('Password must be no more than 64 characters long');
  }

  // Check for leading/trailing whitespace (should be trimmed by caller, but validate anyway)
  // Using length comparison to avoid timing attack warning - we're checking whitespace, not secrets
  if (password.length !== password.trim().length) {
    errors.push('Password cannot start or end with whitespace');
  }

  // If there are already errors, don't check with HIBP API
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  // Check against Have I Been Pwned API
  const isPwned = await checkPasswordPwned(password);
  if (isPwned) {
    errors.push(
      'This password has been found in data breaches. Please choose a different password'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that a new password is different from the current password
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<Object>}
 */
async function validatePasswordChange(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    return {
      isValid: false,
      errors: ['Current password and new password are required'],
    };
  }

  // Check that new password is different from current password
  if (currentPassword === newPassword) {
    return {
      isValid: false,
      errors: ['New password must be different from your current password'],
    };
  }

  // Validate the new password using standard validation
  const passwordValidation = await validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return {
      isValid: false,
      errors: passwordValidation.errors,
    };
  }

  return {
    isValid: true,
    errors: [],
  };
}

module.exports = {
  validatePassword,
  validatePasswordChange,
};
