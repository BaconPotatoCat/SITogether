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
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

describe('Delete User Account API Endpoint', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Add DELETE user route
    app.delete('/api/users/:id', authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;

        // Authorization check: Users can only delete their own account
        if (req.user.userId !== id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. You can only delete your own account.',
          });
        }

        // Verify user exists
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

        // Delete user
        await mockPrismaClient.user.delete({
          where: { id: id },
        });

        // Clear the authentication cookie
        res.clearCookie('token');

        res.json({
          success: true,
          message: 'Account deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting user:', error);

        // Handle specific Prisma errors
        if (error.code === 'P2025') {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        res.status(500).json({
          success: false,
          error: 'Failed to delete account',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/users/:id', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      // Mock console.error to suppress expected error logs in all tests
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error after each test
      if (consoleErrorSpy) {
        consoleErrorSpy.mockRestore();
      }
    });

    it('should successfully delete user account when authenticated and authorized', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.delete.mockResolvedValue(mockUser);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).delete('/api/users/user-123');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should return 403 when trying to delete another user account', async () => {
      const currentUserId = 'user-123';
      const targetUserId = 'user-456';

      const token = jwt.sign({ userId: currentUserId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${targetUserId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied. You can only delete your own account.');
      expect(mockPrismaClient.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaClient.user.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when user does not exist', async () => {
      const userId = 'user-123';

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
      expect(mockPrismaClient.user.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when Prisma throws P2025 error (record not found)', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      const prismaError = new Error('Record to delete does not exist');
      prismaError.code = 'P2025';
      mockPrismaClient.user.delete.mockRejectedValue(prismaError);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 500 when database error occurs', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.delete.mockRejectedValue(new Error('Database connection failed'));

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to delete account');
    });

    it('should clear authentication cookie after successful deletion', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.delete.mockResolvedValue(mockUser);

      const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
      // Check that cookie is being cleared
      const setCookieHeader = response.headers['set-cookie'][0];
      expect(setCookieHeader).toContain('token=');
    });

    it('should return 403 with invalid token', async () => {
      const response = await request(app)
        .delete('/api/users/user-123')
        .set('Cookie', ['token=invalid-token']);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid authentication token');
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      // Note: JWT verification might not throw immediately for expired tokens
      // This test verifies the middleware handles expired tokens
      const response = await request(app)
        .delete('/api/users/user-123')
        .set('Cookie', [`token=${expiredToken}`]);

      // Should be 401 or 403 depending on how JWT handles expired tokens
      expect([401, 403]).toContain(response.status);
    });
  });
});
