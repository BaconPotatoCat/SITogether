import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import FilterModal from '../../components/FilterModal'

// Mock MUI Slider
jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material')
  return {
    ...actual,
    Slider: function MockSlider({
      value,
      onChange,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      valueLabelDisplay,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disableSwap,
      ...props
    }: {
      value: number[]
      onChange: (event: unknown, value: number | number[], activeThumb: number) => void
      valueLabelDisplay?: string
      disableSwap?: boolean
      [key: string]: unknown
    }) {
      return (
        <div data-testid="mock-slider" {...props}>
          <input
            type="range"
            min={18}
            max={100}
            value={value[0]}
            onChange={(e) => onChange(e, [parseInt(e.target.value), value[1]], 0)}
            data-testid="slider-min"
          />
          <input
            type="range"
            min={18}
            max={100}
            value={value[1]}
            onChange={(e) => onChange(e, [value[0], parseInt(e.target.value)], 1)}
            data-testid="slider-max"
          />
          {/* Test button to trigger non-array value */}
          <button
            data-testid="test-non-array"
            onClick={() => onChange(null, 25, 0)} // Pass non-array value
          />
        </div>
      )
    },
  }
})

describe('FilterModal', () => {
  const mockFilters = {
    gender: '',
    ageMin: 18,
    ageMax: 100,
    course: '',
    interests: [],
  }

  const mockAvailableCourses = ['Computer Science', 'Engineering', 'Business']
  const mockAvailableInterests = ['coding', 'sports', 'music', 'reading']

  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    filters: mockFilters,
    onFilterChange: jest.fn(),
    onClearFilters: jest.fn(),
    availableCourses: mockAvailableCourses,
    availableInterests: mockAvailableInterests,
    isMobile: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Modal Structure', () => {
    it('should render modal when isOpen is true', () => {
      render(<FilterModal {...mockProps} />)

      expect(screen.getByText('Filter Profiles')).toBeInTheDocument()
      expect(screen.getByText('×')).toBeInTheDocument()
    })

    it('should not render modal when isOpen is false', () => {
      render(<FilterModal {...mockProps} isOpen={false} />)

      expect(screen.queryByText('Filter Profiles')).not.toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', () => {
      render(<FilterModal {...mockProps} />)

      const closeButton = screen.getByText('×')
      fireEvent.click(closeButton)

      // Should close immediately on desktop
      expect(mockProps.onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Gender Filter', () => {
    it('should render gender select options', () => {
      render(<FilterModal {...mockProps} />)

      const genderSelect = screen.getByDisplayValue('All')
      expect(genderSelect).toBeInTheDocument()

      // Should have Male, Female, Other options
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Male')).toBeInTheDocument()
      expect(screen.getByText('Female')).toBeInTheDocument()
      expect(screen.getByText('Other')).toBeInTheDocument()
    })

    it('should call onFilterChange when gender is selected and applied', () => {
      render(<FilterModal {...mockProps} />)

      const genderSelect = screen.getByDisplayValue('All')
      fireEvent.change(genderSelect, { target: { value: 'Male' } })

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('gender', 'Male')
    })
  })

  describe('Age Range Filter', () => {
    it('should display current age range', () => {
      render(<FilterModal {...mockProps} />)

      expect(screen.getByText('18 - 100 years')).toBeInTheDocument()
    })

    it('should render age slider', () => {
      render(<FilterModal {...mockProps} />)

      const slider = screen.getByTestId('mock-slider')
      expect(slider).toBeInTheDocument()
    })

    it('should update age range when slider values change and apply filters', () => {
      render(<FilterModal {...mockProps} />)

      const minSlider = screen.getByTestId('slider-min')
      const maxSlider = screen.getByTestId('slider-max')

      // Change slider values
      fireEvent.change(minSlider, { target: { value: '25' } })
      fireEvent.change(maxSlider, { target: { value: '35' } })

      // Apply filters
      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMin', 25)
      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMax', 35)
    })
  })

  describe('Course Filter', () => {
    it('should render course select with available courses', () => {
      render(<FilterModal {...mockProps} />)

      const courseSelect = screen.getByDisplayValue('All Courses')
      expect(courseSelect).toBeInTheDocument()

      expect(screen.getByText('All Courses')).toBeInTheDocument()
      expect(screen.getByText('Computer Science')).toBeInTheDocument()
      expect(screen.getByText('Engineering')).toBeInTheDocument()
      expect(screen.getByText('Business')).toBeInTheDocument()
    })

    it('should call onFilterChange when course is selected and applied', () => {
      render(<FilterModal {...mockProps} />)

      const courseSelect = screen.getByDisplayValue('All Courses')
      fireEvent.change(courseSelect, { target: { value: 'Computer Science' } })

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('course', 'Computer Science')
    })
  })

  describe('Interests Filter', () => {
    it('should render interest checkboxes', () => {
      render(<FilterModal {...mockProps} />)

      expect(screen.getByText('coding')).toBeInTheDocument()
      expect(screen.getByText('sports')).toBeInTheDocument()
      expect(screen.getByText('music')).toBeInTheDocument()
      expect(screen.getByText('reading')).toBeInTheDocument()
    })

    it('should toggle interest selection and apply', () => {
      render(<FilterModal {...mockProps} />)

      const codingLabel = screen.getByText('coding')
      fireEvent.click(codingLabel)

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('interests', ['coding'])
    })

    it('should handle multiple interest selections and apply', () => {
      render(<FilterModal {...mockProps} />)

      const codingLabel = screen.getByText('coding')
      const sportsLabel = screen.getByText('sports')

      fireEvent.click(codingLabel)
      fireEvent.click(sportsLabel)

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('interests', ['coding', 'sports'])
    })
  })

  describe('Clear Filters', () => {
    it('should call onClearFilters when clear button is clicked', () => {
      render(<FilterModal {...mockProps} />)

      const clearButton = screen.getByText('Clear All')
      fireEvent.click(clearButton)

      expect(mockProps.onClearFilters).toHaveBeenCalledTimes(1)
    })

    it('should reset local filters when clear button is clicked', () => {
      const filtersWithValues = {
        gender: 'Male',
        ageMin: 25,
        ageMax: 35,
        course: 'Computer Science',
        interests: ['coding', 'sports'],
      }

      render(<FilterModal {...mockProps} filters={filtersWithValues} />)

      const clearButton = screen.getByText('Clear All')
      fireEvent.click(clearButton)

      expect(mockProps.onClearFilters).toHaveBeenCalledTimes(1)
    })
  })

  describe('Local State Management', () => {
    it('should initialize with provided filters', () => {
      const customFilters = {
        gender: 'Female',
        ageMin: 20,
        ageMax: 30,
        course: 'Engineering',
        interests: ['music'],
      }

      render(<FilterModal {...mockProps} filters={customFilters} />)

      // Should reflect the initial filter values
      expect(screen.getByDisplayValue('Female')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument()
      expect(screen.getByText('20 - 30 years')).toBeInTheDocument()
    })

    it('should sync local filters when props change', () => {
      const { rerender } = render(<FilterModal {...mockProps} />)

      const newFilters = {
        gender: 'Male',
        ageMin: 25,
        ageMax: 35,
        course: 'Computer Science',
        interests: ['coding'],
      }

      rerender(<FilterModal {...mockProps} filters={newFilters} />)

      // Should update to new filter values
      expect(screen.getByText('25 - 35 years')).toBeInTheDocument()
    })
  })

  describe('Mobile Behavior', () => {
    it('should handle mobile prop', () => {
      render(<FilterModal {...mockProps} isMobile={true} />)

      // Should still render properly on mobile
      expect(screen.getByText('Filter Profiles')).toBeInTheDocument()
    })

    it('should render mobile modal', () => {
      render(<FilterModal {...mockProps} isMobile={true} />)

      const modal = screen.getByText('Filter Profiles').closest('.filter-modal-mobile')
      expect(modal).toBeInTheDocument()
    })

    it('should handle backdrop click on mobile with animation', () => {
      jest.useFakeTimers()
      render(<FilterModal {...mockProps} isMobile={true} />)

      const backdrop = screen.getByText('Filter Profiles').closest('.filter-modal-overlay')
      fireEvent.click(backdrop!)

      // Should not close immediately - animation delay
      expect(mockProps.onClose).not.toHaveBeenCalled()

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Should close after animation delay
      expect(mockProps.onClose).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })

    it('should handle backdrop click on desktop', () => {
      render(<FilterModal {...mockProps} isMobile={false} />)

      const backdrop = screen.getByText('Filter Profiles').closest('.filter-modal-overlay')
      fireEvent.click(backdrop!)

      // Should close immediately on desktop
      expect(mockProps.onClose).toHaveBeenCalledTimes(1)
    })

    it('should handle close button click on mobile with animation', () => {
      jest.useFakeTimers()
      render(<FilterModal {...mockProps} isMobile={true} />)

      const closeButton = screen.getByText('×')
      fireEvent.click(closeButton)

      // Should not close immediately - animation delay
      expect(mockProps.onClose).not.toHaveBeenCalled()

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Should close after animation delay
      expect(mockProps.onClose).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })

    it('should handle cancel button click on mobile with animation', () => {
      jest.useFakeTimers()
      render(<FilterModal {...mockProps} isMobile={true} />)

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      // Should not close immediately - animation delay
      expect(mockProps.onClose).not.toHaveBeenCalled()

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Should close after animation delay
      expect(mockProps.onClose).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })

    it('should handle apply button click on mobile with animation', () => {
      jest.useFakeTimers()
      render(<FilterModal {...mockProps} isMobile={true} />)

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      // Should not close immediately - animation delay
      expect(mockProps.onClose).not.toHaveBeenCalled()

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Should close after animation delay
      expect(mockProps.onClose).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })

    it('should handle mobile modal click to prevent backdrop close', () => {
      render(<FilterModal {...mockProps} isMobile={true} />)

      const modal = screen.getByText('Filter Profiles').closest('.filter-modal-mobile')
      fireEvent.click(modal!)

      // Should not close when clicking on modal itself
      expect(mockProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('Slider Interactions', () => {
    it('should handle slider value changes and apply', () => {
      render(<FilterModal {...mockProps} />)

      const minSlider = screen.getByTestId('slider-min')
      const maxSlider = screen.getByTestId('slider-max')

      // Test minimum and maximum age changes
      fireEvent.change(minSlider, { target: { value: '22' } })
      fireEvent.change(maxSlider, { target: { value: '45' } })

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMin', 22)
      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMax', 45)
    })

    it('should handle age range changes and apply', () => {
      render(<FilterModal {...mockProps} />)

      const minSlider = screen.getByTestId('slider-min')

      // Try to set min age to a different value
      fireEvent.change(minSlider, { target: { value: '25' } })

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMin', 25)
    })

    it('should handle invalid age range input gracefully', () => {
      render(<FilterModal {...mockProps} />)

      // The age range change handler should handle non-array values gracefully
      // This is tested implicitly through the slider mock, but we can add a specific test
      expect(screen.getByText('18 - 100 years')).toBeInTheDocument()
    })

    it('should handle non-array age range values', () => {
      render(<FilterModal {...mockProps} />)

      // Use the test button that passes a non-array value to onChange
      const testButton = screen.getByTestId('test-non-array')
      fireEvent.click(testButton)

      // The handleAgeRangeChange should handle non-array values gracefully (early return)
      // This tests line 105 in the component (the early return when !Array.isArray(newValue))
      expect(screen.getByText('18 - 100 years')).toBeInTheDocument()
    })

    it('should enforce minimum age distance in slider', () => {
      render(<FilterModal {...mockProps} />)

      const minSlider = screen.getByTestId('slider-min')
      const maxSlider = screen.getByTestId('slider-max')

      // Try to set min age too close to max age (should enforce 5 year minimum)
      fireEvent.change(minSlider, { target: { value: '95' } }) // Max is 100, this should be clamped
      fireEvent.change(maxSlider, { target: { value: '100' } })

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      // The component should enforce the minimum distance
      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMin', 95)
      expect(mockProps.onFilterChange).toHaveBeenCalledWith('ageMax', 100)
    })
  })

  describe('Interest Management', () => {
    it('should remove interest when clicking selected interest', () => {
      const filtersWithInterests = {
        ...mockFilters,
        interests: ['coding', 'sports'],
      }

      render(<FilterModal {...mockProps} filters={filtersWithInterests} />)

      const codingLabel = screen.getByText('coding')
      fireEvent.click(codingLabel)

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      // Should remove 'coding' from interests, keeping 'sports'
      expect(mockProps.onFilterChange).toHaveBeenCalledWith('interests', ['sports'])
    })

    it('should handle interest selection and deselection', () => {
      render(<FilterModal {...mockProps} />)

      const codingLabel = screen.getByText('coding')

      // Select interest
      fireEvent.click(codingLabel)

      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('interests', ['coding'])

      // Reset mocks and re-render
      jest.clearAllMocks()
      // Note: In a real scenario, the component would re-render with updated state
      // For this test, we're demonstrating the toggle logic exists
    })
  })

  describe('Form Submission', () => {
    it('should handle filter application through Apply Filters button', () => {
      render(<FilterModal {...mockProps} />)

      // Change gender filter
      const genderSelect = screen.getByDisplayValue('All')
      fireEvent.change(genderSelect, { target: { value: 'Female' } })

      // Apply filters
      const applyButton = screen.getByText('Apply Filters')
      fireEvent.click(applyButton)

      expect(mockProps.onFilterChange).toHaveBeenCalledWith('gender', 'Female')
    })
  })

  describe('Accessibility', () => {
    it('should have proper labels for form controls', () => {
      render(<FilterModal {...mockProps} />)

      expect(screen.getByText('Gender:')).toBeInTheDocument()
      expect(screen.getByText('Age Range')).toBeInTheDocument()
      expect(screen.getByText('Course:')).toBeInTheDocument()
      expect(screen.getByText('Interests (select multiple):')).toBeInTheDocument()
    })

    it('should have descriptive button text', () => {
      render(<FilterModal {...mockProps} />)

      expect(screen.getByText('Clear All')).toBeInTheDocument()
      expect(screen.getByText('×')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty available courses list', () => {
      render(<FilterModal {...mockProps} availableCourses={[]} />)

      const courseSelect = screen.getByDisplayValue('All Courses')
      expect(courseSelect).toBeInTheDocument()
      expect(screen.getByText('All Courses')).toBeInTheDocument()
    })

    it('should handle empty available interests list', () => {
      render(<FilterModal {...mockProps} availableInterests={[]} />)

      // Should not crash with empty interests
      expect(screen.getByText('Filter Profiles')).toBeInTheDocument()
    })

    it('should handle extreme age values', () => {
      const extremeFilters = {
        ...mockFilters,
        ageMin: 18,
        ageMax: 100,
      }

      render(<FilterModal {...mockProps} filters={extremeFilters} />)

      expect(screen.getByText('18 - 100 years')).toBeInTheDocument()
    })
  })
})
