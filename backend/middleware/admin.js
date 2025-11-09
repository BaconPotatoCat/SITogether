const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const config = require('../lib/config');

/**
 * Middleware to authenticate and authorize Admin users.
 * Access to sensitive actions is only granted after token verification.
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Extract token safely from cookie or Authorization header
    const cookieToken = typeof req.cookies?.token === 'string' ? req.cookies.token.trim() : null;
    const headerAuth =
      typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : null;

    let token = null;
    if (cookieToken) {
      token = cookieToken;
    } else if (
      headerAuth &&
      /^Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(headerAuth)
    ) {
      token = headerAuth.split(' ')[1];
    }

    // Attempt verification
    let decoded;
    try {
      if (!token) throw new Error('NoToken');
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        error:
          error.message === 'NoToken'
            ? 'Authentication required. Please log in.'
            : 'Invalid authentication token.',
      });
    }

    // Fetch user from database after verification
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

    // Only reach this line if all verification checks pass
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
};

const blockAdminAccess = async (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      return handleDeny(req, res, 'Authentication required.', 401);
    }

    // Fetch user role
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true },
    });

    if (!user) {
      return handleDeny(req, res, 'User not found.', 401);
    }

    // Block admin users
    if (user.role === 'Admin') {
      // Detect browser navigation vs API call
      const isBrowser = !req.xhr && req.accepts('html') && !req.accepts('json');

      if (isBrowser) {
        // Admin trying to access normal page → redirect
        return res.redirect('/admin');
      }

      // Admin trying to access API → JSON error
      return res.status(403).json({
        success: false,
        error: 'Admins cannot access normal user endpoints.',
      });
    }

    // Allow normal users
    next();
  } catch (error) {
    console.error('blockAdminAccess error:', error);
    return handleDeny(req, res, 'Internal server error.', 500, '/');
  }
};

/**
 * Helper to handle deny for other cases (like unauthenticated users)
 */
function handleDeny(req, res, message, statusCode = 403, redirectPath = '/auth') {
  const isBrowser = !req.xhr && req.accepts('html') && !req.accepts('json');

  if (isBrowser) {
    return res.redirect(redirectPath);
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}

module.exports = { authenticateAdmin, blockAdminAccess };
