import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LikedProfiles from '../../pages/liked'
import { useRouter } from 'next/router'
import { fetchWithAuth } from '../../utils/api'
import { useToast } from '../../hooks/useToast'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock API
jest.mock('../../utils/api', () => ({
  fetchWithAuth: jest.fn(),
}))

// Mock useToast hook
jest.mock('../../hooks/useToast', () => ({
  useToast: jest.fn(),
}))

// Mock IntroMessageModal
jest.mock('../../components/IntroMessageModal', () => {
  return function IntroMessageModal({
    isOpen,
    onCancel,
    onSubmit,
  }: {
    isOpen: boolean
    onCancel: () => void
    onSubmit: (message: string | null) => void
  }) {
    if (!isOpen) return null
    return (
      <div data-testid="intro-modal">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => onSubmit('Test intro message')}>Submit</button>
      </div>
    )
  }
})

// Mock ToastContainer
jest.mock('../../components/ToastContainer', () => {
  return function ToastContainer() {
    return null
  }
})

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockFetchWithAuth = fetchWithAuth as jest.MockedFunction<typeof fetchWithAuth>
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>

const mockPush = jest.fn()
const mockShowToast = jest.fn()
const mockRemoveToast = jest.fn()

describe('LikedProfiles', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console.error to reduce test noise (errors are expected in some tests)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockUseRouter.mockReturnValue({
      push: mockPush,
      query: {},
      isReady: true,
    } as unknown as ReturnType<typeof useRouter>)
    mockUseToast.mockReturnValue({
      toasts: [],
      showToast: mockShowToast,
      removeToast: mockRemoveToast,
    })
    // Default mock to prevent unhandled promise rejections
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should display loading state initially', () => {
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<LikedProfiles />)

    expect(screen.getByText(/loading liked profiles/i)).toBeInTheDocument()
  })

  it('should display error message when fetch fails', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText(/error loading profiles/i)).toBeInTheDocument()
    })
  })

  it('should display empty state when no profiles', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText(/no profiles to introduce yourself to/i)).toBeInTheDocument()
    })
  })

  it('should display profiles list', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding', 'music'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: false,
      },
    ]

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProfiles }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
      expect(screen.getByText('Computer Science')).toBeInTheDocument()
    })
  })

  it('should show "Send an Introduction" button when hasIntro is false', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: false,
      },
    ]

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProfiles }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Send an Introduction')).toBeInTheDocument()
    })
  })

  it('should show "Introduction Already Sent ✓" button when hasIntro is true', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: true,
      },
    ]

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProfiles }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Introduction Already Sent ✓')).toBeInTheDocument()
    })

    const button = screen.getByText('Introduction Already Sent ✓')
    expect(button).toBeDisabled()
  })

  it('should open intro modal when clicking "Send an Introduction" button', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: false,
      },
    ]

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProfiles }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Send an Introduction')).toBeInTheDocument()
    })

    // Click "Send an Introduction" button
    const sendButton = screen.getByText('Send an Introduction')
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByTestId('intro-modal')).toBeInTheDocument()
    })
  })

  it('should not open intro modal when hasIntro is true', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: true,
      },
    ]

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockProfiles }),
    } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Introduction Already Sent ✓')).toBeInTheDocument()
    })

    // Intro modal should not be open
    expect(screen.queryByTestId('intro-modal')).not.toBeInTheDocument()
  })

  it('should show success toast when intro is sent successfully', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: false,
      },
    ]

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProfiles }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, introMessage: { id: 'msg-1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ ...mockProfiles[0], hasIntro: true }],
        }),
      } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Send an Introduction')).toBeInTheDocument()
    })

    // Click "Send an Introduction" button
    const sendButton = screen.getByText('Send an Introduction')
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByTestId('intro-modal')).toBeInTheDocument()
    })

    // Submit intro
    const submitButton = screen.getByText('Submit')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Introduction sent successfully!', 'success')
    })
  })

  it('should show warning toast when intro already sent (409 error)', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: false,
      },
    ]

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProfiles }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ success: false, error: 'Introduction message already sent' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ ...mockProfiles[0], hasIntro: true }],
        }),
      } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Send an Introduction')).toBeInTheDocument()
    })

    // Click "Send an Introduction" button
    const sendButton = screen.getByText('Send an Introduction')
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByTestId('intro-modal')).toBeInTheDocument()
    })

    // Submit intro (will trigger 409 error)
    const submitButton = screen.getByText('Submit')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'You have already sent an introduction message to this user.',
        'warning'
      )
    })
  })

  it('should show error toast when intro send fails', async () => {
    const mockProfiles = [
      {
        id: 'user-1',
        name: 'John Doe',
        age: 25,
        gender: 'Male',
        course: 'Computer Science',
        bio: 'Test bio',
        interests: ['coding'],
        avatarUrl: 'https://example.com/avatar.jpg',
        hasIntro: false,
      },
    ]

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProfiles }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Server error' }),
      } as Response)

    render(<LikedProfiles />)

    await waitFor(() => {
      expect(screen.getByText('John Doe, 25')).toBeInTheDocument()
    })

    // Click on profile to open modal
    const profileCard = screen.getByText('John Doe, 25')
    fireEvent.click(profileCard)

    await waitFor(() => {
      expect(screen.getByText('Send an Introduction')).toBeInTheDocument()
    })

    // Click "Send an Introduction" button
    const sendButton = screen.getByText('Send an Introduction')
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByTestId('intro-modal')).toBeInTheDocument()
    })

    // Submit intro (will trigger error)
    const submitButton = screen.getByText('Submit')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Failed to send introduction: Server error',
        'error'
      )
    })
  })
})
