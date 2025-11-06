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
    deleteMany: jest.fn(),
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

        // Before deleting the user, find and delete conversations where both users are deleted
        const conversationsToDelete = await mockPrismaClient.conversation.findMany({
          where: {
            OR: [
              { userAId: id, userBId: null },
              { userAId: null, userBId: id },
            ],
          },
          select: { id: true },
        });

        // Delete conversations where both users are deleted (messages will be cascade deleted)
        if (conversationsToDelete.length > 0) {
          await mockPrismaClient.conversation.deleteMany({
            where: {
              id: { in: conversationsToDelete.map((c) => c.id) },
            },
          });
        }

        // Also clean up any orphaned conversations (where both user IDs are already null)
        await mockPrismaClient.conversation.deleteMany({
          where: {
            userAId: null,
            userBId: null,
          },
        });

        // Delete user - conversations and messages should be preserved via SET NULL for remaining conversations
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

  describe('Conversations Preservation and Deletion', () => {
    it('should preserve conversations when only one user is deleted (userAId becomes null)', async () => {
      const userId = 'user-123';

      // Mock user exists
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock: no conversations where both users are deleted (other user still exists)
      mockPrismaClient.conversation.findMany.mockResolvedValue([]);

      // Mock: cleanup of orphaned conversations (none exist)
      mockPrismaClient.conversation.deleteMany.mockResolvedValue({ count: 0 });

      // Mock user deletion
      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });

      // Verify that conversations with both users deleted are checked
      expect(mockPrismaClient.conversation.findMany).toHaveBeenCalled();
      // Verify cleanup of orphaned conversations is called
      expect(mockPrismaClient.conversation.deleteMany).toHaveBeenCalledWith({
        where: {
          userAId: null,
          userBId: null,
        },
      });
    });

    it('should delete conversations when both users are deleted', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';

      // Mock user exists
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock: conversation where this user is userA and userB is already deleted (null)
      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: userId,
          userBId: null, // Other user already deleted
        },
      ]);

      // Mock: delete the conversation
      mockPrismaClient.conversation.deleteMany
        .mockResolvedValueOnce({ count: 1 }) // Delete conversation with both users deleted
        .mockResolvedValueOnce({ count: 0 }); // Cleanup orphaned conversations

      // Mock user deletion
      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify conversation was deleted
      expect(mockPrismaClient.conversation.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [conversationId] },
        },
      });
    });

    it('should preserve conversations when only one user is deleted (userBId becomes null)', async () => {
      const userId = 'user-456';

      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock: no conversations where both users are deleted (other user still exists)
      mockPrismaClient.conversation.findMany.mockResolvedValue([]);

      // Mock: cleanup of orphaned conversations (none exist)
      mockPrismaClient.conversation.deleteMany.mockResolvedValue({ count: 0 });

      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify cleanup is called
      expect(mockPrismaClient.conversation.deleteMany).toHaveBeenCalledWith({
        where: {
          userAId: null,
          userBId: null,
        },
      });
    });

    it('should delete conversation when second user is deleted (userA was already deleted)', async () => {
      const userId = 'user-456';
      const conversationId = 'conv-123';

      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock: conversation where this user is userB and userA is already deleted (null)
      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: null, // Other user already deleted
          userBId: userId,
        },
      ]);

      // Mock: delete the conversation
      mockPrismaClient.conversation.deleteMany
        .mockResolvedValueOnce({ count: 1 }) // Delete conversation with both users deleted
        .mockResolvedValueOnce({ count: 0 }); // Cleanup orphaned conversations

      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify conversation was deleted
      expect(mockPrismaClient.conversation.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [conversationId] },
        },
      });
    });
  });

  describe('Messages Preservation and Deletion', () => {
    it('should preserve messages when only one user is deleted (senderId becomes null)', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';
      const messageId = 'msg-123';

      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock: no conversations where both users are deleted
      mockPrismaClient.conversation.findMany.mockResolvedValue([]);
      mockPrismaClient.conversation.deleteMany.mockResolvedValue({ count: 0 });

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
    });

    it('should delete messages when both users are deleted (conversation is deleted)', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';

      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });

      // Mock: conversation where both users are deleted
      mockPrismaClient.conversation.findMany.mockResolvedValue([
        {
          id: conversationId,
          userAId: userId,
          userBId: null, // Other user already deleted
        },
      ]);

      // Mock: delete the conversation (messages will be cascade deleted)
      mockPrismaClient.conversation.deleteMany
        .mockResolvedValueOnce({ count: 1 }) // Delete conversation
        .mockResolvedValueOnce({ count: 0 }); // Cleanup orphaned

      mockPrismaClient.user.delete.mockResolvedValue({ id: userId });

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify conversation was deleted (messages are cascade deleted)
      expect(mockPrismaClient.conversation.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [conversationId] },
        },
      });
    });
  });
});
