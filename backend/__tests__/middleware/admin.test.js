// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, _secret) => {
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === 'valid-admin-token') {
      return { userId: 'admin-user-id' };
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === 'expired-token') {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      throw error;
    }
    const error = new Error('Invalid token');
    error.name = 'JsonWebTokenError';
    throw error;
  }),
  sign: jest.fn((_payload, _secret, _options) => {
    if (_options?.expiresIn === '-1h') {
      return 'expired-token';
    }
    return 'valid-admin-token';
  }),
}));

// Mock Prisma client
jest.mock('../../lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  return mockPrisma;
});

const mockPrismaClient = require('../../lib/prisma');
const { authenticateAdmin } = require('../../middleware/admin');

describe('Admin Middleware', () => {
  let req, res, next;
  let consoleErrorSpy;

  beforeEach(() => {
    req = {
      cookies: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    // Suppress console.error during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after each test
    consoleErrorSpy.mockRestore();
  });

  describe('authenticateAdmin', () => {
    const validToken = 'valid-admin-token';

    it('should reject request with no token', async () => {
      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please log in.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      req.cookies.token = 'invalid-token';

      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authentication token.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request when user not found', async () => {
      req.cookies.token = validToken;
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token. User not found.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request when user is banned', async () => {
      req.cookies.token = validToken;
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'admin-user-id',
        email: 'admin@example.com',
        role: 'Admin',
        banned: true,
      });

      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied. Account has been banned.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request when user is not admin', async () => {
      req.cookies.token = validToken;
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'regular-user-id',
        email: 'user@example.com',
        role: 'User',
        banned: false,
      });

      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied. Admin privileges required.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request when user is admin and not banned', async () => {
      req.cookies.token = validToken;
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: 'admin-user-id',
        email: 'admin@example.com',
        role: 'Admin',
        banned: false,
      });

      await authenticateAdmin(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('admin-user-id');
      expect(req.user.role).toBe('Admin');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      const expiredToken = 'expired-token';
      req.cookies.token = expiredToken;

      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session expired. Please log in again.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      req.cookies.token = validToken;
      mockPrismaClient.user.findUnique.mockRejectedValue(new Error('Database error'));

      await authenticateAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
