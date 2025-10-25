const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const prisma = require('./lib/prisma');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
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
      users: '/api/users'
    }
  });
});

// Users API route
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        age: true,
        course: true,
        bio: true,
        interests: true,
        avatarUrl: true,
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

// Get all conversations for a user
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Format the conversations with other participant info and last message
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      const lastMessage = conv.messages[0];
      
      return {
        id: conv.id,
        otherUser: otherParticipant ? {
          id: otherParticipant.user.id,
          name: otherParticipant.user.name,
          avatarUrl: otherParticipant.user.avatarUrl
        } : null,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
          senderName: lastMessage.sender.name
        } : null,
        updatedAt: conv.updatedAt
      };
    });

    res.json({
      success: true,
      data: formattedConversations,
      count: formattedConversations.length
    });
  } catch (error) {
    console.error('Conversations fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      message: error.message
    });
  }
});

// Get messages for a specific conversation (only unlocked messages)
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        isLocked: false  // Only show unlocked messages
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Messages fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      message: error.message
    });
  }
});

// Check match status between two users
app.get('/api/matches/check', async (req, res) => {
  try {
    const { userId1, userId2 } = req.query;

    if (!userId1 || !userId2) {
      return res.status(400).json({
        success: false,
        error: 'Both userId1 and userId2 are required'
      });
    }

    // Check for match in either direction
    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { AND: [{ user1Id: userId1 }, { user2Id: userId2 }] },
          { AND: [{ user1Id: userId2 }, { user2Id: userId1 }] }
        ]
      }
    });

    res.json({
      success: true,
      matched: match?.status === 'matched',
      status: match?.status || 'none',
      data: match
    });
  } catch (error) {
    console.error('Match check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check match status',
      message: error.message
    });
  }
});

// Get all matches for a user
app.get('/api/matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const whereClause = {
      OR: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    };

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    const matches = await prisma.match.findMany({
      where: whereClause,
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            age: true,
            course: true,
            bio: true,
            interests: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            age: true,
            course: true,
            bio: true,
            interests: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format matches to show the other user
    const formattedMatches = matches.map(match => ({
      id: match.id,
      status: match.status,
      createdAt: match.createdAt,
      matchedAt: match.matchedAt,
      otherUser: match.user1Id === userId ? match.user2 : match.user1
    }));

    res.json({
      success: true,
      data: formattedMatches,
      count: formattedMatches.length
    });
  } catch (error) {
    console.error('Matches fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch matches',
      message: error.message
    });
  }
});

// Create or update a match (like/pass with optional intro message)
app.post('/api/matches', async (req, res) => {
  try {
    const { userId1, userId2, action, introMessage } = req.body;

    if (!userId1 || !userId2 || !action) {
      return res.status(400).json({
        success: false,
        error: 'userId1, userId2, and action are required'
      });
    }

    if (!['like', 'pass'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action must be either "like" or "pass"'
      });
    }

    // Check if there's already a match from user2 to user1
    const reverseMatch = await prisma.match.findFirst({
      where: {
        user1Id: userId2,
        user2Id: userId1
      }
    });

    let match;
    let isNewMatch = false;

    if (reverseMatch && reverseMatch.status === 'pending' && action === 'like') {
      // It's a mutual match! Update the reverse match to 'matched'
      match = await prisma.match.update({
        where: { id: reverseMatch.id },
        data: {
          status: 'matched',
          matchedAt: new Date()
        },
        include: {
          user1: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          },
          user2: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      });
      isNewMatch = true;

      // Create a conversation for the matched users
      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: userId1 },
              { userId: userId2 }
            ]
          }
        }
      });

      // Unlock any locked intro messages between these users and link to conversation
      await prisma.message.updateMany({
        where: {
          OR: [
            { AND: [{ senderId: userId1 }, { receiverId: userId2 }, { isLocked: true }] },
            { AND: [{ senderId: userId2 }, { receiverId: userId1 }, { isLocked: true }] }
          ]
        },
        data: {
          isLocked: false,
          conversationId: conversation.id
        }
      });

      console.log(`🎉 New match created! Conversation ID: ${conversation.id}`);
    } else {
      // Check if user1 already has a match record with user2
      const existingMatch = await prisma.match.findFirst({
        where: {
          user1Id: userId1,
          user2Id: userId2
        }
      });

      if (existingMatch) {
        return res.json({
          success: true,
          data: existingMatch,
          message: 'Match record already exists'
        });
      }

      // Create new match record
      match = await prisma.match.create({
        data: {
          user1Id: userId1,
          user2Id: userId2,
          status: action === 'like' ? 'pending' : 'rejected'
        },
        include: {
          user1: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          },
          user2: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      });

      // If this is a like with an intro message, create a locked message
      if (action === 'like' && introMessage && introMessage.trim()) {
        await prisma.message.create({
          data: {
            senderId: userId1,
            receiverId: userId2,
            content: introMessage.trim(),
            isLocked: true,
            isIntroMessage: true,
            conversationId: null
          }
        });
        console.log(`📝 Intro message sent from ${userId1} to ${userId2} (locked)`);
      }
    }

    res.status(201).json({
      success: true,
      data: match,
      isNewMatch: isNewMatch,
      message: isNewMatch ? 'It\'s a match!' : 'Match action recorded'
    });
  } catch (error) {
    console.error('Match creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create match',
      message: error.message
    });
  }
});

// Create or get conversation between two users (REQUIRES MATCH)
app.post('/api/conversations', async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    if (!userId1 || !userId2) {
      return res.status(400).json({
        success: false,
        error: 'Both userId1 and userId2 are required'
      });
    }

    // Check if users have matched
    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { AND: [{ user1Id: userId1 }, { user2Id: userId2 }, { status: 'matched' }] },
          { AND: [{ user1Id: userId2 }, { user2Id: userId1 }, { status: 'matched' }] }
        ]
      }
    });

    if (!match) {
      return res.status(403).json({
        success: false,
        error: 'Users must match before creating a conversation'
      });
    }

    // Check if conversation already exists between these users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: {
                userId: userId1
              }
            }
          },
          {
            participants: {
              some: {
                userId: userId2
              }
            }
          }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (existingConversation) {
      return res.json({
        success: true,
        data: existingConversation,
        message: 'Existing conversation found'
      });
    }

    // Create new conversation
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: userId1 },
            { userId: userId2 }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: newConversation,
      message: 'New conversation created'
    });
  } catch (error) {
    console.error('Conversation creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
      message: error.message
    });
  }
});

// Send a message
app.post('/api/messages', async (req, res) => {
  try {
    const { conversationId, senderId, receiverId, content } = req.body;

    if (!conversationId || !senderId || !receiverId || !content) {
      return res.status(400).json({
        success: false,
        error: 'conversationId, senderId, receiverId, and content are required'
      });
    }

    // Create the message and update conversation's updatedAt
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId,
          receiverId,
          content
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      })
    ]);

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Message send error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
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
