# 🚀 Quick Start - v2.0 with Intro Messages

## Get It Running in 3 Steps

### 1️⃣ Start the Application
```bash
docker-compose up --build
```

### 2️⃣ Setup Database (in new terminal)
```bash
# Apply migrations (Match model + Intro messages)
docker exec -it sitogether-backend npx prisma migrate dev --name add_intro_messages

# Load sample data (6 users, 5 matches, 2 locked intro messages, 3 conversations)
docker exec -it sitogether-backend npx prisma db seed
```

### 3️⃣ Test It Out
- Open http://localhost:3000
- You'll be logged in as **Kira Belle**
- Click "Like" on **Neko** → Modal appears
- Send an intro message → **🎉 MATCH!** (Neko already liked you)
- Go to **Chat** page → See conversation with **unlocked intro messages**

---

## 🆕 What's New in v2.0

### 💌 Locked Intro Messages

When you like someone, you can now:
1. **Send an intro message** (up to 200 characters)
2. **Like without a message** (classic swipe)
3. **Cancel** and keep swiping

**The magic:** Your intro message is **locked** until they like you back! When they match with you, your message unlocks and appears in your new conversation.

---

## 🎮 Try These Scenarios

### Scenario 1: Match with Intro Message (IMMEDIATE)

1. Like **Neko** → Modal appears
2. Type: "Hey Neko! Let's work out together! 💪"
3. Click "💌 Send with intro message"
4. **INSTANT MATCH!** 🎉
5. Go to `/chat`
6. Open conversation with Neko
7. **See BOTH intro messages:**
   - Your message: "Hey Neko! Let's work out together! 💪"
   - Neko's message: "Hey! I noticed we're both into wellness..." *(was locked, now unlocked!)*

### Scenario 2: Like Without Message (IMMEDIATE)

1. Like any profile
2. Click "❤️ Like without message"
3. No intro message sent
4. If they already liked you → instant match

### Scenario 3: Intro Message Waiting to Unlock

1. Like **Airi** → Modal appears
2. Type: "Hi Airi! Let's build something cool! 🚀"
3. Send intro
4. No match notification (Airi hasn't liked you yet)
5. Message is **locked** and waiting
6. When Airi likes you later → **MATCH!** + message unlocks

---

## 📊 What's Included in Sample Data

### Users (6)
- **Kira Belle** (You) - CSC student
- **Aqua Nova** - EEE student
- **Star Lumi** - CDM student
- **Miko-chan** - NUR student
- **Airi Sky** - MEC student
- **Neko Mika** - PHT student

### Matches (5)
| User A | User B | Status | Intro Message |
|--------|--------|--------|---------------|
| Kira | Aqua | ✅ Matched | None |
| Kira | Star | ✅ Matched | None |
| Kira | Miko | ✅ Matched | None |
| Kira | Airi | ⏳ Pending | 🔒 Locked from Kira |
| Neko | Kira | ⏳ Pending | 🔒 Locked from Neko |

### Conversations (3)
- **Kira ↔ Aqua** - 3 messages about robotics
- **Kira ↔ Star** - 2 messages about UI design
- **Kira ↔ Miko** - 1 message thanking for help

### Locked Intro Messages (2)
1. **Kira → Airi:** "Hi Airi! I'm working on a tech project and saw you're into engineering. Would love to collaborate!"
2. **Neko → Kira:** "Hey! I noticed we're both into wellness and fitness. I'd love to study together sometime! 🌟"

---

## 🎯 Key Features

### v2.0 Features
- ✅ **Locked intro messages** - Revealed only on mutual match
- ✅ **Optional messaging** - Choose to send or skip
- ✅ **Beautiful modal UI** - Clean intro message composer
- ✅ **Character counter** - 200 character limit
- ✅ **Auto-unlock on match** - Seamless experience

### v1.0 Features
- ✅ **Match-based chat** - Only matched users can message
- ✅ **Swipe to match** - Like or pass on profiles
- ✅ **Real-time messaging** - Send and receive messages
- ✅ **Match notifications** - Know when you match

---

## 🔧 Troubleshooting

**Modal not showing when clicking Like?**
- Check browser console for errors
- Ensure JavaScript is enabled
- Try refreshing the page

**Intro messages not appearing in chat?**
- Make sure both users have matched
- Check that messages were unlocked (matched status)
- Verify seed data loaded correctly

**Database connection error?**
```bash
# Check containers
docker ps

# Restart if needed
docker-compose down
docker-compose up
```

**Migration already applied?**
```bash
# Just reseed
docker exec -it sitogether-backend npx prisma db seed
```

---

## 📚 Documentation

- 📘 `INTRO_MESSAGES_FEATURE.md` - Complete feature documentation
- 📖 `MATCHING_SETUP_GUIDE.md` - Full setup guide
- 📊 `IMPLEMENTATION_SUMMARY.md` - Technical details

---

## 🎨 UI Preview

### Intro Message Modal

```
┌────────────────────────────────────┐
│  Send an intro to Neko Mika?      │
│  Your message will be revealed     │
│  when they like you back!          │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ Hi! I'd love to connect...   │ │
│  │                              │ │
│  └──────────────────────────────┘ │
│                          25/200    │
│                                    │
│  [💌 Send with intro message]     │
│  [❤️ Like without message]        │
│  [Cancel]                          │
└────────────────────────────────────┘
```

---

## 🎯 Next Steps After Setup

1. **Test matching** - Swipe and match with Neko
2. **Send intro messages** - Try different messages
3. **Check chat** - See unlocked messages
4. **Explore UI** - Beautiful modal design
5. **Read docs** - Learn advanced features

---

**Ready to send your first intro message? Let's go! 💌**

**Version:** 2.0.0 with Locked Intro Messages  
**Updated:** October 25, 2025

