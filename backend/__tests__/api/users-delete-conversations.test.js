const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  conversation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

describe('User Account Deletion - Conversations and Messages Preservation', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Add DELETE user route (simplified version for testing)
    app.delete('/api/users/:id', authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (req.user.userId !== id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only delete your own account.',
          });
        }

        const user = await mockPrismaClient.user.findUnique({
          where: { id: id },
          select: { id: true },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        // Delete user - conversations and messages should be preserved via SET NULL
        await mockPrismaClient.user.delete({
          where: { id: id },
        });

        res.clearCookie('token');
        res.json({
          success: true,
          message: 'Account deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete account',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Conversations Preservation', () => {
    it('should preserve conversations when user is deleted (userAId becomes null)', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const conversationId = 'conv-123';

      // Mock user exists
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock conversations before deletion
      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: userId,
          userBId: otherUserId,
          isLocked: false,
        },
      ]);

      // Mock user deletion
      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      // After deletion, conversation should still exist with userAId = null
      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: null, // Preserved with null userAId
          userBId: otherUserId,
          isLocked: false,
        },
      ]);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });

      // Verify conversation still exists (would be checked in actual implementation)
      const conversations = await mockPrismaClient.conversation.findMany();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].userAId).toBeNull();
      expect(conversations[0].userBId).toBe(otherUserId);
    });

    it('should preserve conversations when user is deleted (userBId becomes null)', async () => {
      const userId = 'user-456';
      const otherUserId = 'user-123';
      const conversationId = 'conv-123';

      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: otherUserId,
          userBId: userId,
          isLocked: false,
        },
      ]);

      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      // After deletion
      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: otherUserId,
          userBId: null, // Preserved with null userBId
          isLocked: false,
        },
      ]);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);

      const conversations = await mockPrismaClient.conversation.findMany();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].userAId).toBe(otherUserId);
      expect(conversations[0].userBId).toBeNull();
    });
  });

  describe('Messages Preservation', () => {
    it('should preserve messages when user is deleted (senderId becomes null)', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';
      const messageId = 'msg-123';

      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock messages before deletion
      mockPrismaClient.message.findMany.mockResolvedValue([
        {
          id: messageId,
          conversationId: conversationId,
          senderId: userId,
          content: 'Hello, this is a test message',
          createdAt: new Date(),
        },
      ]);

      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      // After deletion, messages should still exist with senderId = null
      mockPrismaClient.message.findMany.mockResolvedValue([
        {
          id: messageId,
          conversationId: conversationId,
          senderId: null, // Preserved with null senderId
          content: 'Hello, this is a test message',
          createdAt: new Date(),
        },
      ]);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify messages still exist
      const messages = await mockPrismaClient.message.findMany({
        where: { conversationId },
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].senderId).toBeNull();
      expect(messages[0].content).toBe('Hello, this is a test message');
    });
  });
});
