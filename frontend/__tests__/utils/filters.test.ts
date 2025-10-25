import {
  filterUsers,
  getAvailableCourses,
  getAvailableInterests,
  DEFAULT_FILTERS,
} from '../../utils/filters'

describe('filters', () => {
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
    {
      id: '4',
      name: 'Diana Prince',
      age: 26,
      gender: 'Female',
      role: 'User',
      course: null, // No course
      bio: 'No course specified',
      interests: [], // No interests
      avatarUrl: null,
      verified: true,
      createdAt: '2024-01-04T00:00:00.000Z',
    },
  ]

  describe('DEFAULT_FILTERS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_FILTERS).toEqual({
        gender: '',
        ageMin: 18,
        ageMax: 100,
        course: '',
        interests: [],
      })
    })
  })

  describe('filterUsers', () => {
    it('should return all users when not premium', () => {
      const filters = { ...DEFAULT_FILTERS, gender: 'Female' }
      const result = filterUsers(mockUsers, filters, false)

      expect(result).toEqual(mockUsers)
      expect(result).toHaveLength(4)
    })

    it('should filter by gender', () => {
      const filters = { ...DEFAULT_FILTERS, gender: 'Female' }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(2)
      expect(result.map((u) => u.name)).toEqual(['Alice Johnson', 'Diana Prince'])
    })

    it('should filter by age range', () => {
      const filters = { ...DEFAULT_FILTERS, ageMin: 22, ageMax: 25 }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(3)
      expect(result.map((u) => u.name).sort()).toEqual([
        'Alice Johnson',
        'Bob Smith',
        'Charlie Brown',
      ])
    })

    it('should filter by course', () => {
      const filters = { ...DEFAULT_FILTERS, course: 'Engineering' }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(2)
      expect(result.map((u) => u.name).sort()).toEqual(['Bob Smith', 'Charlie Brown'])
    })

    it('should filter by interests', () => {
      const filters = { ...DEFAULT_FILTERS, interests: ['coding'] }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Alice Johnson')
    })

    it('should filter by multiple interests', () => {
      const filters = { ...DEFAULT_FILTERS, interests: ['engineering', 'sports'] }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(2)
      expect(result.map((u) => u.name).sort()).toEqual(['Bob Smith', 'Charlie Brown'])
    })

    it('should combine multiple filters', () => {
      const filters = {
        ...DEFAULT_FILTERS,
        gender: 'Male',
        ageMin: 20,
        ageMax: 25,
        course: 'Engineering',
        interests: ['engineering'],
      }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(2)
      expect(result.map((u) => u.name).sort()).toEqual(['Bob Smith', 'Charlie Brown'])
    })

    it('should handle empty interests array', () => {
      const filters = { ...DEFAULT_FILTERS, interests: [] }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(4) // All users should pass when interests filter is empty
    })

    it('should handle users with empty interests', () => {
      const filters = { ...DEFAULT_FILTERS, interests: ['coding'] }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(1) // Only Alice has 'coding' interest
    })

    it('should handle users with null course', () => {
      const filters = { ...DEFAULT_FILTERS, course: 'Computer Science' }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Alice Johnson')
    })

    it('should return empty array when no users match filters', () => {
      const filters = {
        ...DEFAULT_FILTERS,
        gender: 'Female',
        course: 'Engineering', // No female engineering students
      }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(0)
    })

    it('should handle edge case age filters', () => {
      const filters = { ...DEFAULT_FILTERS, ageMin: 30, ageMax: 40 }
      const result = filterUsers(mockUsers, filters, true)

      expect(result).toHaveLength(0) // No users in this age range
    })
  })

  describe('getAvailableCourses', () => {
    it('should return unique courses from users', () => {
      const result = getAvailableCourses(mockUsers)

      expect(result.sort()).toEqual(['Computer Science', 'Engineering'])
    })

    it('should exclude null courses', () => {
      const result = getAvailableCourses(mockUsers)

      expect(result).not.toContain(null)
      expect(result).not.toContain(undefined)
    })

    it('should handle empty user list', () => {
      const result = getAvailableCourses([])

      expect(result).toEqual([])
    })

    it('should handle users with only null courses', () => {
      const usersWithNullCourses = [
        { ...mockUsers[0], course: null },
        { ...mockUsers[1], course: null },
      ]
      const result = getAvailableCourses(usersWithNullCourses)

      expect(result).toEqual([])
    })

    it('should return single course when all users have same course', () => {
      const usersWithSameCourse = mockUsers.map((user) => ({
        ...user,
        course: 'Computer Science',
      }))
      const result = getAvailableCourses(usersWithSameCourse)

      expect(result).toEqual(['Computer Science'])
    })
  })

  describe('getAvailableInterests', () => {
    it('should return unique interests from all users', () => {
      const result = getAvailableInterests(mockUsers)

      expect(result.sort()).toEqual(['coding', 'engineering', 'gaming', 'music', 'sports'])
    })

    it('should handle empty user list', () => {
      const result = getAvailableInterests([])

      expect(result).toEqual([])
    })

    it('should handle users with empty interests', () => {
      const usersWithEmptyInterests = [
        { ...mockUsers[0], interests: [] },
        { ...mockUsers[1], interests: ['sports'] },
      ]
      const result = getAvailableInterests(usersWithEmptyInterests)

      expect(result).toEqual(['sports'])
    })

    it('should handle users with duplicate interests', () => {
      const usersWithDuplicates = [
        { ...mockUsers[0], interests: ['coding', 'gaming'] },
        { ...mockUsers[1], interests: ['coding', 'sports'] }, // 'coding' appears twice
      ]
      const result = getAvailableInterests(usersWithDuplicates)

      expect(result.sort()).toEqual(['coding', 'gaming', 'sports'])
      expect(result).toHaveLength(3) // No duplicates
    })

    it('should handle complex interest combinations', () => {
      const complexUsers = [
        { ...mockUsers[0], interests: ['coding', 'gaming', 'music'] },
        { ...mockUsers[1], interests: ['sports', 'music', 'coding'] },
        { ...mockUsers[2], interests: ['engineering', 'coding'] },
      ]
      const result = getAvailableInterests(complexUsers)

      expect(result.sort()).toEqual(['coding', 'engineering', 'gaming', 'music', 'sports'])
    })
  })

  describe('Integration tests', () => {
    it('should work with DEFAULT_FILTERS', () => {
      const result = filterUsers(mockUsers, DEFAULT_FILTERS, true)

      expect(result).toHaveLength(4) // All users should pass with default filters
    })

    it('should handle premium vs non-premium filtering', () => {
      const filters = { ...DEFAULT_FILTERS, gender: 'Female' }

      const premiumResult = filterUsers(mockUsers, filters, true)
      const nonPremiumResult = filterUsers(mockUsers, filters, false)

      expect(premiumResult).toHaveLength(2) // Filtered for premium
      expect(nonPremiumResult).toHaveLength(4) // All users for non-premium
    })
  })
})
