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
 * Sanitize potentially dangerous patterns by removing dangerous tags but preserving safe text content
 * @param {string} str - String to clean
 * @returns {string} - Sanitized string with dangerous tags removed but text content preserved
 */
function removeDangerousPatterns(str) {
  if (typeof str !== 'string') return '';

  let cleaned = str;

  // Remove javascript: protocol
  cleaned = cleaned.replace(/javascript:/gi, '');

  // Remove data: URLs (can be used for XSS)
  cleaned = cleaned.replace(/data:(?:image|text|application)\/[^;]*;base64,/gi, '');

  // Remove on* event handlers (onclick, onerror, etc.) - remove attributes but preserve tag content
  cleaned = cleaned.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');

  // Remove script tags - script content is typically code and should be removed entirely
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Remove iframe tags - preserve alt text or title if present
  cleaned = cleaned.replace(/<iframe[^>]*alt=["']([^"']*)["'][^>]*>[\s\S]*?<\/iframe>/gi, '$1');
  cleaned = cleaned.replace(/<iframe[^>]*title=["']([^"']*)["'][^>]*>[\s\S]*?<\/iframe>/gi, '$1');
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

  // Remove style tags - CSS content shouldn't be preserved as text
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove object tags - preserve text content if it exists
  cleaned = cleaned.replace(/<object[^>]*>([\s\S]*?)<\/object>/gi, (match, content) => {
    // Extract text content only (remove nested tags)
    const textOnly = content.replace(/<[^>]*>/g, '').trim();
    return textOnly;
  });

  // Remove embed tags - these typically don't have meaningful text content
  cleaned = cleaned.replace(/<embed[\s\S]*?<\/embed>/gi, '');
  cleaned = cleaned.replace(/<embed\b[^>]*\/?>/gi, '');

  // Remove any remaining dangerous attributes from other tags
  cleaned = cleaned.replace(/<([^>]*)\s(on\w+|javascript:|data:[^=]*)=[^\s>]*(.*?)>/gi, '<$1$3>');

  // Final pass: remove any remaining dangerous tag patterns
  cleaned = cleaned.replace(/<(script|iframe|style|object|embed)[\s\S]*?<\/\1>/gi, '');
  cleaned = cleaned.replace(/<(script|iframe|style|object|embed)\b[^>]*\/?>/gi, '');

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
