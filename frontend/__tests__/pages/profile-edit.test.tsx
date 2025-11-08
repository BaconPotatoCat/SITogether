import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MyProfilePage from '../../pages/profile/index'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useToast } from '../../hooks/useToast'
import { fetchWithAuth } from '../../utils/api'

jest.mock('../../contexts/AuthContext', () => ({
  useSession: jest.fn(),
}))

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(),
}))

jest.mock('../../hooks/useToast', () => ({
  useToast: jest.fn(),
}))

jest.mock('../../utils/api')
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>

jest.mock('../../components/ToastContainer', () => {
  return function ToastContainer() {
    return null
  }
})

jest.mock('../../components/LoadingSpinner', () => {
  return function LoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>
  }
})

const mockSignOut = jest.fn()
const mockRefreshSession = jest.fn()
const mockShowToast = jest.fn()
const mockRemoveToast = jest.fn()

const mockUserData = {
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

describe('Profile Edit Feature', () => {
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console.warn and console.error during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(useTheme as jest.Mock).mockReturnValue({
      isDarkMode: false,
      toggleDarkMode: jest.fn(),
    })
    ;(useToast as jest.Mock).mockReturnValue({
      toasts: [],
      showToast: mockShowToast,
      removeToast: mockRemoveToast,
    })
    ;(useSession as jest.Mock).mockReturnValue({
      session: {
        user: mockUserData,
      },
      status: 'authenticated',
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
    })

    // Mock fetchWithAuth instead of global.fetch
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockUserData,
      }),
    } as Response)
  })

  afterEach(() => {
    // Restore console methods after each test
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should switch to edit mode when Edit Profile button is clicked', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    const editButton = screen.getByText('Edit Profile')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
      expect(screen.getByDisplayValue('25')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g., Computer Science')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Tell us about yourself...')).toBeInTheDocument()
    })
  })

  it('should populate form fields with current user data', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Test User') as HTMLInputElement
      const ageInput = screen.getByDisplayValue('25') as HTMLInputElement
      const courseInput = screen.getByDisplayValue('Computer Science') as HTMLInputElement

      expect(nameInput.value).toBe('Test User')
      expect(ageInput.value).toBe('25')
      expect(courseInput.value).toBe('Computer Science')
    })
  })

  it('should update form fields when user types', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test User') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

    expect(nameInput.value).toBe('Updated Name')
  })

  it('should save profile changes when Save Changes button is clicked', async () => {
    // Mock fetchWithAuth for this test - no initial fetch needed
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { ...mockUserData, name: 'Updated Name' },
      }),
    } as Response)

    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test User')
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/users/user-123',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('Updated Name'),
        })
      )
    })
  })

  it('should display success message after successful save', async () => {
    const updatedUserData = { ...mockUserData, name: 'Updated Name' }
    let currentSession = { user: mockUserData }

    // Mock refreshSession to update the session
    const mockRefreshSessionLocal = jest.fn().mockImplementation(() => {
      currentSession = { user: updatedUserData }
      ;(useSession as jest.Mock).mockReturnValue({
        session: currentSession,
        status: 'authenticated',
        signOut: mockSignOut,
        refreshSession: mockRefreshSessionLocal,
      })
    })

    ;(useSession as jest.Mock).mockReturnValue({
      session: currentSession,
      status: 'authenticated',
      signOut: mockSignOut,
      refreshSession: mockRefreshSessionLocal,
    })

    // Mock fetchWithAuth for this test
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: updatedUserData,
      }),
    } as Response)

    const { rerender } = render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Profile updated successfully!', 'success')
    })

    // Rerender with updated session
    rerender(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Updated Name')).toBeInTheDocument()
    })
  })

  it('should cancel edit mode when Cancel button is clicked', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })

    // Click the back button to cancel
    const backButton = screen.getByRole('button', { name: '' })
    fireEvent.click(backButton)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })
  })

  it('should display error message when save fails', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Failed to update profile',
      }),
    } as Response)

    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to update profile', 'error')
    })
  })

  it('should validate required fields', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit Profile'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test User')
    fireEvent.change(nameInput, { target: { value: '' } })

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes') as HTMLButtonElement
      expect(saveButton.disabled).toBe(true)
    })
  })
})
