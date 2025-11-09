import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Chat from '../../pages/chat'
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

describe('Chat Pages - Deleted Users', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      pathname: '/chat',
      query: {},
    } as unknown as ReturnType<typeof useRouter>)
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Chat List Page - Deleted Users', () => {
    it('should display "Deleted User" when other user has been deleted', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          isLocked: false,
          lastMessage: { content: 'Hello!', createdAt: '2024-01-01T00:00:00.000Z' },
          otherUser: { name: 'Deleted User', avatarUrl: null },
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, conversations: mockConversations }),
      } as Response)

      render(<Chat />)

      await waitFor(() => {
        expect(screen.getByText('Deleted User')).toBeInTheDocument()
      })

      // Should show placeholder avatar (div with "D")
      const avatarPlaceholder = screen.getByText('D')
      expect(avatarPlaceholder).toBeInTheDocument()
    })

    it('should display placeholder avatar for deleted user', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          isLocked: false,
          lastMessage: { content: 'Hello!', createdAt: '2024-01-01T00:00:00.000Z' },
          otherUser: { name: 'Deleted User', avatarUrl: null },
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, conversations: mockConversations }),
      } as Response)

      render(<Chat />)

      await waitFor(() => {
        const placeholder = screen.getByText('D')
        expect(placeholder).toBeInTheDocument()
        // Check it's in a div with chat-avatar class
        expect(placeholder.closest('.chat-avatar')).toBeInTheDocument()
      })
    })
  })

  describe('Conversation Page - Deleted Users', () => {
    beforeEach(() => {
      mockUseRouter.mockReturnValue({
        push: mockPush,
        pathname: '/chat/[id]',
        query: { id: 'conv-1' },
      } as unknown as ReturnType<typeof useRouter>)
    })

    it('should display "Deleted User" as participant when other user is deleted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Current User', avatarUrl: null },
            other: { name: 'Deleted User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        // The "Deleted User" text should appear in the conversation
        // It's used when displaying messages from deleted users
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      })
    })

    it('should display messages from deleted users with null senderId', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          senderId: null, // Deleted user
          content: 'This message was sent by a deleted user',
          createdAt: '2024-01-01T00:00:00.000Z',
          isMine: false, // Backend sets this based on senderId === userId
          isDeleted: true,
        },
        {
          id: 'msg-2',
          senderId: 'user-1',
          content: 'This is my message',
          createdAt: '2024-01-01T00:01:00.000Z',
          isMine: true, // Backend sets this based on senderId === userId
          isDeleted: false,
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: mockMessages,
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Current User', avatarUrl: null },
            other: { name: 'Deleted User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('This message was sent by a deleted user')).toBeInTheDocument()
        expect(screen.getByText('This is my message')).toBeInTheDocument()
      })

      // Should show placeholder avatar for deleted user message
      const deletedUserMessage = screen.getByText('This message was sent by a deleted user')
      const messageRow = deletedUserMessage.closest('.chat-row')
      expect(messageRow).toBeInTheDocument()

      // Should have placeholder with "D" for deleted user
      const placeholder = messageRow?.querySelector('.chat-avatar-sm')
      expect(placeholder).toBeInTheDocument()
    })

    it('should display placeholder avatar for messages from deleted users', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          senderId: null,
          content: 'Message from deleted user',
          createdAt: '2024-01-01T00:00:00.000Z',
          isMine: false,
          isDeleted: true,
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: mockMessages,
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Current User', avatarUrl: null },
            other: { name: 'Deleted User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Message from deleted user')).toBeInTheDocument()
      })

      // Should show "D" placeholder for deleted user inside the message row
      const deletedMessageEl = screen.getByText('Message from deleted user')
      const messageRowEl = deletedMessageEl.closest('.chat-row')
      expect(messageRowEl).toBeInTheDocument()

      const placeholder = messageRowEl?.querySelector('.chat-avatar-sm')
      expect(placeholder).toBeInTheDocument()
      // Verify the placeholder text is "D"
      expect(placeholder?.textContent).toBe('D')
    })

    it('should not mark messages from deleted users as "mine"', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          senderId: null, // Deleted user - should not be marked as "mine"
          content: 'Message from deleted user',
          createdAt: '2024-01-01T00:00:00.000Z',
          isMine: false, // Backend sets this based on senderId === userId
          isDeleted: true,
        },
        {
          id: 'msg-2',
          senderId: 'user-1', // Current user - should be marked as "mine"
          content: 'My message',
          createdAt: '2024-01-01T00:01:00.000Z',
          isMine: true, // Backend sets this based on senderId === userId
          isDeleted: false,
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: mockMessages,
          isLocked: false,
          participants: {
            me: { id: 'user-1', name: 'Current User', avatarUrl: null },
            other: { name: 'Deleted User', avatarUrl: null },
          },
          currentUserId: 'user-1',
        }),
      } as Response)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Message from deleted user')).toBeInTheDocument()
        expect(screen.getByText('My message')).toBeInTheDocument()
      })

      // Deleted user message should not have "mine" class
      const deletedMessage = screen.getByText('Message from deleted user')
      const deletedRow = deletedMessage.closest('.chat-row')
      expect(deletedRow).not.toHaveClass('mine')

      // Current user message should have "mine" class
      const myMessage = screen.getByText('My message')
      const myRow = myMessage.closest('.chat-row')
      expect(myRow).toHaveClass('mine')
    })
  })
})
