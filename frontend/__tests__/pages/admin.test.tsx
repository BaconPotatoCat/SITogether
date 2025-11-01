import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import AdminPanel from '../../pages/admin'
import { fetchWithAuth } from '../../utils/api'

// Mock next/router
const mockPush = jest.fn()
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: '/admin',
  }),
}))

// Mock next/head
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => {
      return <>{children}</>
    },
  }
})

// Mock AuthContext
const mockSession = {
  user: {
    id: 'admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'Admin',
    age: 25,
    gender: 'Male',
  },
  expires: '2024-12-31',
}

const mockUseSession = jest.fn(() => ({
  session: mockSession,
  status: 'authenticated' as const,
})) as jest.MockedFunction<() => {
  session: typeof mockSession | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
}>

jest.mock('../../contexts/AuthContext', () => ({
  useSession: () => mockUseSession(),
}))

// Mock fetchWithAuth
jest.mock('../../utils/api')
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>

// Mock LoadingSpinner
jest.mock('../../components/LoadingSpinner', () => {
  return function LoadingSpinner({ message }: { message?: string }) {
    return <div data-testid="loading-spinner">{message || 'Loading...'}</div>
  }
})

describe('AdminPanel', () => {
  const mockUsers = [
    {
      id: 'user-1',
      email: 'user1@example.com',
      name: 'User One',
      age: 20,
      gender: 'Male',
      role: 'User',
      course: 'Computer Science',
      verified: true,
      banned: false,
      bannedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      _count: { reports: 0 },
    },
    {
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      age: 22,
      gender: 'Female',
      role: 'User',
      course: 'Information Technology',
      verified: true,
      banned: true,
      bannedAt: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      _count: { reports: 2 },
    },
  ]

  const mockReports = [
    {
      id: 'report-1',
      reportedId: 'user-1',
      reportedBy: 'reporter@example.com',
      reason: 'Inappropriate behavior',
      description: 'Test description',
      status: 'Pending',
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
      reportedUser: {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        banned: false,
      },
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
    global.confirm = jest.fn(() => true)
    mockUseSession.mockReturnValue({
      session: mockSession,
      status: 'authenticated' as const,
    })
  })

  describe('User Management Tab', () => {
    it('should render user management tab by default', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockUsers }),
      } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
        expect(screen.getByText('User One')).toBeInTheDocument()
        expect(screen.getByText('User Two')).toBeInTheDocument()
      })
    })

    it('should display user information correctly', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockUsers }),
      } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
        expect(screen.getByText('user2@example.com')).toBeInTheDocument()
      })
    })

    it('should filter users by search term', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockUsers }),
      } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search by name or email...')
      fireEvent.change(searchInput, { target: { value: 'User One' } })

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
        expect(screen.queryByText('User Two')).not.toBeInTheDocument()
      })
    })

    it('should filter users by status', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockUsers }),
      } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
      })

      const filterSelect = screen.getByDisplayValue('All Users')
      fireEvent.change(filterSelect, { target: { value: 'banned' } })

      await waitFor(() => {
        expect(screen.queryByText('User One')).not.toBeInTheDocument()
        expect(screen.getByText('User Two')).toBeInTheDocument()
      })
    })

    it('should ban a user successfully', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            message: 'User banned successfully',
            data: { ...mockUsers[0], banned: true },
          }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
      })

      const banButtons = screen.getAllByText('Ban')
      fireEvent.click(banButtons[0])

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/admin/user-actions', {
          method: 'POST',
          body: JSON.stringify({ userId: 'user-1', action: 'ban' }),
        })
      })
    })

    it('should unban a user successfully', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            message: 'User unbanned successfully',
            data: { ...mockUsers[1], banned: false },
          }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User Two')).toBeInTheDocument()
      })

      const unbanButton = screen.getByText('Unban')
      fireEvent.click(unbanButton)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/admin/user-actions', {
          method: 'POST',
          body: JSON.stringify({ userId: 'user-2', action: 'unban' }),
        })
      })
    })

    it('should send password reset link', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            message: 'Password reset link sent to user1@example.com',
          }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
      })

      const resetButtons = screen.getAllByText('Reset Password')
      fireEvent.click(resetButtons[0])

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/admin/user-actions', {
          method: 'POST',
          body: JSON.stringify({ userId: 'user-1', action: 'reset-password' }),
        })
      })
    })

    it('should display error message when action fails', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            success: false,
            error: 'Failed to ban user',
          }),
        } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
      })

      const banButtons = screen.getAllByText('Ban')
      fireEvent.click(banButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Failed to ban user')).toBeInTheDocument()
      })
    })

    it('should not perform action if user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false)

      mockFetchWithAuth.mockResolvedValueOnce({
        json: async () => ({ success: true, data: mockUsers }),
      } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument()
      })

      const banButtons = screen.getAllByText('Ban')
      fireEvent.click(banButtons[0])

      expect(global.confirm).toHaveBeenCalled()
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(1) // Only initial fetch
    })
  })

  describe('Reported Accounts Tab', () => {
    it('should switch to reports tab and fetch reports', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockReports }),
        } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })

      const reportsTab = screen.getByText('Reported Accounts')
      fireEvent.click(reportsTab)

      await waitFor(() => {
        expect(screen.getByText(/inappropriate behavior/i)).toBeInTheDocument()
      })
    })

    it('should filter reports by status', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockReports }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: [] }),
        } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })

      const reportsTab = screen.getByText('Reported Accounts')
      fireEvent.click(reportsTab)

      await waitFor(() => {
        expect(screen.getByText(/inappropriate behavior/i)).toBeInTheDocument()
      })

      const filterSelect = screen.getByDisplayValue('All Reports')
      fireEvent.change(filterSelect, { target: { value: 'Reviewed' } })

      await waitFor(() => {
        const reportsCalls = mockFetchWithAuth.mock.calls.filter(
          (call) => call[0]?.startsWith('/api/admin/reports')
        )
        expect(reportsCalls.length).toBeGreaterThan(0)
        const lastCall = reportsCalls[reportsCalls.length - 1]
        expect(lastCall[0]).toBe('/api/admin/reports?status=Reviewed')
      })
    })

    it('should display no reports message when empty', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: mockUsers }),
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ success: true, data: [] }),
        } as Response)

      render(<AdminPanel />)

      const reportsTab = screen.getByText('Reported Accounts')
      fireEvent.click(reportsTab)

      await waitFor(() => {
        expect(screen.getByText(/no reports found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Access Control', () => {
    it('should show loading state while authenticating', () => {
      mockUseSession.mockReturnValueOnce({
        session: null,
        status: 'loading' as const,
      })

      render(<AdminPanel />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error when failing to fetch users', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Failed to fetch users',
        }),
      } as Response)

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch users')).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      mockFetchWithAuth.mockRejectedValueOnce(new Error('Network error'))

      render(<AdminPanel />)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })
})


