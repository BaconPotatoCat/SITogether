import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'
import FilterModal from './FilterModal'

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

interface DiscoveryPageProps {
  isPremium?: boolean
}

export default function DiscoveryPage({ isPremium = false }: DiscoveryPageProps) {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    gender: '',
    ageMin: 18,
    ageMax: 100,
    course: '',
    interests: []
  })
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [likingUserId, setLikingUserId] = useState<string | null>(null)
  const [passingUserId, setPassingUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()

    // Detect if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isPremium) {
      applyFilters()
    } else {
      // Non-premium users see all users without filtering
      setFilteredUsers(users)
    }
  }, [users, filters, isPremium])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchWithAuth('/api/users')
      const data = await response.json()

      if (data.success) {
        setUsers(data.data)
      } else {
        throw new Error(data.error || 'Failed to fetch users')
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = users.filter(user => {
      // Gender filter
      if (filters.gender && user.gender !== filters.gender) {
        return false
      }

      // Age filter
      if (user.age < filters.ageMin || user.age > filters.ageMax) {
        return false
      }

      // Course filter
      if (filters.course && user.course !== filters.course) {
        return false
      }

      // Interests filter (at least one matching interest)
      if (filters.interests.length > 0) {
        const hasMatchingInterest = filters.interests.some(filterInterest =>
          user.interests.includes(filterInterest)
        )
        if (!hasMatchingInterest) {
          return false
        }
      }

      return true
    })

    setFilteredUsers(filtered)
  }

  const handleLike = async (userId: string) => {
    if (likingUserId === userId) return

    try {
      setLikingUserId(userId)
      const response = await fetchWithAuth('/api/likes', {
        method: 'POST',
        body: JSON.stringify({ likedId: userId })
      })

      if (response.ok) {
        // Remove user from the list after liking
        setUsers(prev => prev.filter(user => user.id !== userId))
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to like user')
      }
    } catch (error) {
      console.error('Error liking user:', error)
      alert('Failed to like user')
    } finally {
      setLikingUserId(null)
    }
  }

  const handlePass = async (userId: string) => {
    if (passingUserId === userId) return

    try {
      setPassingUserId(userId)
      const response = await fetchWithAuth('/api/passes', {
        method: 'POST',
        body: JSON.stringify({ passedId: userId })
      })

      if (response.ok) {
        // Remove user from the list after passing
        setUsers(prev => prev.filter(user => user.id !== userId))
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to pass user')
      }
    } catch (error) {
      console.error('Error passing user:', error)
      alert('Failed to pass user')
    } finally {
      setPassingUserId(null)
    }
  }

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleInterestFilter = (interest: string) => {
    setFilters(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }))
  }

  // Get all unique courses and interests for filter options
  const availableCourses = Array.from(new Set(users.map(user => user.course).filter((course): course is string => course !== null)))
  const availableInterests = Array.from(new Set(users.flatMap(user => user.interests)))

  if (loading) {
    return (
      <div className="discovery-loading">
        <div className="spinner"></div>
        <p>Loading profiles...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="discovery-error">
        <p>Error: {error}</p>
        <button onClick={fetchUsers} className="retry-button">Retry</button>
      </div>
    )
  }

  return (
    <div className="discovery-page">
      <div className="discovery-header">
        <h2>Discover Profiles</h2>
        {isPremium ? (
          <button
            className="filter-toggle"
            onClick={() => setShowFilterModal(true)}
          >
            Filters
          </button>
        ) : (
          <div className="premium-required">
            <span className="premium-badge">PREMIUM</span>
          </div>
        )}
      </div>

      <div className="profiles-section">
        {filteredUsers.length === 0 ? (
          <div className="no-profiles">
            <p>No profiles match your current filters.</p>
            <p>Try adjusting your filters or check back later for new profiles!</p>
          </div>
        ) : (
          <div className="profiles-grid">
            {filteredUsers.map(user => (
              <div key={user.id} className="profile-card">
                <div className="profile-content">
                  <div className="profile-header">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="profile-avatar" />
                    ) : (
                      <div className="profile-avatar-placeholder">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="profile-info">
                      <div className="profile-main">
                        <h3>{user.name}, {user.age}</h3>
                        {user.course && <p className="profile-course">{user.course}</p>}
                      </div>
                      <div className="profile-details">
                        <p className="profile-gender">{user.gender}</p>
                      </div>
                    </div>
                  </div>

                  {user.bio && (
                    <p className="profile-bio">{user.bio}</p>
                  )}
                </div>

                <div className="profile-footer">
                  {user.interests.length > 0 && (
                    <div className="profile-interests">
                      {user.interests.slice(0, 3).map(interest => (
                        <span key={interest} className="interest-tag">{interest}</span>
                      ))}
                      {user.interests.length > 3 && (
                        <span className="interest-more">+{user.interests.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <div className="profile-actions">
                    <button
                      className="pass-button"
                      onClick={() => handlePass(user.id)}
                      disabled={passingUserId === user.id}
                    >
                      {passingUserId === user.id ? 'Passing...' : 'Pass'}
                    </button>
                    <button
                      className="like-button"
                      onClick={() => handleLike(user.id)}
                      disabled={likingUserId === user.id}
                    >
                      {likingUserId === user.id ? 'Liking...' : 'Like'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={() => setFilters({
          gender: '',
          ageMin: 18,
          ageMax: 100,
          course: '',
          interests: []
        })}
        availableCourses={availableCourses}
        availableInterests={availableInterests}
        isMobile={isMobile}
      />
    </div>
  )
}
