const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const config = require('../lib/config');

// Admin Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    // Prefer HttpOnly cookie for tokens
    let token = req.cookies?.token;

    // Fallback to Authorization header if Bearer format is correct
    if (!token && req.headers?.authorization) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        return res.status(400).json({
          success: false,
          error: 'Malformed authorization header. Expected Bearer token.',
        });
      }
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
