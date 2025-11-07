const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const config = require('../lib/config');

// Middleware to authenticate and authorize admin users
const authenticateAdmin = async (req, res, next) => {
  try {
    const token =
      (req.cookies && req.cookies.token) ||
      (req.headers && req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
    }

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

    // Fetch user securely from database using verified token payload
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        banned: true,
      },
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

    // Attach verified user to request context
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

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
