import { renderHook, act } from '@testing-library/react'
import { useToast } from '../../hooks/useToast'

describe('useToast', () => {
  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it('should add a toast with showToast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Test message', 'success')
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Test message')
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].id).toBeDefined()
  })

  it('should remove a toast with removeToast', () => {
    const { result } = renderHook(() => useToast())

    let toastId: string

    act(() => {
      result.current.showToast('Test message', 'success')
      toastId = result.current.toasts[0].id
    })

    expect(result.current.toasts).toHaveLength(1)

    act(() => {
      result.current.removeToast(toastId)
    })

    expect(result.current.toasts).toHaveLength(0)
  })

  it('should handle multiple toasts', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Message 1', 'success')
      result.current.showToast('Message 2', 'error')
      result.current.showToast('Message 3', 'warning')
    })

    expect(result.current.toasts).toHaveLength(3)
    expect(result.current.toasts[0].message).toBe('Message 1')
    expect(result.current.toasts[1].message).toBe('Message 2')
    expect(result.current.toasts[2].message).toBe('Message 3')
  })

  it('should support different toast types', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Success', 'success')
    })
    expect(result.current.toasts[0].type).toBe('success')

    act(() => {
      result.current.showToast('Error', 'error')
    })
    expect(result.current.toasts[1].type).toBe('error')

    act(() => {
      result.current.showToast('Warning', 'warning')
    })
    expect(result.current.toasts[2].type).toBe('warning')
  })
})

