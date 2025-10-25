// Utility function to make authenticated API calls
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const defaultOptions: RequestInit = {
    ...options,
    credentials: 'include', // Include cookies in requests
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, defaultOptions)

    // If unauthorized, redirect to login
    if (response.status === 401) {
      window.location.href = '/auth'
      throw new Error('Unauthorized')
    }

    return response
  } catch (error) {
    throw error
  }
}
