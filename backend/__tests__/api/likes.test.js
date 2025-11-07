const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  userLikes: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userPoints: {
    findUnique: jest.fn(),
  },
  conversation: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

describe('Likes API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Add likes routes
    app.post('/api/likes', authenticateToken, async (req, res) => {
      try {
        const likerId = req.user.userId;
        const { likedId } = req.body;

        if (!likedId) {
          return res.status(400).json({
            success: false,
            error: 'likedId is required',
          });
        }

        if (likerId === likedId) {
          return res.status(400).json({
            success: false,
            error: 'Cannot like yourself',
          });
        }

        const likedUser = await mockPrismaClient.user.findUnique({
          where: { id: likedId },
          select: { id: true, verified: true },
        });

        if (!likedUser || !likedUser.verified) {
          return res.status(404).json({
            success: false,
            error: 'User not found or not verified',
          });
        }

        const existingLike = await mockPrismaClient.userLikes.findUnique({
          where: {
            likerId_likedId: {
              likerId: likerId,
              likedId: likedId,
            },
          },
        });

        if (existingLike) {
          return res.status(409).json({
            success: false,
            error: 'User already liked',
          });
        }

        const like = await mockPrismaClient.userLikes.create({
          data: {
            likerId: likerId,
            likedId: likedId,
          },
        });

        const userPoints = await mockPrismaClient.userPoints.findUnique({
          where: { userId: likerId },
          select: {
            totalPoints: true,
            dailyCheckinDate: true,
            dailyLikeClaimedDate: true,
          },
        });

        res.status(201).json({
          success: true,
          message: 'User liked successfully',
          like: like,
          points: userPoints,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to like user',
        });
      }
    });

    app.get('/api/likes/check/:userId', authenticateToken, async (req, res) => {
      try {
        const likerId = req.user.userId;
        const { userId: likedId } = req.params;

        const like = await mockPrismaClient.userLikes.findUnique({
          where: {
            likerId_likedId: {
              likerId: likerId,
              likedId: likedId,
            },
          },
        });

        res.json({
          success: true,
          isLiked: !!like,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to check like status',
        });
      }
    });

    app.delete('/api/likes/:userId', authenticateToken, async (req, res) => {
      try {
        const likerId = req.user.userId;
        const { userId: likedId } = req.params;

        const like = await mockPrismaClient.userLikes.findUnique({
          where: {
            likerId_likedId: {
              likerId: likerId,
              likedId: likedId,
            },
          },
        });

        if (!like) {
          return res.status(404).json({
            success: false,
            error: 'Like not found',
          });
        }

        await mockPrismaClient.userLikes.delete({
          where: {
            likerId_likedId: {
              likerId: likerId,
              likedId: likedId,
            },
          },
        });

        res.json({
          success: true,
          message: 'User unliked successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to unlike user',
        });
      }
    });

    app.get('/api/likes', authenticateToken, async (req, res) => {
      try {
        const likerId = req.user.userId;

        const likes = await mockPrismaClient.userLikes.findMany({
          where: {
            likerId: likerId,
          },
          include: {
            liked: {
              select: {
                id: true,
                name: true,
                age: true,
                gender: true,
                course: true,
                bio: true,
                interests: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const likedProfiles = await Promise.all(
          likes.map(async (like) => {
            const likedId = like.liked.id;
            const userAId = likerId < likedId ? likerId : likedId;
            const userBId = likerId < likedId ? likedId : likerId;

            const conversation = await mockPrismaClient.conversation.findUnique({
              where: { userAId_userBId: { userAId, userBId } },
              include: {
                messages: {
                  where: {
                    senderId: likerId,
                  },
                  take: 1,
                },
              },
            });

            const hasIntro = !!conversation && conversation.messages.length > 0;

            return {
              id: like.liked.id,
              name: like.liked.name,
              age: like.liked.age,
              gender: like.liked.gender,
              course: like.liked.course,
              bio: like.liked.bio,
              interests: like.liked.interests,
              avatarUrl: like.liked.avatarUrl,
              hasIntro,
            };
          })
        );

        res.json({
          success: true,
          data: likedProfiles,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get liked profiles',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/likes', () => {
    it('should successfully like a user', async () => {
      const mockLikedUser = { id: 'user-2', verified: true };
      const mockLike = {
        id: 'like-1',
        likerId: 'user-1',
        likedId: 'user-2',
        createdAt: new Date(),
      };
      const mockPoints = {
        totalPoints: 100,
        dailyCheckinDate: null,
        dailyLikeClaimedDate: null,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockLikedUser);
      mockPrismaClient.userLikes.findUnique.mockResolvedValue(null);
      mockPrismaClient.userLikes.create.mockResolvedValue(mockLike);
      mockPrismaClient.userPoints.findUnique.mockResolvedValue(mockPoints);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/likes')
        .set('Cookie', [`token=${token}`])
        .send({ likedId: 'user-2' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User liked successfully');
      expect(response.body.like.likedId).toBe('user-2');
    });

    it('should return 400 if likedId is missing', async () => {
      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/likes')
        .set('Cookie', [`token=${token}`])
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('likedId is required');
    });

    it('should return 400 if trying to like yourself', async () => {
      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/likes')
        .set('Cookie', [`token=${token}`])
        .send({ likedId: 'user-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot like yourself');
    });

    it('should return 404 if liked user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/likes')
        .set('Cookie', [`token=${token}`])
        .send({ likedId: 'user-2' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found or not verified');
    });

    it('should return 409 if user already liked', async () => {
      const mockLikedUser = { id: 'user-2', verified: true };
      const mockExistingLike = { id: 'like-1' };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockLikedUser);
      mockPrismaClient.userLikes.findUnique.mockResolvedValue(mockExistingLike);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/likes')
        .set('Cookie', [`token=${token}`])
        .send({ likedId: 'user-2' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User already liked');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).post('/api/likes').send({ likedId: 'user-2' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/likes/check/:userId', () => {
    it('should return true if user is liked', async () => {
      const mockLike = { id: 'like-1' };

      mockPrismaClient.userLikes.findUnique.mockResolvedValue(mockLike);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/likes/check/user-2')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isLiked).toBe(true);
    });

    it('should return false if user is not liked', async () => {
      mockPrismaClient.userLikes.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/likes/check/user-2')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.isLiked).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/likes/check/user-2');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/likes/:userId', () => {
    it('should successfully unlike a user', async () => {
      const mockLike = { id: 'like-1' };

      mockPrismaClient.userLikes.findUnique.mockResolvedValue(mockLike);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .delete('/api/likes/user-2')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User unliked successfully');
    });

    it('should return 404 if like not found', async () => {
      mockPrismaClient.userLikes.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .delete('/api/likes/user-2')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Like not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).delete('/api/likes/user-2');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/likes', () => {
    it('should return liked profiles with hasIntro flag set to false when no intro message exists', async () => {
      const mockLikes = [
        {
          liked: {
            id: 'user-2',
            name: 'Test User',
            age: 25,
            gender: 'Male',
            course: 'Computer Science',
            bio: 'Test bio',
            interests: ['coding'],
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        },
      ];

      mockPrismaClient.userLikes.findMany.mockResolvedValue(mockLikes);
      mockPrismaClient.conversation.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/likes')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].hasIntro).toBe(false);
      expect(response.body.data[0].id).toBe('user-2');
    });

    it('should return liked profiles with hasIntro flag set to true when intro message exists', async () => {
      const mockLikes = [
        {
          liked: {
            id: 'user-2',
            name: 'Test User',
            age: 25,
            gender: 'Male',
            course: 'Computer Science',
            bio: 'Test bio',
            interests: ['coding'],
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        },
      ];

      const mockConversation = {
        id: 'conv-1',
        messages: [{ id: 'msg-1', senderId: 'user-1', content: 'Hello!' }],
      };

      mockPrismaClient.userLikes.findMany.mockResolvedValue(mockLikes);
      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/likes')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].hasIntro).toBe(true);
      expect(response.body.data[0].id).toBe('user-2');
    });

    it('should return hasIntro false when conversation exists but has no messages from liker', async () => {
      const mockLikes = [
        {
          liked: {
            id: 'user-2',
            name: 'Test User',
            age: 25,
            gender: 'Male',
            course: 'Computer Science',
            bio: 'Test bio',
            interests: ['coding'],
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        },
      ];

      const mockConversation = {
        id: 'conv-1',
        messages: [], // No messages from liker
      };

      mockPrismaClient.userLikes.findMany.mockResolvedValue(mockLikes);
      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .get('/api/likes')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].hasIntro).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/likes');

      expect(response.status).toBe(401);
    });
  });
});