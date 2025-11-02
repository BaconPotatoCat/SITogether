const {
  validateAndSanitizeMessage,
  validateConversationId,
  validateUserId,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  escapeHtml,
} = require('../../utils/messageValidation');

describe('Message Validation Utility', () => {
  describe('validateAndSanitizeMessage', () => {
    describe('Valid messages', () => {
      it('should accept a simple valid message', () => {
        const result = validateAndSanitizeMessage('Hello, how are you?');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello, how are you?');
        expect(result.error).toBeNull();
      });

      it('should trim whitespace from valid message', () => {
        const result = validateAndSanitizeMessage('  Hello world  ');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello world');
        expect(result.error).toBeNull();
      });

      it('should accept message with special characters', () => {
        const result = validateAndSanitizeMessage('Hello! How are you? @user #hashtag');
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello! How are you? @user #hashtag');
        expect(result.error).toBeNull();
      });

      it('should accept message at maximum length', () => {
        const longMessage = 'a'.repeat(MAX_MESSAGE_LENGTH);
        const result = validateAndSanitizeMessage(longMessage);
        expect(result.isValid).toBe(true);
        expect(result.sanitized.length).toBe(MAX_MESSAGE_LENGTH);
        expect(result.error).toBeNull();
      });

      it('should accept unicode characters', () => {
        const result = validateAndSanitizeMessage('Hello 世界 🌍');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    describe('Invalid messages', () => {
      it('should reject null input', () => {
        const result = validateAndSanitizeMessage(null);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Message content must be a non-empty string');
      });

      it('should reject undefined input', () => {
        const result = validateAndSanitizeMessage(undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Message content must be a non-empty string');
      });

      it('should reject non-string input', () => {
        const result = validateAndSanitizeMessage(123);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Message content must be a non-empty string');
      });

      it('should reject empty string', () => {
        const result = validateAndSanitizeMessage('');
        expect(result.isValid).toBe(false);
        // Empty string is caught by the initial type check
        expect(result.error).toBe('Message content must be a non-empty string');
      });

      it('should reject whitespace-only string', () => {
        const result = validateAndSanitizeMessage('   \n\t  ');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Message cannot be empty');
      });

      it('should reject message exceeding maximum length', () => {
        const longMessage = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
        const result = validateAndSanitizeMessage(longMessage);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
        );
      });
    });

    describe('XSS prevention', () => {
      it('should remove script tags', () => {
        const malicious = '<script>alert("XSS")</script>Hello';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello');
        expect(result.sanitized).not.toContain('<script>');
      });

      it('should remove iframe tags', () => {
        const malicious = '<iframe src="evil.com"></iframe>Hello';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello');
        expect(result.sanitized).not.toContain('<iframe>');
      });

      it('should remove javascript: protocol', () => {
        const malicious = 'javascript:alert("XSS")';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).not.toContain('javascript:');
      });

      it('should remove data: URLs', () => {
        const malicious = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).not.toContain('data:');
      });

      it('should remove on* event handlers', () => {
        const malicious = '<div onclick="alert(1)">Hello</div>';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).not.toContain('onclick=');
        expect(result.sanitized).not.toContain('onerror=');
      });

      it('should remove style tags', () => {
        const malicious = '<style>body { color: red; }</style>Hello';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello');
        expect(result.sanitized).not.toContain('<style>');
      });

      it('should remove object and embed tags', () => {
        const malicious = '<object data="evil.swf"></object>Hello<embed src="evil.swf"></embed>';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello');
        expect(result.sanitized).not.toContain('<object');
        expect(result.sanitized).not.toContain('<embed');
      });

      it('should handle multiple XSS attempts', () => {
        const malicious =
          '<script>alert(1)</script>Hello<iframe src="evil.com"></iframe><style>body{}</style>';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('Hello');
      });
    });

    describe('Unicode normalization', () => {
      it('should normalize unicode characters', () => {
        const result = validateAndSanitizeMessage('Hello');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should remove zero-width characters', () => {
        const malicious = 'Hello\u200B\u200C\u200D\uFEFF\u00ADWorld';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe('HelloWorld');
        expect(result.sanitized).not.toContain('\u200B');
      });
    });

    describe('Edge cases', () => {
      it('should handle message with only dangerous content', () => {
        const malicious = '<script></script>';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Message cannot be empty after sanitization');
      });

      it('should preserve valid content after removing dangerous parts', () => {
        const mixed = 'Hello<script>alert(1)</script>World';
        const result = validateAndSanitizeMessage(mixed);
        expect(result.isValid).toBe(true);
        // Script tags removed entirely, valid text preserved
        expect(result.sanitized).toBe('HelloWorld');
      });

      it('should handle mixed case XSS attempts', () => {
        const malicious = '<ScRiPt>alert(1)</ScRiPt>Hello';
        const result = validateAndSanitizeMessage(malicious);
        expect(result.isValid).toBe(true);
        // Script tags removed entirely, valid text preserved
        expect(result.sanitized).toBe('Hello');
        expect(result.sanitized).not.toMatch(/<script/i);
      });
    });
  });

  describe('validateConversationId', () => {
    it('should accept valid UUID v4', () => {
      const validId = '478bba95-71bf-4224-be35-6d81dffe75f3';
      expect(validateConversationId(validId)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(validateConversationId('not-a-uuid')).toBe(false);
      expect(validateConversationId('12345')).toBe(false);
      expect(validateConversationId('478bba95-71bf-4224-be35')).toBe(false);
    });

    it('should reject null', () => {
      expect(validateConversationId(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateConversationId(undefined)).toBe(false);
    });

    it('should reject non-string', () => {
      expect(validateConversationId(123)).toBe(false);
      expect(validateConversationId({})).toBe(false);
    });

    it('should accept uppercase UUID', () => {
      const validId = '478BBA95-71BF-4224-BE35-6D81DFFE75F3';
      expect(validateConversationId(validId)).toBe(true);
    });
  });

  describe('validateUserId', () => {
    it('should accept valid UUID v4', () => {
      const validId = '478bba95-71bf-4224-be35-6d81dffe75f3';
      expect(validateUserId(validId)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(validateUserId('not-a-uuid')).toBe(false);
      expect(validateUserId('12345')).toBe(false);
    });

    it('should reject null', () => {
      expect(validateUserId(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateUserId(undefined)).toBe(false);
    });

    it('should reject non-string', () => {
      expect(validateUserId(123)).toBe(false);
      expect(validateUserId({})).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('&amp;')).toBe('&amp;amp;');
      expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
      expect(escapeHtml("'apostrophe'")).toBe('&#039;apostrophe&#039;');
    });

    it('should handle normal text', () => {
      expect(escapeHtml('Hello world')).toBe('Hello world');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(123)).toBe('');
    });

    it('should escape all special characters in combination', () => {
      const input = '<script>alert("XSS")</script>';
      const output = escapeHtml(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).not.toContain('"');
    });
  });

  describe('Constants', () => {
    it('should have correct MAX_MESSAGE_LENGTH', () => {
      expect(MAX_MESSAGE_LENGTH).toBe(5000);
    });

    it('should have correct MIN_MESSAGE_LENGTH', () => {
      expect(MIN_MESSAGE_LENGTH).toBe(1);
    });
  });
});
