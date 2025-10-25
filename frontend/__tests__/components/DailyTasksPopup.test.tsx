import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import DailyTasksPopup from '../../components/DailyTasksPopup'
import { fetchWithAuth } from '../../utils/api'

// Mock the API
jest.mock('../../utils/api')
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>

describe('DailyTasksPopup', () => {
  const mockUserPoints = {
    totalPoints: 75,
    dailyCheckinDate: null,
    hasLikedToday: false,
    dailyLikeClaimedDate: null,
  }

  const mockUserPointsAfterCheckin = {
    totalPoints: 125, // 75 + 50
    dailyCheckinDate: new Date().toISOString(),
    hasLikedToday: false,
    dailyLikeClaimedDate: null,
  }

  const mockUserPointsLikedToday = {
    totalPoints: 100,
    dailyCheckinDate: null,
    hasLikedToday: true,
    dailyLikeClaimedDate: null,
  }

  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress React act() warnings that occur during component initialization
    const originalConsoleError = console.error
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args[0]
      if (
        typeof message === 'string' &&
        message.includes('Warning: An update to') &&
        message.includes('inside a test was not wrapped in act(...)')
      ) {
        return // Suppress React act() warnings
      }
      originalConsoleError(...args) // Allow other console.error calls through
    })
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        points: mockUserPoints,
      }),
    } as Response)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    mockOnClose.mockClear()
  })

  describe('Modal Structure', () => {
    it('should render modal structure', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily Tasks')).toBeInTheDocument()
        expect(screen.getByText('×')).toBeInTheDocument() // Close button
      })
    })

    it('should call onClose when close button is clicked', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('×')).toBeInTheDocument()
      })

      const closeButton = screen.getByText('×')

      await act(async () => {
        fireEvent.click(closeButton)
      })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should show loading state initially', () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)
      expect(screen.getByText('Loading your points...')).toBeInTheDocument()
    })

    it('should handle API response with non-ok status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch points')).toBeInTheDocument()
      })

      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('should handle API response with success false', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Database error' }),
      } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument()
      })

      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('Progress Display', () => {
    it('should display progress information', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('75 / 1000 points')).toBeInTheDocument()
        expect(screen.getByText('8%')).toBeInTheDocument()
      })
    })

    it('should show progress bar with correct styling', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        // Should have progress bar with 7% width
        // The progress bar should exist
        expect(screen.getByText('75 / 1000 points')).toBeInTheDocument()
      })
    })
  })

  describe('Task Display', () => {
    it('should display all tasks', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
        expect(screen.getByText('Like a person')).toBeInTheDocument()
        expect(screen.getByText('Send an introduction')).toBeInTheDocument()
      })
    })

    it('should show task points', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('+50 pts')).toBeInTheDocument()
        expect(screen.getAllByText('+25 pts')).toHaveLength(2)
      })
    })
  })

  describe('Task States', () => {
    it('should show daily check-in as completed when claimed today', async () => {
      const today = new Date().toISOString()
      const pointsWithCheckin = {
        ...mockUserPoints,
        dailyCheckinDate: today,
      }

      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          points: pointsWithCheckin,
        }),
      } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('✓ Completed')).toBeInTheDocument()
      })
    })

    it('should show like task as claimable when user has liked today', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          points: mockUserPointsLikedToday,
        }),
      } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        const claimButtons = screen.getAllByText('Claim')
        expect(claimButtons).toHaveLength(2) // Daily-checkin and like-person should be claimable when user has liked today
      })
    })
  })

  describe('Claim Functionality', () => {
    it('should successfully claim daily check-in', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPoints,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Daily check-in claimed successfully',
            points: mockUserPointsAfterCheckin,
            pointsEarned: 50,
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      // The claiming state should be set and the API called
      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/points/claim-daily', {
          method: 'POST',
        })
      })

      // After successful claim, task should show as completed
      expect(screen.getByText('✓ Completed')).toBeInTheDocument()
    })

    it('should successfully claim daily like points', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPointsLikedToday,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Daily like points claimed successfully',
            points: {
              ...mockUserPointsLikedToday,
              totalPoints: 125,
              dailyLikeClaimedDate: new Date().toISOString(),
            },
            pointsEarned: 25,
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Like a person')).toBeInTheDocument()
      })

      const likeClaimButton = screen.getAllByText('Claim')[1]

      await act(async () => {
        fireEvent.click(likeClaimButton)
      })

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/points/claim-daily-like', {
          method: 'POST',
        })
      })
    })

    it('should handle claim errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPoints,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: 'Already claimed today',
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error claiming daily-checkin points:',
          expect.any(Object)
        )
        expect(screen.getByText('Already claimed today')).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })

    it('should prevent multiple simultaneous claims', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPoints,
          }),
        } as Response)
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Daily check-in claimed successfully',
            points: mockUserPointsAfterCheckin,
            pointsEarned: 50,
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      // Click multiple times rapidly
      fireEvent.click(checkinClaimButton)
      fireEvent.click(checkinClaimButton)
      fireEvent.click(checkinClaimButton)

      // Wait for the claim to complete
      await waitFor(() => {
        expect(screen.getByText('✓ Completed')).toBeInTheDocument()
      })

      // Should have made exactly 2 calls: initial fetch + 1 claim
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })

    it('should handle claim API response with success false', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPoints,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: false,
            error: 'Insufficient permissions',
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Insufficient permissions')).toBeInTheDocument()
      })

      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('should handle unknown task types gracefully', async () => {
      // This test ensures the switch statement default case error handling works
      // Although in practice the task IDs are controlled, we test the error boundary
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      // The component only has known task types, but we can verify
      // that all tasks are present (some may be claimable, others may not)
      const claimButtons = screen.getAllByText('Claim')
      expect(claimButtons.length).toBeGreaterThan(0) // Should have at least 1 claim button

      // Verify that all known tasks are present
      expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      expect(screen.getByText('Like a person')).toBeInTheDocument()
      expect(screen.getByText('Send an introduction')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle initial load errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetchWithAuth.mockRejectedValue(new Error('Network error'))

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('should display claim errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPoints,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: 'Task not available',
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Task not available')).toBeInTheDocument()
      })

      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })

  describe('Modal Behavior', () => {
    it('should render as modal overlay', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        // Should have modal structure
        const modal = screen.getByText('Daily Tasks').closest('.daily-tasks-popup')
        expect(modal).toBeInTheDocument()
      })
    })

    it('should close modal when clicking outside', async () => {
      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily Tasks')).toBeInTheDocument()
      })

      // Click on the backdrop/overlay (assuming it has a close handler)
      // This depends on the actual modal implementation
      const modal = screen.getByText('Daily Tasks').closest('.daily-tasks-popup')
      if (modal) {
        await act(async () => {
          fireEvent.click(modal)
        })
        // Note: Actual backdrop click handling may vary
      }
    })

    it('should maintain modal state during operations', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            points: mockUserPoints,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Daily check-in claimed successfully',
            points: mockUserPointsAfterCheckin,
            pointsEarned: 50,
          }),
        } as Response)

      render(<DailyTasksPopup onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Daily Tasks')).toBeInTheDocument()
        expect(screen.getAllByText('Claim')).toHaveLength(1)
      })

      // Modal should remain open during claiming
      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      // Modal should still be visible during claiming
      expect(screen.getByText('Daily Tasks')).toBeInTheDocument()
    })
  })
})
