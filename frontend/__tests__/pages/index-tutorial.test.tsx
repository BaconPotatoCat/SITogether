import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from '../../pages/index'
import { fetchWithAuth } from '../../utils/api'

// Mock the API
jest.mock('../../utils/api')
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>

// Mock react-joyride
interface JoyrideStep {
  content: React.ReactNode
  target: string
  placement?: string
  disableBeacon?: boolean
}

interface JoyrideProps {
  steps: JoyrideStep[]
  run: boolean
  callback?: (data: { status: string }) => void
}

interface WindowWithJoyride extends Window {
  __joyrideCallback?: (data: { status: string }) => void
}

jest.mock('react-joyride', () => {
  const React = jest.requireActual('react')
  const MockJoyride = ({ steps, run, callback }: JoyrideProps) => {
    // Store callback for testing - always call useEffect, but conditionally set callback
    React.useEffect(() => {
      if (run && callback && steps.length > 0) {
        // Store callback globally for test access
        ;(window as WindowWithJoyride).__joyrideCallback = callback
      } else {
        ;(window as WindowWithJoyride).__joyrideCallback = undefined
      }
    }, [run, callback, steps.length])
    return run ? (
      <div data-testid="joyride-component" data-steps-count={steps.length}>
        {steps.map((step: JoyrideStep, index: number) => (
          <div key={index} data-testid={`joyride-step-${index}`}>
            {step.content}
          </div>
        ))}
      </div>
    ) : null
  }
  return {
    __esModule: true,
    default: MockJoyride,
    STATUS: {
      FINISHED: 'finished',
      SKIPPED: 'skipped',
    },
  }
})

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
  }),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 1024,
})

