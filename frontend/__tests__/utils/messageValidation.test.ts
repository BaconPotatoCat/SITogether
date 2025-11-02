import {
  validateMessageContent,
  escapeHtml,
  sanitizeForDisplay,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
} from '../../utils/messageValidation'

describe('Message Validation Utility (Frontend)', () => {
  describe('validateMessageContent', () => {
    it('should accept a valid message', () => {
      const result = validateMessageContent('Hello, how are you?')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should reject null input', () => {
      const result = validateMessageContent(null)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Message content must be a non-empty string')
    })

    it('should reject undefined input', () => {
      const result = validateMessageContent(undefined)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Message content must be a non-empty string')
    })

    it('should reject empty string', () => {
      const result = validateMessageContent('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Message content must be a non-empty string')
    })

    it('should reject whitespace-only string', () => {
      const result = validateMessageContent('   \n\t  ')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Message cannot be empty')
    })

    it('should reject message exceeding maximum length', () => {
      const longMessage = 'a'.repeat(MAX_MESSAGE_LENGTH + 1)
      const result = validateMessageContent(longMessage)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`)
    })

    it('should accept message at maximum length', () => {
      const longMessage = 'a'.repeat(MAX_MESSAGE_LENGTH)
      const result = validateMessageContent(longMessage)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
      expect(escapeHtml('&amp;')).toBe('&amp;amp;')
      expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;')
      expect(escapeHtml("'apostrophe'")).toBe('&#039;apostrophe&#039;')
    })

    it('should handle normal text', () => {
      expect(escapeHtml('Hello world')).toBe('Hello world')
    })

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('')
    })
  })

  describe('sanitizeForDisplay', () => {
    it('should escape HTML in content', () => {
      const input = '<script>alert("XSS")</script>Hello'
      const output = sanitizeForDisplay(input)
      expect(output).not.toContain('<')
      expect(output).not.toContain('>')
      expect(output).toContain('Hello')
    })

    it('should handle normal text', () => {
      expect(sanitizeForDisplay('Hello world')).toBe('Hello world')
    })

    it('should handle empty string', () => {
      expect(sanitizeForDisplay('')).toBe('')
    })

    it('should handle non-string input', () => {
      // @ts-expect-error - testing invalid input
      expect(sanitizeForDisplay(null)).toBe('')
      // @ts-expect-error - testing invalid input
      expect(sanitizeForDisplay(undefined)).toBe('')
    })
  })

  describe('Constants', () => {
    it('should have correct MAX_MESSAGE_LENGTH', () => {
      expect(MAX_MESSAGE_LENGTH).toBe(5000)
    })

    it('should have correct MIN_MESSAGE_LENGTH', () => {
      expect(MIN_MESSAGE_LENGTH).toBe(1)
    })
  })
})

