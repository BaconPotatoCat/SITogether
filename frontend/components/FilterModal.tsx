import { useState, useEffect } from 'react'
import { Slider } from '@mui/material'

interface FilterOptions {
  gender: string
  ageMin: number
  ageMax: number
  course: string
  interests: string[]
}

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: FilterOptions
  onFilterChange: (key: keyof FilterOptions, value: string | number | string[]) => void
  onClearFilters: () => void
  availableCourses: string[]
  availableInterests: string[]
  isMobile: boolean
}

export default function FilterModal({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onClearFilters,
  availableCourses,
  availableInterests,
  isMobile,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleLocalFilterChange = (key: keyof FilterOptions, value: string | number | string[]) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleAgeRangeChange = (event: Event, newValue: number | number[]) => {
    if (!Array.isArray(newValue) || newValue.length !== 2) {
      return
    }

    const [min, max] = newValue
    const minDistance = 5

    // Simple validation - ensure min is less than max with minimum distance
    const clampedMin = Math.min(min, max - minDistance)
    const clampedMax = Math.max(max, min + minDistance)

    handleLocalFilterChange('ageMin', clampedMin)
    handleLocalFilterChange('ageMax', clampedMax)
  }

  const applyFilters = () => {
    // Apply all local filters to parent
    Object.entries(localFilters).forEach(([key, value]) => {
      onFilterChange(key as keyof FilterOptions, value)
    })
    handleClose()
  }

  const handleClose = () => {
    if (isMobile) {
      setIsClosing(true)
      setTimeout(() => {
        setIsClosing(false)
        onClose()
      }, 300) // Match the animation duration
    } else {
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div className="filter-modal-content">
      <div className="filter-modal-header">
        <h3>Filter Profiles</h3>
        <button className="filter-modal-close" onClick={handleClose}>
          ×
        </button>
      </div>

      <div className="filter-modal-body">
        <div className="filter-row">
          <div className="filter-group">
            <label>Gender:</label>
            <select
              value={localFilters.gender}
              onChange={(e) => handleLocalFilterChange('gender', e.target.value)}
            >
              <option value="">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Course:</label>
            <select
              value={localFilters.course}
              onChange={(e) => handleLocalFilterChange('course', e.target.value)}
            >
              <option value="">All Courses</option>
              {availableCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group age-range-group">
            <div className="age-header">
              <label>Age Range</label>
              <div className="age-values">
                {localFilters.ageMin} - {localFilters.ageMax} years
              </div>
            </div>
            <div className="mui-slider-container">
              <Slider
                value={[localFilters.ageMin, localFilters.ageMax]}
                onChange={handleAgeRangeChange}
                valueLabelDisplay="auto"
                min={18}
                max={65}
                disableSwap
                sx={{
                  color: '#667eea',
                  '& .MuiSlider-thumb': {
                    backgroundColor: '#667eea',
                  },
                  '& .MuiSlider-track': {
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: '#e9ecef',
                  },
                  '& .MuiSlider-root': {
                    padding: '13px 0',
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group interests-filter">
            <label>Interests (select multiple):</label>
            <div className="interests-grid">
              {availableInterests.map((interest) => (
                <div
                  key={interest}
                  className={`interest-label ${localFilters.interests.includes(interest) ? 'selected' : ''}`}
                  onClick={() => {
                    const newInterests = localFilters.interests.includes(interest)
                      ? localFilters.interests.filter((i) => i !== interest)
                      : [...localFilters.interests, interest]
                    handleLocalFilterChange('interests', newInterests)
                  }}
                >
                  {interest}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="filter-modal-footer">
        <button
          className="clear-filters"
          onClick={() => {
            const clearedFilters = {
              gender: '',
              ageMin: 18,
              ageMax: 100,
              course: '',
              interests: [],
            }
            setLocalFilters(clearedFilters)
            onClearFilters()
          }}
        >
          Clear All
        </button>
        <div className="modal-actions">
          <button className="cancel-button" onClick={handleClose}>
            Cancel
          </button>
          <button className="apply-button" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`filter-modal-overlay ${isMobile ? 'mobile' : 'desktop'}`}
      onClick={handleBackdropClick}
    >
      <div
        className={`filter-modal-${isMobile ? 'mobile' : 'popup'} ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {modalContent}
      </div>
    </div>
  )
}
