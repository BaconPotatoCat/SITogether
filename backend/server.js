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
const { sendVerificationEmail, sendTwoFactorEmail } = require('./lib/email');
const { validatePassword, validatePasswordChange } = require('./utils/passwordValidation');
const config = require('./lib/config');

const app = express();
const PORT = config.port;

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
// Increase body size limit to 10MB for image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
        verify2fa: 'POST /api/auth/verify-2fa',
        resend2fa: 'POST /api/auth/resend-2fa',
        logout: 'POST /api/auth/logout',
        changePassword: 'POST /api/auth/change-password (protected)',
        session: 'GET /api/auth/session (protected)',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password',
      },
      points: {
        getPoints: 'GET /api/points (protected)',
        claimDaily: 'POST /api/points/claim-daily (protected)',
        claimDailyLike: 'POST /api/points/claim-daily-like (protected)',
        unlockPremium: 'POST /api/points/unlock-premium (protected)',
        premiumStatus: 'GET /api/points/premium-status (protected)',
      },
      likes: {
        likeUser: 'POST /api/likes (protected)',
        checkLike: 'GET /api/likes/check/:userId (protected)',
        unlikeUser: 'DELETE /api/likes/:userId (protected)',
      },
      passes: {
        passUser: 'POST /api/passes (protected)',
        unpassUser: 'DELETE /api/passes/:userId (protected)',
      },
    },
  });
});

// Users API route (protected)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    // Get IDs of users that the current user has already liked
    const likedUserIds = await prisma.userLikes.findMany({
      where: {
        likerId: currentUserId,
      },
      select: {
        likedId: true,
      },
    });

    // Get IDs of users that the current user has already passed
    const passedUserIds = await prisma.userPasses.findMany({
      where: {
        passerId: currentUserId,
      },
      select: {
        passedId: true,
      },
    });

    // Get all users for debugging
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        verified: true,
      },
    });

    console.log(`Total users in database: ${allUsers.length}`);
    console.log(`Verified users: ${allUsers.filter((u) => u.verified).length}`);
    console.log(`Unverified users: ${allUsers.filter((u) => !u.verified).length}`);

    console.log(
      `User ${currentUserId} has liked ${likedUserIds.length} users and passed ${passedUserIds.length} users`
    );

    const excludedIds = likedUserIds.map((like) => like.likedId);
    // Also exclude passed users
    excludedIds.push(...passedUserIds.map((pass) => pass.passedId));
    // Also exclude the current user from their own discovery
    excludedIds.push(currentUserId);

    console.log(`Excluded user IDs:`, excludedIds);
    console.log(`Excluding ${excludedIds.length} total users from discovery`);

    const users = await prisma.user.findMany({
      where: {
        verified: true,
        id: {
          notIn: excludedIds,
        },
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

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id: id,
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
        updatedAt: true,
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
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user from database',
    });
  }
});

