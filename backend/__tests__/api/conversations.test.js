const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  conversation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock message validation utility
const mockValidateConversationId = jest.fn();
const mockValidateAndSanitizeMessage = jest.fn();

jest.mock('../../utils/messageValidation', () => ({
  validateConversationId: (...args) => mockValidateConversationId(...args),
  validateAndSanitizeMessage: (...args) => mockValidateAndSanitizeMessage(...args),
}));

jest.mock('lusca', () => ({
  csrf: () => (req, res, next) => next(),
  xframe: () => (req, res, next) => next(),
  xssProtection: () => (req, res, next) => next(),
}));

describe('Conversations API Endpoints', () => {
  let app;
  let mockAuthToken;
  let mockUserId;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    const lusca = require('lusca');
    app.use(lusca.csrf());

    // Mock authenticateToken middleware
    app.use('/api/conversations/:id/messages', authenticateToken);

    // Add message sending route
    app.post('/api/conversations/:id/messages', async (req, res) => {
      try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { content } = req.body;

        // Validate conversation ID format
        const {
          validateConversationId,
          validateAndSanitizeMessage,
        } = require('../../utils/messageValidation');
        if (!validateConversationId(id)) {
          return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
        }

        // Validate and sanitize message content
        const validation = validateAndSanitizeMessage(content);
        if (!validation.isValid) {
          return res.status(400).json({ success: false, error: validation.error });
        }

        const conversation = await mockPrismaClient.conversation.findUnique({ where: { id } });
        if (!conversation)
          return res.status(404).json({ success: false, error: 'Conversation not found' });
        // Handle null user IDs (when a user has been deleted)
        if (
          (conversation.userAId !== userId && conversation.userBId !== userId) ||
          (!conversation.userAId && !conversation.userBId)
        ) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        // Prevent sending messages if the other user has been deleted
        if (!conversation.userAId || !conversation.userBId) {
          return res
            .status(410)
            .json({ success: false, error: 'Cannot send message: other user has been deleted' });
        }
        if (conversation.isLocked) {
          return res.status(423).json({ success: false, error: 'Chat is locked until you match' });
        }

        const message = await mockPrismaClient.message.create({
          data: {
            conversationId: id,
            senderId: userId,
            content: validation.sanitized,
          },
        });

        await mockPrismaClient.conversation.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

        res.status(201).json({ success: true, message });
      } catch (error) {
        console.error('Send message error:', error);
        res
          .status(500)
          .json({ success: false, error: 'Failed to send message', message: error.message });
      }
    });

    // Generate mock token
    mockUserId = '123e4567-e89b-12d3-a456-426614174000';
    mockAuthToken = jwt.sign({ userId: mockUserId }, process.env.JWT_SECRET || 'test-secret-key');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/conversations/:id/messages', () => {
    const conversationId = '478bba95-71bf-4224-be35-6d81dffe75f3';
    const validContent = 'Hello, how are you?';

    it('should send a valid message successfully', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: mockUserId,
        userBId: 'another-user-id',
        isLocked: false,
      };

      const mockMessage = {
        id: 'message-id',
        conversationId,
        senderId: mockUserId,
        content: validContent,
        createdAt: new Date(),
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.create.mockResolvedValue(mockMessage);
      mockPrismaClient.conversation.update.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBeDefined();
      expect(mockValidateConversationId).toHaveBeenCalledWith(conversationId);
      expect(mockValidateAndSanitizeMessage).toHaveBeenCalledWith(validContent);
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          senderId: mockUserId,
          content: validContent,
        },
      });
    });

    it('should reject invalid conversation ID format', async () => {
      const invalidId = 'not-a-uuid';
      mockValidateConversationId.mockReturnValue(false);

      const response = await request(app)
        .post(`/api/conversations/${invalidId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid conversation ID format');
      expect(mockValidateAndSanitizeMessage).not.toHaveBeenCalled();
    });

    it('should reject empty message', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: false,
        sanitized: '',
        error: 'Message cannot be empty',
      });

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message cannot be empty');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should reject message exceeding maximum length', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: false,
        sanitized: '',
        error: 'Message exceeds maximum length of 5000 characters',
      });

      const longContent = 'a'.repeat(5001);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: longContent })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message exceeds maximum length of 5000 characters');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should sanitize XSS attempts in message', async () => {
      const maliciousContent = '<script>alert("XSS")</script>Hello';
      const sanitizedContent = 'Hello';

      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: sanitizedContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: mockUserId,
        userBId: 'another-user-id',
        isLocked: false,
      };

      const mockMessage = {
        id: 'message-id',
        conversationId,
        senderId: mockUserId,
        content: sanitizedContent,
        createdAt: new Date(),
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.create.mockResolvedValue(mockMessage);
      mockPrismaClient.conversation.update.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: maliciousContent })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          conversationId,
          senderId: mockUserId,
          content: sanitizedContent, // Should be sanitized, not the original malicious content
        },
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      mockPrismaClient.conversation.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Conversation not found');
    });

    it('should return 403 for user not in conversation', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: 'user-a',
        userBId: 'user-b',
        isLocked: false,
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should return 423 for locked conversation', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: mockUserId,
        userBId: 'another-user-id',
        isLocked: true,
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Chat is locked until you match');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should return 410 when trying to send message to conversation with deleted user (userAId is null)', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: null, // Deleted user
        userBId: mockUserId,
        isLocked: false,
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot send message: other user has been deleted');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should return 410 when trying to send message to conversation with deleted user (userBId is null)', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: mockUserId,
        userBId: null, // Deleted user
        isLocked: false,
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot send message: other user has been deleted');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });

    it('should return 403 when both users in conversation are deleted', async () => {
      mockValidateConversationId.mockReturnValue(true);
      mockValidateAndSanitizeMessage.mockReturnValue({
        isValid: true,
        sanitized: validContent,
        error: null,
      });

      const mockConversation = {
        id: conversationId,
        userAId: null, // Both users deleted
        userBId: null,
        isLocked: false,
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .send({ content: validContent })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
      expect(mockPrismaClient.message.create).not.toHaveBeenCalled();
    });
  });
});
