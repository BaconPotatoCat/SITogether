import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import MyProfilePage from '../../pages/profile/index'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../../hooks/useToast'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

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

const mockPush = jest.fn()
const mockSignOut = jest.fn()
const mockToggleDarkMode = jest.fn()
const mockShowToast = jest.fn()
const mockRemoveToast = jest.fn()

describe('MyProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      isReady: true,
      query: {},
    })
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
    it('should redirect to login if user is not authenticated', () => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: null,
        status: 'unauthenticated',
        signOut: mockSignOut,
      })

      render(<MyProfilePage />)

      expect(mockPush).toHaveBeenCalledWith('/auth')
    })

    it('should show loading spinner while checking authentication', () => {
      ;(useSession as jest.Mock).mockReturnValue({
        session: null,
        status: 'loading',
        signOut: mockSignOut,
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
          },
        },
        status: 'authenticated',
        signOut: mockSignOut,
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

  describe('Error Handling', () => {
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
      })
    })

    it('should display error message when profile fetch fails', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              success: false,
              error: 'Failed to fetch profile',
            }),
        })
      ) as unknown as jest.Mock

      render(<MyProfilePage />)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Failed to fetch profile', 'error')
      })
    })
  })
})