// Update user by ID (Protected - requires authentication and authorization)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, course, bio, interests, avatarUrl } = req.body;

    // Authorization check: Users can only update their own profile
    if (req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only update your own profile.',
      });
    }

    // Validate required fields
    if (!name || !age) {
      return res.status(400).json({
        success: false,
        error: 'Name and age are required',
      });
    }

    // Validate age range
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      return res.status(400).json({
        success: false,
        error: 'Age must be a positive number between 18 and 65',
      });
    }

    // Prepare update data
    const updateData = {
      name,
      age: ageNum,
      course: course || null,
      bio: bio || null,
      interests: Array.isArray(interests) ? interests : [],
    };

    // Only update avatarUrl if provided
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl;
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: {
        id: id,
      },
      data: updateData,
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
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile',
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

    // Validate age range
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      return res.status(400).json({
        success: false,
        error: 'Age must be a positive number between 18 and 65',
      });
    }

    // Validate password according to NIST 2025 guidelines
    const passwordValidation = await validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors.join('; '),
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

    // Create user and verification token in a transaction
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        age: ageNum,
        gender,
        role: 'User',
        course,
        bio: null,
        interests: [],
        verified: false,
        tokens: {
          create: {
            token: verificationToken,
            type: 'EMAIL_VERIFICATION',
            expiresAt: verificationTokenExpires,
          },
        },
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

    // Create UserPoints record for the new user
    await prisma.userPoints.create({
      data: {
        userId: user.id,
        totalPoints: 0,
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

    // Find verification token with user
    const verificationToken = await prisma.token.findFirst({
      where: {
        token,
        type: 'EMAIL_VERIFICATION',
      },
      include: { user: true },
    });

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
    }

    // Check if token has expired
    if (new Date() > verificationToken.expiresAt) {
      // Delete expired token
      await prisma.token.delete({
        where: { id: verificationToken.id },
      });
      return res.status(400).json({
        success: false,
        error: 'Verification token has expired. Please request a new verification email.',
      });
    }

    // Check if user is already verified
    if (verificationToken.user.verified) {
      // Delete token since user is already verified
      await prisma.token.delete({
        where: { id: verificationToken.id },
      });
      return res.status(200).json({
        success: true,
        message: 'Email already verified. You can now log in.',
      });
    }

    // Update user as verified and delete the token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { verified: true },
      }),
      prisma.token.delete({
        where: { id: verificationToken.id },
      }),
    ]);

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

    // Delete any existing tokens for this user and create new one in a transaction
    const [, createdToken] = await prisma.$transaction([
      prisma.token.deleteMany({
        where: {
          userId: user.id,
          type: 'EMAIL_VERIFICATION',
        },
      }),
      prisma.token.create({
        data: {
          token: verificationToken,
          type: 'EMAIL_VERIFICATION',
          userId: user.id,
          expiresAt: verificationTokenExpires,
        },
      }),
    ]);

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully. Please check your email.',
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);

      // Delete the token since email failed - user can't access it anyway
      try {
        await prisma.token.delete({
          where: { id: createdToken.id },
        });
        console.log('Cleaned up verification token after email failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup token after email error:', cleanupError);
      }

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

    // Generate 6-digit 2FA code
    const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete any existing 2FA tokens for this user
    await prisma.token.deleteMany({
      where: {
        userId: user.id,
        type: 'TWO_FACTOR_AUTH',
      },
    });

    // Create 2FA token
    const createdToken = await prisma.token.create({
      data: {
        token: twoFactorCode,
        type: 'TWO_FACTOR_AUTH',
        userId: user.id,
        expiresAt: expiresAt,
      },
    });

    // Generate temporary JWT token for 2FA verification (valid for 10 minutes)
    const tempToken = jwt.sign({ userId: user.id, requiresTwoFactor: true }, config.jwtSecret, {
      expiresIn: '10m',
    });

    // Send 2FA email
    try {
      await sendTwoFactorEmail(user.email, user.name, twoFactorCode);

      res.json({
        success: true,
        message: 'Please check your email for the verification code',
        requiresTwoFactor: true,
        tempToken: tempToken,
      });
    } catch (emailError) {
      console.error('Failed to send 2FA email:', emailError);

      // Delete the token since email failed
      try {
        await prisma.token.delete({
          where: { id: createdToken.id },
        });
        console.log('Cleaned up 2FA token after email failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup token after email error:', cleanupError);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      message: error.message,
    });
  }
});

