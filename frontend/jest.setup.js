// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => require('next-router-mock'))

// Mock Next.js Head component
jest.mock('next/head', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ children }) => {
      // Extract title from children and set document.title
      React.useEffect(() => {
        const childrenArray = React.Children.toArray(children)
        const titleElement = childrenArray.find(
          child => React.isValidElement(child) && child.type === 'title'
        )
        if (titleElement && React.isValidElement(titleElement)) {
          // Handle both string and array children
          const titleContent = Array.isArray(titleElement.props.children)
            ? titleElement.props.children.join('')
            : titleElement.props.children
          document.title = titleContent
        }
      }, [children])
      return null
    },
  }
})

// Set up environment variables for tests
process.env.NEXT_PUBLIC_BACKEND_INTERNALURL = 'http://sitogether-backend:5000'
process.env.NEXT_PUBLIC_BACKEND_EXTERNALURL = 'http://localhost:5000'
process.env.NEXT_PUBLIC_FRONTEND_INTERNALURL = 'http://sitogether-frontend:3000'
process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL = 'http://localhost:3000'

