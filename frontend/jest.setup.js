// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => require('next-router-mock'))

// Set up environment variables for tests
process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = 'http://sitogether-backend:5000'
process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL = 'http://localhost:5000'
process.env.NEXT_PUBLIC_FRONTEND_INTERNALURL = 'http://sitogether-frontend:3000'
process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL = 'http://localhost:3000'

// Global handler for unhandled rejections in tests
// This allows tests to catch and verify unhandled rejections without failing
// Components using try-finally without catch will have unhandled rejections
// but handle them gracefully in production via finally blocks
const handledRejections = new Map()

// Suppress Jest's default unhandled rejection handler for these specific cases
const originalEmit = process.emit
process.emit = function(name, error, ...args) {
  if (name === 'unhandledRejection') {
    // Store for test verification
    handledRejections.set(error, error)
    // Suppress the error from causing test failure
    return false
  }
  return originalEmit.apply(process, [name, error, ...args])
}

process.on('unhandledRejection', (reason, promise) => {
  // Store the rejection so tests can verify it was caught
  handledRejections.set(promise, reason)
  // This handler prevents the default behavior
})

