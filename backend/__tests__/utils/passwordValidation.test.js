const https = require('https');
const { validatePassword, validatePasswordChange } = require('../../utils/passwordValidation');

// Mock https module
jest.mock('https');

describe('Password Validation', () => {
  let mockRequest;
  let consoleWarnSpy;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockRequest = {
      on: jest.fn(),
      end: jest.fn(),
    };
    https.request.mockReturnValue(mockRequest);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('validatePassword', () => {
    it('should reject password less than 8 characters', async () => {
      const result = await validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password more than 64 characters', async () => {
      const longPassword = 'a'.repeat(65);
      const result = await validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be no more than 64 characters long');
    });

    it('should reject password with leading whitespace', async () => {
      const result = await validatePassword(' password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot start or end with whitespace');
    });

    it('should reject password with trailing whitespace', async () => {
      const result = await validatePassword('password123 ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot start or end with whitespace');
    });

    it('should reject empty password', async () => {
      const result = await validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should reject null password', async () => {
      const result = await validatePassword(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should accept valid password (8-64 characters)', async () => {
      // Mock successful HIBP API response (password not found)
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Empty response means password not found
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      mockRequest.on.mockImplementation((event, _callback) => {
        if (event === 'error') {
          // No error
        }
        return mockRequest;
      });

      // Simulate API response
      https.request.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockResponse), 0);
        return mockRequest;
      });

      const result = await validatePassword('validpass123');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password found in HIBP database', async () => {
      // Mock HIBP API response with password found
      // SHA-1 of 'password' is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
      // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate API response containing the compromised password
            setTimeout(() => callback('1E4C9B93F3F0682250B6CF8331B7EE68FD8:26230667\n'), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      mockRequest.on.mockImplementation((event, _callback) => {
        if (event === 'error') {
          // No error
        }
        return mockRequest;
      });

      https.request.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockResponse), 0);
        return mockRequest;
      });

      const result = await validatePassword('password');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'This password has been found in data breaches. Please choose a different password'
      );
    });

    it('should handle HIBP API errors gracefully (fail open)', async () => {
      // Mock API error
      mockRequest.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Network error')), 0);
        }
        return mockRequest;
      });

      https.request.mockReturnValue(mockRequest);

      const result = await validatePassword('validpass123');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should pass (fail open) when API fails
      expect(result.isValid).toBe(true);
    });

    it('should handle HIBP API timeout gracefully (fail open)', async () => {
      // Set up mock request that triggers timeout
      mockRequest.destroy = jest.fn();

      // Store callbacks for events
      const callbacks = {};
      mockRequest.on.mockImplementation((event, callback) => {
        if (event === 'timeout') {
          callbacks.timeout = callback;
          // Simulate timeout happening
          setImmediate(() => {
            if (callbacks.timeout) callbacks.timeout();
          });
        }
        return mockRequest;
      });

      // Mock https.request to return the request
      https.request.mockImplementation(() => {
        // Trigger timeout after request is set up
        setImmediate(() => {
          if (callbacks.timeout) callbacks.timeout();
        });
        return mockRequest;
      });

      const resultPromise = validatePassword('validpass123');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = await resultPromise;

      // Should pass (fail open) when API times out
      expect(result.isValid).toBe(true);
    }, 10000);

    it('should handle non-200 status codes gracefully (fail open)', async () => {
      const mockResponse = {
        statusCode: 500,
        on: jest.fn((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      mockRequest.on.mockReturnValue(mockRequest);

      https.request.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockResponse), 0);
        return mockRequest;
      });

      const result = await validatePassword('validpass123');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should pass (fail open) when API returns error
      expect(result.isValid).toBe(true);
    });

    it('should not check HIBP API if password already has validation errors', async () => {
      const result = await validatePassword('short'); // Less than 8 chars

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(https.request).not.toHaveBeenCalled();
    });
  });

  describe('validatePasswordChange', () => {
    it('should reject when current password and new password are the same', async () => {
      const result = await validatePasswordChange('samepass123', 'samepass123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('New password must be different from your current password');
    });

    it('should validate new password requirements', async () => {
      const result = await validatePasswordChange('oldpass123', 'short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should accept valid password change', async () => {
      // Mock successful HIBP API response
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      mockRequest.on.mockReturnValue(mockRequest);

      https.request.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockResponse), 0);
        return mockRequest;
      });

      const result = await validatePasswordChange('oldpass123', 'newpass123');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(result.isValid).toBe(true);
    });

    it('should reject when required fields are missing', async () => {
      const result1 = await validatePasswordChange('', 'newpass123');
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Current password and new password are required');

      const result2 = await validatePasswordChange('oldpass123', '');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Current password and new password are required');
    });
  });
});
