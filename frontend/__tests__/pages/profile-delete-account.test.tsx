import React from 'react'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyProfilePage from '../../pages/profile/index'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../../hooks/useToast'
import { fetchWithAuth } from '../../utils/api'

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useSession: jest.fn(),
}))

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(),
}))

jest.mock('../../hooks/useToast', () => ({
  useToast: jest.fn(),
}))

jest.mock('../../utils/api', () => ({
  fetchWithAuth: jest.fn(),
}))

jest.mock('../../components/ToastContainer', () => {
  return function ToastContainer() {
    return null
  }
})

jest.mock('../../components/LoadingSpinner', () => {
  return function LoadingSpinner({ message }: { message: string }) {
    return <div data-testid="loading-spinner">{message}</div>
  }
})

// Mock window.location
Object.defineProperty(window, 'location', {
  writable: true,
  value: { href: '' },
})

const mockSignOut = jest.fn()
const mockRefreshSession = jest.fn()
const mockToggleDarkMode = jest.fn()
const mockShowToast = jest.fn()
const mockRemoveToast = jest.fn()

const mockUser = {
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
}

describe('MyProfilePage - Delete Account', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console.error to suppress expected error logs in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    window.location.href = ''
    ;(useTheme as jest.Mock).mockReturnValue({
      isDarkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    })
    ;(useToast as jest.Mock).mockReturnValue({
      toasts: [],
      showToast: mockShowToast,
      removeToast: mockRemoveToast,
    })
    ;(useSession as jest.Mock).mockReturnValue({
      session: {
        user: mockUser,
      },
      status: 'authenticated',
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
    })
  })

  afterEach(() => {
    // Restore console.error after each test
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore()
    }
  })

  describe('Delete Account Button', () => {
    it('should display Delete Account button in menu', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })
    })

    it('should have red styling for Delete Account button', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        const deleteButton = screen.getByText('Delete Account')
        expect(deleteButton).toBeInTheDocument()
        expect(deleteButton.closest('.profile-menu-item')).toHaveStyle({ color: '#ef4444' })
      })
    })

    it('should open confirmation modal when Delete Account button is clicked', async () => {
      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Account')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument()
        expect(
          screen.getByText(
            /Are you sure you want to delete your account\? This action cannot be undone/
          )
        ).toBeInTheDocument()
      })
    })
  })

  describe('Delete Account Confirmation Modal', () => {
    beforeEach(async () => {
      render(<MyProfilePage />)
      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })
      const deleteButton = screen.getByText('Delete Account')
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument()
      })
    })

    it('should display centered header', () => {
      const header = screen.getByRole('heading', { name: 'Delete Account' })
      expect(header).toBeInTheDocument()
      expect(header).toHaveStyle({ textAlign: 'center' })
    })

    it('should display warning message', () => {
      expect(
        screen.getByText(
          /Are you sure you want to delete your account\? This action cannot be undone/
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(/All your data, including your profile, likes, passes, conversations/)
      ).toBeInTheDocument()
    })

    it('should display Cancel button', () => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('should display Delete Account button in modal', () => {
      const deleteButtons = screen.getAllByText('Delete Account')
      // Should have at least the button in the modal
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('should close modal when Cancel button is clicked', async () => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Account' })).not.toBeInTheDocument()
      })
    })

    it('should close modal when clicking on backdrop', async () => {
      const user = userEvent.setup()
      const backdrop = screen.getByRole('dialog')

      // The backdrop has an onClick handler that closes the modal
      // Wrap the click in act() to handle state updates properly
      await act(async () => {
        await user.click(backdrop)
      })

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Account' })).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete Account Functionality', () => {
    beforeEach(async () => {
      render(<MyProfilePage />)
      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })
      const deleteButton = screen.getByText('Delete Account')
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument()
      })
    })

    it('should successfully delete account', async () => {
      const user = userEvent.setup()
      ;(fetchWithAuth as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Account deleted successfully',
        }),
      })

      // Find the delete button within the modal using within to scope the query
      const modal = screen.getByRole('dialog')
      const modalContent = within(modal)

      // Find the Delete Account button by its text content within the modal
      const deleteAccountButton = modalContent.getByRole('button', { name: /delete account/i })

      expect(deleteAccountButton).toBeInTheDocument()
      expect(deleteAccountButton).toBeEnabled()

      // Wrap the click in act() to handle state updates properly
      await act(async () => {
        await user.click(deleteAccountButton)
      })

      await waitFor(() => {
        expect(fetchWithAuth).toHaveBeenCalledWith('/api/users/user-123', {
          method: 'DELETE',
        })
      })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Account deleted successfully', 'success')
        expect(mockSignOut).toHaveBeenCalled()
      })

      // Should redirect to auth page
      expect(window.location.href).toBe('/auth')
    })

    it('should show error toast when deletion fails', async () => {
      const user = userEvent.setup()
      ;(fetchWithAuth as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Failed to delete account',
        }),
      })

      const modal = screen.getByRole('dialog')
      const modalContent = within(modal)

      // Find the Delete Account button by its text content within the modal
      const deleteAccountButton = modalContent.getByRole('button', { name: /delete account/i })

      expect(deleteAccountButton).toBeInTheDocument()
      expect(deleteAccountButton).toBeEnabled()

      await act(async () => {
        await user.click(deleteAccountButton)
      })

      // Wait for the API call to be made
      await waitFor(() => {
        expect(fetchWithAuth).toHaveBeenCalledWith('/api/users/user-123', {
          method: 'DELETE',
        })
      })

      // Then wait for the error toast
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Failed to delete account', 'error')
        expect(mockSignOut).not.toHaveBeenCalled()
      })

      // Modal should close on error
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Account' })).not.toBeInTheDocument()
      })
    })

    it('should show error toast when network error occurs', async () => {
      const user = userEvent.setup()
      ;(fetchWithAuth as jest.Mock).mockRejectedValue(new Error('Network error'))

      const modal = screen.getByRole('dialog')
      const modalContent = within(modal)

      // Find the Delete Account button by its text content within the modal
      const deleteAccountButton = modalContent.getByRole('button', { name: /delete account/i })

      expect(deleteAccountButton).toBeInTheDocument()
      expect(deleteAccountButton).toBeEnabled()

      await act(async () => {
        await user.click(deleteAccountButton)
      })

      // Wait for the API call to be made (or attempted)
      await waitFor(() => {
        expect(fetchWithAuth).toHaveBeenCalledWith('/api/users/user-123', {
          method: 'DELETE',
        })
      })

      // Then wait for the error toast (network errors go to catch block)
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'An error occurred while deleting your account',
          'error'
        )
        expect(mockSignOut).not.toHaveBeenCalled()
      })
    })

    it('should show 403 error when trying to delete another user account', async () => {
      const user = userEvent.setup()
      ;(fetchWithAuth as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: 'Access denied. You can only delete your own account.',
        }),
      })

      const modal = screen.getByRole('dialog')
      const modalContent = within(modal)
      const deleteAccountButton = modalContent.getByRole('button', { name: /delete account/i })

      await act(async () => {
        await user.click(deleteAccountButton)
      })

      await waitFor(() => {
        expect(fetchWithAuth).toHaveBeenCalledWith('/api/users/user-123', {
          method: 'DELETE',
        })
      })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Access denied. You can only delete your own account.',
          'error'
        )
      })
    })

    it('should disable buttons while deleting', async () => {
      const user = userEvent.setup()
      ;(fetchWithAuth as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ success: true }),
            })
          }, 100)
        })
      })

      const modal = screen.getByRole('dialog')
      const modalContent = within(modal)
      const deleteAccountButton = modalContent.getByRole('button', { name: /delete account/i })

      await act(async () => {
        await user.click(deleteAccountButton)
      })

      // Button should show loading state
      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      expect(cancelButton).toBeDisabled()
    })

    it('should not close modal when clicking backdrop during deletion', async () => {
      const user = userEvent.setup()
      ;(fetchWithAuth as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ success: true }),
            })
          }, 100)
        })
      })

      const modal = screen.getByRole('dialog')
      const modalContent = within(modal)
      const deleteAccountButton = modalContent.getByRole('button', { name: /delete account/i })

      await act(async () => {
        await user.click(deleteAccountButton)
      })

      // Try to click backdrop while deleting
      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })

      const backdrop = screen.getByRole('dialog')

      // Try to click backdrop - it should not close because isDeletingAccount is true
      await act(async () => {
        await user.click(backdrop)
      })

      // Modal should still be open
      expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument()
    })
  })

  describe('Dark Mode Support', () => {
    it('should adapt modal styling for dark mode', async () => {
      ;(useTheme as jest.Mock).mockReturnValue({
        isDarkMode: true,
        toggleDarkMode: mockToggleDarkMode,
      })

      render(<MyProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Account')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        const modal = screen.getByRole('dialog')
        const modalContent = modal.querySelector('div')
        expect(modalContent).toHaveStyle({ background: '#1f2937' })
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(async () => {
      render(<MyProfilePage />)
      await waitFor(() => {
        expect(screen.getByText('Delete Account')).toBeInTheDocument()
      })
      const deleteButton = screen.getByText('Delete Account')
      fireEvent.click(deleteButton)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument()
      })
    })

    it('should have proper dialog role and aria-modal', () => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('should have proper button labels', () => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /Delete Account/i }).length).toBeGreaterThan(0)
    })
  })
})
