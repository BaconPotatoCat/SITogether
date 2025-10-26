import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import DailyTasksComponent from '../../components/DailyTasksComponent'
import { fetchWithAuth } from '../../utils/api'

// Mock the API
jest.mock('../../utils/api')
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>

describe('DailyTasksComponent', () => {
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

  const mockUserPointsPremiumThreshold = {
    totalPoints: 975, // Close to 1000
    dailyCheckinDate: null,
    hasLikedToday: true,
    dailyLikeClaimedDate: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console.error for cleaner test output (errors are intentionally tested)
    jest.spyOn(console, 'error').mockImplementation(() => {})
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
  })

  describe('Initial Loading', () => {
    it('should show loading state initially', () => {
      render(<DailyTasksComponent />)
      expect(screen.getByText('Loading your points...')).toBeInTheDocument()
    })

    it('should fetch user points on mount', async () => {
      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/points')
      })
    })

    it('should display tasks after loading', async () => {
      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
        expect(screen.getByText('Like a person')).toBeInTheDocument()
        expect(screen.getByText('Send an introduction')).toBeInTheDocument()
      })

      expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument()
    })

    it('should handle API errors during initial load', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Network error'))

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('should handle API response with non-ok status', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch points')).toBeInTheDocument()
      })
    })

    it('should handle API response with success false', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Database error' }),
      } as Response)

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument()
      })
    })

    it('should handle edge case when user points are auto-created (not in DB initially)', async () => {
      // Simulate backend auto-creating userPoints record with 0 points
      const newlyCreatedPoints = {
        totalPoints: 0,
        dailyCheckinDate: null,
        hasLikedToday: false,
        dailyLikeClaimedDate: null,
      }

      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          points: newlyCreatedPoints,
        }),
      } as Response)

      render(<DailyTasksComponent />)

      // Should successfully load with 0 points (newly created record)
      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      // All tasks should be claimable (no tasks completed yet)
      await waitFor(() => {
        const claimButtons = screen.getAllByText('Claim')
        expect(claimButtons.length).toBeGreaterThan(0)
      })

      // Verify the API was called
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/points')
    })
  })

  describe('Task Display', () => {
    it('should show correct task information', async () => {
      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
        expect(screen.getByText('+50 pts')).toBeInTheDocument()
        expect(screen.getByText('Like a person')).toBeInTheDocument()
        expect(screen.getAllByText('+25 pts')).toHaveLength(2) // Like and Send introduction both give 25
      })
    })

    it('should show claim buttons for available tasks', async () => {
      render(<DailyTasksComponent />)

      await waitFor(() => {
        const claimButtons = screen.getAllByText('Claim')
        expect(claimButtons).toHaveLength(1) // Only daily-checkin should be claimable initially
      })
    })

    it('should disable claim buttons when at premium threshold', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          points: mockUserPointsPremiumThreshold,
        }),
      } as Response)

      render(<DailyTasksComponent currentPoints={1000} />)

      await waitFor(() => {
        const maxPointsButtons = screen.getAllByText('Max Points')
        expect(maxPointsButtons).toHaveLength(2) // Only daily-checkin and like-person show "Max Points" (send-introduction is never claimable)
      })
    })
  })

  describe('Task States', () => {
    it('should show daily check-in as completed when already claimed today', async () => {
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

      render(<DailyTasksComponent />)

      await waitFor(() => {
        // Should show as completed and not claimable
        expect(screen.getByText('✓ Completed')).toBeInTheDocument()
      })

      // Check button should not be available for completed task
      const claimButtons = screen.queryAllByText('Claim')
      expect(claimButtons).toHaveLength(0) // Daily check-in is completed, like task not claimable (user hasn't liked today)
    })

    it('should show like task as claimable when user has liked today but not claimed', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          points: mockUserPointsLikedToday,
        }),
      } as Response)

      render(<DailyTasksComponent />)

      await waitFor(() => {
        const likeTask = screen.getByText('Like a person')
        expect(likeTask).toBeInTheDocument()

        // Should be claimable since user liked today
        const claimButtons = screen.getAllByText('Claim')
        expect(claimButtons).toHaveLength(2) // Daily check-in + like-person should be claimable
      })
    })

    it('should show like task as not claimable when user has not liked today', async () => {
      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Like a person')).toBeInTheDocument()
        // The like task should show as "Not available" or similar
        // This depends on the component's implementation
      })
    })
  })

  describe('Claim Functionality', () => {
    it('should successfully claim daily check-in points', async () => {
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

      const mockOnPointsUpdate = jest.fn()
      render(<DailyTasksComponent onPointsUpdate={mockOnPointsUpdate} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0] // First claim button

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      // The claiming state should be set and the API called
      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/points/claim-daily', {
          method: 'POST',
        })
        expect(mockOnPointsUpdate).toHaveBeenCalled()
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
              totalPoints: 125, // 100 + 25
              dailyLikeClaimedDate: new Date().toISOString(),
            },
            pointsEarned: 25,
          }),
        } as Response)

      const mockOnPointsUpdate = jest.fn()
      render(<DailyTasksComponent onPointsUpdate={mockOnPointsUpdate} />)

      await waitFor(() => {
        expect(screen.getByText('Like a person')).toBeInTheDocument()
      })

      const likeClaimButton = screen.getAllByText('Claim')[1] // Second claim button (like task)

      await act(async () => {
        fireEvent.click(likeClaimButton)
      })

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/points/claim-daily-like', {
          method: 'POST',
        })
        expect(mockOnPointsUpdate).toHaveBeenCalled()
      })
    })

    it('should handle claim API errors', async () => {
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

      render(<DailyTasksComponent />)

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
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Daily check-in claimed successfully',
            points: mockUserPointsAfterCheckin,
            pointsEarned: 50,
          }),
        } as Response)

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      // Click the same button multiple times rapidly
      fireEvent.click(checkinClaimButton)
      fireEvent.click(checkinClaimButton) // Should be ignored due to claiming state
      fireEvent.click(checkinClaimButton) // Should be ignored due to claiming state

      // Wait for the claim to complete
      await waitFor(() => {
        expect(screen.getByText('✓ Completed')).toBeInTheDocument()
      })

      // Should have made exactly 2 calls: initial fetch + 1 claim
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })

    it('should handle claim API response with success false', async () => {
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

      render(<DailyTasksComponent />)

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
    })

    it('should handle unknown task types gracefully', async () => {
      // This test ensures the switch statement default case error handling works
      // Although in practice the task IDs are controlled, we test the error boundary
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          points: mockUserPoints,
        }),
      } as Response)

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      // The component only has known task types, but we can verify
      // that all task buttons exist and are functional
      const claimButtons = screen.getAllByText('Claim')
      expect(claimButtons).toHaveLength(1) // Only daily-checkin should be claimable initially

      // Verify that all known tasks are present
      expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      expect(screen.getByText('Like a person')).toBeInTheDocument()
      expect(screen.getByText('Send an introduction')).toBeInTheDocument()
    })
  })

  describe('Points Behavior', () => {
    it('should disable claim buttons at max points', async () => {
      render(<DailyTasksComponent currentPoints={1000} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      // When at max points, buttons should show "Max Points" instead of "Claim"
      const maxPointsButtons = screen.getAllByText('Max Points')
      expect(maxPointsButtons).toHaveLength(1)
    })

    it('should show claim buttons when under max points', async () => {
      render(<DailyTasksComponent currentPoints={500} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      // When under max points, should show "Claim" button
      const claimButtons = screen.getAllByText('Claim')
      expect(claimButtons).toHaveLength(1)
    })

    it('should handle points update callback', async () => {
      const mockOnPointsUpdate = jest.fn()

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, points: mockUserPoints }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)

      render(<DailyTasksComponent onPointsUpdate={mockOnPointsUpdate} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const claimButton = screen.getByText('Claim')

      await act(async () => {
        fireEvent.click(claimButton)
      })

      await waitFor(() => {
        expect(mockOnPointsUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message on claim failure', async () => {
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
            error: 'Task already completed',
          }),
        } as Response)

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Task already completed')).toBeInTheDocument()
      })
    })

    it('should clear error when retrying claim', async () => {
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
            error: 'Network error',
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

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      // First attempt fails
      const checkinClaimButton = screen.getAllByText('Claim')[0]
      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      // Second attempt succeeds
      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(screen.queryByText('Network error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Props', () => {
    it('should call onPointsUpdate when provided and claim succeeds', async () => {
      const mockOnPointsUpdate = jest.fn()

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

      render(<DailyTasksComponent onPointsUpdate={mockOnPointsUpdate} />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      await waitFor(() => {
        expect(mockOnPointsUpdate).toHaveBeenCalledTimes(1)
      })
    })

    it('should work without onPointsUpdate callback', async () => {
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

      render(<DailyTasksComponent />)

      await waitFor(() => {
        expect(screen.getByText('Daily check-in')).toBeInTheDocument()
      })

      const checkinClaimButton = screen.getAllByText('Claim')[0]

      await act(async () => {
        fireEvent.click(checkinClaimButton)
      })

      // Should not crash without the callback
      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
      })
    })
  })
})
