// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => require('next-router-mock'))

// Set up environment variables for tests
process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = 'http://sitogether-backend:5000'
process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL = 'http://localhost:5000'
process.env.NEXT_PUBLIC_FRONTEND_INTERNALURL = 'http://sitogether-frontend:3000'
process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL = 'http://localhost:3000'

