const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const config = require('../lib/config');

const authenticateAdmin = async (req, res, next) => {
  try {
    // Extract token safely
    const cookieToken = typeof req.cookies?.token === 'string' ? req.cookies.token.trim() : null;
    const headerAuth =
      typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : null;

    let token = null;

    // Validate header format explicitly
    if (cookieToken) {
      token = cookieToken;
    } else if (
      headerAuth &&
      /^Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(headerAuth)
    ) {
      token = headerAuth.split(' ')[1];
    }

    // Enforce presence of token
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
    }

    // Verify token securely
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.',
        });
      }
      return res.status(403).json({
        success: false,
        error: 'Invalid authentication token.',
      });
    }

    // Fetch and validate user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, banned: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. User not found.',
      });
    }

    if (user.banned) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Account has been banned.',
      });
    }

    if (user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      });
    }

    // Attach verified user to request
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
};

module.exports = { authenticateAdmin };
