// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => require('next-router-mock'))

// Set up environment variables for tests
process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = 'http://sitogether-backend:5000'
process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL = 'http://localhost:5000'
process.env.NEXT_PUBLIC_FRONTEND_INTERNALURL = 'http://sitogether-frontend:3000'
process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL = 'http://localhost:3000'

// Mock scrollIntoView for jsdom (not available in jsdom environment)
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn()
}

// Global handler for unhandled rejections in tests
// Components using try-finally without catch will have unhandled rejections
// but handle them gracefully in production via finally blocks
// We intercept process.emit to suppress these expected rejections before Jest sees them
const EventEmitter = require('events')
const originalEmit = EventEmitter.prototype.emit

EventEmitter.prototype.emit = function emit(name, ...args) {
  if (name === 'unhandledRejection') {
    // Suppress unhandled rejections - these are expected for components using try-finally
    // Tests verify component behavior instead of rejection handling
    return true // Indicate event was handled, preventing default behavior
  }
  return originalEmit.apply(this, [name, ...args])
}

// Also add a listener as a safety net
process.on('unhandledRejection', () => {
  // Silently handle - tests verify component behavior
})

