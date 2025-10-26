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
        const { email, password, name, age, gender, course } = req.body;

        // Validation
        if (!email || !password || !name || !age || !gender) {
          return res.status(400).json({
            success: false,
            error: 'Email, password, name, age, and gender are required',
          });
        }

        // Gender validation
        const validGenders = ['Male', 'Female', 'Other'];
        if (!validGenders.includes(gender)) {
          return res.status(400).json({
            success: false,
            error: 'Gender must be one of: Male, Female, or Other',
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
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Email and password are required',
          });
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
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
        password: 'password123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        course: 'CS',
      });

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
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        age: 25,
        gender: 'Male',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
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
});
