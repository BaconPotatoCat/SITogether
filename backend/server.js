const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const prisma = require('./lib/prisma');
const { authenticateToken } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL,
  credentials: true
}));
app.use(cookieParser());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'SITogether Backend API is running!',
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
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
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        session: 'GET /api/auth/session (protected)'
      }
    }
  });
});

// Users API route (protected)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        confirmed: true
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
        confirmed: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Prisma query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users from database',
      message: error.message
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
        error: 'Email, password, name, age, and gender are required'
      });
    }

    // Validate gender value
    const validGenders = ['Male', 'Female', 'Other'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        error: 'Gender must be one of: Male, Female, or Other'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

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
        confirmed: false
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
        confirmed: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
      message: error.message
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
        error: 'Email and password are required'
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
        confirmed: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('User found in database:', {
      email: user?.email,
      confirmed: user?.confirmed,
      confirmedType: typeof user?.confirmed
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if account is confirmed
    if (!user.confirmed) {
      return res.status(403).json({
        success: false,
        error: 'Account not confirmed. Please check your email and confirm your account before logging in.',
        requiresConfirmation: true
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
      maxAge: 60 * 60 * 1000 // 1 hour in milliseconds
    });

    res.json({
      success: true,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      message: error.message
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully'
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
        confirmed: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SITogether Backend server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