describe('Home Page - Tutorial Feature', () => {
  const mockUsers = [
    {
      id: '1',
      name: 'Alice Johnson',
      age: 25,
      gender: 'Female',
      course: 'Computer Science',
      bio: 'Love coding!',
      interests: ['coding', 'gaming'],
      avatarUrl: 'https://example.com/avatar1.jpg',
    },
    {
      id: '2',
      name: 'Bob Smith',
      age: 23,
      gender: 'Male',
      course: 'Engineering',
      bio: 'Engineering student',
      interests: ['engineering', 'sports'],
      avatarUrl: 'https://example.com/avatar2.jpg',
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Suppress console warnings about act() for cleaner test output
    jest.spyOn(console, 'error').mockImplementation((message) => {
      if (typeof message === 'string' && message.includes('not wrapped in act')) {
        return
      }
      // eslint-disable-next-line no-console
      console.error(message)
    })
    // Clear localStorage
    localStorage.clear()
    // Clear any stored callbacks
    ;(window as WindowWithJoyride).__joyrideCallback = undefined

    // Mock successful API response
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUsers }),
    } as Response)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    localStorage.clear()
    jest.restoreAllMocks()
  })

  describe('Tutorial Initialization', () => {
    it('should start tutorial on first visit when users are loaded', async () => {
      await act(async () => {
        render(<Home />)
      })

      // Wait for users to load
      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/Loading profiles/)).not.toBeInTheDocument()
      })

      // Fast-forward timers to trigger tutorial
      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const joyride = screen.queryByTestId('joyride-component')
        expect(joyride).toBeInTheDocument()
      })
    })

    it('should not start tutorial if user has already seen it', async () => {
      localStorage.setItem('sitogether-tutorial-completed', 'true')

      await act(async () => {
        render(<Home />)
      })

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        expect(screen.queryByText(/Loading profiles/)).not.toBeInTheDocument()
      })

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const joyride = screen.queryByTestId('joyride-component')
        expect(joyride).not.toBeInTheDocument()
      })
    })

    it('should not start tutorial if no users are available', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response)

      await act(async () => {
        render(<Home />)
      })

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        expect(screen.queryByText(/Loading profiles/)).not.toBeInTheDocument()
      })

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const joyride = screen.queryByTestId('joyride-component')
        expect(joyride).not.toBeInTheDocument()
      })
    })

    it('should not start tutorial while still loading', async () => {
      render(<Home />)

      // Don't advance timers yet - should not show tutorial
      const joyride = screen.queryByTestId('joyride-component')
      expect(joyride).not.toBeInTheDocument()
    })
  })

  describe('Empty feed behavior', () => {
    it('does not render Pass/Like/Report buttons when no profiles are available', async () => {
      // Make API return an empty list
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response)

      await act(async () => {
        render(<Home />)
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        expect(screen.queryByText(/Loading profiles/)).not.toBeInTheDocument()
      })

      // The "all caught up" text should be visible
      expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument()

      // The action buttons should not be in the document
      expect(screen.queryByRole('button', { name: /pass/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /like/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /report/i })).not.toBeInTheDocument()

      // The swipe-actions container should not render
      expect(document.querySelector('.swipe-actions')).toBeNull()
    })
  })

  describe('Tutorial Steps Configuration', () => {
    it('should render all tutorial steps when tutorial runs', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const joyride = screen.getByTestId('joyride-component')
        expect(joyride).toBeInTheDocument()
        // Should have 5 steps
        expect(joyride).toHaveAttribute('data-steps-count', '5')
      })
    })

    it('should include welcome step with correct content', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(screen.getByText(/Welcome to SITogether!/)).toBeInTheDocument()
        expect(screen.getByText(/Let's learn how to use the platform/)).toBeInTheDocument()
      })
    })

    it('should include like button step with correct content', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const step1 = screen.getByTestId('joyride-step-1')
        expect(step1).toBeInTheDocument()
        expect(step1).toHaveTextContent('Like a Person')
        expect(step1).toHaveTextContent('Click the')
        expect(step1).toHaveTextContent('Like')
      })
    })

    it('should include pass button step with correct content', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const step2 = screen.getByTestId('joyride-step-2')
        expect(step2).toBeInTheDocument()
        expect(step2).toHaveTextContent('Pass on a Person')
        expect(step2).toHaveTextContent('Click the')
        expect(step2).toHaveTextContent('Pass')
      })
    })

    it('should include liked tab step with correct content', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const step3 = screen.getByTestId('joyride-step-3')
        expect(step3).toBeInTheDocument()
        expect(step3).toHaveTextContent('Send Introductions')
        expect(step3).toHaveTextContent('Visit the')
        expect(step3).toHaveTextContent('Liked')
      })
    })

    it('should include chat tab step with correct content', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const step4 = screen.getByTestId('joyride-step-4')
        expect(step4).toBeInTheDocument()
        expect(step4).toHaveTextContent('View Your Chats')
        expect(step4).toHaveTextContent('Once you match')
        expect(step4).toHaveTextContent('Chat')
      })
    })
  })

  describe('Tutorial Data Attributes', () => {
    it('should have data-tutorial attribute on like button', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        const likeButton = screen.getByText('Like').closest('button')
        expect(likeButton).toHaveAttribute('data-tutorial', 'like-button')
      })
    })

    it('should have data-tutorial attribute on pass button', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        const passButton = screen.getByText('Pass').closest('button')
        expect(passButton).toHaveAttribute('data-tutorial', 'pass-button')
      })
    })
  })

  describe('Tutorial Callback Handling', () => {
    it('should save to localStorage when tutorial is finished', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(screen.getByTestId('joyride-component')).toBeInTheDocument()
      })

      // Simulate tutorial completion
      const callback = (window as WindowWithJoyride).__joyrideCallback
      if (callback) {
        act(() => {
          callback({ status: 'finished' })
        })

        await waitFor(() => {
          expect(localStorage.getItem('sitogether-tutorial-completed')).toBe('true')
        })
      }
    })

    it('should save to localStorage when tutorial is skipped', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(screen.getByTestId('joyride-component')).toBeInTheDocument()
      })

      // Simulate tutorial skip
      const callback = (window as WindowWithJoyride).__joyrideCallback
      if (callback) {
        act(() => {
          callback({ status: 'skipped' })
        })

        await waitFor(() => {
          expect(localStorage.getItem('sitogether-tutorial-completed')).toBe('true')
        })
      }
    })
  })

  describe('Tutorial Integration', () => {
    it('should render Joyride component with correct props', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const joyride = screen.getByTestId('joyride-component')
        expect(joyride).toBeInTheDocument()
        // Verify it has steps
        expect(joyride).toHaveAttribute('data-steps-count')
      })
    })

    it('should not render Joyride when runTutorial is false', async () => {
      localStorage.setItem('sitogether-tutorial-completed', 'true')

      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      act(() => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const joyride = screen.queryByTestId('joyride-component')
        expect(joyride).not.toBeInTheDocument()
      })
    })
  })

  describe('Tutorial Step Targets', () => {
    it('should target swipe-section for welcome step', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      // Verify swipe-section exists
      await waitFor(() => {
        const swipeSection = document.querySelector('.swipe-section')
        expect(swipeSection).toBeInTheDocument()
      })
    })

    it('should target like button with correct selector', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        const likeButton = document.querySelector('[data-tutorial="like-button"]')
        expect(likeButton).toBeInTheDocument()
        expect(likeButton).toHaveTextContent('Like')
      })
    })

    it('should target pass button with correct selector', async () => {
      render(<Home />)

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/users')
      })

      await waitFor(() => {
        const passButton = document.querySelector('[data-tutorial="pass-button"]')
        expect(passButton).toBeInTheDocument()
        expect(passButton).toHaveTextContent('Pass')
      })
    })
  })
})
