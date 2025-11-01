const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  // Get token from cookie or Authorization header
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is banned
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
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
        error: 'Your account has been banned. Please contact support for more information.',
        banned: true,
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
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
};

module.exports = { authenticateToken };
