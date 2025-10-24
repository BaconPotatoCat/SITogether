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
      },
      points: {
        getPoints: 'GET /api/points (protected)',
        claimDaily: 'POST /api/points/claim-daily (protected)',
        claimDailyLike: 'POST /api/points/claim-daily-like (protected)',
        unlockPremium: 'POST /api/points/unlock-premium (protected)',
        premiumStatus: 'GET /api/points/premium-status (protected)'
      },
      likes: {
        likeUser: 'POST /api/likes (protected)',
        checkLike: 'GET /api/likes/check/:userId (protected)',
        unlikeUser: 'DELETE /api/likes/:userId (protected)'
      },
      passes: {
        passUser: 'POST /api/passes (protected)',
        unpassUser: 'DELETE /api/passes/:userId (protected)'
      }
    }
  });
});

// Users API route (protected)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    // Get IDs of users that the current user has already liked
    const likedUserIds = await prisma.userLikes.findMany({
      where: {
        likerId: currentUserId
      },
      select: {
        likedId: true
      }
    });

    // Get IDs of users that the current user has already passed
    const passedUserIds = await prisma.userPasses.findMany({
      where: {
        passerId: currentUserId
      },
      select: {
        passedId: true
      }
    });

    // Get all users for debugging
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        verified: true
      }
    });

    console.log(`Total users in database: ${allUsers.length}`);
    console.log(`Verified users: ${allUsers.filter(u => u.verified).length}`);
    console.log(`Unverified users: ${allUsers.filter(u => !u.verified).length}`);

    console.log(`User ${currentUserId} has liked ${likedUserIds.length} users and passed ${passedUserIds.length} users`);

    const excludedIds = likedUserIds.map(like => like.likedId);
    // Also exclude passed users
    excludedIds.push(...passedUserIds.map(pass => pass.passedId));
    // Also exclude the current user from their own discovery
    excludedIds.push(currentUserId);

    console.log(`Excluded user IDs:`, excludedIds);
    console.log(`Excluding ${excludedIds.length} total users from discovery`);

    const users = await prisma.user.findMany({
      where: {
        verified: true,
        id: {
          notIn: excludedIds
        }
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
        verified: false
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
        createdAt: true
      }
    });

    // Create UserPoints record for the new user
    await prisma.userPoints.create({
      data: {
        userId: user.id,
        totalPoints: 0
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
        verified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('User found in database:', {
      email: user?.email,
      verified: user?.verified,
      verifiedType: typeof user?.verified
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

    // Check if account is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        error: 'Account not verified. Please check your email and verify your account before logging in.',
        requiresVerification: true
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
        verified: true
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

// Points API routes (protected)

// Get user points
app.get('/api/points', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user points (should always exist since created during registration)
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true
      }
    });

    if (!userPoints) {
      console.error(`UserPoints record not found for user ${userId} - user registration may be incomplete`);
      return res.status(500).json({
        success: false,
        error: 'User points record not found. Please contact support.'
      });
    }

    // Check if user has liked someone today
    const mostRecentLike = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasLikedToday = mostRecentLike &&
      new Date(mostRecentLike.createdAt).getTime() >= today.getTime();

    // Add computed field to response
    const pointsWithComputed = {
      ...userPoints,
      hasLikedToday
    };

    res.json({
      success: true,
      points: pointsWithComputed
    });
  } catch (error) {
    console.error('Get points error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user points',
      message: error.message
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
      select: { createdAt: true }
    });

    if (!mostRecentLike) {
      return res.status(400).json({
        success: false,
        error: 'No likes found for today'
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
        error: 'Daily like task not completed yet'
      });
    }

    // Check if already claimed today
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId }
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found'
      });
    }

    // Check if user has reached 1000 points (premium threshold)
    if (userPoints.totalPoints >= 1000) {
      return res.status(400).json({
        success: false,
        error: 'Cannot claim points - you have reached the premium threshold. Unlock premium to continue earning points.'
      });
    }

    if (userPoints.dailyLikeClaimedDate) {
      const claimedDate = new Date(userPoints.dailyLikeClaimedDate);
      claimedDate.setHours(0, 0, 0, 0);

      if (claimedDate.getTime() === today.getTime()) {
        return res.status(400).json({
          success: false,
          error: 'Daily like points already claimed today'
        });
      }
    }

    // Award points for daily like task
    const updatedPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: userPoints.totalPoints + 25,
        dailyLikeClaimedDate: new Date()
      },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true
      }
    });

    // Add computed field for response
    const mostRecentLikeAfter = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const hasLikedTodayAfter = mostRecentLikeAfter &&
      new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

    const pointsWithComputed = {
      ...updatedPoints,
      hasLikedToday: hasLikedTodayAfter
    };

    res.json({
      success: true,
      message: 'Daily like points claimed successfully',
      points: pointsWithComputed,
      pointsEarned: 25
    });
  } catch (error) {
    console.error('Claim daily like points error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim daily like points',
      message: error.message
    });
  }
});

