import { renderHook, act, waitFor } from '@testing-library/react'
import { useDiscovery } from '../../hooks/useDiscovery'
import { fetchWithAuth } from '../../utils/api'

// Suppress act() warnings for useEffect async operations in hooks
// These are false positives - we properly wait for all async operations with waitFor()
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn((...args: unknown[]) => {
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('Warning: An update to TestComponent') ||
        message.includes('not wrapped in act'))
    ) {
      return
    }
    originalError.call(console, ...args)
  })
})

afterAll(() => {
  console.error = originalError
})

// Mock the API
jest.mock('../../utils/api')
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 1024,
})

describe('useDiscovery', () => {
  const mockUsers = [
    {
      id: '1',
      name: 'Alice Johnson',
      age: 25,
      gender: 'Female',
      role: 'User',
      course: 'Computer Science',
      bio: 'Love coding!',
      interests: ['coding', 'gaming'],
      avatarUrl: null,
      verified: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      name: 'Bob Smith',
      age: 23,
      gender: 'Male',
      role: 'User',
      course: 'Engineering',
      bio: 'Engineering student',
      interests: ['engineering', 'sports'],
      avatarUrl: null,
      verified: true,
      createdAt: '2024-01-02T00:00:00.000Z',
    },
    {
      id: '3',
      name: 'Charlie Brown',
      age: 22,
      gender: 'Male',
      role: 'User',
      course: 'Engineering',
      bio: 'Another engineering student',
      interests: ['engineering', 'music'],
      avatarUrl: null,
      verified: true,
      createdAt: '2024-01-03T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUsers, count: mockUsers.length }),
    } as Response)
  })

  describe('Filtering Logic', () => {
    it('should apply interests filter', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Apply interests filter
      act(() => {
        result.current.updateFilter('interests', ['coding'])
      })

      expect(result.current.filteredUsers).toHaveLength(1)
      expect(result.current.filteredUsers[0].name).toBe('Alice Johnson')
    })

    it('should handle updateFilter', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Update gender filter
      act(() => {
        result.current.updateFilter('gender', 'Female')
      })

      expect(result.current.filters.gender).toBe('Female')
    })

    it('should handle clearFilters', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // First set some filters
      act(() => {
        result.current.updateFilter('gender', 'Female')
        result.current.updateFilter('ageMin', 20)
      })

      expect(result.current.filters.gender).toBe('Female')
      expect(result.current.filters.ageMin).toBe(20)

      // Clear filters
      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters.gender).toBe('')
      expect(result.current.filters.ageMin).toBe(18)
      expect(result.current.filters.ageMax).toBe(100)
    })
  })

  describe('Modal Management', () => {
    it('should handle closeFilterModal', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Open modal first
      act(() => {
        result.current.openFilterModal()
      })

      expect(result.current.showFilterModal).toBe(true)

      // Close modal
      act(() => {
        result.current.closeFilterModal()
      })

      expect(result.current.showFilterModal).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle API response with success false', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'API Error' }),
      } as Response)

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for error to be set
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBe('API Error')
      expect(result.current.loading).toBe(false)
    })

    it('should handle API network errors', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for error to be set
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBe('Network error')
      expect(result.current.loading).toBe(false)
    })

    it('should handle non-Error objects in catch block', async () => {
      mockFetchWithAuth.mockRejectedValue('String error')

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for error to be set
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBe('Failed to load users')
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Non-Premium Mode', () => {
    it('should show all users when not premium', async () => {
      const { result } = renderHook(() => useDiscovery(false)) // isPremium = false

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // In non-premium mode, filteredUsers should equal all users
      expect(result.current.filteredUsers).toEqual(result.current.users)
      expect(result.current.filteredUsers).toHaveLength(3)
    })
  })

  describe('Advanced Filtering Edge Cases', () => {
    it('should handle age filtering boundary conditions', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Test exact age boundary (Alice is 25)
      act(() => {
        result.current.updateFilter('ageMin', 25)
        result.current.updateFilter('ageMax', 25)
      })

      // Should include only Alice
      expect(result.current.filteredUsers).toHaveLength(1)
      expect(result.current.filteredUsers[0].name).toBe('Alice Johnson')
    })

    it('should handle course filtering with null values', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Filter by Engineering course (Bob and Charlie have this)
      act(() => {
        result.current.updateFilter('course', 'Engineering')
      })

      // Should include Bob and Charlie
      expect(result.current.filteredUsers).toHaveLength(2)
      expect(result.current.filteredUsers.map((u) => u.name).sort()).toEqual([
        'Bob Smith',
        'Charlie Brown',
      ])
    })

    it('should handle empty string filters', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Set filters to empty strings (should not filter anything)
      act(() => {
        result.current.updateFilter('gender', '')
        result.current.updateFilter('course', '')
      })

      // Should include all users
      expect(result.current.filteredUsers).toHaveLength(3)
    })
  })

  describe('API Actions', () => {
    it('should handle like action successfully', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Mock successful like API call
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      // Call handleLike
      act(() => {
        result.current.handleLike('1')
      })

      // Should set likingUserId
      expect(result.current.likingUserId).toBe('1')

      // Wait for API call to complete
      await waitFor(() => expect(result.current.likingUserId).toBe(null))

      // Should remove user from list and clear likingUserId
      expect(result.current.users).toHaveLength(2)
      expect(result.current.users.map((u) => u.id).sort()).toEqual(['2', '3']) // Alice (id:1) should be removed
      expect(result.current.likingUserId).toBe(null)
    })

    it('should handle pass action successfully', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Mock successful pass API call
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      // Call handlePass
      act(() => {
        result.current.handlePass('2')
      })

      // Should set passingUserId
      expect(result.current.passingUserId).toBe('2')

      // Wait for API call to complete
      await waitFor(() => expect(result.current.passingUserId).toBe(null))

      // Should remove user from list and clear passingUserId
      expect(result.current.users).toHaveLength(2)
      expect(result.current.users.map((u) => u.id).sort()).toEqual(['1', '3']) // Bob (id:2) should be removed
      expect(result.current.passingUserId).toBe(null)
    })

    it('should handle API action errors', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Mock failed like API call
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Like failed' }),
      } as Response)

      // Call handleLike
      act(() => {
        result.current.handleLike('1')
      })

      // Wait for API call to complete
      await waitFor(() => expect(result.current.likingUserId).toBe(null))

      // Should show alert and clear loading state
      expect(alertSpy).toHaveBeenCalledWith('Like failed')
      expect(result.current.likingUserId).toBe(null)

      alertSpy.mockRestore()
    })

    it('should handle network errors in API actions', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Mock network error in like API call
      mockFetchWithAuth.mockRejectedValueOnce(new Error('Network error'))

      // Call handleLike
      act(() => {
        result.current.handleLike('1')
      })

      // Wait for API call to complete
      await waitFor(() => expect(result.current.likingUserId).toBe(null))

      // Should log error, show alert, and clear loading state
      expect(consoleSpy).toHaveBeenCalledWith('Error liking user:', expect.any(Error))
      expect(alertSpy).toHaveBeenCalledWith('Failed to like user')
      expect(result.current.likingUserId).toBe(null)

      consoleSpy.mockRestore()
      alertSpy.mockRestore()
    })
  })

  describe('Computed Values', () => {
    it('should compute availableCourses correctly', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.availableCourses).toEqual(['Computer Science', 'Engineering'])
    })

    it('should compute availableInterests correctly', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.availableInterests.sort()).toEqual([
        'coding',
        'engineering',
        'gaming',
        'music',
        'sports',
      ])
    })
  })

  describe('Mobile Detection', () => {
    it('should detect mobile screen size', () => {
      // Set mobile width
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 600 })

      const { result } = renderHook(() => useDiscovery(true))

      expect(result.current.isMobile).toBe(true)
    })

    it('should detect desktop screen size', () => {
      // Set desktop width
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })

      const { result } = renderHook(() => useDiscovery(true))

      expect(result.current.isMobile).toBe(false)
    })
  })
})
