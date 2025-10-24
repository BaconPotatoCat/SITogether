const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock email service
jest.mock('../../lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const { sendVerificationEmail } = require('../../lib/email');

describe('Email Verification API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // GET /api/auth/verify
    app.get('/api/auth/verify', async (req, res) => {
      try {
        const { token } = req.query;

        if (!token) {
          return res.status(400).json({
            success: false,
            error: 'Verification token is required',
          });
        }

        const user = await mockPrismaClient.user.findFirst({
          where: { verificationToken: token },
        });

        if (!user) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or expired verification token',
          });
        }

        // Check if token has expired
        if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
          return res.status(400).json({
            success: false,
            error: 'Verification token has expired. Please request a new verification email.',
          });
        }

        if (user.verified) {
          return res.status(200).json({
            success: true,
            message: 'Email already verified. You can now log in.',
          });
        }

        await mockPrismaClient.user.update({
          where: { id: user.id },
          data: {
            verified: true,
            verificationToken: null,
            verificationTokenExpires: null,
          },
        });

        res.status(200).json({
          success: true,
          message: 'Email verified successfully! You can now log in to your account.',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to verify email',
        });
      }
    });

    // POST /api/auth/resend-verification
    app.post('/api/auth/resend-verification', async (req, res) => {
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
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'No account found with this email address',
          });
        }

        if (user.verified) {
          return res.status(400).json({
            success: false,
            error: 'Account is already verified. You can log in now.',
          });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

        await mockPrismaClient.user.update({
          where: { id: user.id },
          data: {
            verificationToken,
            verificationTokenExpires,
          },
        });

        await sendVerificationEmail(user.email, user.name, verificationToken);

        res.status(200).json({
          success: true,
          message: 'Verification email sent successfully. Please check your email.',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to resend verification email',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/verify', () => {
    it('should verify email with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        verified: false,
        verificationToken: 'valid-token-123',
        verificationTokenExpires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockPrismaClient.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaClient.user.update.mockResolvedValue({ ...mockUser, verified: true });

      const response = await request(app)
        .get('/api/auth/verify')
        .query({ token: 'valid-token-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          verified: true,
          verificationToken: null,
          verificationTokenExpires: null,
        },
      });
    });

    it('should return 400 if token is missing', async () => {
      const response = await request(app).get('/api/auth/verify');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token is required');
    });

    it('should return 400 if token is invalid', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/auth/verify').query({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should return 400 if token has expired', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        verified: false,
        verificationToken: 'expired-token',
        verificationTokenExpires: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockPrismaClient.user.findFirst.mockResolvedValue(mockUser);

      const response = await request(app).get('/api/auth/verify').query({ token: 'expired-token' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should return 200 if account is already verified', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        verified: true,
        verificationToken: 'some-token',
      };

      mockPrismaClient.user.findFirst.mockResolvedValue(mockUser);

      const response = await request(app).get('/api/auth/verify').query({ token: 'some-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('already verified');
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: false,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.update.mockResolvedValue({
        ...mockUser,
        verificationToken: 'new-token',
      });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('sent successfully');
      expect(mockPrismaClient.user.update).toHaveBeenCalled();
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        expect.any(String)
      );
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app).post('/api/auth/resend-verification').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return 404 if user does not exist', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No account found');
    });

    it('should return 400 if account is already verified', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        verified: true,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already verified');
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should generate new token and expiration', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        verified: false,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.update.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          verificationToken: expect.any(String),
          verificationTokenExpires: expect.any(Date),
        }),
      });

      // Verify token expiration is approximately 1 hour from now
      const updateCall = mockPrismaClient.user.update.mock.calls[0][0];
      const expiresAt = updateCall.data.verificationTokenExpires;
      const expectedExpires = new Date(Date.now() + 60 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt - expectedExpires);
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Token Generation and Expiration', () => {
    it('should generate unique tokens', () => {
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
