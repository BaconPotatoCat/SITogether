/**
 * Centralized configuration for frontend environment variables
 * Validates required variables and provides a single source of truth
 */

const isTest = process.env.NODE_ENV === 'test'

const requiredEnvVars: string[] = ['NEXT_PUBLIC_BACKEND_INTERNALURL']

// Validate required environment variables (only in server-side code)
// Skip validation in test mode
if (typeof window === 'undefined' && !isTest) {
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:')
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`)
    })
    console.error('\nPlease set these variables in your .env file.')
    // In production, exit; in development, just warn
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }
}

// In test mode, provide defaults for missing variables
if (isTest) {
  process.env.NEXT_PUBLIC_BACKEND_INTERNALURL =
    process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || 'http://localhost:5000'
}

export const config = {
  // Backend API URL (internal URL for server-to-server communication)
  backendInternalUrl: process.env.NEXT_PUBLIC_BACKEND_INTERNALURL,

  // Frontend URL (external URL for client-side)
  frontendExternalUrl: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL,

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Validation helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
} as const
