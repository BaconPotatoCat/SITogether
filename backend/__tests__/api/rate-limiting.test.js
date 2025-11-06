const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Import rate limiters
const {
  loginLimiter,
  passwordResetLimiter,
  registerLimiter,
  otpLimiter,
  resendOtpLimiter,
  resendVerificationLimiter,
  sensitiveDataLimiter,
} = require('../../middleware/rateLimiter');

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  token: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  userPoints: {
    findUnique: jest.fn(),
  },
  userLikes: {
    findMany: jest.fn(),
  },
  userPasses: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock('../../lib/prisma', () => mockPrismaClient);

// Mock email sending
jest.mock('../../lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendTwoFactorEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Mock password validation
jest.mock('../../utils/passwordValidation', () => ({
  validatePassword: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
  validatePasswordChange: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
}));

// Mock bcrypt
jest.mock('bcrypt');

// Mock authenticateToken middleware
jest.mock('../../middleware/auth', () => {
  const jwt = require('jsonwebtoken');
  return {
    authenticateToken: (req, res, next) => {
      try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: decoded.userId };
        next();
      } catch (error) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    },
  };
});

// Import authenticateToken after mock
const { authenticateToken } = require('../../middleware/auth');

describe('Rate Limiting Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    // Configure trust proxy to trust only 1 proxy (safer than true)
    // This allows reading x-forwarded-for header while preventing IP spoofing
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Setup routes with rate limiting
    app.post('/api/auth/login', loginLimiter, async (req, res) => {
      res.json({ success: true, message: 'Login endpoint' });
    });

    app.post('/api/auth/register', registerLimiter, async (req, res) => {
      res.json({ success: true, message: 'Register endpoint' });
    });

    app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
      res.json({ success: true, message: 'Forgot password endpoint' });
    });

    app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
      res.json({ success: true, message: 'Reset password endpoint' });
    });

    app.post('/api/auth/verify-2fa', otpLimiter, async (req, res) => {
      res.json({ success: true, message: 'Verify 2FA endpoint' });
    });

    app.post('/api/auth/resend-2fa', resendOtpLimiter, async (req, res) => {
      res.json({ success: true, message: 'Resend 2FA endpoint' });
    });

    app.post('/api/auth/resend-verification', resendVerificationLimiter, async (req, res) => {
      res.json({ success: true, message: 'Resend verification endpoint' });
    });

    app.get('/api/users', sensitiveDataLimiter, authenticateToken, async (req, res) => {
      res.json({ success: true, message: 'Users endpoint' });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Rate Limiting', () => {
    it('should allow requests within the limit (5 per 15 minutes)', async () => {
      // Make 5 requests - should all succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding the limit (6th request)', async () => {
      // Make 5 successful requests first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' });
      }

      // 6th request should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many login attempts');
    });
  });

  describe('Registration Rate Limiting', () => {
    it('should allow requests within the limit (3 per hour)', async () => {
      // Make 3 requests - should all succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `test${i}@example.com`,
            password: 'password123',
            name: 'Test User',
            age: 25,
            gender: 'Male',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding the limit (4th request)', async () => {
      // Make 3 successful requests first
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `test${i}@example.com`,
            password: 'password123',
            name: 'Test User',
            age: 25,
            gender: 'Male',
          });
      }

      // 4th request should be rate limited
      const response = await request(app).post('/api/auth/register').send({
        email: 'test4@example.com',
        password: 'password123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
      });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many registration attempts');
    });
  });

  describe('Password Reset Rate Limiting', () => {
    it('should allow requests within the limit (3 per hour)', async () => {
      // Make 3 requests - should all succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding the limit (4th request)', async () => {
      // Make 3 successful requests first
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });
      }

      // 4th request should be rate limited
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many password reset requests');
    });

    it('should apply same limit to reset-password endpoint', async () => {
      // Make 3 successful requests first
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/reset-password')
          .send({ token: 'test-token', newPassword: 'newpassword123' });
      }

      // 4th request should be rate limited
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'test-token', newPassword: 'newpassword123' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many password reset requests');
    });
  });

  describe('OTP/MFA Rate Limiting', () => {
    it('should allow requests within the limit (5 per 15 minutes)', async () => {
      // Make 5 requests - should all succeed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/verify-2fa')
          .send({ tempToken: 'test-token', code: '123456' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding the limit (6th request)', async () => {
      // Make 5 successful requests first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/verify-2fa')
          .send({ tempToken: 'test-token', code: '123456' });
      }

      // 6th request should be rate limited
      const response = await request(app)
        .post('/api/auth/verify-2fa')
        .send({ tempToken: 'test-token', code: '123456' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many verification attempts');
    });
  });

  describe('Resend OTP Rate Limiting', () => {
    it('should allow requests within the limit (3 per hour)', async () => {
      // Make 3 requests - should all succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/resend-2fa')
          .send({ tempToken: 'test-token' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding the limit (4th request)', async () => {
      // Make 3 successful requests first
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/resend-2fa').send({ tempToken: 'test-token' });
      }

      // 4th request should be rate limited
      const response = await request(app)
        .post('/api/auth/resend-2fa')
        .send({ tempToken: 'test-token' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many resend requests');
    });
  });

  describe('Resend Verification Email Rate Limiting', () => {
    it('should allow requests within the limit (3 per hour)', async () => {
      // Make 3 requests - should all succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'test@example.com' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should block requests exceeding the limit (4th request)', async () => {
      // Make 3 successful requests first
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'test@example.com' });
      }

      // 4th request should be rate limited
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many verification email requests');
    });
  });

  describe('Sensitive Data Access Rate Limiting', () => {
    const getAuthToken = () => {
      return jwt.sign({ userId: 'test-user-id' }, process.env.JWT_SECRET);
    };

    it('should allow requests within the limit (100 per 15 minutes)', async () => {
      const token = getAuthToken();

      // Make 100 requests - should all succeed
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .get('/api/users')
          .set('Cookie', [`token=${token}`]);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    }, 30000); // Increase timeout for this test

    it('should block requests exceeding the limit (101st request)', async () => {
      const token = getAuthToken();

      // Make 100 successful requests first
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/users')
          .set('Cookie', [`token=${token}`]);
      }

      // 101st request should be rate limited
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many requests');
    }, 30000); // Increase timeout for this test
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in responses', async () => {
      // Make a request - headers should be present regardless of rate limit status
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'header-test@example.com' });

      // Headers should be present whether rate limited or not
      // Check for standard rate limit headers
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');

      // Verify header values are numbers
      expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
      expect(Number(response.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
      expect(Number(response.headers['ratelimit-reset'])).toBeGreaterThan(0);
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should track rate limits per IP address independently', async () => {
      // Use resend-2fa endpoint which has its own rate limiter instance (3 per hour)
      // Exhaust limit from IP 1 (make 3 requests)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/resend-2fa')
          .set('x-forwarded-for', '192.168.1.1')
          .send({ tempToken: 'test-token' });
        // First 3 should succeed
        expect(response.status).toBe(200);
      }

      // IP 1 should be rate limited on 4th request
      const response1 = await request(app)
        .post('/api/auth/resend-2fa')
        .set('x-forwarded-for', '192.168.1.1')
        .send({ tempToken: 'test-token' });

      expect(response1.status).toBe(429);

      // IP 2 should still be able to make requests (hasn't hit limit yet)
      const response2 = await request(app)
        .post('/api/auth/resend-2fa')
        .set('x-forwarded-for', '192.168.1.2')
        .send({ tempToken: 'test-token' });

      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
    });
  });
});
