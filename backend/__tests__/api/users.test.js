const request = require('supertest');
const express = require('express');

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, _secret) => {
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === 'valid-user-token') {
      return { userId: 'test-user' };
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === 'invalid-token') {
      throw new Error('Invalid token');
    }
    throw new Error('Invalid token');
  }),
  sign: jest.fn((_payload, _secret, _options) => 'valid-user-token'),
}));

// Mock Prisma client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

const { PrismaClient } = require('@prisma/client');
const mockPrismaClient = new PrismaClient();

const { authenticateToken } = require('../../middleware/auth');

describe('Users API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Add users route
    app.get('/api/users', authenticateToken, async (req, res) => {
      try {
        const users = await mockPrismaClient.user.findMany({
          where: {
            verified: true,
          },
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            course: true,
            bio: true,
            interests: true,
            avatarUrl: true,
            verified: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        res.json({
          success: true,
          count: users.length,
          users,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return verified users when authenticated', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          name: 'Test User 1',
          age: 25,
          gender: 'Male',
          verified: true,
        },
        {
          id: 'user-2',
          name: 'Test User 2',
          age: 23,
          gender: 'Female',
          verified: true,
        },
      ];

      mockPrismaClient.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'test-user', banned: false });

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', ['token=valid-user-token']);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required. Please log in.');
    });

    it('should return 403 with invalid token', async () => {
      const response = await request(app).get('/api/users').set('Cookie', ['token=invalid-token']);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid authentication token.');
    });

    it('should only return verified users', async () => {
      const mockUsers = [{ id: 'user-1', verified: true, name: 'Verified User' }];

      mockPrismaClient.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'test-user', banned: false });

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', ['token=valid-user-token']);

      expect(response.status).toBe(200);
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { verified: true },
        })
      );
    });

    it('should return empty array when no verified users exist', async () => {
      mockPrismaClient.user.findMany.mockResolvedValue([]);
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'test-user', banned: false });

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', ['token=valid-user-token']);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });
});