// Verify 2FA code and complete login
app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({
        success: false,
        error: 'Temporary token and verification code are required',
      });
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired temporary token',
      });
    }

    // Check if this is a 2FA token
    if (!decoded.requiresTwoFactor || !decoded.userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid temporary token',
      });
    }

    const userId = decoded.userId;

    // Find 2FA token
    const twoFactorToken = await prisma.token.findFirst({
      where: {
        token: code,
        type: 'TWO_FACTOR_AUTH',
        userId: userId,
      },
    });

    if (!twoFactorToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid verification code',
      });
    }

    // Check if token has expired
    if (new Date() > twoFactorToken.expiresAt) {
      // Delete expired token
      await prisma.token.delete({
        where: { id: twoFactorToken.id },
      });
      return res.status(401).json({
        success: false,
        error: 'Verification code has expired. Please try logging in again.',
      });
    }

    // Delete the used 2FA token
    await prisma.token.delete({
      where: { id: twoFactorToken.id },
    });

    // Generate final JWT token
    const finalToken = jwt.sign({ userId: userId }, config.jwtSecret, { expiresIn: '1h' });

    // Set cookie with token
    res.cookie('token', finalToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    });

    res.json({
      success: true,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code',
      message: error.message,
    });
  }
});

// Resend 2FA code endpoint
app.post('/api/auth/resend-2fa', async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({
        success: false,
        error: 'Temporary token is required',
      });
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired temporary token. Please try logging in again.',
      });
    }

    // Check if this is a 2FA token
    if (!decoded.requiresTwoFactor || !decoded.userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid temporary token',
      });
    }

    const userId = decoded.userId;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        verified: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate new 6-digit 2FA code
    const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete any existing 2FA tokens for this user
    await prisma.token.deleteMany({
      where: {
        userId: user.id,
        type: 'TWO_FACTOR_AUTH',
      },
    });

    // Create new 2FA token
    const createdToken = await prisma.token.create({
      data: {
        token: twoFactorCode,
        type: 'TWO_FACTOR_AUTH',
        userId: user.id,
        expiresAt: expiresAt,
      },
    });

    // Send 2FA email
    try {
      await sendTwoFactorEmail(user.email, user.name, twoFactorCode);

      res.json({
        success: true,
        message: 'Verification code sent successfully. Please check your email.',
      });
    } catch (emailError) {
      console.error('Failed to send 2FA email:', emailError);

      // Delete the token since email failed
      try {
        await prisma.token.delete({
          where: { id: createdToken.id },
        });
        console.log('Cleaned up 2FA token after email failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup token after email error:', cleanupError);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Resend 2FA error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification code',
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

// Change password endpoint (protected)
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    // Validate password change according to NIST 2025 guidelines
    const passwordValidation = await validatePasswordChange(currentPassword, newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors.join('; '),
      });
    }

    // Find user by ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
      message: error.message,
    });
  }
});

// Session endpoint (protected)
app.get('/api/auth/session', authenticateToken, async (req, res) => {
  try {
    // Get user data from token
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        age: true,
        role: true,
        course: true,
        bio: true,
        interests: true,
        avatarUrl: true,
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

// Forgot password endpoint (request password reset)
app.post('/api/auth/forgot-password', async (req, res) => {
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
      select: {
        id: true,
        email: true,
        name: true,
        verified: true,
      },
    });

    // Always return success to prevent email enumeration attacks
    // Even if user doesn't exist, we say we sent the email
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Check if user is verified
    if (!user.verified) {
      return res.status(400).json({
        success: false,
        error: 'Please verify your email address before resetting your password.',
        requiresVerification: true,
      });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing password reset tokens for this email
    await prisma.token.deleteMany({
      where: {
        email,
        type: 'PASSWORD_RESET',
      },
    });

    // Create new password reset token
    const createdToken = await prisma.token.create({
      data: {
        token: resetToken,
        type: 'PASSWORD_RESET',
        email: user.email,
        userId: user.id,
        expiresAt: resetTokenExpires,
      },
    });

    // Send password reset email
    const { sendPasswordResetEmail } = require('./lib/email');
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);

      res.json({
        success: true,
        message: 'Password reset link has been sent to your email.',
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);

      // Delete the token since email failed - user can't access it anyway
      try {
        await prisma.token.delete({
          where: { id: createdToken.id },
        });
        console.log('Cleaned up password reset token after email failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup token after email error:', cleanupError);
      }

      res.status(500).json({
        success: false,
        error: 'Failed to send password reset email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
      message: error.message,
    });
  }
});

// Reset password endpoint (verify token and update password)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
    }

    // Validate password according to NIST 2025 guidelines
    const passwordValidation = await validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors.join('; '),
      });
    }

    // Find password reset token
    const resetToken = await prisma.token.findFirst({
      where: {
        token,
        type: 'PASSWORD_RESET',
      },
    });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset token',
      });
    }

    // Check if token has expired
    if (new Date() > resetToken.expiresAt) {
      // Delete expired token
      await prisma.token.delete({
        where: { id: resetToken.id },
      });
      return res.status(400).json({
        success: false,
        error: 'Password reset token has expired. Please request a new one.',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Delete the used reset token
    await prisma.token.delete({
      where: { id: resetToken.id },
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: error.message,
    });
  }
});

