import { renderHook, act } from '@testing-library/react'
import { useDiscovery } from '../../hooks/useDiscovery'
import { fetchWithAuth } from '../../utils/api'

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
    it('should apply interests filter and cover lines 111-114', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Apply interests filter - should trigger lines 111-114
      act(() => {
        result.current.updateFilter('interests', ['coding'])
      })

      expect(result.current.filteredUsers).toHaveLength(1)
      expect(result.current.filteredUsers[0].name).toBe('Alice Johnson')
    })

    it('should handle updateFilter and cover line 192', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Update gender filter - should trigger line 192
      act(() => {
        result.current.updateFilter('gender', 'Female')
      })

      expect(result.current.filters.gender).toBe('Female')
    })

    it('should handle clearFilters and cover line 201', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // First set some filters
      act(() => {
        result.current.updateFilter('gender', 'Female')
        result.current.updateFilter('ageMin', 20)
      })

      expect(result.current.filters.gender).toBe('Female')
      expect(result.current.filters.ageMin).toBe(20)

      // Clear filters - should trigger line 201
      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters.gender).toBe('')
      expect(result.current.filters.ageMin).toBe(18)
      expect(result.current.filters.ageMax).toBe(100)
    })
  })

  describe('Modal Management', () => {
    it('should handle closeFilterModal and cover line 226', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Open modal first
      act(() => {
        result.current.openFilterModal()
      })

      expect(result.current.showFilterModal).toBe(true)

      // Close modal - should trigger line 226
      act(() => {
        result.current.closeFilterModal()
      })

      expect(result.current.showFilterModal).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle API response with success false and cover lines 82-86', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'API Error' }),
      } as Response)

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for error to be set
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.error).toBe('API Error')
      expect(result.current.loading).toBe(false)
    })

    it('should handle API network errors and cover error handling lines 84-86', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for error to be set
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.loading).toBe(false)
    })

    it('should handle non-Error objects in catch block', async () => {
      mockFetchWithAuth.mockRejectedValue('String error')

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for error to be set
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.error).toBe('Failed to load users')
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Non-Premium Mode', () => {
    it('should show all users when not premium and cover lines 93-94', async () => {
      const { result } = renderHook(() => useDiscovery(false)) // isPremium = false

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // In non-premium mode, filteredUsers should equal all users
      expect(result.current.filteredUsers).toEqual(result.current.users)
      expect(result.current.filteredUsers).toHaveLength(3)
    })
  })

  describe('Advanced Filtering Edge Cases', () => {
    it('should handle age filtering boundary conditions and cover lines 104-105', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Test exact age boundary (Alice is 25)
      act(() => {
        result.current.updateFilter('ageMin', 25)
        result.current.updateFilter('ageMax', 25)
      })

      // Should include only Alice
      expect(result.current.filteredUsers).toHaveLength(1)
      expect(result.current.filteredUsers[0].name).toBe('Alice Johnson')
    })

    it('should handle course filtering with null values and cover line 107', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

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
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

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
    it('should handle like action successfully and cover handleAction logic', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Mock successful like API call
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      // Call handleLike - should cover lines 141-169
      act(() => {
        result.current.handleLike('1')
      })

      // Should set likingUserId
      expect(result.current.likingUserId).toBe('1')

      // Wait for API call to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Should remove user from list and clear likingUserId
      expect(result.current.users).toHaveLength(2)
      expect(result.current.users.map((u) => u.id).sort()).toEqual(['2', '3']) // Alice (id:1) should be removed
      expect(result.current.likingUserId).toBe(null)
    })

    it('should handle pass action successfully and cover handlePass callback', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Mock successful pass API call
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      // Call handlePass - should cover line 184
      act(() => {
        result.current.handlePass('2')
      })

      // Should set passingUserId
      expect(result.current.passingUserId).toBe('2')

      // Wait for API call to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Should remove user from list and clear passingUserId
      expect(result.current.users).toHaveLength(2)
      expect(result.current.users.map((u) => u.id).sort()).toEqual(['1', '3']) // Bob (id:2) should be removed
      expect(result.current.passingUserId).toBe(null)
    })

    it('should handle API action errors', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

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
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Should show alert and clear loading state
      expect(alertSpy).toHaveBeenCalledWith('Like failed')
      expect(result.current.likingUserId).toBe(null)

      alertSpy.mockRestore()
    })

    it('should handle network errors in API actions and cover lines 166-169', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})

      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Mock network error in like API call
      mockFetchWithAuth.mockRejectedValueOnce(new Error('Network error'))

      // Call handleLike - should trigger catch block lines 166-169
      act(() => {
        result.current.handleLike('1')
      })

      // Wait for API call to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

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
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.availableCourses).toEqual(['Computer Science', 'Engineering'])
    })

    it('should compute availableInterests correctly', async () => {
      const { result } = renderHook(() => useDiscovery(true))

      // Wait for initial data load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

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
