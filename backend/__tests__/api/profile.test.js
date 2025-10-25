const request = require('supertest');
const express = require('express');

// Mock Prisma with proper structure
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  }
};

jest.mock('../../lib/prisma', () => mockPrisma);

const prisma = mockPrisma;

// Create a minimal Express app for testing
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes after mocking
const setupRoutes = () => {
  // GET user by ID
  app.get('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const user = await prisma.user.findUnique({
        where: { id },
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
          updatedAt: true
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
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user from database'
      });
    }
  });

  // PUT update user by ID
  app.put('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, age, course, bio, interests, avatarUrl } = req.body;

      if (!name || !age) {
        return res.status(400).json({
          success: false,
          error: 'Name and age are required'
        });
      }

      const updateData = {
        name,
        age: parseInt(age),
        course: course || null,
        bio: bio || null,
        interests: Array.isArray(interests) ? interests : []
      };

      if (avatarUrl !== undefined) {
        updateData.avatarUrl = avatarUrl;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
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
          updatedAt: true
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update user profile'
      });
    }
  });
};

describe('Profile API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupRoutes();
  });

  describe('GET /api/users/:id', () => {
    it('should return user profile by ID', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: 'Computer Science',
        bio: 'Software developer',
        interests: ['Coding', 'Gaming'],
        avatarUrl: 'https://example.com/avatar.jpg',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/user-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'user-123',
        name: 'Test User',
        age: 25
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: expect.any(Object)
      });
    });

    it('should return 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 500 on database error', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/user-123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch user from database');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user profile successfully', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        age: 26,
        gender: 'Male',
        role: 'User',
        course: 'Software Engineering',
        bio: 'Updated bio',
        interests: ['Coding', 'Reading'],
        avatarUrl: 'https://example.com/avatar.jpg',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .put('/api/users/user-123')
        .send({
          name: 'Updated Name',
          age: 26,
          course: 'Software Engineering',
          bio: 'Updated bio',
          interests: ['Coding', 'Reading']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.age).toBe(26);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          name: 'Updated Name',
          age: 26,
          course: 'Software Engineering',
          bio: 'Updated bio',
          interests: ['Coding', 'Reading']
        }),
        select: expect.any(Object)
      });
    });

    it('should update avatar URL when provided', async () => {
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: 'Computer Science',
        bio: 'Software developer',
        interests: ['Coding'],
        avatarUrl: base64Image,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .put('/api/users/user-123')
        .send({
          name: 'Test User',
          age: 25,
          course: 'Computer Science',
          bio: 'Software developer',
          interests: ['Coding'],
          avatarUrl: base64Image
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.avatarUrl).toBe(base64Image);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          avatarUrl: base64Image
        }),
        select: expect.any(Object)
      });
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .put('/api/users/user-123')
        .send({
          age: 25
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name and age are required');
    });

    it('should return 400 when age is missing', async () => {
      const response = await request(app)
        .put('/api/users/user-123')
        .send({
          name: 'Test User'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name and age are required');
    });

    it('should handle null values for optional fields', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: null,
        bio: null,
        interests: [],
        avatarUrl: null,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .put('/api/users/user-123')
        .send({
          name: 'Test User',
          age: 25,
          course: '',
          bio: '',
          interests: []
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.course).toBe(null);
      expect(response.body.data.bio).toBe(null);
    });

    it('should return 500 on database error', async () => {
      prisma.user.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/user-123')
        .send({
          name: 'Test User',
          age: 25
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to update user profile');
    });

    it('should convert age to integer', async () => {
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        gender: 'Male',
        role: 'User',
        course: 'Computer Science',
        bio: 'Software developer',
        interests: [],
        avatarUrl: null,
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      await request(app)
        .put('/api/users/user-123')
        .send({
          name: 'Test User',
          age: '25' // String
        })
        .expect(200);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          age: 25 // Should be converted to number
        }),
        select: expect.any(Object)
      });
    });
  });
});

