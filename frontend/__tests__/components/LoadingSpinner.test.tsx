import { render, screen } from '@testing-library/react'
import LoadingSpinner from '../../components/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('should render inline spinner by default', () => {
    render(<LoadingSpinner />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByText('Loading...').closest('div')).toHaveClass('loading-inline')
  })

  it('should render fullscreen spinner when fullScreen is true', () => {
    render(<LoadingSpinner fullScreen />)
    
    const overlay = document.querySelector('.loading-overlay')
    expect(overlay).toBeInTheDocument()
  })

  it('should display custom message', () => {
    render(<LoadingSpinner message="Loading session..." />)
    
    expect(screen.getByText('Loading session...')).toBeInTheDocument()
  })

  it('should display custom message in fullscreen mode', () => {
    render(<LoadingSpinner fullScreen message="Authenticating..." />)
    
    expect(screen.getByText('Authenticating...')).toBeInTheDocument()
  })

  it('should have spinner element', () => {
    const { container } = render(<LoadingSpinner />)
    
    const spinner = container.querySelector('.spinner')
    expect(spinner).toBeInTheDocument()
  })
})

