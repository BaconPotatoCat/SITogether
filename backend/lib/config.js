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
// Critical vars (JWT_SECRET, DATABASE_URL) must be present
// Email vars can be missing and will fail gracefully when used
const criticalVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingCriticalVars = criticalVars.filter((varName) => !process.env[varName]);
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingCriticalVars.length > 0 && !isTest) {
  console.error('❌ Missing critical environment variables:');
  missingCriticalVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables in your .env file or Docker environment.');
  process.exit(1);
}

// Warn about missing non-critical vars (email, frontend URL)
const missingNonCriticalVars = missingVars.filter((varName) => !criticalVars.includes(varName));
if (missingNonCriticalVars.length > 0 && !isTest) {
  console.warn('⚠️  Missing optional environment variables (some features may not work):');
  missingNonCriticalVars.forEach((varName) => {
    console.warn(`   - ${varName}`);
  });
  console.warn(
    '\nEmail features will fail when used. Frontend URL defaults to http://localhost:3000'
  );
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
    externalUrl: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL || 'http://localhost:3000',
  },

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY,

  // Validation helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

module.exports = config;
