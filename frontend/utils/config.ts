/**
 * Centralized configuration for frontend environment variables
 * Validates required variables and provides a single source of truth
 */

const requiredEnvVars: string[] = ['NEXT_PUBLIC_BACKEND_INTERNALURL']

// Validate required environment variables (only in server-side code)
if (typeof window === 'undefined') {
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:')
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`)
    })
    console.error('\nPlease set these variables in your .env file.')
    // In production, we might want to exit, but in development we'll just warn
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }
}

export const config = {
  // Backend API URL
  backendInternalUrl: process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || '',

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Validation helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const