// Points API routes (protected)

// Get user points
app.get('/api/points', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user points (should always exist since created during registration)
    let userPoints = await prisma.userPoints.findUnique({
      where: { userId },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true,
      },
    });

    // Fallback: Create userPoints record if it doesn't exist (edge case)
    if (!userPoints) {
      console.warn(`UserPoints record not found for user ${userId} - creating as fallback`);

      try {
        userPoints = await prisma.userPoints.create({
          data: {
            userId: userId,
            totalPoints: 0,
          },
          select: {
            totalPoints: true,
            dailyCheckinDate: true,
            dailyLikeClaimedDate: true,
          },
        });
        console.log(`✓ Created UserPoints record for user ${userId}`);
      } catch (createError) {
        console.error(`Failed to create UserPoints for user ${userId}:`, createError);
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize user points. Please contact support.',
        });
      }
    }

    // Check if user has liked someone today
    const mostRecentLike = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasLikedToday =
      mostRecentLike && new Date(mostRecentLike.createdAt).getTime() >= today.getTime();

    // Add computed field to response
    const pointsWithComputed = {
      ...userPoints,
      hasLikedToday,
    };

    res.json({
      success: true,
      points: pointsWithComputed,
    });
  } catch (error) {
    console.error('Get points error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user points',
      message: error.message,
    });
  }
});

// Claim daily like points
app.post('/api/points/claim-daily-like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user has liked someone today
    const mostRecentLike = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (!mostRecentLike) {
      return res.status(400).json({
        success: false,
        error: 'No likes found for today',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const likeDate = new Date(mostRecentLike.createdAt);
    likeDate.setHours(0, 0, 0, 0);

    // Must have liked today
    if (likeDate.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        error: 'Daily like task not completed yet',
      });
    }

    // Check if already claimed today
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found',
      });
    }

    // Check if user has reached 1000 points (premium threshold)
    if (userPoints.totalPoints >= 1000) {
      return res.status(400).json({
        success: false,
        error:
          'Cannot claim points - you have reached the premium threshold. Unlock premium to continue earning points.',
      });
    }

    if (userPoints.dailyLikeClaimedDate) {
      const claimedDate = new Date(userPoints.dailyLikeClaimedDate);
      claimedDate.setHours(0, 0, 0, 0);

      if (claimedDate.getTime() === today.getTime()) {
        return res.status(400).json({
          success: false,
          error: 'Daily like points already claimed today',
        });
      }
    }

    // Award points for daily like task
    const updatedPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: userPoints.totalPoints + 25,
        dailyLikeClaimedDate: new Date(),
      },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true,
      },
    });

    // Add computed field for response
    const mostRecentLikeAfter = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const hasLikedTodayAfter =
      mostRecentLikeAfter && new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

    const pointsWithComputed = {
      ...updatedPoints,
      hasLikedToday: hasLikedTodayAfter,
    };

    res.json({
      success: true,
      message: 'Daily like points claimed successfully',
      points: pointsWithComputed,
      pointsEarned: 25,
    });
  } catch (error) {
    console.error('Claim daily like points error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim daily like points',
      message: error.message,
    });
  }
});

