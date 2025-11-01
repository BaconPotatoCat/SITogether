const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const prisma = require('./lib/prisma');
const { authenticateToken } = require('./middleware/auth');
const { sendVerificationEmail } = require('./lib/email');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'SITogether Backend API is running!',
    status: 'success',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to SITogether API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      users: 'GET /api/users (protected)',
      auth: {
        register: 'POST /api/auth/register',
        verify: 'GET /api/auth/verify?token=<verification_token>',
        resendVerification: 'POST /api/auth/resend-verification',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        session: 'GET /api/auth/session (protected)',
        resetPasswordRequest: 'POST /api/auth/reset-password-request (protected)',
        resetPassword: 'POST /api/auth/reset-password',
      },
      admin: {
        users: 'GET /api/admin/users (admin only)',
        banUser: 'POST /api/admin/users/:id/ban (admin only)',
        unbanUser: 'POST /api/admin/users/:id/unban (admin only)',
        sendPasswordReset: 'POST /api/admin/users/:id/reset-password (admin only)',
        reports: 'GET /api/admin/reports (admin only)',
        updateReport: 'PUT /api/admin/reports/:id (admin only)',
      },
    },
  });
});

// Users API route (protected)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        verified: true,
      },
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        role: true,
        course: true,
        bio: true,
        interests: true,
        avatarUrl: true,
        verified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error('Prisma query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users from database',
      message: error.message,
    });
  }
});

// Authentication routes
// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, age, gender, course } = req.body;

    // Validate required fields
    if (!email || !password || !name || !age || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, name, age, and gender are required',
      });
    }

    // Validate gender value
    const validGenders = ['Male', 'Female', 'Other'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        error: 'Gender must be one of: Male, Female, or Other',
      });
    }

    // Validate SIT student email format
    // TODO: Uncomment to enforce SIT email validation
    // const sitEmailRegex = /^\d{7}@sit\.singaporetech\.edu\.sg$/;
    // if (!sitEmailRegex.test(email)) {
    //   return res.status(400).json({
    //     success: false,
    //     error: 'Email must be a valid SIT student email (format: 2500000@sit.singaporetech.edu.sg)',
    //   });
    // }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate verification token and expiration (1 hour from now)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        age: parseInt(age),
        gender,
        role: 'User',
        course,
        bio: null,
        interests: [],
        verified: false,
        verificationToken,
        verificationTokenExpires,
      },
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        gender: true,
        role: true,
        course: true,
        bio: true,
        interests: true,
        avatarUrl: true,
        verified: true,
        createdAt: true,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, name, verificationToken);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: user,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);

      // User is created but email failed - still return success but with a warning
      res.status(201).json({
        success: true,
        message:
          'User registered successfully, but verification email could not be sent. Please contact support.',
        data: user,
        warning: 'Verification email not sent',
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
      message: error.message,
    });
  }
});

// Email verification endpoint
app.get('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
    }

    // Check if token has expired
    if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
      return res.status(400).json({
        success: false,
        error: 'Verification token has expired. Please request a new verification email.',
      });
    }

    // Check if user is already verified
    if (user.verified) {
      return res.status(200).json({
        success: true,
        message: 'Email already verified. You can now log in.',
      });
    }

    // Update user as verified and clear the token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in to your account.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email',
      message: error.message,
    });
  }
});

