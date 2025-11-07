import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from '../utils/api'

interface User {
  id: string
  name: string
  age: number
  gender: string
  role: string
  course: string | null
  bio: string | null
  interests: string[]
  avatarUrl: string | null
  verified: boolean
  createdAt: string
}

interface FilterOptions {
  gender: string
  ageMin: number
  ageMax: number
  course: string
  interests: string[]
}

interface DiscoveryState {
  users: User[]
  filteredUsers: User[]
  loading: boolean
  error: string | null
  filters: FilterOptions
  showFilterModal: boolean
  isMobile: boolean
  likingUserId: string | null
  passingUserId: string | null
}

const DEFAULT_FILTERS: FilterOptions = {
  gender: '',
  ageMin: 18,
  ageMax: 100,
  course: '',
  interests: [],
}

export function useDiscovery(isPremium = false) {
  const [state, setState] = useState<DiscoveryState>({
    users: [],
    filteredUsers: [],
    loading: true,
    error: null,
    filters: DEFAULT_FILTERS,
    showFilterModal: false,
    isMobile: false,
    likingUserId: null,
    passingUserId: null,
  })

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setState((prev) => ({ ...prev, isMobile: window.innerWidth < 768 }))
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const response = await fetchWithAuth('/api/users')
      const data = await response.json()

      if (data.success) {
        const verifiedUsers = data.data.filter((user: User) => user.verified === true)
        setState((prev) => ({ ...prev, users: verifiedUsers, loading: false }))
      } else {
        throw new Error(data.error || 'Failed to fetch users')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users'
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }))
    }
  }, [])

  // Filter users
  const applyFilters = useCallback(() => {
    if (!isPremium) {
      setState((prev) => ({ ...prev, filteredUsers: prev.users }))
      return
    }

    const filtered = state.users.filter((user) => {
      const filters = state.filters

      // Gender filter
      if (filters.gender && user.gender !== filters.gender) return false

      // Age filter
      if (user.age < filters.ageMin || user.age > filters.ageMax) return false

      // Course filter
      if (filters.course && user.course !== filters.course) return false

      // Interests filter (at least one matching interest)
      if (filters.interests.length > 0) {
        const hasMatchingInterest = filters.interests.some((filterInterest) =>
          user.interests?.includes(filterInterest)
        )
        if (!hasMatchingInterest) return false
      }

      return true
    })

    setState((prev) => ({ ...prev, filteredUsers: filtered }))
  }, [state.users, state.filters, isPremium])

  // Apply filters when users or filters change
  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  // Initial fetch
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // API actions
  const handleAction = useCallback(
    async (
      userId: string,
      action: 'like' | 'pass',
      endpoint: string,
      loadingState: keyof DiscoveryState
    ) => {
      const currentLoadingId = state[loadingState as keyof DiscoveryState]
      if (currentLoadingId === userId) return

      try {
        setState((prev) => ({ ...prev, [loadingState]: userId }))

        const idKey = action === 'like' ? 'likedId' : `${action}edId`
        const response = await fetchWithAuth(`/api/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({ [idKey]: userId }),
        })

        if (response.ok) {
          // Remove user from the list after action
          setState((prev) => ({
            ...prev,
            users: prev.users.filter((user) => user.id !== userId),
            [loadingState]: null,
          }))
        } else {
          const errorData = await response.json()
          alert(errorData.error || `Failed to ${action} user`)
          setState((prev) => ({ ...prev, [loadingState]: null }))
        }
      } catch (error) {
        const gerund = action === 'like' ? 'liking' : `${action}ing`
        console.error(`Error ${gerund} user:`, error)
        alert(`Failed to ${action} user`)
        setState((prev) => ({ ...prev, [loadingState]: null }))
      }
    },
    [state]
  )

  const handleLike = useCallback(
    (userId: string) => {
      handleAction(userId, 'like', 'likes', 'likingUserId')
    },
    [handleAction]
  )

  const handlePass = useCallback(
    (userId: string) => {
      handleAction(userId, 'pass', 'passes', 'passingUserId')
    },
    [handleAction]
  )

  // Filter management
  const updateFilter = useCallback(
    (key: keyof FilterOptions, value: string | number | string[]) => {
      setState((prev) => ({
        ...prev,
        filters: { ...prev.filters, [key]: value },
      }))
    },
    []
  )

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: DEFAULT_FILTERS,
    }))
  }, [])

  // Computed values
  const availableCourses = useMemo(() => {
    return Array.from(
      new Set(
        state.users.map((user) => user.course).filter((course): course is string => course !== null)
      )
    )
  }, [state.users])

  const availableInterests = useMemo(() => {
    return Array.from(new Set(state.users.flatMap((user) => user.interests)))
  }, [state.users])

  // Modal management
  const openFilterModal = useCallback(() => {
    setState((prev) => ({ ...prev, showFilterModal: true }))
  }, [])

  const closeFilterModal = useCallback(() => {
    setState((prev) => ({ ...prev, showFilterModal: false }))
  }, [])

  return {
    // State
    ...state,

    // Actions
    fetchUsers,
    handleLike,
    handlePass,
    updateFilter,
    clearFilters,
    openFilterModal,
    closeFilterModal,

    // Computed
    availableCourses,
    availableInterests,
  }
}