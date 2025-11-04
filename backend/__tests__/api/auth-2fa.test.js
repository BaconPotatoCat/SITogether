const request = require('supertest');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  token: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock bcrypt for faster tests
jest.mock('bcrypt');

// Mock email service
jest.mock('../../lib/email', () => ({
  sendTwoFactorEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const { sendTwoFactorEmail } = require('../../lib/email');

describe('2FA API Endpoints', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // POST /api/auth/login - with 2FA flow
    app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Email and password are required',
          });
        }

        // Find user by email
        const user = await mockPrismaClient.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            age: true,
            gender: true,
            role: true,
            course: true,
            bio: true,
            interests: true,
            avatarUrl: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid email or password',
          });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            error: 'Invalid email or password',
          });
        }

        // Check if account is verified
        if (!user.verified) {
          return res.status(403).json({
            success: false,
            error:
              'Account not verified. Please check your email and verify your account before logging in.',
            requiresVerification: true,
            email: user.email,
          });
        }

        // Generate 6-digit 2FA code
        const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Set expiration to 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Delete any existing 2FA tokens for this user
        await mockPrismaClient.token.deleteMany({
          where: {
            userId: user.id,
            type: 'TWO_FACTOR_AUTH',
          },
        });

        // Create 2FA token
        const createdToken = await mockPrismaClient.token.create({
          data: {
            token: twoFactorCode,
            type: 'TWO_FACTOR_AUTH',
            userId: user.id,
            expiresAt: expiresAt,
          },
        });

        // Generate temporary JWT token for 2FA verification (valid for 10 minutes)
        const tempToken = jwt.sign(
          { userId: user.id, requiresTwoFactor: true },
          process.env.JWT_SECRET,
          { expiresIn: '10m' }
        );

        // Send 2FA email
        try {
          await sendTwoFactorEmail(user.email, user.name, twoFactorCode);

          res.json({
            success: true,
            message: 'Please check your email for the verification code',
            requiresTwoFactor: true,
            tempToken: tempToken,
          });
        } catch (emailError) {
          console.error('Failed to send 2FA email:', emailError);

          // Delete the token since email failed
          try {
            await mockPrismaClient.token.delete({
              where: { id: createdToken.id },
            });
            console.log('Cleaned up 2FA token after email failure');
          } catch (cleanupError) {
            console.error('Failed to cleanup token after email error:', cleanupError);
          }

          res.status(500).json({
            success: false,
            error: 'Failed to send verification email. Please try again later.',
          });
        }
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to login',
          message: error.message,
        });
      }
    });

    // POST /api/auth/verify-2fa
    app.post('/api/auth/verify-2fa', async (req, res) => {
      try {
        const { tempToken, code } = req.body;

        if (!tempToken || !code) {
          return res.status(400).json({
            success: false,
            error: 'Temporary token and verification code are required',
          });
        }

        // Verify temporary token
        let decoded;
        try {
          decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (error) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired temporary token',
          });
        }

        // Check if this is a 2FA token
        if (!decoded.requiresTwoFactor || !decoded.userId) {
          return res.status(400).json({
            success: false,
            error: 'Invalid temporary token',
          });
        }

        const userId = decoded.userId;

        // Find 2FA token
        const twoFactorToken = await mockPrismaClient.token.findFirst({
          where: {
            token: code,
            type: 'TWO_FACTOR_AUTH',
            userId: userId,
          },
        });

        if (!twoFactorToken) {
          return res.status(401).json({
            success: false,
            error: 'Invalid verification code',
          });
        }

        // Check if token has expired
        if (new Date() > twoFactorToken.expiresAt) {
          // Delete expired token
          await mockPrismaClient.token.delete({
            where: { id: twoFactorToken.id },
          });
          return res.status(401).json({
            success: false,
            error: 'Verification code has expired. Please try logging in again.',
          });
        }

        // Delete the used 2FA token
        await mockPrismaClient.token.delete({
          where: { id: twoFactorToken.id },
        });

        // Generate final JWT token
        const finalToken = jwt.sign({ userId: userId }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });

        // Set cookie with token
        res.cookie('token', finalToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
        });

        res.json({
          success: true,
          message: 'Login successful',
        });
      } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to verify code',
          message: error.message,
        });
      }
    });

    // POST /api/auth/resend-2fa
    app.post('/api/auth/resend-2fa', async (req, res) => {
      try {
        const { tempToken } = req.body;

        if (!tempToken) {
          return res.status(400).json({
            success: false,
            error: 'Temporary token is required',
          });
        }

        // Verify temporary token
        let decoded;
        try {
          decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (error) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired temporary token. Please try logging in again.',
          });
        }

        // Check if this is a 2FA token
        if (!decoded.requiresTwoFactor || !decoded.userId) {
          return res.status(400).json({
            success: false,
            error: 'Invalid temporary token',
          });
        }

        const userId = decoded.userId;

        // Get user details
        const user = await mockPrismaClient.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            verified: true,
          },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        // Generate new 6-digit 2FA code
        const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Set expiration to 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Delete any existing 2FA tokens for this user
        await mockPrismaClient.token.deleteMany({
          where: {
            userId: user.id,
            type: 'TWO_FACTOR_AUTH',
          },
        });

        // Create new 2FA token
        const createdToken = await mockPrismaClient.token.create({
          data: {
            token: twoFactorCode,
            type: 'TWO_FACTOR_AUTH',
            userId: user.id,
            expiresAt: expiresAt,
          },
        });

        // Send 2FA email
        try {
          await sendTwoFactorEmail(user.email, user.name, twoFactorCode);

          res.json({
            success: true,
            message: 'Verification code sent successfully. Please check your email.',
          });
        } catch (emailError) {
          console.error('Failed to send 2FA email:', emailError);

          // Delete the token since email failed
          try {
            await mockPrismaClient.token.delete({
              where: { id: createdToken.id },
            });
            console.log('Cleaned up 2FA token after email failure');
          } catch (cleanupError) {
            console.error('Failed to cleanup token after email error:', cleanupError);
          }

          res.status(500).json({
            success: false,
            error: 'Failed to send verification email. Please try again later.',
          });
        }
      } catch (error) {
        console.error('Resend 2FA error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to resend verification code',
          message: error.message,
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    // Reset email mock to success state
    sendTwoFactorEmail.mockResolvedValue({ success: true });
  });

  describe('POST /api/auth/login - 2FA Flow', () => {
    it('should initiate 2FA flow for verified user with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: 'CS',
        bio: 'Test bio',
        interests: ['Coding'],
        avatarUrl: null,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-1',
        token: '123456',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requiresTwoFactor).toBe(true);
      expect(response.body.tempToken).toBeDefined();
      expect(response.body.message).toContain('check your email');

      // Verify 2FA code was created
      expect(mockPrismaClient.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'TWO_FACTOR_AUTH',
          userId: 'user-1',
        }),
      });

      // Verify email was sent
      expect(sendTwoFactorEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        expect.any(String)
      );
    });

    it('should return 401 for invalid email', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 401 for invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should return 403 for unverified account', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        verified: false,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.requiresVerification).toBe(true);
    });

    it('should handle email send failure and cleanup token', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-1',
        token: '123456',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      mockPrismaClient.token.delete.mockResolvedValue({
        id: 'token-1',
      });
      sendTwoFactorEmail.mockRejectedValue(new Error('Email send failed'));

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to send verification email');

      // Verify token was cleaned up
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should delete existing 2FA tokens before creating new one', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: 'CS',
        bio: 'Test bio',
        interests: ['Coding'],
        avatarUrl: null,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-2',
        token: '123456',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(mockPrismaClient.token.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: 'TWO_FACTOR_AUTH',
        },
      });
    });
  });

  describe('POST /api/auth/verify-2fa', () => {
    it('should verify valid 2FA code and complete login', async () => {
      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );

      const mockToken = {
        id: 'token-1',
        token: '123456',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockPrismaClient.token.findFirst.mockResolvedValue(mockToken);
      mockPrismaClient.token.delete.mockResolvedValue(mockToken);

      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: tempToken,
        code: '123456',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');

      // Verify token was found
      expect(mockPrismaClient.token.findFirst).toHaveBeenCalledWith({
        where: {
          token: '123456',
          type: 'TWO_FACTOR_AUTH',
          userId: 'user-1',
        },
      });

      // Verify token was deleted
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });

      // Verify cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie) => cookie.startsWith('token='))).toBe(true);
    });

    it('should return 400 if tempToken is missing', async () => {
      const response = await request(app).post('/api/auth/verify-2fa').send({
        code: '123456',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Temporary token and verification code');
    });

    it('should return 400 if code is missing', async () => {
      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Temporary token and verification code');
    });

    it('should return 401 for invalid temporary token', async () => {
      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: 'invalid_token',
        code: '123456',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired temporary token');
    });

    it('should return 400 for token without requiresTwoFactor flag', async () => {
      const tempToken = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: tempToken,
        code: '123456',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid temporary token');
    });

    it('should return 401 for invalid verification code', async () => {
      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      mockPrismaClient.token.findFirst.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: tempToken,
        code: 'wrongcode',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid verification code');
    });

    it('should return 401 for expired verification code', async () => {
      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      const expiredToken = {
        id: 'token-1',
        token: '123456',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      mockPrismaClient.token.findFirst.mockResolvedValue(expiredToken);
      mockPrismaClient.token.delete.mockResolvedValue(expiredToken);

      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: tempToken,
        code: '123456',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');

      // Verify expired token was deleted
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });

    it('should handle errors during verification', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      mockPrismaClient.token.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/auth/verify-2fa').send({
        tempToken: tempToken,
        code: '123456',
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to verify code');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /api/auth/resend-2fa', () => {
    it('should resend 2FA code for valid tempToken', async () => {
      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-2',
        token: '654321',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Verification code sent successfully');

      // Verify old tokens were deleted
      expect(mockPrismaClient.token.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: 'TWO_FACTOR_AUTH',
        },
      });

      // Verify new token was created
      expect(mockPrismaClient.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'TWO_FACTOR_AUTH',
          userId: 'user-1',
        }),
      });

      // Verify email was sent
      expect(sendTwoFactorEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        expect.any(String)
      );
    });

    it('should return 400 if tempToken is missing', async () => {
      const response = await request(app).post('/api/auth/resend-2fa').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Temporary token is required');
    });

    it('should return 401 for invalid or expired tempToken', async () => {
      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: 'invalid_token',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired temporary token');
    });

    it('should return 400 for token without requiresTwoFactor flag', async () => {
      const tempToken = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid temporary token');
    });

    it('should return 404 if user not found', async () => {
      const tempToken = jwt.sign(
        { userId: 'nonexistent-user', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should handle email send failure and cleanup token', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-2',
        token: '654321',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      mockPrismaClient.token.delete.mockResolvedValue({
        id: 'token-2',
      });
      sendTwoFactorEmail.mockRejectedValue(new Error('Email send failed'));

      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to send verification email');

      // Verify token was cleaned up
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-2' },
      });

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should delete existing tokens before creating new one', async () => {
      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-3',
        token: '999888',
        type: 'TWO_FACTOR_AUTH',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(200);
      expect(mockPrismaClient.token.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: 'TWO_FACTOR_AUTH',
        },
      });
    });

    it('should handle errors during resend', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const tempToken = jwt.sign(
        { userId: 'user-1', requiresTwoFactor: true },
        process.env.JWT_SECRET
      );

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/auth/resend-2fa').send({
        tempToken: tempToken,
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to resend verification code');

      consoleErrorSpy.mockRestore();
    });
  });
});
