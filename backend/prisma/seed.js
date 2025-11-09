// Bridge console.* to file logger in non-test environments
require('../lib/logging-bridge');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { prepareEmailForStorage, encryptField } = require('../utils/fieldEncryption');
const config = require('../lib/config');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create initial admin account
  const adminEmail = config.admin.email;
  const adminPassword = config.admin.password;

  // Validate admin credentials
  if (!adminEmail || !adminPassword) {
    console.error('❌ Admin credentials are required for seeding');
    console.error('Please set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file');
    throw new Error('Admin credentials missing');
  }

  const saltRounds = 10;
  const adminHashedPassword = await bcrypt.hash(adminPassword, saltRounds);

  console.log(`👤 Creating admin account: ${adminEmail}`);

  const { emailHash: adminEmailHash, encryptedEmail: adminEncryptedEmail } =
    await prepareEmailForStorage(adminEmail);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEncryptedEmail,
      emailHash: adminEmailHash,
      password: adminHashedPassword,
      name: 'Administrator',
      age: await encryptField(25, (value) => value.toString()),
      gender: await encryptField('Other'),
      course: await encryptField('Admin'),
      bio: await encryptField('System Administrator'),
      interests: await encryptField([], (value) => {
        if (!Array.isArray(value) || value.length === 0) return null;
        return JSON.stringify(value);
      }),
      avatarUrl: null,
      verified: true,
      role: 'Admin',
    },
  });

  // Create points entry for admin
  await prisma.userPoints.create({
    data: {
      userId: adminUser.id,
      totalPoints: 0,
    },
  });

  console.log(`✅ Created admin account with email: ${adminEmail}`);
  console.log('⚠️  Please change the admin password in production!');

  // Hash a common password for all seeded users
  const hashedPassword = await bcrypt.hash('catsixseven', saltRounds);
  console.log('🔐 Generated hashed password for seeded users');

  // Sample user data
  const userData = [
    {
      email: 'kira.belle@example.com',
      password: hashedPassword,
      name: 'Kira Belle',
      age: 23,
      gender: 'Female',
      course: 'CSC',
      bio: "Computer Science student who loves coding and gaming. Let's study algorithms together!",
      interests: ['Programming', 'Gaming', 'Tech'],
      avatarUrl:
        'https://images.unsplash.com/photo-1721440171951-26505bbe23cb?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
      verified: false,
    },
    {
      email: 'aqua.nova@example.com',
      password: hashedPassword,
      name: 'Aqua Nova',
      age: 21,
      gender: 'Female',
      course: 'EEE',
      bio: "Electrical Engineering student passionate about robotics and innovation. Let's build something amazing!",
      interests: ['Electronics', 'Robotics', 'Innovation'],
      avatarUrl:
        'https://images.unsplash.com/photo-1663035309414-07fe9174d7d6?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1936',
      verified: true,
    },
    {
      email: 'star.lumi@example.com',
      password: hashedPassword,
      name: 'Star Lumi',
      age: 22,
      gender: 'Female',
      course: 'CDM',
      bio: 'Communication and Digital Media student. Love creating content and exploring new media trends.',
      interests: ['Design', 'Media', 'Creativity'],
      avatarUrl:
        'https://images.unsplash.com/photo-1758207575528-6b80f80f4408?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
      verified: true,
    },
    {
      email: 'miko.chan@example.com',
      password: hashedPassword,
      name: 'Miko-chan',
      age: 20,
      gender: 'Female',
      course: 'NUR',
      bio: "Nursing student dedicated to helping others. Let's study healthcare together and make a difference!",
      interests: ['Healthcare', 'Wellness', 'Community'],
      avatarUrl:
        'https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1170',
      verified: true,
    },
    {
      email: 'airi.sky@example.com',
      password: hashedPassword,
      name: 'Airi Sky',
      age: 24,
      gender: 'Female',
      course: 'MEC',
      bio: "Mechanical Engineering student who loves solving complex problems. Let's tackle challenging projects together!",
      interests: ['Engineering', 'Innovation', 'Problem Solving'],
      avatarUrl:
        'https://images.unsplash.com/photo-1727409048076-182d2907a59e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=987',
      verified: true,
    },
    {
      email: 'neko.mika@example.com',
      password: hashedPassword,
      name: 'Neko Mika',
      age: 19,
      gender: 'Female',
      course: 'PHT',
      bio: "Physiotherapy student passionate about movement and wellness. Let's study anatomy and help people recover!",
      interests: ['Health', 'Fitness', 'Wellness'],
      avatarUrl:
        'https://images.unsplash.com/photo-1693240531477-bc6525187514?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
      verified: true,
    },
  ];

  // Prepare emails and user fields for storage (encrypt and hash)
  console.log('🔒 Encrypting emails and user fields...');
  const usersWithEncryptedData = await Promise.all(
    userData.map(async (user) => {
      const { emailHash, encryptedEmail } = await prepareEmailForStorage(user.email);
      const [encryptedAge, encryptedGender, encryptedCourse, encryptedBio, encryptedInterests] =
        await Promise.all([
          encryptField(user.age, (value) => value.toString()),
          encryptField(user.gender),
          encryptField(user.course || null),
          encryptField(user.bio || null),
          encryptField(user.interests || [], (value) => {
            if (!Array.isArray(value) || value.length === 0) return null;
            return JSON.stringify(value);
          }),
        ]);
      return {
        ...user,
        email: encryptedEmail,
        emailHash: emailHash,
        age: encryptedAge,
        gender: encryptedGender,
        course: encryptedCourse,
        bio: encryptedBio,
        interests: encryptedInterests,
      };
    })
  );

  // Create sample users
  const users = await prisma.user.createMany({
    data: usersWithEncryptedData,
  });

  console.log(`✅ Created ${users.count} users`);
  console.log('🔑 All seeded users have password: "catsixseven"');
  console.log('✅ All seeded users are verified');

  // Get newly created users (exclude admin who already has points) to create points entries
  const newUsers = await prisma.user.findMany({
    where: {
      role: 'User', // Only get non-admin users
    },
    select: { id: true },
  });

  // Create points entries for each new user
  const pointsEntries = await Promise.all(
    newUsers.map((user) =>
      prisma.userPoints.create({
        data: {
          userId: user.id,
          totalPoints: 0,
        },
      })
    )
  );

  console.log(`✅ Created ${pointsEntries.length} user points entries`);
  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
