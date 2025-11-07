const jwt = require('jsonwebtoken');
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
    it('should call next() with valid token in cookie', () => {
      const token = jwt.sign({ userId: 'test-user-id' }, process.env.JWT_SECRET);
      req.cookies.token = token;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('test-user-id');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() with valid token in authorization header', () => {
      const token = jwt.sign({ userId: 'test-user-id' }, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('test-user-id');
    });

    it('should return 401 when no token is provided', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please log in.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token is invalid', () => {
      req.cookies.token = 'invalid-token';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authentication token.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', () => {
      const expiredToken = jwt.sign({ userId: 'test-user-id' }, process.env.JWT_SECRET, {
        expiresIn: '-1h',
      });
      req.cookies.token = expiredToken;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Session expired. Please log in again.',
      });
    });

    it('should prefer cookie over authorization header', () => {
      const cookieToken = jwt.sign({ userId: 'cookie-user' }, process.env.JWT_SECRET);
      const headerToken = jwt.sign({ userId: 'header-user' }, process.env.JWT_SECRET);

      req.cookies.token = cookieToken;
      req.headers.authorization = `Bearer ${headerToken}`;

      authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('cookie-user');
    });
  });
});
