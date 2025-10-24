import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ToastContainer from '../../components/ToastContainer'

describe('ToastContainer', () => {
  const mockRemoveToast = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render nothing when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} removeToast={mockRemoveToast} />)
    expect(container.querySelector('.toast-container')).toBeEmptyDOMElement()
  })

  it('should render toasts', () => {
    const toasts = [
      { id: 1, message: 'Success message', type: 'success' as const },
      { id: 2, message: 'Error message', type: 'error' as const },
    ]

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />)

    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('should apply correct CSS class based on toast type', () => {
    const toasts = [
      { id: 1, message: 'Success', type: 'success' as const },
      { id: 2, message: 'Error', type: 'error' as const },
      { id: 3, message: 'Warning', type: 'warning' as const },
    ]

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />)

    const successToast = screen.getByText('Success').closest('.toast')
    const errorToast = screen.getByText('Error').closest('.toast')
    const warningToast = screen.getByText('Warning').closest('.toast')

    expect(successToast).toHaveClass('toast-success')
    expect(errorToast).toHaveClass('toast-error')
    expect(warningToast).toHaveClass('toast-warning')
  })

  it('should call removeToast when close button is clicked', () => {
    const toasts = [{ id: 1, message: 'Test message', type: 'success' as const }]

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />)

    const closeButton = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeButton)

    expect(mockRemoveToast).toHaveBeenCalledWith(1)
  })

  it('should render multiple close buttons for multiple toasts', () => {
    const toasts = [
      { id: 1, message: 'Message 1', type: 'success' as const },
      { id: 2, message: 'Message 2', type: 'warning' as const },
    ]

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />)

    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    expect(closeButtons).toHaveLength(2)

    fireEvent.click(closeButtons[0])
    expect(mockRemoveToast).toHaveBeenCalledWith(1)

    fireEvent.click(closeButtons[1])
    expect(mockRemoveToast).toHaveBeenCalledWith(2)
  })
})
