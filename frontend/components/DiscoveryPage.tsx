import FilterModal from './FilterModal'
import { useDiscovery } from '../hooks/useDiscovery'

interface DiscoveryPageProps {
  isPremium?: boolean
}

export default function DiscoveryPage({ isPremium = false }: DiscoveryPageProps) {
  const {
    filteredUsers,
    loading,
    error,
    filters,
    showFilterModal,
    isMobile,
    likingUserId,
    passingUserId,
    fetchUsers,
    handleLike,
    handlePass,
    updateFilter,
    clearFilters,
    openFilterModal,
    closeFilterModal,
    availableCourses,
    availableInterests,
  } = useDiscovery(isPremium)

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
        <button onClick={fetchUsers} className="retry-button">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="discovery-page">
      <div className="discovery-header">
        <h2>Discover Profiles</h2>
        {isPremium ? (
          <button className="filter-toggle" onClick={openFilterModal}>
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
            {filteredUsers.map((user) => (
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
                        <h3>
                          {user.name}, {user.age}
                        </h3>
                        {user.course && <p className="profile-course">{user.course}</p>}
                      </div>
                      <div className="profile-details">
                        <p className="profile-gender">{user.gender}</p>
                      </div>
                    </div>
                  </div>

                  {user.bio && <p className="profile-bio">{user.bio}</p>}
                </div>

                <div className="profile-footer">
                  {user.interests.length > 0 && (
                    <div className="profile-interests">
                      {user.interests.slice(0, 3).map((interest) => (
                        <span key={interest} className="interest-tag">
                          {interest}
                        </span>
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
        onClose={closeFilterModal}
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        availableCourses={availableCourses}
        availableInterests={availableInterests}
        isMobile={isMobile}
      />
    </div>
  )
}
