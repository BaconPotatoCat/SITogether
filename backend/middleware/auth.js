const jwt = require('jsonwebtoken');
const config = require('../lib/config');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
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
    const decoded = jwt.verify(token, config.jwtSecret);

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
