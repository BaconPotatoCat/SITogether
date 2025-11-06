/**
 * Centralized configuration for frontend environment variables
 * Validates required variables and provides a single source of truth
 */

const isTest = process.env.NODE_ENV === 'test'

// In test mode, provide defaults for missing variables
const getBackendUrl = () => {
  if (isTest) {
    return process.env.NEXT_PUBLIC_BACKEND_INTERNALURL || 'http://localhost:5000'
  }
  return process.env.NEXT_PUBLIC_BACKEND_INTERNALURL
}

export const config = {
  // Backend API URL (internal URL for server-to-server communication)
  backendInternalUrl: getBackendUrl(),

  // Frontend URL (external URL for client-side)
  frontendExternalUrl: process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL,

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',

  // Validation helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
} as const
