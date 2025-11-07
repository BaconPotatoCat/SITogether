/**
 * Centralized configuration for frontend environment variables
 * Validates required variables and provides a single source of truth
 */

const isTest = process.env.NODE_ENV === 'test'

// In test mode, provide defaults for missing variables by mutating process.env
// This mirrors the backend `lib/config.js` pattern so tests can set or rely on
// defaults without components reading process.env directly.
if (isTest) {
  process.env.NEXT_PUBLIC_BACKEND_INTERNALURL =
    process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || 'http://localhost:5000'
  process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL =
    process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL || 'http://localhost:3000'
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY =
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 'test-site-key-123'
}

export const config = {
  // Backend API URL (internal URL for server-to-server communication)
  backendInternalUrl: process.env.NEXT_PUBLIC_BACKEND_INTERNALURL,

  // Frontend URL (external URL for client-side)
  frontendExternalUrl: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL,

  // reCAPTCHA Configuration
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Validation helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: isTest,
} as const
