export interface User {
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

export interface FilterOptions {
  gender: string
  ageMin: number
  ageMax: number
  course: string
  interests: string[]
}

export const DEFAULT_FILTERS: FilterOptions = {
  gender: '',
  ageMin: 18,
  ageMax: 100,
  course: '',
  interests: [],
}

export function filterUsers(users: User[], filters: FilterOptions, isPremium = false): User[] {
  if (!isPremium) {
    return users
  }

  return users.filter((user) => {
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
}

export function getAvailableCourses(users: User[]): string[] {
  return Array.from(
    new Set(users.map((user) => user.course).filter((course): course is string => course !== null))
  )
}

export function getAvailableInterests(users: User[]): string[] {
  return Array.from(new Set(users.flatMap((user) => user.interests)))
}
