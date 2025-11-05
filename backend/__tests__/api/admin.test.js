const request = require('supertest');
const express = require('express');

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, _secret) => {
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === 'admin-token') {
      return { userId: 'admin-user-id' };
    }
    throw new Error('Invalid token');
  }),
  sign: jest.fn((_payload, _secret, _options) => 'admin-token'),
}));

// Mock Prisma client
jest.mock('../../lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  return mockPrisma;
});

const mockPrismaClient = require('../../lib/prisma');

// Mock admin middleware
const mockAuthenticateAdmin = jest.fn((req, res, next) => {
  req.user = { userId: 'admin-user-id', role: 'Admin' };
  next();
});

describe('Admin API Endpoints', () => {
  let app;
  const adminToken = 'admin-token';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // Admin routes
    app.get('/api/admin/users', mockAuthenticateAdmin, async (req, res) => {
      try {
        const users = await mockPrismaClient.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            age: true,
            gender: true,
            role: true,
            course: true,
            verified: true,
            banned: true,
            bannedAt: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                reports: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        res.json({
          success: true,
          data: users,
          count: users.length,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
          message: error.message,
        });
      }
    });

    app.post('/api/admin/users/:id/ban', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const user = await mockPrismaClient.user.findUnique({ where: { id } });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        if (user.role === 'Admin') {
          return res.status(403).json({
            success: false,
            error: 'Cannot ban admin users',
          });
        }

        const bannedUser = await mockPrismaClient.user.update({
          where: { id },
          data: {
            banned: true,
            bannedAt: new Date(),
          },
          select: {
            id: true,
            email: true,
            name: true,
            banned: true,
            bannedAt: true,
          },
        });

        res.json({
          success: true,
          message: 'User banned successfully',
          data: bannedUser,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to ban user',
          message: error.message,
        });
      }
    });

    app.post('/api/admin/users/:id/unban', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const user = await mockPrismaClient.user.findUnique({ where: { id } });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        const unbannedUser = await mockPrismaClient.user.update({
          where: { id },
          data: {
            banned: false,
            bannedAt: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            banned: true,
            bannedAt: true,
          },
        });

        res.json({
          success: true,
          message: 'User unbanned successfully',
          data: unbannedUser,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to unban user',
          message: error.message,
        });
      }
    });

    app.post('/api/admin/users/:id/reset-password', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const user = await mockPrismaClient.user.findUnique({
          where: { id },
          select: { id: true, email: true, name: true },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        res.json({
          success: true,
          message: `Password reset link sent to ${user.email}`,
          data: user,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to send password reset link',
          message: error.message,
        });
      }
    });

    app.get('/api/admin/reports', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { status } = req.query;
        const whereClause = status ? { status: status } : {};

        const reports = await mockPrismaClient.report.findMany({
          where: whereClause,
          include: {
            reportedUser: {
              select: {
                id: true,
                email: true,
                name: true,
                banned: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        res.json({
          success: true,
          data: reports,
          count: reports.length,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch reports',
          message: error.message,
        });
      }
    });

    app.put('/api/admin/reports/:id', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['Pending', 'Reviewed', 'Resolved'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid status. Must be one of: Pending, Reviewed, Resolved',
          });
        }

        const report = await mockPrismaClient.report.findUnique({ where: { id } });

        if (!report) {
          return res.status(404).json({
            success: false,
            error: 'Report not found',
          });
        }

        const updatedReport = await mockPrismaClient.report.update({
          where: { id },
          data: { status },
          include: {
            reportedUser: {
              select: {
                id: true,
                email: true,
                name: true,
                banned: true,
              },
            },
          },
        });

        res.json({
          success: true,
          message: 'Report updated successfully',
          data: updatedReport,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to update report',
          message: error.message,
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should fetch all users successfully', async () => {
      const testDate = new Date('2025-11-01T11:11:56.447Z');
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User One',
          age: 20,
          gender: 'Male',
          role: 'User',
          course: 'CS',
          verified: true,
          banned: false,
          bannedAt: null,
          createdAt: testDate.toISOString(),
          updatedAt: testDate.toISOString(),
          _count: { reports: 0 },
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User Two',
          age: 22,
          gender: 'Female',
          role: 'User',
          course: 'IT',
          verified: true,
          banned: true,
          bannedAt: testDate.toISOString(),
          createdAt: testDate.toISOString(),
          updatedAt: testDate.toISOString(),
          _count: { reports: 2 },
        },
      ];

      mockPrismaClient.user.findMany.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(response.body.count).toBe(2);
    });

    it('should handle database errors', async () => {
      mockPrismaClient.user.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch users');
    });
  });

  describe('POST /api/admin/users/:id/ban', () => {
    it('should ban a regular user successfully', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'User',
      };

      const mockBannedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        banned: true,
        bannedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.update.mockResolvedValue(mockBannedUser);

      const response = await request(app)
        .post(`/api/admin/users/${userId}/ban`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User banned successfully');
      expect(response.body.data.banned).toBe(true);
    });

    it('should not allow banning admin users', async () => {
      const userId = 'admin-123';
      const mockAdminUser = {
        id: userId,
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'Admin',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .post(`/api/admin/users/${userId}/ban`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot ban admin users');
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/non-existent-id/ban')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/admin/users/:id/unban', () => {
    it('should unban a user successfully', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'User',
        banned: true,
      };

      const mockUnbannedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        banned: false,
        bannedAt: null,
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaClient.user.update.mockResolvedValue(mockUnbannedUser);

      const response = await request(app)
        .post(`/api/admin/users/${userId}/unban`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User unbanned successfully');
      expect(response.body.data.banned).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/non-existent-id/unban')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    it('should send password reset link successfully', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post(`/api/admin/users/${userId}/reset-password`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset link sent to');
      expect(response.body.data).toEqual(mockUser);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/non-existent-id/reset-password')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('GET /api/admin/reports', () => {
    it('should fetch all reports successfully', async () => {
      const testDate = new Date('2025-11-01T11:11:56.486Z');
      const mockReports = [
        {
          id: 'report-1',
          reportedId: 'user-1',
          reportedBy: 'reporter@example.com',
          reason: 'Inappropriate behavior',
          description: 'Test description',
          status: 'Pending',
          createdAt: testDate.toISOString(),
          updatedAt: testDate.toISOString(),
          reportedUser: {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User One',
            banned: false,
          },
        },
      ];

      mockPrismaClient.report.findMany.mockResolvedValue(mockReports);

      const response = await request(app)
        .get('/api/admin/reports')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockReports);
      expect(response.body.count).toBe(1);
    });

    it('should filter reports by status', async () => {
      const mockReports = [
        {
          id: 'report-1',
          status: 'Pending',
          reportedUser: {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User One',
            banned: false,
          },
        },
      ];

      mockPrismaClient.report.findMany.mockResolvedValue(mockReports);

      const response = await request(app)
        .get('/api/admin/reports?status=Pending')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPrismaClient.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'Pending' },
        })
      );
    });
  });

  describe('PUT /api/admin/reports/:id', () => {
    it('should update report status successfully', async () => {
      const reportId = 'report-123';
      const mockReport = {
        id: reportId,
        status: 'Pending',
      };

      const mockUpdatedReport = {
        id: reportId,
        status: 'Reviewed',
        reportedUser: {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User One',
          banned: false,
        },
      };

      mockPrismaClient.report.findUnique.mockResolvedValue(mockReport);
      mockPrismaClient.report.update.mockResolvedValue(mockUpdatedReport);

      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({ status: 'Reviewed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Report updated successfully');
      expect(response.body.data.status).toBe('Reviewed');
    });

    it('should reject invalid status', async () => {
      const reportId = 'report-123';

      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid status');
    });

    it('should return 404 for non-existent report', async () => {
      mockPrismaClient.report.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/admin/reports/non-existent-id')
        .set('Cookie', [`token=${adminToken}`])
        .send({ status: 'Reviewed' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Report not found');
    });
  });
});
