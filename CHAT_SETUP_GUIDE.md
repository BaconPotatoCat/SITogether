# Chat Feature Setup Guide

## Overview
A fully functional chat system has been implemented with the following features:
- Real-time conversations between users
- Message history stored in the database
- Modern chat interface with conversation list and message view
- Auto-polling for new messages every 3 seconds
- Responsive design

## What's Been Added

### 1. Database Schema (Prisma)
- `Conversation` model - stores chat conversations
- `ConversationParticipant` model - tracks which users are in each conversation
- `Message` model - stores individual messages

### 2. Backend API (Express)
New endpoints in `backend/server.js`:
- `GET /api/conversations/:userId` - Get all conversations for a user
- `GET /api/conversations/:conversationId/messages` - Get messages in a conversation
- `POST /api/conversations` - Create or get existing conversation between two users
- `POST /api/messages` - Send a new message

### 3. Frontend API Routes (Next.js)
- `frontend/pages/api/conversations.ts` - Proxy for conversation endpoints
- `frontend/pages/api/messages.ts` - Proxy for message endpoints

### 4. Chat UI (React)
Updated `frontend/pages/chat.tsx` with:
- Split-panel layout (conversations list + messages view)
- Real-time message polling
- Message sending functionality
- Auto-scroll to latest message
- Modern styling with CSS

## Setup Instructions

### Step 1: Generate and Run Prisma Migration

Navigate to the backend directory and generate a migration:

```bash
cd backend
npx prisma migrate dev --name add_chat_models
```

This will:
- Create migration files in `backend/prisma/migrations/`
- Update your PostgreSQL database schema
- Generate the updated Prisma Client

### Step 2: Seed the Database with Test Data

Run the seed script to populate the database with sample users and conversations:

```bash
npm run seed
# or
npx prisma db seed
```

This will create:
- 6 sample users (including Kira Belle, Aqua Nova, Star Lumi, etc.)
- 3 conversations with messages between users

### Step 3: Restart Your Services

If your containers are running, restart them to ensure the new code is loaded:

```bash
cd ..
docker-compose down
docker-compose up --build
```

Or if running locally without Docker:

**Backend:**
```bash
cd backend
npm install
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Using the Chat Feature

1. Navigate to `http://localhost:3000/chat` (or your frontend URL)
2. The page will load as the first user (Kira Belle) by default
3. You'll see a list of conversations on the left panel
4. Click on any conversation to view messages
5. Type a message in the input field and click "Send" to send a message
6. Messages will auto-refresh every 3 seconds

## Testing the Chat

### Test Scenario 1: View Existing Conversations
1. Open the chat page
2. You should see 3 conversations in the list (with Aqua Nova, Star Lumi, and Miko-chan)
3. Click on each to view the message history

### Test Scenario 2: Send a Message
1. Select any conversation
2. Type a message in the input field
3. Click "Send"
4. The message should appear instantly in the chat
5. The conversation list should update with your new message

### Test Scenario 3: Create a New Conversation (via API)
You can use the backend API to create new conversations:

```bash
curl -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{
    "userId1": "USER_ID_1",
    "userId2": "USER_ID_2"
  }'
```

## API Endpoints Reference

### Get Conversations for a User
```
GET /api/conversations/:userId
```

### Get Messages in a Conversation
```
GET /api/conversations/:conversationId/messages
```

### Create/Get Conversation
```
POST /api/conversations
Body: { "userId1": "uuid", "userId2": "uuid" }
```

### Send Message
```
POST /api/messages
Body: {
  "conversationId": "uuid",
  "senderId": "uuid",
  "receiverId": "uuid",
  "content": "message text"
}
```

## Features Included

✅ Database models for conversations and messages  
✅ Full CRUD API endpoints for chat functionality  
✅ Split-panel chat interface  
✅ Message history display  
✅ Real-time message sending  
✅ Auto-polling for new messages  
✅ Timestamp formatting  
✅ Message bubbles (sent vs received styling)  
✅ Empty state handling  
✅ Responsive design  
✅ Sample data seeding  

## Next Steps (Optional Enhancements)

If you want to extend the chat functionality, consider:
- WebSocket support for true real-time updates (instead of polling)
- Typing indicators
- Message read receipts
- User online/offline status
- Image/file sharing
- Search functionality
- Delete/edit messages
- Group chats (3+ participants)

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in your `.env` file
- Verify the database exists

### Migration Issues
If migration fails:
```bash
npx prisma migrate reset  # WARNING: This will delete all data
npx prisma migrate dev --name add_chat_models
npm run seed
```

### Frontend Not Showing Data
- Check browser console for errors
- Verify backend is running on the correct port
- Check `NEXT_PUBLIC_BACKEND_INTERNALURL` environment variable

### Messages Not Sending
- Check network tab in browser dev tools
- Verify all required fields are being sent in the POST request
- Check backend logs for errors

## Support

If you encounter any issues, check:
1. Backend logs: `docker-compose logs backend`
2. Frontend logs: `docker-compose logs frontend`
3. Database logs: `docker-compose logs db`




