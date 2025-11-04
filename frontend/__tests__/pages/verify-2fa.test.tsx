import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import Verify2FA from '../../pages/verify-2fa'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: { [key: string]: string } = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

describe('2FA Verification Page', () => {
  const mockPush = jest.fn()
  const mockRouter = {
    push: mockPush,
    query: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(global.fetch as jest.Mock).mockClear()
    sessionStorageMock.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Rendering', () => {
    it('should render loading state initially without tempToken', () => {
      render(<Verify2FA />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should render 2FA form with valid tempToken', async () => {
      sessionStorageMock.setItem('tempToken', 'valid-temp-token')

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
        expect(
          screen.getByText(/we've sent a 6-digit verification code to your email/i)
        ).toBeInTheDocument()
      })

      // Check for 6 input boxes
      const inputBoxes = screen.getAllByRole('textbox')
      expect(inputBoxes.length).toBe(6)

      // Check for submit button
      expect(screen.getByRole('button', { name: /verify code/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByText("Didn't receive the code?")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument()
    })

    it('should redirect to auth page if no tempToken', async () => {
      render(<Verify2FA />)

      // Should show error toast and redirect
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith('/auth')
        },
        { timeout: 4000 }
      )
    })
  })

  describe('Code Input', () => {
    beforeEach(() => {
      sessionStorageMock.setItem('tempToken', 'valid-temp-token')
    })

    it('should accept 6 digit code input', async () => {
      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input, index) => {
        fireEvent.change(input, { target: { value: (index + 1).toString() } })
      })

      await waitFor(() => {
        inputs.forEach((input, index) => {
          expect(input).toHaveValue((index + 1).toString())
        })
      })
    })

    it('should auto-focus next input on digit entry', async () => {
      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      fireEvent.change(inputs[0], { target: { value: '1' } })

      // Next input should be focused
      expect(inputs[1]).toHaveFocus()
    })

    it('should handle backspace to go to previous input when current is empty', async () => {
      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')

      // Fill first input and move to second
      fireEvent.change(inputs[0], { target: { value: '1' } })

      // Press backspace on second input (which is empty) - should move to first
      fireEvent.keyDown(inputs[1], { key: 'Backspace', code: 'Backspace' })

      expect(inputs[0]).toHaveFocus()
    })

    it('should handle paste of 6-digit code', async () => {
      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      // Mock clipboardData object
      const clipboardData = {
        getData: (type: string) => {
          if (type === 'text') {
            return '123456'
          }
          return ''
        },
      }

      fireEvent.paste(inputs[0], { clipboardData })

      await waitFor(() => {
        expect(inputs[0]).toHaveValue('1')
        expect(inputs[1]).toHaveValue('2')
        expect(inputs[2]).toHaveValue('3')
        expect(inputs[3]).toHaveValue('4')
        expect(inputs[4]).toHaveValue('5')
        expect(inputs[5]).toHaveValue('6')
      })
    })

    it('should disable submit button until 6 digits entered', async () => {
      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const submitButton = screen.getByRole('button', { name: /verify code/i })
      expect(submitButton).toBeDisabled()

      // Enter 5 digits
      const inputs = screen.getAllByRole('textbox')
      inputs.slice(0, 5).forEach((input, i) => {
        fireEvent.change(input, { target: { value: (i + 1).toString() } })
      })

      expect(submitButton).toBeDisabled()

      // Enter 6th digit
      fireEvent.change(inputs[5], { target: { value: '6' } })

      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Form Submission', () => {
    beforeEach(() => {
      sessionStorageMock.setItem('tempToken', 'valid-temp-token')
    })

    it('should successfully verify code and redirect', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Login successful',
        }),
        headers: new Headers(),
      })

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input, index) => {
        fireEvent.change(input, { target: { value: (index + 1).toString() } })
      })

      const submitButton = screen.getByRole('button', { name: /verify code/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempToken: 'valid-temp-token',
            code: '123456',
          }),
        })
      })

      await waitFor(() => {
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tempToken')
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('should handle invalid code error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Invalid verification code',
        }),
      })

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input, index) => {
        fireEvent.change(input, { target: { value: (index + 1).toString() } })
      })

      const submitButton = screen.getByRole('button', { name: /verify code/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        // Inputs should be cleared
        inputs.forEach((input) => {
          expect(input).toHaveValue('')
        })
      })

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input, index) => {
        fireEvent.change(input, { target: { value: (index + 1).toString() } })
      })

      const submitButton = screen.getByRole('button', { name: /verify code/i })
      fireEvent.click(submitButton)

      // Wait for the async error handling to complete and toast to appear
      await waitFor(() => {
        expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument()
      })

      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalledWith('2FA verification error:', expect.any(Error))

      // Should not redirect on error
      expect(mockPush).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should show loading state during submission', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ success: true, message: 'Login successful' }),
                headers: new Headers(),
              })
            }, 100)
          )
      )

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input, index) => {
        fireEvent.change(input, { target: { value: (index + 1).toString() } })
      })

      const submitButton = screen.getByRole('button', { name: /verify code/i })
      fireEvent.click(submitButton)

      // Should show verifying state
      expect(screen.getByText('Verifying...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Cancel Button', () => {
    beforeEach(() => {
      sessionStorageMock.setItem('tempToken', 'valid-temp-token')
    })

    it('should redirect to auth page on cancel', async () => {
      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockPush).toHaveBeenCalledWith('/auth')
    })
  })

  describe('Resend Code', () => {
    beforeEach(() => {
      sessionStorageMock.setItem('tempToken', 'valid-temp-token')
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should successfully resend code', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Verification code sent successfully. Please check your email.',
        }),
      })

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend code/i })
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/resend-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempToken: 'valid-temp-token' }),
        })
      })
    })

    it('should show cooldown timer after resend', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Verification code sent successfully. Please check your email.',
        }),
      })

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend code/i })
      fireEvent.click(resendButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /resend in/i })).toBeInTheDocument()
      })

      expect(resendButton).toBeDisabled()
    })

    it('should clear inputs after resend', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Verification code sent successfully. Please check your email.',
        }),
      })

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      // Fill some inputs
      const inputs = screen.getAllByRole('textbox')
      inputs.slice(0, 3).forEach((input, i) => {
        fireEvent.change(input, { target: { value: (i + 1).toString() } })
      })

      const resendButton = screen.getByRole('button', { name: /resend code/i })
      fireEvent.click(resendButton)

      await waitFor(() => {
        inputs.forEach((input) => {
          expect(input).toHaveValue('')
        })
      })
    })

    it('should handle resend errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Failed to resend code',
        }),
      })

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend code/i })
      fireEvent.click(resendButton)

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(resendButton).not.toBeDisabled()
      })
    })

    it('should be disabled during loading', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ success: true }),
              })
            }, 100)
          )
      )

      render(<Verify2FA />)

      await waitFor(() => {
        expect(screen.getByText('Verify Your Identity')).toBeInTheDocument()
      })

      const resendButton = screen.getByRole('button', { name: /resend code/i })
      fireEvent.click(resendButton)

      expect(resendButton.textContent).toContain('Sending...')
    })
  })
})
