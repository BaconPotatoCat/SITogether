import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MyProfilePage from '../../pages/profile/index'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../../hooks/useToast'

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useSession: jest.fn(),
}))

// Mock ThemeContext
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(),
}))

// Mock useToast hook
jest.mock('../../hooks/useToast', () => ({
  useToast: jest.fn(),
}))

// Mock ToastContainer
jest.mock('../../components/ToastContainer', () => {
  return function ToastContainer() {
    return null
  }
})

// Mock LoadingSpinner
jest.mock('../../components/LoadingSpinner', () => {
  return function LoadingSpinner({ message }: { message: string }) {
    return <div data-testid="loading-spinner">{message}</div>
  }
})

const mockSignOut = jest.fn()
const mockRefreshSession = jest.fn()
const mockToggleDarkMode = jest.fn()
const mockShowToast = jest.fn()
const mockRemoveToast = jest.fn()

describe('MyProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useTheme as jest.Mock).mockReturnValue({
      isDarkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    })
    ;(useToast as jest.Mock).mockReturnValue({
      toasts: [],
      showToast: mockShowToast,
      removeToast: mockRemoveToast,
    })
  })

  describe('Authentication', () => {
    it('should return null when user is not authenticated', () => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: null,
        status: 'unauthenticated',
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
      })

      const { container } = render(<MyProfilePage />)

      // Component should render nothing (middleware will handle redirect)
      expect(container.firstChild).toBeNull()
    })

    it('should show loading spinner while checking authentication', () => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: null,
        status: 'loading',
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
      })

      render(<MyProfilePage />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading your profile...')).toBeInTheDocument()
    })
  })

  describe('Profile Display', () => {
    beforeEach(() => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            age: 25,
            gender: 'Male',
            role: 'User',
            course: 'Computer Science',
            bio: 'Software developer',
            interests: ['Coding', 'Gaming'],
            avatarUrl: 'https://example.com/avatar.jpg',
            verified: true,
          },
        },
        status: 'authenticated',
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
      })

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {},
            }),
        })
      ) as unknown as jest.Mock
    })

    it('should display user profile information', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })
    })

    it('should display Edit Profile button', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument()
      })
    })

    it('should display Dark Mode toggle', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Dark Mode')).toBeInTheDocument()
      })
    })

    it('should display Logout button', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })
    })
  })

  describe('Dark Mode Toggle', () => {
    beforeEach(() => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
        status: 'authenticated',
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
      })

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: 'user-123',
                name: 'Test User',
                age: 25,
                interests: [],
              },
            }),
        })
      ) as unknown as jest.Mock
    })

    it('should toggle dark mode when clicked', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Dark Mode')).toBeInTheDocument()
      })

      const toggle = screen.getByRole('checkbox')
      fireEvent.click(toggle)

      expect(mockToggleDarkMode).toHaveBeenCalled()
    })
  })

  describe('Logout', () => {
    beforeEach(() => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
        status: 'authenticated',
        signOut: mockSignOut,
        refreshSession: mockRefreshSession,
      })

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: 'user-123',
                name: 'Test User',
                age: 25,
                interests: [],
              },
            }),
        })
      ) as unknown as jest.Mock
    })

    it('should call signOut when logout button is clicked', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })

      const logoutButton = screen.getByText('Logout')
      fireEvent.click(logoutButton)

      expect(mockSignOut).toHaveBeenCalled()
    })
  })
})
