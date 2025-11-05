const request = require('supertest');
const express = require('express');
const { authenticateToken } = require('../../middleware/auth');

// Mock JWT
jest.mock('jsonwebtoken', () => {
  const mockJwt = {
    verify: jest.fn(),
    sign: jest.fn(),
  };
  return mockJwt;
});

const jwt = require('jsonwebtoken');

// Mock lib/prisma first (it's used by @prisma/client)
jest.mock('../../lib/prisma', () => {
  const mockPrismaClient = {
    userPoints: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userLikes: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
  return mockPrismaClient;
});

jest.mock('@prisma/client', () => {
  // Require lib/prisma to get the mocked instance
  const libPrisma = require('../../lib/prisma');
  return {
    PrismaClient: jest.fn(() => libPrisma),
  };
});

const mockPrismaClient = require('../../lib/prisma');

describe('Points API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Add points routes
    app.get('/api/points', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;

        let userPoints = await mockPrismaClient.userPoints.findUnique({
          where: { userId },
          select: {
            totalPoints: true,
            dailyCheckinDate: true,
            dailyLikeClaimedDate: true,
          },
        });

        // Fallback: Create userPoints record if it doesn't exist (edge case)
        if (!userPoints) {
          try {
            userPoints = await mockPrismaClient.userPoints.create({
              data: {
                userId: userId,
                totalPoints: 0,
              },
              select: {
                totalPoints: true,
                dailyCheckinDate: true,
                dailyLikeClaimedDate: true,
              },
            });
          } catch (createError) {
            return res.status(500).json({
              success: false,
              error: 'Failed to initialize user points. Please contact support.',
            });
          }
        }

        const mostRecentLike = await mockPrismaClient.userLikes.findFirst({
          where: { likerId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const hasLikedToday =
          mostRecentLike && new Date(mostRecentLike.createdAt).getTime() >= today.getTime();

        const pointsWithComputed = {
          ...userPoints,
          hasLikedToday,
        };

        res.json({
          success: true,
          points: pointsWithComputed,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve user points',
        });
      }
    });

    app.post('/api/points/claim-daily', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;

        const userPoints = await mockPrismaClient.userPoints.findUnique({
          where: { userId },
        });

        if (!userPoints) {
          return res.status(404).json({
            success: false,
            error: 'User points not found',
          });
        }

        if (userPoints.totalPoints >= 1000) {
          return res.status(400).json({
            success: false,
            error: 'Cannot claim points - you have reached the premium threshold.',
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (userPoints.dailyCheckinDate) {
          const lastClaimDate = new Date(userPoints.dailyCheckinDate);
          lastClaimDate.setHours(0, 0, 0, 0);

          if (lastClaimDate.getTime() === today.getTime()) {
            return res.status(400).json({
              success: false,
              error: 'Daily check-in already claimed today',
            });
          }
        }

        const updatedPoints = await mockPrismaClient.userPoints.update({
          where: { userId },
          data: {
            totalPoints: userPoints.totalPoints + 50,
            dailyCheckinDate: new Date(),
          },
          select: {
            totalPoints: true,
            dailyCheckinDate: true,
            dailyLikeClaimedDate: true,
          },
        });

        const mostRecentLikeAfter = await mockPrismaClient.userLikes.findFirst({
          where: { likerId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const hasLikedTodayAfter =
          mostRecentLikeAfter &&
          new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

        const pointsWithComputed = {
          ...updatedPoints,
          hasLikedToday: hasLikedTodayAfter,
        };

        res.json({
          success: true,
          message: 'Daily check-in claimed successfully',
          points: pointsWithComputed,
          pointsEarned: 50,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to claim daily points',
        });
      }
    });

    app.post('/api/points/claim-daily-like', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;

        const mostRecentLike = await mockPrismaClient.userLikes.findFirst({
          where: { likerId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        if (!mostRecentLike) {
          return res.status(400).json({
            success: false,
            error: 'No likes found for today',
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const likeDate = new Date(mostRecentLike.createdAt);
        likeDate.setHours(0, 0, 0, 0);

        if (likeDate.getTime() !== today.getTime()) {
          return res.status(400).json({
            success: false,
            error: 'Daily like task not completed yet',
          });
        }

        const userPoints = await mockPrismaClient.userPoints.findUnique({
          where: { userId },
        });

        if (!userPoints) {
          return res.status(404).json({
            success: false,
            error: 'User points not found',
          });
        }

        if (userPoints.totalPoints >= 1000) {
          return res.status(400).json({
            success: false,
            error: 'Cannot claim points - you have reached the premium threshold.',
          });
        }

        if (userPoints.dailyLikeClaimedDate) {
          const claimedDate = new Date(userPoints.dailyLikeClaimedDate);
          claimedDate.setHours(0, 0, 0, 0);

          if (claimedDate.getTime() === today.getTime()) {
            return res.status(400).json({
              success: false,
              error: 'Daily like points already claimed today',
            });
          }
        }

        const updatedPoints = await mockPrismaClient.userPoints.update({
          where: { userId },
          data: {
            totalPoints: userPoints.totalPoints + 25,
            dailyLikeClaimedDate: new Date(),
          },
          select: {
            totalPoints: true,
            dailyCheckinDate: true,
            dailyLikeClaimedDate: true,
          },
        });

        const mostRecentLikeAfter = await mockPrismaClient.userLikes.findFirst({
          where: { likerId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const hasLikedTodayAfter =
          mostRecentLikeAfter &&
          new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

        const pointsWithComputed = {
          ...updatedPoints,
          hasLikedToday: hasLikedTodayAfter,
        };

        res.json({
          success: true,
          message: 'Daily like points claimed successfully',
          points: pointsWithComputed,
          pointsEarned: 25,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to claim daily like points',
        });
      }
    });

    app.post('/api/points/unlock-premium', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;

        const userPoints = await mockPrismaClient.userPoints.findUnique({
          where: { userId },
        });

        if (!userPoints) {
          return res.status(404).json({
            success: false,
            error: 'User points not found',
          });
        }

        if (userPoints.totalPoints < 1000) {
          return res.status(400).json({
            success: false,
            error: 'Not enough points to unlock premium. Need 1000 points.',
            currentPoints: userPoints.totalPoints,
            requiredPoints: 1000,
          });
        }

        if (userPoints.premiumExpiryDate && new Date(userPoints.premiumExpiryDate) > new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Premium is already active',
          });
        }

        const premiumExpiryDate = new Date();
        premiumExpiryDate.setDate(premiumExpiryDate.getDate() + 5);

        const updatedPoints = await mockPrismaClient.userPoints.update({
          where: { userId },
          data: {
            premiumExpiryDate: premiumExpiryDate,
            totalPoints: 0,
          },
          select: {
            totalPoints: true,
            dailyCheckinDate: true,
            dailyLikeClaimedDate: true,
            premiumExpiryDate: true,
          },
        });

        const mostRecentLikeAfter = await mockPrismaClient.userLikes.findFirst({
          where: { likerId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const hasLikedTodayAfter =
          mostRecentLikeAfter &&
          new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

        const pointsWithComputed = {
          ...updatedPoints,
          hasLikedToday: hasLikedTodayAfter,
        };

        res.json({
          success: true,
          message: 'Premium unlocked successfully',
          points: pointsWithComputed,
          premiumExpiryDate: premiumExpiryDate,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to unlock premium',
        });
      }
    });

    // Set up JWT mocks
    jwt.sign.mockImplementation((payload, _secret, _options) => {
      return `mock-token-${payload.userId}`;
    });

    jwt.verify.mockImplementation((token, _secret) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token && typeof token === 'string' && token.startsWith('mock-token-')) {
        const userId = token.replace('mock-token-', '');
        return { userId };
      }
      throw new Error('Invalid token');
    });

    app.get('/api/points/premium-status', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;

        const userPoints = await mockPrismaClient.userPoints.findUnique({
          where: { userId },
          select: {
            premiumExpiryDate: true,
            totalPoints: true,
          },
        });

        if (!userPoints) {
          return res.status(404).json({
            success: false,
            error: 'User points not found',
          });
        }

        let isPremiumActive = false;
        if (userPoints.premiumExpiryDate) {
          isPremiumActive = new Date(userPoints.premiumExpiryDate) > new Date();
        }

        res.json({
          success: true,
          isPremiumActive: isPremiumActive,
          premiumExpiryDate: userPoints.premiumExpiryDate,
          totalPoints: userPoints.totalPoints,
          canUnlockPremium: userPoints.totalPoints >= 1000 && !isPremiumActive,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to check premium status',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock user lookup for authentication middleware
    mockPrismaClient.user.findUnique.mockImplementation((query) => {
      // For authentication checks (querying by id with select for banned)
      if (query.where && query.where.id && query.select && query.select.banned !== undefined) {
        return Promise.resolve({
          id: query.where.id,
          banned: false,
        });
      }
      // For other queries, return null by default (tests will override)
      return Promise.resolve(null);
    });
  });

  describe('GET /api/points', () => {
    it('should return user points when authenticated', async () => {
      const mockPoints = {
        totalPoints: 150,
        dailyCheckinDate: new Date(),
        dailyLikeClaimedDate: new Date(),
      };

      const mockLike = {
        createdAt: new Date(),
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);
      mockPrismaClient.userLikes.findFirst.mockResolvedValue(mockLike);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/points')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.points.totalPoints).toBe(150);
      expect(response.body.points.hasLikedToday).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/points');

      expect(response.status).toBe(401);
    });

    it('should auto-create user points record if not found (fallback)', async () => {
      const newlyCreatedPoints = {
        totalPoints: 0,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: null,
      };

      // First call returns null (not found), then create is called
      mockPrismaClient.userPoints.findUnique.mockResolvedValue(null);
      mockPrismaClient.userPoints.create.mockResolvedValue(newlyCreatedPoints);
      mockPrismaClient.userLikes.findFirst.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/points')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.points.totalPoints).toBe(0);
      expect(mockPrismaClient.userPoints.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          totalPoints: 0,
        },
        select: {
          totalPoints: true,
          dailyCheckinDate: true,
          dailyLikeClaimedDate: true,
        },
      });
    });
  });

  describe('POST /api/points/claim-daily', () => {
    it('should successfully claim daily check-in points', async () => {
      const mockPoints = {
        totalPoints: 100,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: null,
      };

      const updatedPoints = {
        totalPoints: 150,
        dailyCheckinDate: new Date(),
        dailyLikeClaimedDate: null,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);
      mockPrismaClient.userPoints.update.mockResolvedValue(updatedPoints);
      mockPrismaClient.userLikes.findFirst.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/claim-daily')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Daily check-in claimed successfully');
      expect(response.body.pointsEarned).toBe(50);
    });

    it('should return 400 if already claimed today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mockPoints = {
        totalPoints: 100,
        dailyCheckinDate: today,
        dailyLikeClaimedDate: null,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/claim-daily')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Daily check-in already claimed today');
    });

    it('should return 400 if user has reached premium threshold', async () => {
      const mockPoints = {
        totalPoints: 1000,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: null,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/claim-daily')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('reached the premium threshold');
    });
  });

  describe('POST /api/points/claim-daily-like', () => {
    it('should successfully claim daily like points', async () => {
      const today = new Date();
      const mockLike = { createdAt: today };
      const mockPoints = {
        totalPoints: 100,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: null,
      };

      const updatedPoints = {
        totalPoints: 125,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: new Date(),
      };

      mockPrismaClient.userLikes.findFirst.mockResolvedValue(mockLike);
      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);
      mockPrismaClient.userPoints.update.mockResolvedValue(updatedPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/claim-daily-like')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pointsEarned).toBe(25);
    });

    it('should return 400 if no likes found for today', async () => {
      mockPrismaClient.userLikes.findFirst.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/claim-daily-like')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No likes found for today');
    });

    it('should return 400 if daily like task not completed yet', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const mockLike = { createdAt: yesterday };

      mockPrismaClient.userLikes.findFirst.mockResolvedValue(mockLike);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/claim-daily-like')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Daily like task not completed yet');
    });
  });

  describe('POST /api/points/unlock-premium', () => {
    it('should successfully unlock premium', async () => {
      const mockPoints = {
        totalPoints: 1000,
        premiumExpiryDate: null,
      };

      const updatedPoints = {
        totalPoints: 0,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: null,
        premiumExpiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);
      mockPrismaClient.userPoints.update.mockResolvedValue(updatedPoints);
      mockPrismaClient.userLikes.findFirst.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/unlock-premium')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Premium unlocked successfully');
      expect(response.body.points.totalPoints).toBe(0);
    });

    it('should return 400 if not enough points', async () => {
      const mockPoints = {
        totalPoints: 500,
        premiumExpiryDate: null,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/unlock-premium')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Not enough points');
      expect(response.body.requiredPoints).toBe(1000);
    });

    it('should return 400 if premium already active', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockPoints = {
        totalPoints: 1000,
        premiumExpiryDate: futureDate,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/points/unlock-premium')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Premium is already active');
    });
  });

  describe('GET /api/points/premium-status', () => {
    it('should return premium status when not premium', async () => {
      const mockPoints = {
        premiumExpiryDate: null,
        totalPoints: 500,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/points/premium-status')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isPremiumActive).toBe(false);
      expect(response.body.canUnlockPremium).toBe(false);
    });

    it('should return premium status when premium is active', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockPoints = {
        premiumExpiryDate: futureDate,
        totalPoints: 0,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/points/premium-status')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.isPremiumActive).toBe(true);
      expect(response.body.canUnlockPremium).toBe(false);
    });

    it('should show canUnlockPremium as true when eligible', async () => {
      const mockPoints = {
        premiumExpiryDate: null,
        totalPoints: 1000,
      };

      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/points/premium-status')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.canUnlockPremium).toBe(true);
    });
  });
});
