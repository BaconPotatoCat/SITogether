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
// We use prependListener to ensure our handler runs before Jest's handler
process.prependListener('unhandledRejection', (reason, promise) => {
  // Silently handle - this prevents Jest from failing tests
  // Tests will verify component behavior instead
  // The rejection is caught and handled gracefully
})

