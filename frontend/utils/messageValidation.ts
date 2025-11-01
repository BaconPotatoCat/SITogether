/**
 * Frontend security validation utilities for chat messages
 * Mirrors backend validation for client-side validation
 */

// Maximum message length (must match backend)
export const MAX_MESSAGE_LENGTH = 5000;

// Minimum message length
export const MIN_MESSAGE_LENGTH = 1;

/**
 * Escape HTML to prevent XSS attacks when displaying user input
 * @param str - String to escape
 * @returns Escaped string safe for HTML display
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return str.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Validate message content length and basic format
 * @param content - Message content to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateMessageContent(content: string | null | undefined): {
  isValid: boolean;
  error: string | null;
} {
  if (!content || typeof content !== 'string') {
    return {
      isValid: false,
      error: 'Message content must be a non-empty string',
    };
  }

  const trimmed = content.trim();

  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: 'Message cannot be empty',
    };
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  return {
    isValid: true,
    error: null,
  };
}

/**
 * Sanitize message for display (escape HTML)
 * @param content - Message content to sanitize
 * @returns Sanitized content safe for HTML rendering
 */
export function sanitizeForDisplay(content: string): string {
  if (typeof content !== 'string') return '';
  return escapeHtml(content);
}

