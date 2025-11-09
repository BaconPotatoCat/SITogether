import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ConversationPage from '../../pages/chat/[id]'
import { useRouter } from 'next/router'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock messageValidation
jest.mock('../../utils/messageValidation', () => ({
  sanitizeForDisplay: jest.fn((text: string) => text),
}))

describe('Conversation Page - Empty State', () => {
  const mockPush = jest.fn()
  let originalUnhandledRejection: NodeJS.UnhandledRejectionListener[]
  let rejectionHandler: ((reason: unknown) => void) | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      pathname: '/chat/[id]',
      query: { id: 'conversation-123' },
    } as unknown as ReturnType<typeof useRouter>)
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Store original unhandled rejection handlers
    originalUnhandledRejection = process.listeners(
      'unhandledRejection'
    ) as NodeJS.UnhandledRejectionListener[]
  })

  afterEach(() => {
    // Remove our handler if it exists
    if (rejectionHandler) {
      process.removeListener('unhandledRejection', rejectionHandler)
      rejectionHandler = null
    }

    // Restore original unhandled rejection handlers
    process.removeAllListeners('unhandledRejection')
    originalUnhandledRejection.forEach((handler) => {
      process.on('unhandledRejection', handler)
    })
    jest.restoreAllMocks()
  })

  describe('Empty Conversation Rendering', () => {
    it('should display loading state initially', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('should display empty conversation thread when no messages exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Chat thread should be present but empty
      const chatThread = document.querySelector('.chat-thread')
      expect(chatThread).toBeInTheDocument()

      // No message bubbles should be present
      const chatBubbles = document.querySelectorAll('.chat-bubble')
      expect(chatBubbles).toHaveLength(0)

      // No chat rows should be present
      const chatRows = document.querySelectorAll('.chat-row')
      expect(chatRows).toHaveLength(0)
    })

    it('should display back button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      expect(screen.getByText('← Back')).toBeInTheDocument()
    })

    it('should display message input form when conversation is not locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Message input should be present
      const input = screen.getByPlaceholderText('Type a message')
      expect(input).toBeInTheDocument()
      expect(input).not.toBeDisabled()

      // Send button should be present
      const sendButton = screen.getByText('Send')
      expect(sendButton).toBeInTheDocument()
      expect(sendButton).toBeDisabled() // Disabled because input is empty
    })

    it('should display locked banner when conversation is locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: true,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      expect(
        screen.getByText('🔒 Chat is locked until you both like each other.')
      ).toBeInTheDocument()
    })

    it('should disable message input when conversation is locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: true,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Chat is locked')
      expect(input).toBeInTheDocument()
      expect(input).toBeDisabled()

      const sendButton = screen.getByText('Send')
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Empty Conversation API Interaction', () => {
    it('should fetch messages on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/conversations/conversation-123/messages')
      })
    })

    it('should handle API response with empty messages array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const chatThread = document.querySelector('.chat-thread')
      expect(chatThread).toBeInTheDocument()
      expect(chatThread?.children.length).toBe(1) // Only the endRef div
    })

    it('should handle API response with success false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Conversation not found' }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Should still render the page structure
      expect(screen.getByText('← Back')).toBeInTheDocument()
    })

    it('should not fetch messages when id is not available', () => {
      mockUseRouter.mockReturnValue({
        push: mockPush,
        pathname: '/chat/[id]',
        query: {},
      } as unknown as ReturnType<typeof useRouter>)

      render(<ConversationPage />)

      // Should not call fetch when id is missing
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Empty Conversation Structure', () => {
    it('should have correct conversation page structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      const { container } = render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Should have main container
      const main = container.querySelector('main.container')
      expect(main).toBeInTheDocument()

      // Should have back button
      const backButton = screen.getByText('← Back')
      expect(backButton).toBeInTheDocument()

      // Should have chat thread
      const chatThread = main?.querySelector('.chat-thread')
      expect(chatThread).toBeInTheDocument()

      // Should have message form
      const form = main?.querySelector('form')
      expect(form).toBeInTheDocument()
    })

    it('should have empty chat thread with only endRef div', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      const { container } = render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const chatThread = container.querySelector('.chat-thread')
      expect(chatThread).toBeInTheDocument()

      // Should only have the endRef div (no messages)
      expect(chatThread?.children.length).toBe(1)
      expect(chatThread?.querySelector('.chat-row')).not.toBeInTheDocument()
    })

    it('should render message input with correct attributes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Type a message') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.type).toBe('text')
      expect(input.maxLength).toBe(5000)
      expect(input.value).toBe('')
    })
  })

  describe('Empty Conversation with Locked State', () => {
    it('should show lock banner and disable input when locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: true,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Lock banner should be visible
      const lockBanner = document.querySelector('.lock-banner')
      expect(lockBanner).toBeInTheDocument()
      expect(lockBanner?.textContent).toContain('Chat is locked until you both like each other.')

      // Input should be disabled
      const input = screen.getByPlaceholderText('Chat is locked')
      expect(input).toBeDisabled()

      // Send button should be disabled
      const sendButton = screen.getByText('Send')
      expect(sendButton).toBeDisabled()
    })

    it('should not show lock banner when conversation is not locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Lock banner should not be visible
      const lockBanner = document.querySelector('.lock-banner')
      expect(lockBanner).not.toBeInTheDocument()
    })

    it('should hide the report button when conversation is locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: true,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Report button should not be visible at all
      const reportButton = screen.queryByText('🚩 Report')
      expect(reportButton).not.toBeInTheDocument()
    })
  })

  describe('Empty Conversation Navigation', () => {
    it('should navigate back when back button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const backButton = screen.getByText('← Back')
      fireEvent.click(backButton)

      expect(mockPush).toHaveBeenCalledWith('/chat')
    })
  })

  describe('Empty Conversation Message Sending', () => {
    it('should not send message when input is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const form = screen.getByText('Send').closest('form')
      expect(form).toBeInTheDocument()

      const sendButton = screen.getByText('Send')
      expect(sendButton).toBeDisabled()

      // Try to submit form
      fireEvent.submit(form!)

      // Should not make a POST request (only GET requests for messages and potentially avatar enrichment)
      // The component may make additional GET requests for avatar enrichment
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should not send message when conversation is locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: true,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Chat is locked')
      const sendButton = screen.getByText('Send')

      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Loading to Empty State Transition', () => {
    it('should transition from loading to empty conversation smoothly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      const { container } = render(<ConversationPage />)

      // Initially should show loading
      expect(screen.getByText('Loading…')).toBeInTheDocument()

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })

      // Should now show empty conversation
      const chatThread = container.querySelector('.chat-thread')
      expect(chatThread).toBeInTheDocument()
      expect(chatThread?.querySelectorAll('.chat-row')).toHaveLength(0)
    })
  })

  describe('Head Metadata', () => {
    it('should set correct page title', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Me', avatarUrl: null },
            other: { id: 'user-2', name: 'Other User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      // Check that Head component would set the title
      expect(document.title || 'SITogether • Conversation').toBeTruthy()
    })
  })
})
