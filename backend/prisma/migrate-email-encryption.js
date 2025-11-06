/**
 * Complete migration script for email encryption
 * This script handles:
 * 1. Dropping the unique constraint on email
 * 2. Adding emailHash column
 * 3. Populating emailHash for existing users
 * 4. Adding unique constraint on emailHash
 */

const { PrismaClient } = require('@prisma/client');
const { hashEmail, encryptEmail, decryptEmail } = require('../utils/emailEncryption');

const prisma = new PrismaClient();

async function migrateEmailEncryption() {
  console.log('🔄 Starting email encryption migration...');

  try {
    // Step 1: Check if emailHash column already exists
    const checkColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email_hash'
    `;

    if (checkColumn.length === 0) {
      console.log('📝 Step 1: Adding email_hash column...');
      
      // Add email_hash column
      await prisma.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_hash VARCHAR(255)
      `;
      
      console.log('✅ email_hash column added');
    } else {
      console.log('✅ email_hash column already exists');
    }

    // Step 2: Drop unique constraint on email if it exists
    console.log('📝 Step 2: Dropping unique constraint on email...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE users 
        DROP CONSTRAINT IF EXISTS users_email_key
      `;
      console.log('✅ Unique constraint on email dropped');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('✅ Unique constraint on email already removed');
      } else {
        throw error;
      }
    }

    // Step 3: Migrate existing users
    console.log('📝 Step 3: Migrating existing users...');
    // Use raw SQL to find users with null emailHash (Prisma doesn't support null in where clauses)
    const users = await prisma.$queryRaw`
      SELECT id, email 
      FROM users 
      WHERE email_hash IS NULL
    `;

    console.log(`📊 Found ${users.length} users to migrate`);

    if (users.length > 0) {
      for (const user of users) {
        try {
          // Determine if email is already encrypted or plaintext
          let plaintextEmail;
          
          try {
            // Try to decrypt - if it fails, assume it's plaintext
            plaintextEmail = await decryptEmail(user.email);
          } catch (error) {
            // If decryption fails, assume email is plaintext
            plaintextEmail = user.email;
          }

          // Hash the email for lookup
          const emailHash = hashEmail(plaintextEmail);
          
          // Encrypt the email for storage
          const encryptedEmail = await encryptEmail(plaintextEmail);

          // Update the user
          await prisma.user.update({
            where: { id: user.id },
            data: {
              email: encryptedEmail,
              emailHash: emailHash,
            },
          });

          console.log(`✅ Migrated user ${user.id}`);
        } catch (error) {
          console.error(`❌ Error migrating user ${user.id}:`, error.message);
          // Continue with other users
        }
      }
    } else {
      console.log('✅ No users to migrate');
    }

    // Step 4: Check for duplicate emailHash values before adding constraint
    console.log('📝 Step 4: Checking for duplicate emailHash values...');
    const duplicates = await prisma.$queryRaw`
      SELECT email_hash, COUNT(*) as count
      FROM users
      WHERE email_hash IS NOT NULL
      GROUP BY email_hash
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.error('❌ Cannot add unique constraint: duplicate emailHash values found:');
      console.error(duplicates);
      throw new Error('Duplicate emailHash values found');
    }

    // Check if any users still have null emailHash
    const usersWithNullHashResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM users
      WHERE email_hash IS NULL
    `;
    const usersWithNullHash = Number(usersWithNullHashResult[0].count);

    if (usersWithNullHash > 0) {
      console.warn(`⚠️  Warning: ${usersWithNullHash} users still have null emailHash`);
      console.warn('Skipping unique constraint addition');
    } else {
      // Step 5: Add unique constraint on emailHash
      console.log('📝 Step 5: Adding unique constraint on email_hash...');
      try {
        await prisma.$executeRaw`
          CREATE UNIQUE INDEX IF NOT EXISTS users_email_hash_key 
          ON users(email_hash)
        `;
        console.log('✅ Unique constraint on email_hash added');
      } catch (error) {
        if (error.message.includes('already exists') || error.code === '42P07') {
          console.log('✅ Unique constraint on email_hash already exists');
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateEmailEncryption()
  .then(() => {
    console.log('🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });

