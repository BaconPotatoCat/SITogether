import { useState } from 'react'
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

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportingUserId, setReportingUserId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  const handleReportClick = (userId: string) => {
    setReportingUserId(userId)
    setShowReportModal(true)
    setReportReason('')
    setReportDescription('')
  }

  const handleSubmitReport = async () => {
    if (!reportingUserId || !reportReason.trim()) {
      alert('Please select a reason for reporting')
      return
    }

    setIsSubmittingReport(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportedId: reportingUserId,
          reason: reportReason,
          description: reportDescription.trim() || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('Report submitted successfully. Thank you for helping keep our community safe.')
        setShowReportModal(false)
        setReportingUserId(null)
        setReportReason('')
        setReportDescription('')
      } else {
        alert(result.error || 'Failed to submit report')
      }
    } catch (error) {
      alert('Failed to submit report. Please try again.')
      console.error('Report error:', error)
    } finally {
      setIsSubmittingReport(false)
    }
  }

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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleReportClick(user.id)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      title="Report user"
                      type="button"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        const currentColor = e.currentTarget.style.backgroundColor
                        // Check for both hex (#dc3545) and RGB (rgb(220, 53, 69)) formats
                        if (
                          currentColor !== '#dc3545' &&
                          currentColor !== 'rgb(220, 53, 69)' &&
                          currentColor !== 'rgba(220, 53, 69, 1)'
                        )
                          return
                        e.currentTarget.style.backgroundColor = '#c82333'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#dc3545'
                      }}
                    >
                      🚩 Report
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

      {/* Report Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            if (!isSubmittingReport) {
              setShowReportModal(false)
              setReportingUserId(null)
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Report User</h2>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Please select a reason for reporting this user. All reports are reviewed by our
              moderation team.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="report-reason-select"
                style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}
              >
                Reason <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <select
                id="report-reason-select"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                disabled={isSubmittingReport}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                }}
              >
                <option value="">Select a reason...</option>
                <option value="Inappropriate Content">Inappropriate Content</option>
                <option value="Harassment">Harassment</option>
                <option value="Spam">Spam</option>
                <option value="Fake Profile">Fake Profile</option>
                <option value="Inappropriate Behavior">Inappropriate Behavior</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="report-description-textarea"
                style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}
              >
                Additional Details (Optional)
              </label>
              <textarea
                id="report-description-textarea"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                disabled={isSubmittingReport}
                placeholder="Please provide any additional information..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  if (!isSubmittingReport) {
                    setShowReportModal(false)
                    setReportingUserId(null)
                  }
                }}
                disabled={isSubmittingReport}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmittingReport ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmittingReport || !reportReason.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor:
                    isSubmittingReport || !reportReason.trim() ? '#6c757d' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSubmittingReport || !reportReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
