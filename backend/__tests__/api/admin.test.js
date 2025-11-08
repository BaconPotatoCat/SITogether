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
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

        // Prevent banning admin users (check role internally)
        const userRole = await mockPrismaClient.user.findUnique({
          where: { id },
          select: { role: true },
        });

        if (userRole && userRole.role === 'Admin') {
          return res.status(403).json({
            success: false,
            error: 'Cannot ban admin users',
          });
        }

        // Ban the user and resolve all their reports
        const [bannedUser] = await mockPrismaClient.$transaction([
          mockPrismaClient.user.update({
            where: { id },
            data: {
              banned: true,
            },
            select: {
              id: true,
              email: true,
              name: true,
              banned: true,
            },
          }),
          mockPrismaClient.report.updateMany({
            where: {
              reportedId: id,
              status: 'Pending',
            },
            data: {
              status: 'Resolved',
            },
          }),
        ]);

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

    // Mark report as invalid (resolves without banning) (Admin only)
    // This route must be defined BEFORE the more general /api/admin/reports/:id route
    app.post('/api/admin/reports/:id/invalid', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        // Check if report exists
        const report = await mockPrismaClient.report.findUnique({
          where: { id },
        });

        if (!report) {
          return res.status(404).json({
            success: false,
            error: 'Report not found',
          });
        }

        // Update report status to Resolved
        const updatedReport = await mockPrismaClient.report.update({
          where: { id },
          data: { status: 'Resolved' },
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
          message: 'Report marked as invalid and resolved',
          data: updatedReport,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to mark report as invalid',
          message: error.message,
        });
      }
    });

    app.put('/api/admin/reports/:id', mockAuthenticateAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['Pending', 'Resolved'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid status. Must be one of: Pending, Resolved',
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
      expect(response.body.error).toMatch(/failed to fetch users/i);
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

      const mockBannedUserResult = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        banned: true,
      };

      mockPrismaClient.user.findUnique
        .mockResolvedValueOnce(mockUser) // First call: check if user exists
        .mockResolvedValueOnce({ role: 'User' }); // Second call: check role
      mockPrismaClient.$transaction.mockResolvedValue([
        mockBannedUserResult, // bannedUser
        { count: 0 }, // reportsUpdated (no pending reports)
      ]);

      const response = await request(app)
        .post(`/api/admin/users/${userId}/ban`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/user banned successfully/i);
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
      expect(response.body.error).toMatch(/cannot ban admin users/i);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/non-existent-id/ban')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/user not found/i);
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
      expect(response.body.message).toMatch(/user unbanned successfully/i);
      expect(response.body.data.banned).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/non-existent-id/unban')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/user not found/i);
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
      expect(response.body.message).toMatch(/password reset link sent to/i);
      expect(response.body.data).toEqual(mockUser);
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/non-existent-id/reset-password')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/user not found/i);
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
        status: 'Resolved',
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
        .send({ status: 'Resolved' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/report updated successfully/i);
      expect(response.body.data.status).toBe('Resolved');
    });

    it('should reject invalid status', async () => {
      const reportId = 'report-123';

      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid status/i);
    });

    it('should return 404 for non-existent report', async () => {
      mockPrismaClient.report.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/admin/reports/non-existent-id')
        .set('Cookie', [`token=${adminToken}`])
        .send({ status: 'Resolved' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/report not found/i);
    });
  });

  describe('POST /api/admin/reports/:id/invalid', () => {
    it('should mark report as invalid and resolve it', async () => {
      const reportId = 'report-123';
      const mockReport = {
        id: reportId,
        status: 'Pending',
      };

      const mockUpdatedReport = {
        id: reportId,
        status: 'Resolved',
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
        .post(`/api/admin/reports/${reportId}/invalid`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/report marked as invalid/i);
      expect(response.body.data.status).toBe('Resolved');
    });

    it('should return 404 for non-existent report', async () => {
      mockPrismaClient.report.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/reports/non-existent-id/invalid')
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/report not found/i);
    });
  });

  describe('POST /api/admin/users/:id/ban', () => {
    it('should ban user and resolve all pending reports', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'User',
        banned: false,
      };

      const mockBannedUserResult = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        banned: true,
      };

      mockPrismaClient.user.findUnique
        .mockResolvedValueOnce(mockUser) // First call: check if user exists
        .mockResolvedValueOnce({ role: 'User' }); // Second call: check role
      mockPrismaClient.$transaction.mockResolvedValue([
        mockBannedUserResult, // bannedUser
        { count: 2 }, // reportsUpdated
      ]);

      const response = await request(app)
        .post(`/api/admin/users/${userId}/ban`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/user banned successfully/i);
      expect(response.body.data.banned).toBe(true);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
      // Verify transaction was called with an array of 2 operations
      const transactionCall = mockPrismaClient.$transaction.mock.calls[0];
      expect(transactionCall[0]).toHaveLength(2);
    });
  });
});
