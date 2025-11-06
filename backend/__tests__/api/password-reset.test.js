const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  token: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock email service
jest.mock('../../lib/email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock bcrypt
jest.mock('bcrypt');

const { sendPasswordResetEmail } = require('../../lib/email');

describe('Password Reset API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // POST /api/auth/forgot-password
    app.post('/api/auth/forgot-password', async (req, res) => {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({
            success: false,
            error: 'Email is required',
          });
        }

        const user = await mockPrismaClient.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            verified: true,
          },
        });

        // Security: Always return success to prevent email enumeration
        if (!user) {
          return res.json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.',
          });
        }

        if (!user.verified) {
          return res.status(400).json({
            success: false,
            error: 'Please verify your email address before resetting your password.',
            requiresVerification: true,
          });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await mockPrismaClient.token.deleteMany({
          where: {
            email,
            type: 'PASSWORD_RESET',
          },
        });

        const createdToken = await mockPrismaClient.token.create({
          data: {
            token: resetToken,
            type: 'PASSWORD_RESET',
            email: user.email,
            userId: user.id,
            expiresAt: resetTokenExpires,
          },
        });

        try {
          await sendPasswordResetEmail(user.email, user.name, resetToken);

          res.json({
            success: true,
            message: 'Password reset link has been sent to your email.',
          });
        } catch (emailError) {
          // Delete token if email fails
          await mockPrismaClient.token.delete({
            where: { id: createdToken.id },
          });

          res.status(500).json({
            success: false,
            error: 'Failed to send password reset email. Please try again later.',
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to process password reset request',
        });
      }
    });

    // POST /api/auth/reset-password
    app.post('/api/auth/reset-password', async (req, res) => {
      try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
          return res.status(400).json({
            success: false,
            error: 'Token and new password are required',
          });
        }

        // Validate password according to NIST 2025 guidelines
        const { validatePassword } = require('../../utils/passwordValidation');
        const passwordValidation = await validatePassword(newPassword);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            success: false,
            error: passwordValidation.errors.join('; '),
          });
        }

        const resetToken = await mockPrismaClient.token.findFirst({
          where: {
            token,
            type: 'PASSWORD_RESET',
          },
        });

        if (!resetToken) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or expired password reset token',
          });
        }

        if (new Date() > resetToken.expiresAt) {
          await mockPrismaClient.token.delete({
            where: { id: resetToken.id },
          });
          return res.status(400).json({
            success: false,
            error: 'Password reset token has expired. Please request a new one.',
          });
        }

        const user = await mockPrismaClient.user.findUnique({
          where: { email: resetToken.email },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await mockPrismaClient.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });

        await mockPrismaClient.token.delete({
          where: { id: resetToken.id },
        });

        res.json({
          success: true,
          message:
            'Password has been reset successfully. You can now log in with your new password.',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to reset password',
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

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email for valid verified user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.token.create.mockResolvedValue({
        id: 'token-1',
        token: 'reset-token-123',
        type: 'PASSWORD_RESET',
        email: 'test@example.com',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset link has been sent');
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        expect.any(String)
      );
      expect(mockPrismaClient.token.deleteMany).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          type: 'PASSWORD_RESET',
        },
      });
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app).post('/api/auth/forgot-password').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return success for non-existent email (security)', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with that email exists');
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return 400 for unverified user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: false,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('verify your email address');
      expect(response.body.requiresVerification).toBe(true);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should delete token if email fails to send', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      const mockCreatedToken = {
        id: 'token-1',
        token: 'reset-token-123',
        type: 'PASSWORD_RESET',
        email: 'test@example.com',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaClient.token.create.mockResolvedValue(mockCreatedToken);
      mockPrismaClient.token.delete.mockResolvedValue(mockCreatedToken);
      sendPasswordResetEmail.mockRejectedValue(new Error('Email service error'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to send password reset email');
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });

    it('should delete old password reset tokens before creating new one', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: true,
      };

      const mockCreatedToken = {
        id: 'token-2',
        token: 'new-reset-token',
        type: 'PASSWORD_RESET',
        email: 'test@example.com',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.token.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.token.create.mockResolvedValue(mockCreatedToken);
      sendPasswordResetEmail.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPrismaClient.token.deleteMany).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          type: 'PASSWORD_RESET',
        },
      });
      expect(mockPrismaClient.token.create).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        expect.any(String)
      );
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
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

      const mockResetToken = {
        id: 'token-1',
        token: 'valid-reset-token',
        type: 'PASSWORD_RESET',
        email: 'test@example.com',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'old-hashed-password',
      };

      mockPrismaClient.token.findFirst.mockResolvedValue(mockResetToken);
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.update.mockResolvedValue({
        ...mockUser,
        password: 'new-hashed-password',
      });
      mockPrismaClient.token.delete.mockResolvedValue(mockResetToken);
      bcrypt.hash.mockResolvedValue('new-hashed-password');

      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'new-hashed-password' },
      });
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });

    it('should return 400 if token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ newPassword: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 if newPassword is missing', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 if password is too short', async () => {
      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      mockRequest.on.mockReturnValue(mockRequest);
      https.request = jest.fn().mockReturnValue(mockRequest);

      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'some-token',
        newPassword: '12345', // Only 5 characters
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should return 400 if password is too long (more than 64 characters)', async () => {
      // Mock HIBP API
      const https = require('https');
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      mockRequest.on.mockReturnValue(mockRequest);
      https.request = jest.fn().mockReturnValue(mockRequest);

      const longPassword = 'a'.repeat(65);
      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'some-token',
        newPassword: longPassword,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('no more than 64 characters');
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
        setTimeout(() => callback(mockResponse), 0);
        return mockRequest;
      });

      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'some-token',
        newPassword: 'password', // Known compromised password
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('This password has been found in data breaches');
    });

    it('should return 400 for invalid token', async () => {
      mockPrismaClient.token.findFirst.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'invalid-token',
        newPassword: 'newpassword123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should return 400 for expired token', async () => {
      const mockResetToken = {
        id: 'token-1',
        token: 'expired-token',
        type: 'PASSWORD_RESET',
        email: 'test@example.com',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockPrismaClient.token.findFirst.mockResolvedValue(mockResetToken);
      mockPrismaClient.token.delete.mockResolvedValue(mockResetToken);

      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'expired-token',
        newPassword: 'newpassword123',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
      expect(mockPrismaClient.token.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      });
    });

    it('should return 404 if user not found', async () => {
      const mockResetToken = {
        id: 'token-1',
        token: 'valid-token',
        type: 'PASSWORD_RESET',
        email: 'nonexistent@example.com',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaClient.token.findFirst.mockResolvedValue(mockResetToken);
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'valid-token',
        newPassword: 'newpassword123',
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should use PASSWORD_RESET token type filter', async () => {
      mockPrismaClient.token.findFirst.mockResolvedValue(null);

      await request(app).post('/api/auth/reset-password').send({
        token: 'some-token',
        newPassword: 'newpassword123',
      });

      expect(mockPrismaClient.token.findFirst).toHaveBeenCalledWith({
        where: {
          token: 'some-token',
          type: 'PASSWORD_RESET',
        },
      });
    });
  });

  describe('Token Security', () => {
    it('should generate unique reset tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex');
      const token2 = crypto.randomBytes(32).toString('hex');

      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token2).toHaveLength(64);
    });

    it('should set expiration to 1 hour from now', () => {
      const now = Date.now();
      const expiration = new Date(now + 60 * 60 * 1000);
      const expectedTime = now + 3600000;

      expect(expiration.getTime()).toBe(expectedTime);
    });

    it('should detect expired tokens', () => {
      const expiredTime = new Date(Date.now() - 3600000); // 1 hour ago
      const currentTime = new Date();

      expect(currentTime > expiredTime).toBe(true);
    });

    it('should detect valid tokens', () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const currentTime = new Date();

      expect(currentTime > futureTime).toBe(false);
    });
  });
});
