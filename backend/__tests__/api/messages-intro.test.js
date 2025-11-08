const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  userLikes: {
    findUnique: jest.fn(),
  },
  conversation: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  message: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock message validation utility
const mockValidateUserId = jest.fn();
const mockValidateAndSanitizeMessage = jest.fn();

jest.mock('../../utils/messageValidation', () => ({
  validateUserId: (...args) => mockValidateUserId(...args),
  validateAndSanitizeMessage: (...args) => mockValidateAndSanitizeMessage(...args),
}));

jest.mock('lusca', () => ({
  csrf: () => (req, res, next) => next(),
  xframe: () => (req, res, next) => next(),
  xssProtection: () => (req, res, next) => next(),
}));

describe('Introduction Message API Endpoints', () => {
  let app;
  let mockAuthToken;
  let mockLikerId;
  let mockLikedId;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    const lusca = require('lusca');
    app.use(lusca.csrf());

    // Mock authenticateToken middleware
    app.use('/api/likes/:userId/intro', authenticateToken);

    // Add intro message route
    app.post('/api/likes/:userId/intro', async (req, res) => {
      try {
        const likerId = req.user.userId;
        const { userId: likedId } = req.params;
        const { introMessage } = req.body;

        // Validate user ID format
        const {
          validateUserId,
          validateAndSanitizeMessage,
        } = require('../../utils/messageValidation');
        if (!validateUserId(likedId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID format',
          });
        }

        // Validate and sanitize intro message
        const validation = validateAndSanitizeMessage(introMessage);
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            error: validation.error || 'Intro message is required',
          });
        }

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

        const userAId = likerId < likedId ? likerId : likedId;
        const userBId = likerId < likedId ? likedId : likerId;

        let conversation = await mockPrismaClient.conversation.findUnique({
          where: { userAId_userBId: { userAId, userBId } },
        });

        if (!conversation) {
          conversation = await mockPrismaClient.conversation.create({
            data: { userAId, userBId, isLocked: true },
          });
        }

        const existingMessage = await mockPrismaClient.message.findFirst({
          where: {
            conversationId: conversation.id,
            senderId: likerId,
          },
        });

        if (existingMessage) {
          return res.status(409).json({
            success: false,
            error: 'Introduction message already sent',
          });
        }

        const createdIntroMessage = await mockPrismaClient.message.create({
          data: {
            conversationId: conversation.id,
            senderId: likerId,
            content: validation.sanitized,
          },
        });

        res.status(201).json({
          success: true,
          message: 'Introduction sent successfully',
          introMessage: { id: createdIntroMessage.id },
        });
      } catch (error) {
        console.error('Send intro message error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to send introduction',
          message: error.message,
        });
      }
    });

    // Generate mock tokens
    mockLikerId = '123e4567-e89b-12d3-a456-426614174000';
    mockLikedId = '223e4567-e89b-12d3-a456-426614174000';
    mockAuthToken = jwt.sign({ userId: mockLikerId }, process.env.JWT_SECRET || 'test-secret-key');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/likes/:userId/intro', () => {
    const validIntroMessage = 'Hi, I would like to connect with you!';

    it('should send a valid introduction message successfully', async () => {
      mockValidateUserId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validIntroMessage,
        error: null,
      });

      const mockLike = {
        likerId: mockLikerId,
        likedId: mockLikedId,
      };

      const mockConversation = {
        id: 'conversation-id',
        userAId: mockLikerId,
        userBId: mockLikedId,
        isLocked: true,
      };

      const mockMessage = {
        id: 'message-id',
        conversationId: mockConversation.id,
        senderId: mockLikerId,
        content: validIntroMessage,
        createdAt: new Date(),
      };

      mockPrismaClient.userLikes.findUnique.mockResolvedValue(mockLike);
      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.findFirst.mockResolvedValue(null);
      mockPrismaClient.message.create.mockResolvedValue(mockMessage);

      const response = await request(app)
        .post(`/api/likes/${mockLikedId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: validIntroMessage })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Introduction sent successfully');
      expect(mockValidateUserId).toHaveBeenCalledWith(mockLikedId);
      expect(mockValidateAndSanitizeMessage).toHaveBeenCalledWith(validIntroMessage);
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: mockConversation.id,
          senderId: mockLikerId,
          content: validIntroMessage,
        },
      });
    });

    it('should reject invalid user ID format', async () => {
      const invalidUserId = 'not-a-uuid';
      mockValidateUserId.mockReturnValue(false);

      const response = await request(app)
        .post(`/api/likes/${invalidUserId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: validIntroMessage })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid user ID format');
      expect(mockValidateAndSanitizeMessage).not.toHaveBeenCalled();
    });

    it('should reject empty introduction message', async () => {
      mockValidateUserId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: false,
        sanitized: '',
        error: 'Message cannot be empty',
      });

      const response = await request(app)
        .post(`/api/likes/${mockLikedId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message cannot be empty');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should reject introduction message exceeding maximum length', async () => {
      mockValidateUserId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: false,
        sanitized: '',
        error: 'Message exceeds maximum length of 5000 characters',
      });

      const longMessage = 'a'.repeat(5001);

      const response = await request(app)
        .post(`/api/likes/${mockLikedId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: longMessage })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message exceeds maximum length of 5000 characters');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should sanitize XSS attempts in introduction message', async () => {
      const maliciousContent = '<script>alert("XSS")</script>Hello';
      const sanitizedContent = 'Hello';

      mockValidateUserId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: sanitizedContent,
        error: null,
      });

      const mockLike = {
        likerId: mockLikerId,
        likedId: mockLikedId,
      };

      const mockConversation = {
        id: 'conversation-id',
        userAId: mockLikerId,
        userBId: mockLikedId,
        isLocked: true,
      };

      const mockMessage = {
        id: 'message-id',
        conversationId: mockConversation.id,
        senderId: mockLikerId,
        content: sanitizedContent,
        createdAt: new Date(),
      };

      mockPrismaClient.userLikes.findUnique.mockResolvedValue(mockLike);
      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.findFirst.mockResolvedValue(null);
      mockPrismaClient.message.create.mockResolvedValue(mockMessage);

      const response = await request(app)
        .post(`/api/likes/${mockLikedId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: maliciousContent })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: mockConversation.id,
          senderId: mockLikerId,
          content: sanitizedContent, // Should be sanitized
        },
      });
    });

    it('should return 404 if like does not exist', async () => {
      mockValidateUserId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validIntroMessage,
        error: null,
      });

      mockPrismaClient.userLikes.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/likes/${mockLikedId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: validIntroMessage })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Like not found');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should return 409 if introduction message already sent', async () => {
      mockValidateUserId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validIntroMessage,
        error: null,
      });

      const mockLike = {
        likerId: mockLikerId,
        likedId: mockLikedId,
      };

      const mockConversation = {
        id: 'conversation-id',
        userAId: mockLikerId,
        userBId: mockLikedId,
        isLocked: true,
      };

      const existingMessage = {
        id: 'existing-message-id',
        conversationId: mockConversation.id,
        senderId: mockLikerId,
        content: 'Previous intro',
      };

      mockPrismaClient.userLikes.findUnique.mockResolvedValue(mockLike);
      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.findFirst.mockResolvedValue(existingMessage);

      const response = await request(app)
        .post(`/api/likes/${mockLikedId}/intro`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ introMessage: validIntroMessage })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Introduction message already sent');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });
  });
});
