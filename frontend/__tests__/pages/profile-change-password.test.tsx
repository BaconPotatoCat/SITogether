import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('MyProfilePage - Change Password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  it('should display Change Password button in menu', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      expect(menuButton).toBeInTheDocument()
    })
  })

  it('should navigate to change password view when Change Password button is clicked', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      expect(menuButton).toBeInTheDocument()
    })

    const buttons = screen.getAllByText('Change Password')
    const changePasswordButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
    if (changePasswordButton) {
      fireEvent.click(changePasswordButton)
    }

    await waitFor(() => {
      // Check for the header (h2 element) instead of button
      expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument()
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })
  })

  it('should display all password input fields', async () => {
    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      expect(menuButton).toBeInTheDocument()
    })

    const buttons = screen.getAllByText('Change Password')
    const changePasswordButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
    if (changePasswordButton) {
      fireEvent.click(changePasswordButton)
    }

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
      expect(screen.getByLabelText('New Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument()
    })
  })

  it('should disable submit button when fields are empty', async () => {
    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Button should be disabled when fields are empty
    const submitButton = screen.getByRole('button', { name: /change password/i })
    expect(submitButton).toBeDisabled()
  })

  it('should show validation error when submitting with empty field', async () => {
    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Fill only two fields (leaving one empty)
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')

    fireEvent.change(currentPasswordInput, { target: { value: 'test123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'test123' } })
    // Leave confirm password empty

    // Button should still be disabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).toBeDisabled()
    })
  })

  it('should show validation error when new password is too short', async () => {
    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPasswordInput, { target: { value: '12345' } }) // Too short
    fireEvent.change(confirmPasswordInput, { target: { value: '12345' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'New password must be at least 6 characters long',
        'error'
      )
    })
  })

  it('should show validation error when passwords do not match', async () => {
    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpass' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'New password and confirm password do not match',
        'error'
      )
    })
  })

  it('should show validation error when new password is same as current', async () => {
    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'samepass123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'samepass123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'samepass123' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'New password must be different from current password',
        'error'
      )
    })
  })

  it('should successfully change password', async () => {
    ;(fetchWithAuth as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Password changed successfully',
      }),
    })

    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/auth/change-password',
        {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'oldpass123',
            newPassword: 'newpass123',
          }),
        },
        false // redirectOn401: false
      )
      expect(mockShowToast).toHaveBeenCalledWith('Password changed successfully!', 'success')
    })
  })

  it('should handle incorrect current password error', async () => {
    ;(fetchWithAuth as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: 'Current password is incorrect',
      }),
    })

    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      const currentPasswordInput = screen.getByLabelText('Current Password')
      const newPasswordInput = screen.getByLabelText('New Password')
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

      fireEvent.change(currentPasswordInput, { target: { value: 'wrongpass' } })
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Current password is incorrect', 'error')
    })
  })

  it('should handle server error gracefully', async () => {
    ;(fetchWithAuth as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Internal server error',
      }),
    })

    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'An error occurred. Please try again later.',
        'error'
      )
    })
  })

  it('should return to menu view after successful password change', async () => {
    ;(fetchWithAuth as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Password changed successfully',
      }),
    })

    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      // Should return to menu view
      expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument()
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })
  })

  it('should disable submit button when loading', async () => {
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

    render(<MyProfilePage />)

    // Navigate to change password view
    await waitFor(() => {
      const buttons = screen.getAllByText('Change Password')
      const menuButton = buttons.find((btn) => btn.closest('.profile-menu-item'))
      if (menuButton) fireEvent.click(menuButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Current Password')).toBeInTheDocument()
    })

    // Get inputs after they're rendered
    const currentPasswordInput = screen.getByLabelText('Current Password')
    const newPasswordInput = screen.getByLabelText('New Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password')

    // Fill the form
    fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } })
    fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })

    // Wait for button to be enabled
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /change password/i })
      expect(submitButton).not.toBeDisabled()
    })

    const submitButton = screen.getByRole('button', { name: /change password/i })
    fireEvent.click(submitButton)

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText(/changing password/i)).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })
})
