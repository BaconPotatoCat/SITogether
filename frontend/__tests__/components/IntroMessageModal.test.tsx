import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import IntroMessageModal from '../../components/IntroMessageModal'

describe('IntroMessageModal', () => {
  const mockOnCancel = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <IntroMessageModal
        isOpen={false}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    )
    expect(screen.queryByText('Send an introduction')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    )
    expect(screen.getByText('Add an intro message (optional)')).toBeInTheDocument()
  })

  it('should show required title when required is true', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
        required={true}
      />
    )
    expect(screen.getByText('Send an introduction')).toBeInTheDocument()
  })

  it('should show optional title when required is false', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
        required={false}
      />
    )
    expect(screen.getByText('Add an intro message (optional)')).toBeInTheDocument()
  })

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    )
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('should call onSubmit with message when submit button is clicked', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    )
    const textarea = screen.getByPlaceholderText('Write a friendly opener…')
    const submitButton = screen.getByText('Send like')

    fireEvent.change(textarea, { target: { value: 'Hello!' } })
    fireEvent.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith('Hello!')
  })

  it('should call onSubmit with null when message is empty and not required', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
        required={false}
      />
    )
    const submitButton = screen.getByText('Send like')
    fireEvent.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith(null)
  })

  it('should not call onSubmit when message is empty and required is true', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
        required={true}
      />
    )
    const submitButton = screen.getByText('Send Introduction')
    expect(submitButton).toBeDisabled()
    
    fireEvent.click(submitButton)
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should use custom submitButtonText when provided', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
        submitButtonText="Custom Submit"
      />
    )
    expect(screen.getByText('Custom Submit')).toBeInTheDocument()
  })

  it('should limit input to 5000 characters', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    )
    const textarea = screen.getByPlaceholderText('Write a friendly opener…') as HTMLTextAreaElement
    
    const longText = 'a'.repeat(5001)
    fireEvent.change(textarea, { target: { value: longText } })
    
    // Should be limited to 5000 characters
    expect(textarea.value.length).toBeLessThanOrEqual(5000)
  })

  it('should trim whitespace when submitting', () => {
    render(
      <IntroMessageModal
        isOpen={true}
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    )
    const textarea = screen.getByPlaceholderText('Write a friendly opener…')
    const submitButton = screen.getByText('Send like')

    fireEvent.change(textarea, { target: { value: '  Hello!  ' } })
    fireEvent.click(submitButton)

    expect(mockOnSubmit).toHaveBeenCalledWith('Hello!')
  })
})

