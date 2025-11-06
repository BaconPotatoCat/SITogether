require('dotenv').config();

/**
 * Centralized configuration for backend environment variables
 * Validates required variables and provides a single source of truth
 */

const isTest = process.env.NODE_ENV === 'test';

const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'NEXT_PUBLIC_FRONTEND_EXTERNALURL',
];

// Validate required environment variables (skip in test mode)
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0 && !isTest) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables in your .env file.');
  process.exit(1);
}

// In test mode, provide defaults for missing variables
if (isTest) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
  process.env.EMAIL_USER = process.env.EMAIL_USER || 'test@example.com';
  process.env.EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'test-password';
  process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL =
    process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL || 'http://localhost:3000';
}

const config = {
  // Server configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 0,

  // Authentication
  jwtSecret: process.env.JWT_SECRET,

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Email configuration
  email: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
  },

  // Frontend URLs (for generating email links)
  frontend: {
    externalUrl: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL,
  },

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY,

  // Validation helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

module.exports = config;
