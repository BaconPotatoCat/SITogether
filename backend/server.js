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
        logout: 'POST /api/auth/logout',
        session: 'GET /api/auth/session (protected)',
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

// Update user by ID
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, course, bio, interests, avatarUrl } = req.body;

    console.log('PUT /api/users/:id called with ID:', id);
    console.log('Request body:', {
      name,
      age,
      course,
      bio,
      interests,
      avatarUrl: avatarUrl ? 'base64 image...' : null,
    });

    // Validate required fields
    if (!name || !age) {
      return res.status(400).json({
        success: false,
        error: 'Name and age are required',
      });
    }

    // Prepare update data
    const updateData = {
      name,
      age: parseInt(age),
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
        age: parseInt(age),
        gender,
        role: 'User',
        course,
        bio: null,
        interests: [],
        verified: false,
        verificationTokens: {
          create: {
            token: verificationToken,
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
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
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
      await prisma.verificationToken.delete({
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
      await prisma.verificationToken.delete({
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
      prisma.verificationToken.delete({
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
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { userId: user.id },
      }),
      prisma.verificationToken.create({
        data: {
          token: verificationToken,
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

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
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
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
