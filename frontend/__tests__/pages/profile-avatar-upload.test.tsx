import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import MyProfilePage from '../../pages/profile/index'
import { useSession } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

jest.mock('../../contexts/AuthContext', () => ({
  useSession: jest.fn(),
}))

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: jest.fn(),
}))

jest.mock('../../components/LoadingSpinner', () => {
  return function LoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>
  }
})

const mockPush = jest.fn()
const mockSignOut = jest.fn()

const mockUserData = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  age: 25,
  gender: 'Male',
  role: 'User',
  course: 'Computer Science',
  bio: 'Software developer',
  interests: ['Coding', 'Gaming'],
  avatarUrl: 'https://example.com/avatar.jpg',
  verified: true,
}

describe('Profile Avatar Upload Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      isReady: true,
      query: {},
    })
    ;(useTheme as jest.Mock).mockReturnValue({
      isDarkMode: false,
      toggleDarkMode: jest.fn(),
    })
    ;(useSession as jest.Mock).mockReturnValue({
      session: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      },
      status: 'authenticated',
      signOut: mockSignOut,
    })

    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            data: mockUserData,
          }),
      })
    ) as jest.Mock
  })

  it('should have a file input for avatar upload', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('should trigger file input when avatar edit button is clicked', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = jest.spyOn(fileInput, 'click')

    const editButton = screen.getByTitle('Change profile picture')
    fireEvent.click(editButton)

    expect(clickSpy).toHaveBeenCalled()
  })

  it('should upload avatar when file is selected', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockUserData }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { ...mockUserData, avatarUrl: 'data:image/png;base64,newimage' },
        }),
      })

    global.fetch = mockFetch as unknown as typeof fetch

    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
      result: 'data:image/png;base64,testimage',
    }

    global.FileReader = jest.fn(() => mockFileReader) as unknown as typeof FileReader

    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['test'], 'test.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', {
      value: [file],
    })

    fireEvent.change(fileInput)

    // Simulate FileReader onloadend
    await waitFor(() => {
      if (mockFileReader.onloadend) {
        mockFileReader.onloadend({} as ProgressEvent<FileReader>)
      }
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/user-123',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('avatarUrl'),
        })
      )
    })
  })

  it('should show error for non-image files', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput, 'files', {
      value: [file],
    })

    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('Please select an image file')).toBeInTheDocument()
    })
  })

  it('should show error for files larger than 5MB', async () => {
    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    // Create a mock file larger than 5MB
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png', { type: 'image/png' })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })
    Object.defineProperty(fileInput, 'files', {
      value: [largeFile],
    })

    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('Image size must be less than 5MB')).toBeInTheDocument()
    })
  })

  it('should display success message after successful upload', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockUserData }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { ...mockUserData, avatarUrl: 'data:image/png;base64,newimage' },
        }),
      })

    global.fetch = mockFetch as unknown as typeof fetch

    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
      result: 'data:image/png;base64,testimage',
    }

    global.FileReader = jest.fn(() => mockFileReader) as unknown as typeof FileReader

    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', {
      value: [file],
    })

    fireEvent.change(fileInput)

    await waitFor(() => {
      if (mockFileReader.onloadend) {
        mockFileReader.onloadend({} as ProgressEvent<FileReader>)
      }
    })

    await waitFor(() => {
      expect(screen.getByText('Profile picture updated successfully!')).toBeInTheDocument()
    })
  })

  it('should disable button while uploading', async () => {
    let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | undefined
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockUserData }),
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFetch = resolve
      }))

    global.fetch = mockFetch as unknown as typeof fetch

    const mockFileReader = {
      readAsDataURL: jest.fn(),
      onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
      result: 'data:image/png;base64,testimage',
    }

    global.FileReader = jest.fn(() => mockFileReader) as unknown as typeof FileReader

    render(<MyProfilePage />)

    await waitFor(() => {
      expect(screen.getByTitle('Change profile picture')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', {
      value: [file],
    })

    fireEvent.change(fileInput)

    await waitFor(() => {
      if (mockFileReader.onloadend) {
        mockFileReader.onloadend({} as ProgressEvent<FileReader>)
      }
    })

    await waitFor(() => {
      const button = screen.getByTitle('Change profile picture') as HTMLButtonElement
      expect(button.disabled).toBe(true)
    })

    // Clean up - resolve the pending promise
    if (resolveFetch) {
      resolveFetch({
        json: () => Promise.resolve({ success: true, data: mockUserData })
      })
    }
  })
})

