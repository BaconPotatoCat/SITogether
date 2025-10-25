# 🎯 SITogether - Matching System Setup Guide

## Overview

This guide explains the new matching system that has been integrated into SITogether. Users can now only chat with others after they've matched!

## What's New

### 1. **Match Model** 
A new `Match` table has been added to track user interactions:
- **pending**: One user liked another, waiting for reciprocation
- **matched**: Both users liked each other (mutual match)
- **rejected**: User passed on another user

### 2. **Matching Logic**
- When User A likes User B, a "pending" match is created
- If User B also likes User A, the match becomes "matched"
- A conversation is automatically created when users match
- Users can only message each other after matching

### 3. **Updated Features**
- **Discovery Page**: Like/pass actions now create match records
- **Chat Page**: Shows only conversations with matched users
- **Match Notifications**: Users see a notification when they match

## Setup Instructions

### Option 1: Using Docker Compose (Recommended)

1. **Make sure Docker is running**

2. **Start the application:**
   ```bash
   docker-compose up --build
   ```

3. **Apply database migrations (in a new terminal):**
   ```bash
   docker exec -it sitogether-backend npx prisma migrate dev --name add_matches
   ```

4. **Seed the database with sample data:**
   ```bash
   docker exec -it sitogether-backend npx prisma db seed
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

### Option 2: Local Development

1. **Create .env file in backend directory:**
   ```bash
   # Copy from env.example and adjust for local setup
   DATABASE_URL=postgresql://sitogether_user:sitogether_password@localhost:5432/sitogether_db
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Apply database migrations:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_matches
   ```

4. **Seed the database:**
   ```bash
   npx prisma db seed
   ```

5. **Start the backend:**
   ```bash
   npm run dev
   ```

6. **Start the frontend (in another terminal):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## How It Works

### User Flow

1. **Discovery Page** (`/`)
   - Users see profiles they can swipe on
   - Like = Create a pending match
   - Pass = Record rejection
   - When mutual match occurs → Notification appears

2. **Chat Page** (`/chat`)
   - Shows conversations only with matched users
   - Each conversation is created automatically when users match
   - Empty state prompts users to match with others

### API Endpoints

#### Backend Endpoints

**Matches:**
- `GET /api/matches/:userId` - Get all matches for a user
- `GET /api/matches/check?userId1=...&userId2=...` - Check match status
- `POST /api/matches` - Create or update a match
  ```json
  {
    "userId1": "uuid",
    "userId2": "uuid", 
    "action": "like" | "pass"
  }
  ```

**Conversations:**
- `GET /api/conversations/:userId` - Get user's conversations
- `POST /api/conversations` - Create conversation (requires match)

**Messages:**
- `GET /api/conversations/:conversationId/messages` - Get messages
- `POST /api/messages` - Send a message

#### Frontend API Routes

- `GET /api/matches?userId=...` - Proxy to backend matches endpoint
- `POST /api/matches` - Proxy to create match
- `GET /api/conversations?userId=...` - Proxy to conversations
- `POST /api/conversations` - Proxy to create conversation
- `GET /api/messages?conversationId=...` - Proxy to messages
- `POST /api/messages` - Proxy to send message

## Database Schema

### Match Table
```prisma
model Match {
  id          String   @id @default(uuid())
  user1Id     String   // User who initiated
  user2Id     String   // User being matched with
  status      String   @default("pending") // pending, matched, rejected
  createdAt   DateTime @default(now())
  matchedAt   DateTime? // When mutual match occurred
  
  user1 User @relation("MatchInitiator", fields: [user1Id], references: [id])
  user2 User @relation("MatchReceiver", fields: [user2Id], references: [id])
  
  @@unique([user1Id, user2Id])
}
```

## Sample Data

The seed file creates:
- 6 sample users (Kira, Aqua, Star, Miko, Airi, Neko)
- 5 match records:
  - Kira ↔ Aqua (matched)
  - Kira ↔ Star (matched)
  - Kira ↔ Miko (matched)
  - Kira → Airi (pending)
  - Neko → Kira (pending)
- 3 conversations (only for matched users)
- Sample messages in each conversation

## Testing the System

1. **Test Matching:**
   - Go to `/` (Discovery page)
   - Like a user (Neko is set to like Kira back)
   - See the match notification
   - Go to `/chat` to see the new conversation

2. **Test Chat:**
   - Go to `/chat`
   - See conversations with matched users only
   - Click a conversation to open it
   - Send messages

3. **Test Match Requirement:**
   - Try to manually create a conversation between unmatched users
   - Should fail with "Users must match before creating a conversation"

## Troubleshooting

### "Environment variable not found: DATABASE_URL"
- Make sure `.env` file exists in the backend directory
- Copy from `env.example` and adjust database URL

### "Cannot find module '@prisma/client'"
- Run `npm install` in the backend directory
- Run `npx prisma generate`

### "Migration failed"
- Check if database is running: `docker ps`
- Check database connection in `.env` file
- Try resetting: `npx prisma migrate reset` (⚠️ deletes all data)

### "No conversations showing up"
- Make sure you've run the seed script
- Check that matches are created (status: "matched")
- Verify conversations exist in database

## File Changes Summary

### Backend
- ✅ `prisma/schema.prisma` - Added Match model
- ✅ `server.js` - Added match endpoints and updated conversation logic
- ✅ `prisma/seed.js` - Added sample matches

### Frontend
- ✅ `pages/index.tsx` - Integrated matching on like/pass
- ✅ `pages/chat.tsx` - Updated UI for matched conversations
- ✅ `pages/api/matches.ts` - New API route for matches
- ✅ `styles/globals.css` - Added match notification animation

## Next Steps

1. **Add authentication** - Currently using demo user (first user in database)
2. **Add match management** - View all matches, unmatch feature
3. **Add notifications** - Real-time match notifications
4. **Add match expiry** - Matches expire after X days
5. **Add match filters** - Filter by interests, course, etc.

## Support

If you encounter issues:
1. Check the console for errors
2. Verify database is running
3. Check that migrations are applied
4. Ensure seed data is loaded

---

🎉 **Happy Matching!**