// Resend verification email endpoint
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email address',
      });
    }

    // Check if already verified
    if (user.verified) {
      return res.status(400).json({
        success: false,
        error: 'Account is already verified. You can log in now.',
      });
    }

    // Generate new verification token and expiration
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpires,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully. Please check your email.',
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email',
      message: error.message,
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        age: true,
        gender: true,
        role: true,
        course: true,
        bio: true,
        interests: true,
        avatarUrl: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('User found in database:', {
      email: user?.email,
      verified: user?.verified,
      verifiedType: typeof user?.verified,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Check if account is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        error:
          'Account not verified. Please check your email and verify your account before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token expires in 1 hour
    );

    // Set cookie with token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    });

    res.json({
      success: true,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      message: error.message,
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Session endpoint (protected)
app.get('/api/auth/session', authenticateToken, async (req, res) => {
  try {
    // Get user data from token
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        gender: true,
        role: true,
        course: true,
        bio: true,
        interests: true,
        avatarUrl: true,
        verified: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user: user,
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session',
      message: error.message,
    });
  }
});

// Request password reset (User-facing - authenticated users can request for themselves)
app.post('/api/auth/reset-password-request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });
    } catch (dbError) {
      console.error('Database error updating reset token:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate reset token',
      });
    }

    // Send reset email
    try {
      await sendResetPasswordEmail(user.email, user.name, resetToken);

      res.json({
        success: true,
        message: 'Password reset link has been sent to your email',
      });
    } catch (emailError) {
      console.error('Error sending reset password email:', emailError);

      // Clear the token if email sending fails
      await prisma.user.update({
        where: { id: userId },
        data: {
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to send reset password email',
      });
    }
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
      message: error.message,
    });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required',
      });
    }

    // Validate password length (minimum 6 characters to match registration)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      });
    }

    // Find user with this reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    // Check if token has expired
    if (user.resetTokenExpires && new Date() > user.resetTokenExpires) {
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired. Please request a new password reset.',
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and clear reset token (single-use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: error.message,
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get all users (Admin only)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        gender: true,
        role: true,
        course: true,
        verified: true,
        banned: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reports: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message,
    });
  }
});

// Ban user (Admin only)
app.post('/api/admin/users/:id/ban', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Prevent banning admin users
    if (user.role === 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot ban admin users',
      });
    }

    // Ban the user
    const bannedUser = await prisma.user.update({
      where: { id },
      data: {
        banned: true,
        bannedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        banned: true,
        bannedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'User banned successfully',
      data: bannedUser,
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ban user',
      message: error.message,
    });
  }
});

// Unban user (Admin only)
app.post('/api/admin/users/:id/unban', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Unban the user
    const unbannedUser = await prisma.user.update({
      where: { id },
      data: {
        banned: false,
        bannedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        banned: true,
        bannedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'User unbanned successfully',
      data: unbannedUser,
    });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unban user',
      message: error.message,
    });
  }
});

// Send password reset link (Admin only)
app.post('/api/admin/users/:id/reset-password', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    try {
      await prisma.user.update({
        where: { id },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });
    } catch (dbError) {
      console.error('Error sending reset password email: Error: Database error');
      return res.status(500).json({
        success: false,
        error: 'Failed to generate reset token',
      });
    }

    // Send reset email
    try {
      await sendResetPasswordEmail(user.email, user.name, resetToken);

      res.json({
        success: true,
        message: `Password reset link sent to ${user.email}`,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (emailError) {
      console.error('Error sending reset password email:', emailError);

      // Clear the token if email sending fails
      await prisma.user.update({
        where: { id },
        data: {
          resetToken: null,
          resetTokenExpires: null,
        },
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to send reset password email',
      });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send password reset link',
      message: error.message,
    });
  }
});

// Get all reports (Admin only)
app.get('/api/admin/reports', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    const whereClause = status ? { status: status } : {};

    const reports = await prisma.report.findMany({
      where: whereClause,
      include: {
        reportedUser: {
          select: {
            id: true,
            email: true,
            name: true,
            banned: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      message: error.message,
    });
  }
});

// Update report status (Admin only)
app.put('/api/admin/reports/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['Pending', 'Reviewed', 'Resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: Pending, Reviewed, Resolved',
      });
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    // Update report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: { status },
      include: {
        reportedUser: {
          select: {
            id: true,
            email: true,
            name: true,
            banned: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: updatedReport,
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report',
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((err, res) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SITogether Backend server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