// Claim daily check-in points
app.post('/api/points/claim-daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user already claimed today
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found',
      });
    }

    // Check if user has reached 1000 points (premium threshold)
    if (userPoints.totalPoints >= 1000) {
      return res.status(400).json({
        success: false,
        error:
          'Cannot claim points - you have reached the premium threshold. Unlock premium to continue earning points.',
      });
    }

    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (userPoints.dailyCheckinDate) {
      const lastClaimDate = new Date(userPoints.dailyCheckinDate);
      lastClaimDate.setHours(0, 0, 0, 0);

      if (lastClaimDate.getTime() === today.getTime()) {
        return res.status(400).json({
          success: false,
          error: 'Daily check-in already claimed today',
        });
      }
    }

    // Update points and mark as claimed
    const updatedPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: userPoints.totalPoints + 50,
        dailyCheckinDate: new Date(),
      },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true,
      },
    });

    // Add computed field for response
    const mostRecentLikeAfter = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // 'today' is already declared above in this function
    const hasLikedTodayAfter =
      mostRecentLikeAfter && new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

    const pointsWithComputed = {
      ...updatedPoints,
      hasLikedToday: hasLikedTodayAfter,
    };

    res.json({
      success: true,
      message: 'Daily check-in claimed successfully',
      points: pointsWithComputed,
      pointsEarned: 50,
    });
  } catch (error) {
    console.error('Claim daily points error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim daily points',
      message: error.message,
    });
  }
});

// Unlock premium
app.post('/api/points/unlock-premium', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get current user points
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found',
      });
    }

    // Check if user has enough points
    if (userPoints.totalPoints < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Not enough points to unlock premium. Need 1000 points.',
        currentPoints: userPoints.totalPoints,
        requiredPoints: 1000,
      });
    }

    // Check if already premium
    if (userPoints.premiumExpiryDate && new Date(userPoints.premiumExpiryDate) > new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Premium is already active',
        expiryDate: userPoints.premiumExpiryDate,
      });
    }

    // Calculate premium expiry (5 days from now)
    const premiumExpiryDate = new Date();
    premiumExpiryDate.setDate(premiumExpiryDate.getDate() + 5);

    // Update user points to unlock premium and reset points to 0
    const updatedPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        premiumExpiryDate: premiumExpiryDate,
        totalPoints: 0, // Reset points to 0 when premium is unlocked
      },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true,
        premiumExpiryDate: true,
      },
    });

    // Add computed field for response
    const mostRecentLikeAfter = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasLikedTodayAfter =
      mostRecentLikeAfter && new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

    const pointsWithComputed = {
      ...updatedPoints,
      hasLikedToday: hasLikedTodayAfter,
    };

    res.json({
      success: true,
      message: 'Premium unlocked successfully',
      points: pointsWithComputed,
      premiumExpiryDate: premiumExpiryDate,
    });
  } catch (error) {
    console.error('Unlock premium error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlock premium',
      message: error.message,
    });
  }
});

// Check premium status
app.get('/api/points/premium-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userPoints = await prisma.userPoints.findUnique({
      where: { userId },
      select: {
        premiumExpiryDate: true,
        totalPoints: true,
      },
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found',
      });
    }

    let isPremiumActive = false;
    if (userPoints.premiumExpiryDate) {
      isPremiumActive = new Date(userPoints.premiumExpiryDate) > new Date();
    }

    // If premium has expired, update the database
    if (!isPremiumActive && userPoints.premiumExpiryDate) {
      await prisma.userPoints.update({
        where: { userId },
        data: {
          premiumExpiryDate: null,
        },
      });
    }

    res.json({
      success: true,
      isPremiumActive: isPremiumActive,
      premiumExpiryDate: userPoints.premiumExpiryDate,
      totalPoints: userPoints.totalPoints,
      canUnlockPremium: userPoints.totalPoints >= 1000 && !isPremiumActive,
    });
  } catch (error) {
    console.error('Check premium status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check premium status',
      message: error.message,
    });
  }
});

// Likes API routes (protected)

