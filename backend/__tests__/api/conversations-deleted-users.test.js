const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  conversation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

describe('Conversations API - Deleted Users Handling', () => {
  let app;
  let mockAuthToken;
  let mockUserId;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Mock GET /api/conversations endpoint
    app.get('/api/conversations', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;

        const conversations = await mockPrismaClient.conversation.findMany({
          where: {
            OR: [{ userAId: userId }, { userBId: userId }],
          },
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        const result = await Promise.all(
          conversations.map(async (c) => {
            const otherUserId = c.userAId === userId ? c.userBId : c.userAId;
            // Handle case where other user might be deleted (null)
            const otherUser = otherUserId
              ? await mockPrismaClient.user.findUnique({
                  where: { id: otherUserId },
                  select: { id: true, name: true, avatarUrl: true },
                })
              : null;
            // Hide name, avatar, and ID when conversation is locked (before match) or when user is deleted
            const sanitizedOtherUser =
              otherUser && c.isLocked
                ? {
                    name: 'Hidden User',
                    avatarUrl: null,
                  }
                : otherUser || {
                    name: 'Deleted User',
                    avatarUrl: null,
                  };
            return {
              id: c.id,
              isLocked: c.isLocked,
              lastMessage: c.messages[0] || null,
              otherUser: sanitizedOtherUser,
            };
          })
        );

        res.json({ success: true, conversations: result });
      } catch (error) {
        console.error('List conversations error:', error);
        res
          .status(500)
          .json({ success: false, error: 'Failed to list conversations', message: error.message });
      }
    });

    // Mock GET /api/conversations/:id/messages endpoint
    app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.userId;
        const { id } = req.params;

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

        const messages = await mockPrismaClient.message.findMany({
          where: { conversationId: id },
          orderBy: { createdAt: 'asc' },
        });

        // Include lightweight participant details to render avatars in chat UI
        // Handle null user IDs when a user has been deleted
        const [userA, userB] = await Promise.all([
          conversation.userAId
            ? mockPrismaClient.user.findUnique({
                where: { id: conversation.userAId },
                select: { id: true, name: true, avatarUrl: true },
              })
            : Promise.resolve(null),
          conversation.userBId
            ? mockPrismaClient.user.findUnique({
                where: { id: conversation.userBId },
                select: { id: true, name: true, avatarUrl: true },
              })
            : Promise.resolve(null),
        ]);
        const me = userA && userA.id === userId ? userA : userB;
        // Hide other user's name, avatar, and ID when conversation is locked (before match) or when user is deleted
        const other = userA && userA.id === userId ? userB : userA;
        const sanitizedOther =
          other && conversation.isLocked
            ? {
                name: 'Hidden User',
                avatarUrl: null,
              }
            : other || {
                name: 'Deleted User',
                avatarUrl: null,
              };

        res.json({
          success: true,
          isLocked: conversation.isLocked,
          messages,
          participants: { me, other: sanitizedOther },
          currentUserId: userId,
        });
      } catch (error) {
        console.error('Get messages error:', error);
        res
          .status(500)
          .json({ success: false, error: 'Failed to get messages', message: error.message });
      }
    });

    // Generate mock token
    mockUserId = '123e4567-e89b-12d3-a456-426614174000';
    mockAuthToken = jwt.sign({ userId: mockUserId }, process.env.JWT_SECRET || 'test-secret-key');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/conversations - Deleted Users', () => {
    it('should return "Deleted User" when other user has been deleted (userBId is null)', async () => {
      const conversationId = 'conv-123';
      const mockConversations = [
        {
          id: conversationId,
          userAId: mockUserId,
          userBId: null, // Deleted user
          isLocked: false,
          updatedAt: new Date(),
          messages: [],
        },
      ];

      mockPrismaClient.conversation.findMany.mockResolvedValue(mockConversations);
      mockPrismaClient.user.findUnique.mockResolvedValue(null); // User not found (deleted)

      const response = await request(app)
        .get('/api/conversations')
        .set('Cookie', `token=${mockAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].otherUser.name).toBe('Deleted User');
      expect(response.body.conversations[0].otherUser.avatarUrl).toBeNull();
    });

    it('should return "Deleted User" when other user has been deleted (userAId is null)', async () => {
      const conversationId = 'conv-123';
      const mockConversations = [
        {
          id: conversationId,
          userAId: null, // Deleted user
          userBId: mockUserId,
          isLocked: false,
          updatedAt: new Date(),
          messages: [],
        },
      ];

      mockPrismaClient.conversation.findMany.mockResolvedValue(mockConversations);
      mockPrismaClient.user.findUnique.mockResolvedValue(null); // User not found (deleted)

      const response = await request(app)
        .get('/api/conversations')
        .set('Cookie', `token=${mockAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].otherUser.name).toBe('Deleted User');
      expect(response.body.conversations[0].otherUser.avatarUrl).toBeNull();
    });
  });

  describe('GET /api/conversations/:id/messages - Deleted Users', () => {
    it('should return messages with null senderId when sender has been deleted', async () => {
      const conversationId = 'conv-123';
      const mockConversation = {
        id: conversationId,
        userAId: mockUserId,
        userBId: 'other-user-id',
        isLocked: false,
      };

      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: conversationId,
          senderId: null, // Deleted user
          content: 'This message was sent by a deleted user',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          conversationId: conversationId,
          senderId: mockUserId,
          content: 'This is my message',
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: mockUserId,
        name: 'Current User',
        avatarUrl: null,
      });

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].senderId).toBeNull();
      expect(response.body.messages[0].content).toBe('This message was sent by a deleted user');
      expect(response.body.messages[1].senderId).toBe(mockUserId);
    });

    it('should return "Deleted User" as other participant when other user has been deleted', async () => {
      const conversationId = 'conv-123';
      const mockConversation = {
        id: conversationId,
        userAId: mockUserId,
        userBId: null, // Deleted user
        isLocked: false,
      };

      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: conversationId,
          senderId: null,
          content: 'Message from deleted user',
          createdAt: new Date(),
        },
      ];

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaClient.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: mockUserId,
        name: 'Current User',
        avatarUrl: null,
      });

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.participants.other.name).toBe('Deleted User');
      expect(response.body.participants.other.avatarUrl).toBeNull();
    });

    it('should return 403 when both users in conversation are deleted', async () => {
      const conversationId = 'conv-123';
      const mockConversation = {
        id: conversationId,
        userAId: null, // Both deleted
        userBId: null,
        isLocked: false,
      };

      mockPrismaClient.conversation.findUnique.mockResolvedValue(mockConversation);

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Cookie', `token=${mockAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
    });
  });
});