// Claim daily check-in points
app.post('/api/points/claim-daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user already claimed today
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId }
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found'
      });
    }

    // Check if user has reached 1000 points (premium threshold)
    if (userPoints.totalPoints >= 1000) {
      return res.status(400).json({
        success: false,
        error: 'Cannot claim points - you have reached the premium threshold. Unlock premium to continue earning points.'
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
          error: 'Daily check-in already claimed today'
        });
      }
    }

    // Update points and mark as claimed
    const updatedPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: userPoints.totalPoints + 50,
        dailyCheckinDate: new Date()
      },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true
      }
    });

    // Add computed field for response
    const mostRecentLikeAfter = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    // 'today' is already declared above in this function
    const hasLikedTodayAfter = mostRecentLikeAfter &&
      new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

    const pointsWithComputed = {
      ...updatedPoints,
      hasLikedToday: hasLikedTodayAfter
    };

    res.json({
      success: true,
      message: 'Daily check-in claimed successfully',
      points: pointsWithComputed,
      pointsEarned: 50
    });
  } catch (error) {
    console.error('Claim daily points error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim daily points',
      message: error.message
    });
  }
});

// Unlock premium
app.post('/api/points/unlock-premium', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get current user points
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId }
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found'
      });
    }

    // Check if user has enough points
    if (userPoints.totalPoints < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Not enough points to unlock premium. Need 1000 points.',
        currentPoints: userPoints.totalPoints,
        requiredPoints: 1000
      });
    }

    // Check if already premium
    if (userPoints.premiumExpiryDate && new Date(userPoints.premiumExpiryDate) > new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Premium is already active',
        expiryDate: userPoints.premiumExpiryDate
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
        totalPoints: 0  // Reset points to 0 when premium is unlocked
      },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true,
        premiumExpiryDate: true
      }
    });

    // Add computed field for response
    const mostRecentLikeAfter = await prisma.userLikes.findFirst({
      where: { likerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasLikedTodayAfter = mostRecentLikeAfter &&
      new Date(mostRecentLikeAfter.createdAt).getTime() >= today.getTime();

    const pointsWithComputed = {
      ...updatedPoints,
      hasLikedToday: hasLikedTodayAfter
    };

    res.json({
      success: true,
      message: 'Premium unlocked successfully',
      points: pointsWithComputed,
      premiumExpiryDate: premiumExpiryDate
    });
  } catch (error) {
    console.error('Unlock premium error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlock premium',
      message: error.message
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
        totalPoints: true
      }
    });

    if (!userPoints) {
      return res.status(404).json({
        success: false,
        error: 'User points not found'
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
          premiumExpiryDate: null
        }
      });
    }

    res.json({
      success: true,
      isPremiumActive: isPremiumActive,
      premiumExpiryDate: userPoints.premiumExpiryDate,
      totalPoints: userPoints.totalPoints,
      canUnlockPremium: userPoints.totalPoints >= 1000 && !isPremiumActive
    });
  } catch (error) {
    console.error('Check premium status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check premium status',
      message: error.message
    });
  }
});