// Get all liked profiles (regardless of intro status)
app.get('/api/likes', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;

    // Get all likes by the current user
    const likes = await prisma.userLikes.findMany({
      where: {
        likerId: likerId,
      },
      include: {
        liked: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            course: true,
            bio: true,
            interests: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format the response
    const likedProfiles = likes.map((like) => ({
      id: like.liked.id,
      name: like.liked.name,
      age: like.liked.age,
      gender: like.liked.gender,
      course: like.liked.course,
      bio: like.liked.bio,
      interests: like.liked.interests,
      avatarUrl: like.liked.avatarUrl,
    }));

    res.json({
      success: true,
      data: likedProfiles,
    });
  } catch (error) {
    console.error('Get all liked profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get liked profiles',
      message: error.message,
    });
  }
});

// Get liked profiles that don't have intro messages yet
// Must be defined before parameterized routes like /api/likes/:userId
app.get('/api/likes/pending-intro', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;

    // Get all likes by the current user
    const likes = await prisma.userLikes.findMany({
      where: {
        likerId: likerId,
      },
      include: {
        liked: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            course: true,
            bio: true,
            interests: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Check which likes have intro messages
    const likesWithoutIntro = [];

    for (const like of likes) {
      const likedId = like.likedId;
      // Find conversation between the two users
      const userAId = likerId < likedId ? likerId : likedId;
      const userBId = likerId < likedId ? likedId : likerId;

      const conversation = await prisma.conversation.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        include: {
          messages: {
            where: {
              senderId: likerId,
            },
            take: 1,
          },
        },
      });

      // If no conversation exists or no messages from the liker, they haven't sent an intro
      if (!conversation || conversation.messages.length === 0) {
        likesWithoutIntro.push({
          id: like.liked.id,
          name: like.liked.name,
          age: like.liked.age,
          gender: like.liked.gender,
          course: like.liked.course,
          bio: like.liked.bio,
          interests: like.liked.interests,
          avatarUrl: like.liked.avatarUrl,
        });
      }
    }

    res.json({
      success: true,
      data: likesWithoutIntro,
    });
  } catch (error) {
    console.error('Get pending intro likes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get liked profiles',
      message: error.message,
    });
  }
});

// Like a user
app.post('/api/likes', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;
    const { likedId, introMessage } = req.body;

    console.log(`Like attempt: likerId=${likerId}, likedId=${likedId}`);

    if (!likedId) {
      return res.status(400).json({
        success: false,
        error: 'likedId is required',
      });
    }

    // Prevent liking yourself
    if (likerId === likedId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot like yourself',
      });
    }

    // Check if the liked user exists and is verified
    const likedUser = await prisma.user.findUnique({
      where: { id: likedId },
      select: { id: true, verified: true },
    });

    if (!likedUser || !likedUser.verified) {
      return res.status(404).json({
        success: false,
        error: 'User not found or not verified',
      });
    }

    // Check if like already exists
    const existingLike = await prisma.userLikes.findUnique({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId,
        },
      },
    });

    if (existingLike) {
      console.log(`User ${likerId} has already liked user ${likedId} - existing like found`);
      return res.status(409).json({
        success: false,
        error: 'User already liked',
      });
    }

    // Create the like
    const like = await prisma.userLikes.create({
      data: {
        likerId: likerId,
        likedId: likedId,
      },
    });

    // Check if there is already a reciprocal like (match)
    const reciprocalLike = await prisma.userLikes.findUnique({
      where: {
        likerId_likedId: {
          likerId: likedId,
          likedId: likerId,
        },
      },
    });

    const isMatch = !!reciprocalLike;

    // Ensure a conversation exists between the pair (ordered for uniqueness)
    const userAId = likerId < likedId ? likerId : likedId;
    const userBId = likerId < likedId ? likedId : likerId;

    let conversation = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userAId,
          userBId,
          isLocked: !isMatch, // unlock immediately if already matched
        },
      });
    } else if (isMatch && conversation.isLocked) {
      // Unlock on match
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { isLocked: false },
      });
    }

    // If intro message provided, store it as the first message (allowed even if locked)
    let createdIntroMessage = null;
    if (introMessage) {
      // Validate and sanitize intro message
      const { validateAndSanitizeMessage } = require('./utils/messageValidation');
      const validation = validateAndSanitizeMessage(introMessage);

      if (validation.isValid) {
        createdIntroMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: likerId,
            content: validation.sanitized,
          },
        });
      }
      // If validation fails, we silently ignore the intro message (it's optional)
    }

    // Get updated points data (no need to update flags anymore)
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: likerId },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'User liked successfully',
      like: like,
      matched: isMatch,
      conversation: { id: conversation.id, isLocked: conversation.isLocked },
      introMessage: createdIntroMessage ? { id: createdIntroMessage.id } : null,
      points: userPoints,
    });
  } catch (error) {
    console.error('Like user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like user',
      message: error.message,
    });
  }
});

