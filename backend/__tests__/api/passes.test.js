const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/auth');

// Mock Prisma client
const mockPrismaClient = {
  userPasses: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock('lusca', () => ({
  csrf: () => (req, res, next) => next(),
  xframe: () => (req, res, next) => next(),
  xssProtection: () => (req, res, next) => next(),
}));

describe('Passes API Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    const lusca = require('lusca');
    app.use(lusca.csrf());

    // Add passes routes
    app.post('/api/passes', authenticateToken, async (req, res) => {
      try {
        const passerId = req.user.userId;
        const { passedId } = req.body;

        if (!passedId) {
          return res.status(400).json({
            success: false,
            error: 'passedId is required',
          });
        }

        if (passerId === passedId) {
          return res.status(400).json({
            success: false,
            error: 'Cannot pass on yourself',
          });
        }

        const passedUser = await mockPrismaClient.user.findUnique({
          where: { id: passedId },
          select: { id: true, verified: true },
        });

        if (!passedUser || !passedUser.verified) {
          return res.status(404).json({
            success: false,
            error: 'User not found or not verified',
          });
        }

        const existingPass = await mockPrismaClient.userPasses.findUnique({
          where: {
            passerId_passedId: {
              passerId: passerId,
              passedId: passedId,
            },
          },
        });

        if (existingPass) {
          return res.status(409).json({
            success: false,
            error: 'User already passed',
          });
        }

        const pass = await mockPrismaClient.userPasses.create({
          data: {
            passerId: passerId,
            passedId: passedId,
          },
        });

        res.status(201).json({
          success: true,
          message: 'User passed successfully',
          pass: pass,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to pass user',
        });
      }
    });

    app.delete('/api/passes/:userId', authenticateToken, async (req, res) => {
      try {
        const passerId = req.user.userId;
        const { userId: passedId } = req.params;

        const pass = await mockPrismaClient.userPasses.findUnique({
          where: {
            passerId_passedId: {
              passerId: passerId,
              passedId: passedId,
            },
          },
        });

        if (!pass) {
          return res.status(404).json({
            success: false,
            error: 'Pass not found',
          });
        }

        await mockPrismaClient.userPasses.delete({
          where: {
            passerId_passedId: {
              passerId: passerId,
              passedId: passedId,
            },
          },
        });

        res.json({
          success: true,
          message: 'User unpassed successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to unpass user',
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/passes', () => {
    it('should successfully pass on a user', async () => {
      const mockPassedUser = { id: 'user-2', verified: true };
      const mockPass = {
        id: 'pass-1',
        passerId: 'user-1',
        passedId: 'user-2',
        createdAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockPassedUser);
      mockPrismaClient.userPasses.findUnique.mockResolvedValue(null);
      mockPrismaClient.userPasses.create.mockResolvedValue(mockPass);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/passes')
        .set('Cookie', [`token=${token}`])
        .send({ passedId: 'user-2' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User passed successfully');
      expect(response.body.pass.passedId).toBe('user-2');
    });

    it('should return 400 if passedId is missing', async () => {
      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/passes')
        .set('Cookie', [`token=${token}`])
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('passedId is required');
    });

    it('should return 400 if trying to pass on yourself', async () => {
      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/passes')
        .set('Cookie', [`token=${token}`])
        .send({ passedId: 'user-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot pass on yourself');
    });

    it('should return 404 if passed user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/passes')
        .set('Cookie', [`token=${token}`])
        .send({ passedId: 'user-2' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found or not verified');
    });

    it('should return 409 if user already passed', async () => {
      const mockPassedUser = { id: 'user-2', verified: true };
      const mockExistingPass = { id: 'pass-1' };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockPassedUser);
      mockPrismaClient.userPasses.findUnique.mockResolvedValue(mockExistingPass);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/api/passes')
        .set('Cookie', [`token=${token}`])
        .send({ passedId: 'user-2' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User already passed');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).post('/api/passes').send({ passedId: 'user-2' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/passes/:userId', () => {
    it('should successfully unpass a user', async () => {
      const mockPass = { id: 'pass-1' };

      mockPrismaClient.userPasses.findUnique.mockResolvedValue(mockPass);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .delete('/api/passes/user-2')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User unpassed successfully');
    });

    it('should return 404 if pass not found', async () => {
      mockPrismaClient.userPasses.findUnique.mockResolvedValue(null);

      const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET);

      const response = await request(app)
        .delete('/api/passes/user-2')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Pass not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).delete('/api/passes/user-2');

      expect(response.status).toBe(401);
    });
  });
});
