const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user and check if admin
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
        error: 'Account has been banned.',
      });
    }

    if (user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      });
    }

    req.user = decoded;
    req.user.role = user.role;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
};

module.exports = { authenticateAdmin };