// Check if user is liked
app.get('/api/likes/check/:userId', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;
    const { userId: likedId } = req.params;

    const like = await prisma.userLikes.findUnique({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId,
        },
      },
    });

    res.json({
      success: true,
      isLiked: !!like,
    });
  } catch (error) {
    console.error('Check like error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check like status',
      message: error.message,
    });
  }
});

// Unlike a user
app.delete('/api/likes/:userId', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;
    const { userId: likedId } = req.params;

    const like = await prisma.userLikes.findUnique({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId,
        },
      },
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        error: 'Like not found',
      });
    }

    await prisma.userLikes.delete({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId,
        },
      },
    });

    res.json({
      success: true,
      message: 'User unliked successfully',
    });
  } catch (error) {
    console.error('Unlike user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlike user',
      message: error.message,
    });
  }
});

// Send introduction message to an existing like
app.post('/api/likes/:userId/intro', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;
    const { userId: likedId } = req.params;
    const { introMessage } = req.body;

    // Validate user ID format
    const { validateUserId, validateAndSanitizeMessage } = require('./utils/messageValidation');
    if (!validateUserId(likedId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format',
      });
    }

    // Validate and sanitize intro message
    const validation = validateAndSanitizeMessage(introMessage);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Intro message is required',
      });
    }

    // Verify the like exists
    const like = await prisma.userLikes.findUnique({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId,
        },
      },
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        error: 'Like not found',
      });
    }

    // Find or create conversation between the two users
    const userAId = likerId < likedId ? likerId : likedId;
    const userBId = likerId < likedId ? likedId : likerId;

    let conversation = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    if (!conversation) {
      // Check if there's a reciprocal like (match)
      const reciprocalLike = await prisma.userLikes.findUnique({
        where: {
          likerId_likedId: {
            likerId: likedId,
            likedId: likerId,
          },
        },
      });

      const isMatch = !!reciprocalLike;

      conversation = await prisma.conversation.create({
        data: {
          userAId,
          userBId,
          isLocked: !isMatch,
        },
      });
    }

    // Check if intro message already exists
    const existingMessage = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        senderId: likerId,
      },
    });

    if (existingMessage) {
      return res.status(409).json({
        success: false,
        error: 'Introduction message already sent',
      });
    }

    // Create the intro message with sanitized content
    const createdIntroMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: likerId,
        content: validation.sanitized,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Introduction sent successfully',
      introMessage: { id: createdIntroMessage.id },
    });
  } catch (error) {
    console.error('Send intro message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send introduction',
      message: error.message,
    });
  }
});

// Conversations API
// List conversations for current user
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const result = await Promise.all(
      conversations.map(async (c) => {
        const otherUserId = c.userAId === userId ? c.userBId : c.userAId;
        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, name: true, avatarUrl: true },
        });
        return {
          id: c.id,
          isLocked: c.isLocked,
          lastMessage: c.messages[0] || null,
          otherUser,
        };
      })
    );

    res.json({ success: true, conversations: result });
  } catch (error) {
    console.error('List conversations error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to list conversations', message: error.message });
  }
});

