const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Clear existing data (in correct order due to foreign key constraints)
  await prisma.message.deleteMany({})
  await prisma.conversationParticipant.deleteMany({})
  await prisma.conversation.deleteMany({})
  await prisma.match.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('🗑️  Cleared existing data')

  // Create sample users
  const kira = await prisma.user.create({
    data: {
      email: 'kira.belle@example.com',
      name: 'Kira Belle',
      age: 23,
      course: 'CSC',
      bio: "Computer Science student who loves coding and gaming. Let's study algorithms together!",
      interests: ['Programming', 'Gaming', 'Tech'],
      avatarUrl: 'https://images.unsplash.com/photo-1721440171951-26505bbe23cb?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687'
    }
  })

  const aqua = await prisma.user.create({
    data: {
      email: 'aqua.nova@example.com',
      name: 'Aqua Nova',
      age: 21,
      course: 'EEE',
      bio: "Electrical Engineering student passionate about robotics and innovation. Let's build something amazing!",
      interests: ['Electronics', 'Robotics', 'Innovation'],
      avatarUrl: 'https://images.unsplash.com/photo-1663035309414-07fe9174d7d6?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1936'
    }
  })

  const star = await prisma.user.create({
    data: {
      email: 'star.lumi@example.com',
      name: 'Star Lumi',
      age: 22,
      course: 'CDM',
      bio: "Communication and Digital Media student. Love creating content and exploring new media trends.",
      interests: ['Design', 'Media', 'Creativity'],
      avatarUrl: 'https://images.unsplash.com/photo-1758207575528-6b80f80f4408?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687'
    }
  })

  const miko = await prisma.user.create({
    data: {
      email: 'miko.chan@example.com',
      name: 'Miko-chan',
      age: 20,
      course: 'NUR',
      bio: "Nursing student dedicated to helping others. Let's study healthcare together and make a difference!",
      interests: ['Healthcare', 'Wellness', 'Community'],
      avatarUrl: 'https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1170'
    }
  })

  const airi = await prisma.user.create({
    data: {
      email: 'airi.sky@example.com',
      name: 'Airi Sky',
      age: 24,
      course: 'MEC',
      bio: "Mechanical Engineering student who loves solving complex problems. Let's tackle challenging projects together!",
      interests: ['Engineering', 'Innovation', 'Problem Solving'],
      avatarUrl: 'https://images.unsplash.com/photo-1727409048076-182d2907a59e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=987'
    }
  })

  const neko = await prisma.user.create({
    data: {
      email: 'neko.mika@example.com',
      name: 'Neko Mika',
      age: 19,
      course: 'PHT',
      bio: "Physiotherapy student passionate about movement and wellness. Let's study anatomy and help people recover!",
      interests: ['Health', 'Fitness', 'Wellness'],
      avatarUrl: 'https://images.unsplash.com/photo-1693240531477-bc6525187514?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687'
    }
  })

  console.log('✅ Created 6 users')

  // Create matches between users
  // Match 1: Kira <-> Aqua (matched)
  const match1 = await prisma.match.create({
    data: {
      user1Id: kira.id,
      user2Id: aqua.id,
      status: 'matched',
      matchedAt: new Date(Date.now() - 86400000) // 1 day ago
    }
  })

  // Match 2: Kira <-> Star (matched)
  const match2 = await prisma.match.create({
    data: {
      user1Id: kira.id,
      user2Id: star.id,
      status: 'matched',
      matchedAt: new Date(Date.now() - 3600000 * 3) // 3 hours ago
    }
  })

  // Match 3: Kira <-> Miko (matched)
  const match3 = await prisma.match.create({
    data: {
      user1Id: kira.id,
      user2Id: miko.id,
      status: 'matched',
      matchedAt: new Date(Date.now() - 3600000 * 6) // 6 hours ago
    }
  })

  // Match 4: Kira liked Airi (pending - waiting for Airi to like back)
  await prisma.match.create({
    data: {
      user1Id: kira.id,
      user2Id: airi.id,
      status: 'pending'
    }
  })

  // Create locked intro message from Kira to Airi
  await prisma.message.create({
    data: {
      senderId: kira.id,
      receiverId: airi.id,
      content: "Hi Airi! I'm working on a tech project and saw you're into engineering. Would love to collaborate!",
      isLocked: true,
      isIntroMessage: true,
      conversationId: null,
      createdAt: new Date(Date.now() - 60000 * 30) // 30 minutes ago
    }
  })

  // Match 5: Neko liked Kira (pending - waiting for Kira to like back)
  await prisma.match.create({
    data: {
      user1Id: neko.id,
      user2Id: kira.id,
      status: 'pending'
    }
  })

  // Create locked intro message from Neko to Kira
  await prisma.message.create({
    data: {
      senderId: neko.id,
      receiverId: kira.id,
      content: "Hey! I noticed we're both into wellness and fitness. I'd love to study together sometime! 🌟",
      isLocked: true,
      isIntroMessage: true,
      conversationId: null,
      createdAt: new Date(Date.now() - 60000 * 20) // 20 minutes ago
    }
  })

  console.log('✅ Created 5 matches with 2 locked intro messages')

  // Create conversations between Kira and other users (only for matched users)
  // Conversation 1: Kira <-> Aqua
  const conv1 = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: kira.id },
          { userId: aqua.id }
        ]
      }
    }
  })

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv1.id,
        senderId: aqua.id,
        receiverId: kira.id,
        content: 'Hey Kira! Want to collaborate on a robotics project?',
        createdAt: new Date(Date.now() - 60000 * 15) // 15 minutes ago
      },
      {
        conversationId: conv1.id,
        senderId: kira.id,
        receiverId: aqua.id,
        content: 'That sounds amazing! I can help with the programming side.',
        createdAt: new Date(Date.now() - 60000 * 12) // 12 minutes ago
      },
      {
        conversationId: conv1.id,
        senderId: aqua.id,
        receiverId: kira.id,
        content: 'Perfect! When are you free to meet?',
        createdAt: new Date(Date.now() - 60000 * 2) // 2 minutes ago
      }
    ]
  })

  // Conversation 2: Kira <-> Star
  const conv2 = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: kira.id },
          { userId: star.id }
        ]
      }
    }
  })

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv2.id,
        senderId: star.id,
        receiverId: kira.id,
        content: 'Hi! I saw your profile. Do you need help with UI design for your projects?',
        createdAt: new Date(Date.now() - 3600000 * 2) // 2 hours ago
      },
      {
        conversationId: conv2.id,
        senderId: kira.id,
        receiverId: star.id,
        content: 'Actually, yes! I have a web app that needs better design.',
        createdAt: new Date(Date.now() - 3600000 * 1) // 1 hour ago
      }
    ]
  })

  // Conversation 3: Kira <-> Miko
  const conv3 = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: kira.id },
          { userId: miko.id }
        ]
      }
    }
  })

  await prisma.message.create({
    data: {
      conversationId: conv3.id,
      senderId: miko.id,
      receiverId: kira.id,
      content: 'Thanks for helping me with the statistics assignment! 🙏',
      createdAt: new Date(Date.now() - 3600000 * 5) // 5 hours ago
    }
  })

  console.log('✅ Created 3 conversations with messages')
  console.log('🎉 Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
