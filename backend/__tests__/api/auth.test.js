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

    app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Validate required fields
        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            success: false,
            error: 'Current password and new password are required',
          });
        }

        // Validate password length
        if (newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            error: 'New password must be at least 6 characters long',
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

  describe('POST /api/auth/change-password', () => {
    const userId = 'user-123';
    const token = jwt.sign({ userId }, process.env.JWT_SECRET);

    it('should successfully change password with valid credentials', async () => {
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

    it('should return 400 when new password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`token=${token}`])
        .send({
          currentPassword: 'oldpass123',
          newPassword: '12345', // Less than 6 characters
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('New password must be at least 6 characters long');
    });

    it('should return 401 when current password is incorrect', async () => {
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