// Get messages in a conversation
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation)
      return res.status(404).json({ success: false, error: 'Conversation not found' });

    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Include lightweight participant details to render avatars in chat UI
    const [userA, userB] = await Promise.all([
      prisma.user.findUnique({
        where: { id: conversation.userAId },
        select: { id: true, name: true, avatarUrl: true },
      }),
      prisma.user.findUnique({
        where: { id: conversation.userBId },
        select: { id: true, name: true, avatarUrl: true },
      }),
    ]);
    const me = userA && userA.id === userId ? userA : userB;
    const other = userA && userA.id === userId ? userB : userA;

    res.json({
      success: true,
      isLocked: conversation.isLocked,
      messages,
      participants: { me, other },
      currentUserId: userId,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to get messages', message: error.message });
  }
});

// Send a message in a conversation (blocked if locked)
app.post('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { content } = req.body;

    // Validate conversation ID format
    const {
      validateConversationId,
      validateAndSanitizeMessage,
    } = require('./utils/messageValidation');
    if (!validateConversationId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID format' });
    }

    // Validate and sanitize message content
    const validation = validateAndSanitizeMessage(content);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation)
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (conversation.isLocked) {
      return res.status(423).json({ success: false, error: 'Chat is locked until you match' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        content: validation.sanitized,
      },
    });

    // touch conversation updatedAt
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to send message', message: error.message });
  }
});

// Unpass a user
app.delete('/api/passes/:userId', authenticateToken, async (req, res) => {
  try {
    const passerId = req.user.userId;
    const { userId: passedId } = req.params;

    const pass = await prisma.userPasses.findUnique({
      where: {
        passerId_passedId: {
          passerId: passerId,
          passedId: passedId,
        },
      },
    });

    if (!pass) {
      return res.status(404).json({
        success: false,
        error: 'Pass not found',
      });
    }

    await prisma.userPasses.delete({
      where: {
        passerId_passedId: {
          passerId: passerId,
          passedId: passedId,
        },
      },
    });

    res.json({
      success: true,
      message: 'User unpassed successfully',
    });
  } catch (error) {
    console.error('Unpass user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unpass user',
      message: error.message,
    });
  }
});

// Pass a user
app.post('/api/passes', authenticateToken, async (req, res) => {
  try {
    const passerId = req.user.userId;
    const { passedId } = req.body;

    console.log(`Pass attempt: passerId=${passerId}, passedId=${passedId}`);

    if (!passedId) {
      return res.status(400).json({
        success: false,
        error: 'passedId is required',
      });
    }

    // Prevent passing yourself
    if (passerId === passedId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot pass on yourself',
      });
    }

    // Check if the passed user exists and is verified
    const passedUser = await prisma.user.findUnique({
      where: { id: passedId },
      select: { id: true, verified: true },
    });

    if (!passedUser || !passedUser.verified) {
      return res.status(404).json({
        success: false,
        error: 'User not found or not verified',
      });
    }

    // Check if pass already exists
    const existingPass = await prisma.userPasses.findUnique({
      where: {
        passerId_passedId: {
          passerId: passerId,
          passedId: passedId,
        },
      },
    });

    if (existingPass) {
      console.log(`User ${passerId} has already passed on user ${passedId} - existing pass found`);
      return res.status(409).json({
        success: false,
        error: 'User already passed',
      });
    }

    // Create the pass
    const pass = await prisma.userPasses.create({
      data: {
        passerId: passerId,
        passedId: passedId,
      },
    });

    console.log(`User ${passerId} passed on user ${passedId}`);

    res.status(201).json({
      success: true,
      message: 'User passed successfully',
      pass: pass,
    });
  } catch (error) {
    console.error('Pass user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pass user',
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: config.isDevelopment ? err.message : 'Internal server error',
  });
});

// 404 handler - MUST be last
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SITogether Backend server is running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
});
