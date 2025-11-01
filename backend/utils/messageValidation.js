/**
 * Security validation and sanitization utilities for chat messages
 */

// Maximum message length (5000 characters)
const MAX_MESSAGE_LENGTH = 5000;

// Minimum message length (after trim)
const MIN_MESSAGE_LENGTH = 1;

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Remove potentially dangerous patterns
 * @param {string} str - String to clean
 * @returns {string} - Cleaned string
 */
function removeDangerousPatterns(str) {
  if (typeof str !== 'string') return '';
  
  // Remove javascript: protocol
  let cleaned = str.replace(/javascript:/gi, '');
  
  // Remove data: URLs (can be used for XSS)
  cleaned = cleaned.replace(/data:(?:image|text|application)\/[^;]*;base64,/gi, '');
  
  // Remove on* event handlers (onclick, onerror, etc.)
  cleaned = cleaned.replace(/\bon\w+\s*=/gi, '');
  
  // Remove script tags
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove iframe tags
  cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove style tags
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove object/embed tags
  cleaned = cleaned.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  cleaned = cleaned.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  // Also match self-closing embed tags
  cleaned = cleaned.replace(/<embed\b[^>]*\/?>/gi, '');
  
  return cleaned;
}

/**
 * Normalize Unicode and validate encoding
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
function normalizeUnicode(str) {
  if (typeof str !== 'string') return '';
  
  // Remove zero-width characters that can be used for obfuscation
  const zeroWidthChars = /[\u200B-\u200D\uFEFF\u00AD]/g;
  let normalized = str.replace(zeroWidthChars, '');
  
  // Normalize Unicode to NFC form
  try {
    normalized = normalized.normalize('NFC');
  } catch (e) {
    // If normalization fails, return original (trimmed)
    return normalized.trim();
  }
  
  return normalized;
}

/**
 * Validate and sanitize message content
 * @param {string} content - Raw message content
 * @returns {object} - { isValid: boolean, sanitized: string, error: string | null }
 */
function validateAndSanitizeMessage(content) {
  // Check if content exists and is a string
  if (!content || typeof content !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      error: 'Message content must be a non-empty string',
    };
  }

  // Check length before processing
  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      sanitized: '',
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  // Trim whitespace
  let sanitized = content.trim();

  // Check minimum length after trim
  if (sanitized.length < MIN_MESSAGE_LENGTH) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Message cannot be empty',
    };
  }

  // Normalize Unicode
  sanitized = normalizeUnicode(sanitized);

  // Remove dangerous patterns (before HTML escaping)
  sanitized = removeDangerousPatterns(sanitized);

  // Re-trim after pattern removal
  sanitized = sanitized.trim();

  // Final length check after sanitization
  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      sanitized: '',
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  if (sanitized.length < MIN_MESSAGE_LENGTH) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Message cannot be empty after sanitization',
    };
  }

  // Escape HTML to prevent XSS (this should be done when displaying, not storing)
  // For storage, we keep the text as-is but validated
  // The HTML escaping should happen in the frontend when rendering
  
  return {
    isValid: true,
    sanitized: sanitized,
    error: null,
  };
}

/**
 * Validate conversation ID format (UUID)
 * @param {string} id - Conversation ID
 * @returns {boolean} - True if valid UUID format
 */
function validateConversationId(id) {
  if (!id || typeof id !== 'string') return false;
  
  // UUID v4 pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

/**
 * Validate user ID format (UUID)
 * @param {string} id - User ID
 * @returns {boolean} - True if valid UUID format
 */
function validateUserId(id) {
  if (!id || typeof id !== 'string') return false;
  
  // UUID v4 pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

module.exports = {
  validateAndSanitizeMessage,
  validateConversationId,
  validateUserId,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  escapeHtml, // Export for frontend use if needed
};

