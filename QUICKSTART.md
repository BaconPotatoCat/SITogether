# 🚀 Quick Start - Matching System

## Get It Running in 3 Steps

### 1️⃣ Start the Application
```bash
docker-compose up --build
```

### 2️⃣ Setup Database (in new terminal)
```bash
# Apply migration to create Match table
docker exec -it sitogether-backend npx prisma migrate dev --name add_matches

# Load sample data (6 users, 5 matches, 3 conversations)
docker exec -it sitogether-backend npx prisma db seed
```

### 3️⃣ Test It Out
- Open http://localhost:3000
- You'll be logged in as **Kira Belle**
- Swipe right on **Neko** → **🎉 MATCH!**
- Go to **Chat** page → See your new conversation

---

## What You'll See

### Discovery Page (`/`)
- Swipe through profiles
- Like = ❤️ (creates match request)
- Pass = ❌ (records rejection)
- Match notification when mutual like

### Chat Page (`/chat`)
- 3 existing conversations (Aqua, Star, Miko)
- Click to open and send messages
- New conversations appear after matching

---

## Sample Matches Included

| User A | User B | Status |
|--------|--------|--------|
| Kira | Aqua | ✅ Matched (can chat) |
| Kira | Star | ✅ Matched (can chat) |
| Kira | Miko | ✅ Matched (can chat) |
| Kira | Airi | ⏳ Pending (Kira liked Airi) |
| Neko | Kira | ⏳ Pending (Neko liked Kira) |

**Tip:** Like Neko to create a new match and conversation!

---

## Key Files Changed

```
✅ backend/prisma/schema.prisma    - Added Match model
✅ backend/server.js               - Match endpoints + match requirement
✅ backend/prisma/seed.js          - Sample matches

✅ frontend/pages/index.tsx        - Matching on like/pass
✅ frontend/pages/chat.tsx         - Matched conversations only
✅ frontend/pages/api/matches.ts   - Match API routes
✅ frontend/styles/globals.css     - Match notification style
```

---

## Troubleshooting

**Database connection error?**
```bash
# Check if containers are running
docker ps

# Restart if needed
docker-compose down
docker-compose up
```

**No conversations showing?**
```bash
# Make sure seed ran successfully
docker exec -it sitogether-backend npx prisma db seed
```

**Migration already applied?**
```bash
# Just run seed to get sample data
docker exec -it sitogether-backend npx prisma db seed
```

---

## Next Steps

Read the detailed guides:
- 📖 `MATCHING_SETUP_GUIDE.md` - Complete setup documentation
- 📊 `IMPLEMENTATION_SUMMARY.md` - Technical implementation details

---

**Ready to match? Let's go! 🎯**

