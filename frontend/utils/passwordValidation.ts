/**
 * Password validation utility following NIST Password Guidelines 2025
 *
 * Key requirements:
 * - Minimum length: 8 characters
 * - Maximum length: 64 characters
 * - Check against commonly used/compromised passwords via Have I Been Pwned API (backend)
 * - No mandatory complexity requirements (no forced uppercase, numbers, special chars)
 * - Allow all printable ASCII characters, Unicode characters, and spaces
 *
 */

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validates a password according to NIST 2025 guidelines
 * @param password
 * @returns PasswordValidationResult
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required'],
    }
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (password.length > 64) {
    errors.push('Password must be no more than 64 characters long')
  }

  // Check for leading/trailing whitespace (should be trimmed by caller, but validate anyway)
  if (password !== password.trim()) {
    errors.push('Password cannot start or end with whitespace')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * @param currentPassword
 * @param newPassword
 * @returns PasswordValidationResult
 */
export function validatePasswordChange(
  currentPassword: string,
  newPassword: string
): PasswordValidationResult {
  const errors: string[] = []

  if (!currentPassword || !newPassword) {
    return {
      isValid: false,
      errors: ['Current password and new password are required'],
    }
  }

  if (currentPassword === newPassword) {
    errors.push('New password must be different from your current password')
  }

  const passwordValidation = validatePassword(newPassword)
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
