import { useState, useEffect, useRef } from 'react'
import Slider from '@mui/material/Slider'

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
  onFilterChange: (key: keyof FilterOptions, value: any) => void
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
  isMobile
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters)
  const [isInteractingWithSlider, setIsInteractingWithSlider] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [startY, setStartY] = useState(0)
  const [modalHeight, setModalHeight] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Measure modal height when it opens
  useEffect(() => {
    if (isOpen && isMobile && modalRef.current) {
      const height = modalRef.current.offsetHeight
      setModalHeight(height)
    }
  }, [isOpen, isMobile])

  // Reset drag offset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setDragOffset(0)
      setIsDragging(false)
      setIsClosing(false)
    }
  }, [isOpen])

  // Track slider interaction globally
  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to ensure backdrop click doesn't fire immediately
      setTimeout(() => {
        setIsInteractingWithSlider(false)
      }, 50)
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check if clicking on slider elements
      if (target.closest && (
        target.closest('.MuiSlider-thumb') ||
        target.closest('.MuiSlider-track') ||
        target.closest('.MuiSlider-rail')
      )) {
        setIsInteractingWithSlider(true)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isOpen])

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleLocalFilterChange = (key: keyof FilterOptions, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleAgeRangeChange = (event: Event, newValue: number | number[], activeThumb: number) => {
    const minDistance = 5 // Minimum 5 year difference

    // Enforce minimum distance similar to MUI example
    if (!Array.isArray(newValue)) {
      return
    }

    if (activeThumb === 0) {
      // Moving min handle
      const clampedMin = Math.min(newValue[0], newValue[1] - minDistance)
      handleLocalFilterChange('ageMin', clampedMin)
    } else {
      // Moving max handle
      const clampedMax = Math.max(newValue[1], newValue[0] + minDistance)
      handleLocalFilterChange('ageMax', clampedMax)
    }
  }

  const applyFilters = () => {
    // Apply all local filters to parent
    Object.entries(localFilters).forEach(([key, value]) => {
      onFilterChange(key as keyof FilterOptions, value)
    })
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isInteractingWithSlider && !isClosing) {
      if (isMobile) {
        // Animate modal sliding down before closing
        setIsClosing(true)
        const finalOffset = modalHeight
        setDragOffset(finalOffset)

        // Close modal after animation completes
        setTimeout(() => {
          onClose()
        }, 200) // Match the CSS transition duration
      } else {
        // For desktop, close immediately without animation
        onClose()
      }
    }
  }

  // Helper function to get clientY from touch or mouse event
  const getClientY = (e: React.TouchEvent | React.MouseEvent) => {
    return 'touches' in e ? e.touches[0].clientY : e.clientY
  }

  if (!isOpen) return null

  // Handle drag functionality for mobile
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isMobile || isClosing) return

    // Don't start dragging if clicking on the close button
    const target = e.target as HTMLElement
    if (target.closest('.filter-modal-close')) return

    setIsDragging(true)
    setStartY(getClientY(e))
  }

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || !isMobile || isClosing) return

    const clientY = getClientY(e)
    const deltaY = clientY - startY

    // Only allow dragging downwards
    if (deltaY > 0) {
      setDragOffset(deltaY)
    }
  }

  const handleDragEnd = () => {
    if (!isDragging || !isMobile) return

    setIsDragging(false)

    // If dragged down more than half the modal height, animate fully downward
    const threshold = modalHeight / 2
    if (dragOffset > threshold) {
      // Animate to slide completely off screen (top of modal reaches bottom of screen)
      setIsClosing(true)
      const finalOffset = modalHeight // Slide down by full modal height
      setDragOffset(finalOffset)

      // Close modal after animation completes
      setTimeout(() => {
        onClose()
      }, 200) // Match the CSS transition duration
    } else {
      // Snap back to original position
      setDragOffset(0)
    }
  }

  const modalContent = (
    <div className="filter-modal-content">
      {isMobile && (
        <div
          className="mobile-modal-handle"
          onTouchStart={handleDragStart}
          onMouseDown={handleDragStart}
          onTouchMove={handleDragMove}
          onMouseMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        ></div>
      )}
      <div
        className="filter-modal-header"
        onTouchStart={isMobile ? handleDragStart : undefined}
        onMouseDown={isMobile ? handleDragStart : undefined}
        onTouchMove={isMobile ? handleDragMove : undefined}
        onMouseMove={isMobile ? handleDragMove : undefined}
        onTouchEnd={isMobile ? handleDragEnd : undefined}
        onMouseUp={isMobile ? handleDragEnd : undefined}
        onMouseLeave={isMobile ? handleDragEnd : undefined}
      >
        <h3>Filter Profiles</h3>
        <button className="filter-modal-close" onClick={onClose}>×</button>
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
              {availableCourses.map(course => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group age-range-group">
            <div className="age-header">
              <label>Age Range</label>
              <div className="age-values">{localFilters.ageMin} - {localFilters.ageMax} years</div>
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
              {availableInterests.map(interest => (
                <div
                  key={interest}
                  className={`interest-label ${localFilters.interests.includes(interest) ? 'selected' : ''}`}
                  onClick={() => {
                    const newInterests = localFilters.interests.includes(interest)
                      ? localFilters.interests.filter(i => i !== interest)
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
        <button className="clear-filters" onClick={() => {
          const clearedFilters = {
            gender: '',
            ageMin: 18,
            ageMax: 100,
            course: '',
            interests: []
          }
          setLocalFilters(clearedFilters)
          onClearFilters()
        }}>
          Clear All
        </button>
        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="apply-button" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div className="filter-modal-overlay mobile" onClick={handleBackdropClick}>
        <div
          ref={modalRef}
          className="filter-modal-mobile"
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `translateY(${dragOffset}px)` }}
        >
          {modalContent}
        </div>
      </div>
    )
  }

  return (
    <div className="filter-modal-overlay desktop" onClick={handleBackdropClick}>
      <div className="filter-modal-popup" onClick={(e) => e.stopPropagation()}>
        {modalContent}
      </div>
    </div>
  )
}