// Likes API routes (protected)

// Like a user
app.post('/api/likes', authenticateToken, async (req, res) => {
  try {
    const likerId = req.user.userId;
    const { likedId } = req.body;

    console.log(`Like attempt: likerId=${likerId}, likedId=${likedId}`);

    if (!likedId) {
      return res.status(400).json({
        success: false,
        error: 'likedId is required'
      });
    }

    // Prevent liking yourself
    if (likerId === likedId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot like yourself'
      });
    }

    // Check if the liked user exists and is verified
    const likedUser = await prisma.user.findUnique({
      where: { id: likedId },
      select: { id: true, verified: true }
    });

    if (!likedUser || !likedUser.verified) {
      return res.status(404).json({
        success: false,
        error: 'User not found or not verified'
      });
    }

    // Check if like already exists
    const existingLike = await prisma.userLikes.findUnique({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId
        }
      }
    });

    if (existingLike) {
      console.log(`User ${likerId} has already liked user ${likedId} - existing like found`);
      return res.status(409).json({
        success: false,
        error: 'User already liked'
      });
    }

    // Create the like
    const like = await prisma.userLikes.create({
      data: {
        likerId: likerId,
        likedId: likedId
      }
    });

    // Get updated points data (no need to update flags anymore)
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: likerId },
      select: {
        totalPoints: true,
        dailyCheckinDate: true,
        dailyLikeClaimedDate: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'User liked successfully',
      like: like,
      points: userPoints
    });
  } catch (error) {
    console.error('Like user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like user',
      message: error.message
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
          likedId: likedId
        }
      }
    });

    res.json({
      success: true,
      isLiked: !!like
    });
  } catch (error) {
    console.error('Check like error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check like status',
      message: error.message
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
          likedId: likedId
        }
      }
    });

    if (!like) {
      return res.status(404).json({
        success: false,
        error: 'Like not found'
      });
    }

    await prisma.userLikes.delete({
      where: {
        likerId_likedId: {
          likerId: likerId,
          likedId: likedId
        }
      }
    });

    res.json({
      success: true,
      message: 'User unliked successfully'
    });
  } catch (error) {
    console.error('Unlike user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlike user',
      message: error.message
    });
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
          passedId: passedId
        }
      }
    });

    if (!pass) {
      return res.status(404).json({
        success: false,
        error: 'Pass not found'
      });
    }

    await prisma.userPasses.delete({
      where: {
        passerId_passedId: {
          passerId: passerId,
          passedId: passedId
        }
      }
    });

    res.json({
      success: true,
      message: 'User unpassed successfully'
    });
  } catch (error) {
    console.error('Unpass user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unpass user',
      message: error.message
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
        error: 'passedId is required'
      });
    }

    // Prevent passing yourself
    if (passerId === passedId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot pass on yourself'
      });
    }

    // Check if the passed user exists and is verified
    const passedUser = await prisma.user.findUnique({
      where: { id: passedId },
      select: { id: true, verified: true }
    });

    if (!passedUser || !passedUser.verified) {
      return res.status(404).json({
        success: false,
        error: 'User not found or not verified'
      });
    }

    // Check if pass already exists
    const existingPass = await prisma.userPasses.findUnique({
      where: {
        passerId_passedId: {
          passerId: passerId,
          passedId: passedId
        }
      }
    });

    if (existingPass) {
      console.log(`User ${passerId} has already passed on user ${passedId} - existing pass found`);
      return res.status(409).json({
        success: false,
        error: 'User already passed'
      });
    }

    // Create the pass
    const pass = await prisma.userPasses.create({
      data: {
        passerId: passerId,
        passedId: passedId
      }
    });

    console.log(`User ${passerId} passed on user ${passedId}`);

    res.status(201).json({
      success: true,
      message: 'User passed successfully',
      pass: pass
    });
  } catch (error) {
    console.error('Pass user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pass user',
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
