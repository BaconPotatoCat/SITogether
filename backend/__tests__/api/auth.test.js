const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock bcrypt for faster tests
jest.mock('bcrypt');

describe('Auth API Endpoints', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Add auth routes (simplified for testing)
    app.post('/api/auth/register', async (req, res) => {
      try {
        const { email, password, name, age, gender, course, recaptchaToken } = req.body;

        // Validation
        if (!email || !password || !name || !age || !gender) {
          return res.status(400).json({
            success: false,
            error: 'Email, password, name, age, and gender are required',
          });
        }

        // Verify reCAPTCHA token (if secret key is set)
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (secretKey) {
          if (!recaptchaToken) {
            return res.status(400).json({
              success: false,
              error: 'reCAPTCHA token is missing',
            });
          }

          // Mock reCAPTCHA verification
          // In tests, we'll mock the global fetch to simulate Google's response
          const mockRecaptchaResponse = global.mockRecaptchaResponse || { success: true };
          if (!mockRecaptchaResponse.success) {
            return res.status(400).json({
              success: false,
              error:
                mockRecaptchaResponse.error || 'reCAPTCHA verification failed. Please try again.',
            });
          }
        }

        // Gender validation
        const validGenders = ['Male', 'Female', 'Other'];
        if (!validGenders.includes(gender)) {
          return res.status(400).json({
            success: false,
            error: 'Gender must be one of: Male, Female, or Other',
          });
        }

        // Validate password according to NIST 2025 guidelines
        const { validatePassword } = require('../../utils/passwordValidation');
        const passwordValidation = await validatePassword(password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: passwordValidation.errors.join('; '),
          });
        }

        // Check if user exists
        const existingUser = await mockPrismaClient.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'User with this email already exists',
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        await mockPrismaClient.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            age: parseInt(age),
            gender,
            role: 'User',
            course,
            bio: null,
            interests: [],
            verified: false,
          },
        });

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Registration failed',
        });
      }
    });

    app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password, recaptchaToken } = req.body;

        if (!email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Email and password are required',
          });
        }

        // Verify reCAPTCHA token if provided (rate limit was exceeded)
        if (recaptchaToken) {
          // Mock reCAPTCHA verification
          const mockRecaptchaResponse = global.mockRecaptchaResponse || { success: true };
          if (!mockRecaptchaResponse.success) {
            return res.status(400).json({
              success: false,
              error:
                mockRecaptchaResponse.error || 'reCAPTCHA verification failed. Please try again.',
              requiresRecaptcha: true,
            });
          }
        }

        const user = await mockPrismaClient.user.findUnique({
          where: { email },
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid email or password',
          });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            error: 'Invalid email or password',
          });
        }

        if (!user.verified) {
          return res.status(403).json({
            success: false,
            error:
              'Account not verified. Please check your email and verify your account before logging in.',
            requiresVerification: true,
          });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
          httpOnly: true,
          maxAge: 60 * 60 * 1000,
        });

        res.json({
          success: true,
          message: 'Login successful',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Login failed',
        });
      }
    });

    app.post('/api/auth/logout', (req, res) => {
      res.clearCookie('token');
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    });

    app.get('/api/auth/session', authenticateToken, async (req, res) => {
      try {
        const user = await mockPrismaClient.user.findUnique({
          where: { id: req.user.userId },
          select: {
            id: true,
            email: true,
            name: true,
            age: true,
            gender: true,
            role: true,
            course: true,
            bio: true,
            interests: true,
            avatarUrl: true,
            verified: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        res.json({
          success: true,
          user: user,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve session',
        });
      }
    });

    app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;
        const { currentPassword, newPassword, recaptchaToken } = req.body;

        // Verify reCAPTCHA token if provided (rate limit was exceeded)
        if (recaptchaToken) {
          // Mock reCAPTCHA verification
          const mockRecaptchaResponse = global.mockRecaptchaResponse || { success: true };
          if (!mockRecaptchaResponse.success) {
            return res.status(400).json({
              success: false,
              error:
                mockRecaptchaResponse.error || 'reCAPTCHA verification failed. Please try again.',
              requiresRecaptcha: true,
            });
          }
        }

        // Validate required fields
        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            success: false,
            error: 'Current password and new password are required',
          });
        }

        // Validate password according to NIST 2025 guidelines
        const { validatePasswordChange } = require('../../utils/passwordValidation');
        const passwordValidation = await validatePasswordChange(currentPassword, newPassword);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: passwordValidation.errors.join('; '),
          });
        }

        // Find user by ID
        const user = await mockPrismaClient.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            password: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            error: 'Current password is incorrect',
          });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        await mockPrismaClient.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        });

        res.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to change password',
          message: error.message,
        });
      }
    });
  });

  let consoleWarnSpy;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('POST /api/auth/register', () => {
    beforeEach(() => {
      // Reset reCAPTCHA mock
      global.mockRecaptchaResponse = { success: true };
      delete process.env.RECAPTCHA_SECRET_KEY;
    });

    afterEach(() => {
      delete global.mockRecaptchaResponse;
      delete process.env.RECAPTCHA_SECRET_KEY;
    });

    it('should register a new user with valid data', async () => {
      // Mock HIBP API to return empty (password not found)
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

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

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        verified: false,
      });
      bcrypt.hash.mockResolvedValue('hashed_password');

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'validpass123', // 12 characters, meets requirements
        name: 'Test User',
        age: 25,
        gender: 'Male',
        course: 'CS',
        recaptchaToken: 'valid-token',
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 if gender is invalid', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        age: 25,
        gender: 'InvalidGender',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Gender must be one of');
    });

    it('should return 409 if user already exists', async () => {
      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

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

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      // Mock user existence check - user already exists
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'validpass123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should return 400 if password is too short (less than 8 characters)', async () => {
      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      mockRequest.on.mockReturnValue(mockRequest);
      https.request = jest.fn().mockReturnValue(mockRequest);

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'short', // Less than 8 characters
        name: 'Test User',
        age: 25,
        gender: 'Male',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should return 400 if reCAPTCHA token is missing when secret key is set', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret-key';

      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

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

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'validpass123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        course: 'CS',
        // recaptchaToken is missing
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reCAPTCHA token is missing');
    });

    it('should return 400 if reCAPTCHA verification fails', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret-key';
      global.mockRecaptchaResponse = { success: false, error: 'reCAPTCHA verification failed' };

      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

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

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'validpass123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        course: 'CS',
        recaptchaToken: 'invalid-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reCAPTCHA verification failed');
    });

    it('should allow registration without reCAPTCHA when secret key is not set', async () => {
      // Ensure RECAPTCHA_SECRET_KEY is not set
      delete process.env.RECAPTCHA_SECRET_KEY;

      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback(''), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

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

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      mockPrismaClient.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        verified: false,
      });
      bcrypt.hash.mockResolvedValue('hashed_password');

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'validpass123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        course: 'CS',
        // No recaptchaToken provided
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
    });

    it('should return 400 if password is found in data breaches', async () => {
      // Mock HIBP API to return compromised password
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, _callback) => {
          if (event === 'error') {
            // No error
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Password "password" is compromised
            setTimeout(() => callback('1E4C9B93F3F0682250B6CF8331B7EE68FD8:26230667\n'), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password', // Known compromised password
        name: 'Test User',
        age: 25,
        gender: 'Male',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('This password has been found in data breaches');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(() => {
      // Reset reCAPTCHA mock
      global.mockRecaptchaResponse = { success: true };
    });

    afterEach(() => {
      delete global.mockRecaptchaResponse;
    });

    it('should login with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        verified: true,
      };

      // Explicitly reset and set up mocks
      mockPrismaClient.user.findUnique.mockReset();
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockReset();
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 if email or password is missing', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 401 if user does not exist', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 401 if password is incorrect', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        verified: true,
      });
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 403 if account is not verified', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        verified: false,
      });
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.requiresVerification).toBe(true);
      expect(response.body.error).toContain('not verified');
    });

    it('should login successfully with valid reCAPTCHA token when rate limit exceeded', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      global.mockRecaptchaResponse = { success: true };

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
        recaptchaToken: 'valid-recaptcha-token',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
    });

    it('should return 400 if reCAPTCHA verification fails', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      global.mockRecaptchaResponse = { success: false, error: 'reCAPTCHA verification failed' };

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
        recaptchaToken: 'invalid-recaptcha-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reCAPTCHA verification failed');
      expect(response.body.requiresRecaptcha).toBe(true);
    });

    it('should allow login without reCAPTCHA when not provided', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
        // No recaptchaToken provided
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout user', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return user session data when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: 'CS',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: null,
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/auth/session')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(mockUser);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/session');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should return 404 if user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'nonexistent-user' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/auth/session')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/auth/change-password', () => {
    const userId = 'user-123';
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);

    beforeEach(() => {
      // Reset reCAPTCHA mock
      global.mockRecaptchaResponse = { success: true };
    });

    afterEach(() => {
      delete global.mockRecaptchaResponse;
    });

    it('should successfully change password with valid credentials', async () => {
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new_password');
      mockPrismaClient.user.update.mockResolvedValue({
        id: userId,
        password: 'hashed_new_password',
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
      expect(bcrypt.compare).toHaveBeenCalledWith('oldpass123', 'hashed_old_password');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'hashed_new_password' },
      });
    });

    it('should return 400 when current password is missing', async () => {
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          newPassword: 'newpass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password and new password are required');
    });

    it('should return 400 when new password is missing', async () => {
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password and new password are required');
    });

    it('should return 400 when new password is too short (less than 8 characters)', async () => {
      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      mockRequest.on.mockReturnValue(mockRequest);
      https.request = jest.fn().mockReturnValue(mockRequest);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: '12345', // Less than 8 characters
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password must be at least 8 characters long');
    });

    it('should return 400 when new password is too long (more than 64 characters)', async () => {
      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      mockRequest.on.mockReturnValue(mockRequest);
      https.request = jest.fn().mockReturnValue(mockRequest);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const longPassword = 'a'.repeat(65);
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: longPassword,
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password must be no more than 64 characters long');
    });

    it('should return 400 when new password is found in data breaches', async () => {
      // Mock HIBP API to return compromised password
      const https = require('https');
      const mockRequest = {
        on: jest.fn((event, _callback) => {
          if (event === 'error') {
            // No error
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Password "password" is compromised
            setTimeout(() => callback('1E4C9B93F3F0682250B6CF8331B7EE68FD8:26230667\n'), 0);
          } else if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
        }),
      };

      https.request = jest.fn((options, callback) => {
        setTimeout(() => {
          if (callback) callback(mockResponse);
        }, 0);
        return mockRequest;
      });

      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'password', // Known compromised password
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('This password has been found in data breaches');
    });

    it('should return 401 when current password is incorrect', async () => {
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Wrong password

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'wrongpass',
          newPassword: 'newpass123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is incorrect');
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpass', 'hashed_old_password');
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
    });

    it('should return 404 when user is not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      // Mock auth check to work, but route handler check to return null
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).post('/api/auth/change-password').send({
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new_password');
      mockPrismaClient.user.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to change password');
    });

    it('should successfully change password with valid reCAPTCHA token when rate limit exceeded', async () => {
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new_password');
      mockPrismaClient.user.update.mockResolvedValue({
        id: userId,
        password: 'hashed_new_password',
      });
      global.mockRecaptchaResponse = { success: true };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
          recaptchaToken: 'valid-recaptcha-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should return 400 if reCAPTCHA verification fails', async () => {
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      global.mockRecaptchaResponse = { success: false, error: 'reCAPTCHA verification failed' };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
          recaptchaToken: 'invalid-recaptcha-token',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('reCAPTCHA verification failed');
      expect(response.body.requiresRecaptcha).toBe(true);
    });

    it('should allow password change without reCAPTCHA when not provided', async () => {
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new_password');
      mockPrismaClient.user.update.mockResolvedValue({
        id: userId,
        password: 'hashed_new_password',
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
          // No recaptchaToken provided
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should hash new password with bcrypt', async () => {
      const mockUser = {
        id: userId,
        password: 'hashed_old_password',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new_password');
      mockPrismaClient.user.update.mockResolvedValue({
        id: userId,
        password: 'hashed_new_password',
      });

      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
        });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'hashed_new_password' },
      });
    });
  });
});
