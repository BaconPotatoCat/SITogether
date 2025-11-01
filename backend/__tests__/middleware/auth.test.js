// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, _secret) => {
    if (token === 'valid-token') {
      return { userId: 'test-user-id' };
    }
    if (token === 'cookie-token') {
      return { userId: 'cookie-user' };
    }
    if (token === 'header-token') {
      return { userId: 'header-user' };
    }
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
    return 'valid-token';
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
const { authenticateToken } = require('../../middleware/auth');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should call next() with valid token in cookie', async () => {
      req.cookies.token = 'valid-token';
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'test-user-id', banned: false });

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('test-user-id');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() with valid token in authorization header', async () => {
      req.headers.authorization = 'Bearer valid-token';
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'test-user-id', banned: false });

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('test-user-id');
    });

    it('should return 401 when no token is provided', async () => {
      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please log in.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token is invalid', async () => {
      req.cookies.token = 'invalid-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authentication token.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      req.cookies.token = 'expired-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session expired. Please log in again.',
      });
    });

    it('should prefer cookie over authorization header', async () => {
      req.cookies.token = 'cookie-token';
      req.headers.authorization = 'Bearer header-token';
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: 'cookie-user', banned: false });

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('cookie-user');
    });
  });
});
